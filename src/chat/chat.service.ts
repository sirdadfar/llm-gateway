import { Injectable } from '@nestjs/common';
import { ApiKey } from '../auth/api-key.entity';
import { CacheService } from '../cache/cache.service';
import { OpenAIError } from '../common/openai-error';
import { ChatRequest, ChatResult, StreamChunk } from '../providers/llm-provider.interface';
import { ProviderRegistry } from '../providers/provider.registry';
import { UsageService } from '../usage/usage.service';
import { ChatCompletionDto } from './dto/chat-completion.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly cache: CacheService,
    private readonly usage: UsageService,
  ) {}

  private normalized(dto: ChatCompletionDto): ChatRequest {
    return {
      model: this.registry.canonicalModel(dto.model),
      messages: dto.messages,
      temperature: dto.temperature,
      maxTokens: dto.max_tokens,
      topP: dto.top_p,
      stop: dto.stop,
    };
  }

  private assertModelAllowed(dto: ChatCompletionDto, key: ApiKey): void {
    if (!key.allowedModels.length) return;

    const requested = dto.model;
    const canonical = this.registry.canonicalModel(requested);
    if (!key.allowedModels.includes(requested) && !key.allowedModels.includes(canonical)) {
      throw new OpenAIError('Model is not allowed for this API key', 'permission_error', 'model_not_allowed', 403);
    }
  }

  private canUseCache(dto: ChatCompletionDto, headers: Record<string, string | undefined>): boolean {
    return (
      dto.stream !== true &&
      (dto.temperature === 0 || headers['x-cache'] === 'enable') &&
      headers['cache-control'] !== 'no-cache'
    );
  }

  private async recordError(
    key: ApiKey,
    provider: string,
    model: string,
    stream: boolean,
    startedAt: number,
    error: unknown,
  ): Promise<void> {
    await this.usage.record({
      apiKeyId: key.id,
      provider,
      model,
      status: 'error',
      stream,
      latencyMs: Date.now() - startedAt,
      errorCode: error instanceof OpenAIError ? error.code : 'provider_error',
    });
  }

  async complete(
    dto: ChatCompletionDto,
    key: ApiKey,
    headers: Record<string, string | undefined>,
  ): Promise<{ body: Record<string, unknown>; cache: 'HIT' | 'MISS' }> {
    this.assertModelAllowed(dto, key);

    const provider = this.registry.resolve(dto.model);
    const request = this.normalized(dto);
    const useCache = this.canUseCache(dto, headers);
    const cacheKey = this.cache.key(request);
    const startedAt = Date.now();

    if (useCache) {
      const cached = await this.cache.get<Record<string, unknown>>(cacheKey);
      if (cached) {
        void this.usage.record({
          apiKeyId: key.id,
          provider: provider.name,
          model: request.model,
          status: 'success',
          cached: true,
          stream: false,
          latencyMs: Date.now() - startedAt,
        });
        return { body: cached, cache: 'HIT' };
      }
    }

    let result: ChatResult;
    let usedProvider = provider;

    try {
      result = await provider.chat(request);
    } catch (error) {
      const fallback = this.fallbackFor(error, dto.model);

      if (!fallback) {
        await this.recordError(key, provider.name, request.model, false, startedAt, error);
        throw error;
      }

      try {
        usedProvider = fallback.provider;
        result = await usedProvider.chat({ ...request, model: fallback.model });
      } catch (fallbackError) {
        await this.recordError(key, usedProvider.name, fallback.model, false, startedAt, fallbackError);
        throw fallbackError;
      }
    }

    const body: Record<string, unknown> = {
      id: result.id,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: dto.model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: result.content },
          finish_reason: result.finishReason,
        },
      ],
      usage: {
        prompt_tokens: result.usage.promptTokens,
        completion_tokens: result.usage.completionTokens,
        total_tokens: result.usage.totalTokens,
      },
    };

    if (useCache) await this.cache.set(cacheKey, body);

    void this.usage.record({
      apiKeyId: key.id,
      provider: usedProvider.name,
      model: result.model,
      status: 'success',
      cached: false,
      stream: false,
      latencyMs: Date.now() - startedAt,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
    });

    return { body, cache: 'MISS' };
  }

  private fallbackFor(
    error: unknown,
    requestedModel: string,
  ): { provider: ReturnType<ProviderRegistry['resolve']>; model: string } | null {
    if (process.env.FALLBACK_ENABLED !== 'true' || !this.isRetryableProviderError(error)) return null;

    const candidates = (process.env.FALLBACK_MODELS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((model) => model !== requestedModel);

    for (const model of candidates) {
      try {
        return {
          provider: this.registry.resolve(model),
          model: this.registry.canonicalModel(model),
        };
      } catch {
        // Ignore invalid or disabled fallback candidates.
      }
    }

    return null;
  }

  private isRetryableProviderError(error: unknown): boolean {
    if (error instanceof OpenAIError) return error.status === 408 || error.status >= 500;
    if (!error || typeof error !== 'object') return false;

    const status = (error as { status?: unknown }).status;
    return status === 408 || (typeof status === 'number' && status >= 500);
  }

  async *stream(dto: ChatCompletionDto, key: ApiKey, signal: AbortSignal): AsyncIterable<StreamChunk> {
    this.assertModelAllowed(dto, key);

    const provider = this.registry.resolve(dto.model);
    const model = this.registry.canonicalModel(dto.model);
    const startedAt = Date.now();
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    try {
      for await (const chunk of provider.chatStream(this.normalized(dto), signal)) {
        if (chunk.usage) {
          promptTokens = chunk.usage.promptTokens;
          completionTokens = chunk.usage.completionTokens;
          totalTokens = chunk.usage.totalTokens;
        }
        yield chunk;
      }

      void this.usage.record({
        apiKeyId: key.id,
        provider: provider.name,
        model,
        status: 'success',
        stream: true,
        latencyMs: Date.now() - startedAt,
        promptTokens,
        completionTokens,
        totalTokens,
      });
    } catch (error) {
      await this.recordError(key, provider.name, model, true, startedAt, error);
      throw error;
    }
  }
}