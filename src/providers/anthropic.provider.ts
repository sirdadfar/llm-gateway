import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { ChatRequest, ChatResult, LLMProvider, StreamChunk } from './llm-provider.interface';

@Injectable()
export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private readonly client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || 'disabled',
    timeout: Number(process.env.REQUEST_TIMEOUT_MS ?? 60000),
    maxRetries: Number(process.env.PROVIDER_RETRIES ?? 1),
  });

  private split(request: ChatRequest) {
    const system = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => (typeof message.content === 'string' ? message.content : ''))
      .join('\n');

    const messages = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content:
          typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
      }));

    return { system, messages };
  }

  async chat(request: ChatRequest, signal?: AbortSignal): Promise<ChatResult> {
    const prompt = this.split(request);
    const response = await this.client.messages.create(
      {
        model: request.model,
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature,
        top_p: request.topP,
        system: prompt.system || undefined,
        messages: prompt.messages,
      },
      { signal },
    );

    const content = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      id: response.id,
      model: response.model,
      content,
      finishReason: response.stop_reason ?? 'stop',
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async *chatStream(request: ChatRequest, signal?: AbortSignal): AsyncIterable<StreamChunk> {
    const prompt = this.split(request);
    const id = randomUUID();
    const stream = this.client.messages.stream(
      {
        model: request.model,
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature,
        top_p: request.topP,
        system: prompt.system || undefined,
        messages: prompt.messages,
      },
      { signal },
    );

    let promptTokens = 0;

    for await (const event of stream) {
      if (event.type === 'message_start') {
        promptTokens = event.message.usage.input_tokens;
      }

      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { id, model: request.model, delta: event.delta.text };
      }

      if (event.type === 'message_delta') {
        const completionTokens = event.usage.output_tokens;
        yield {
          id,
          model: request.model,
          delta: '',
          finishReason: event.delta.stop_reason ?? undefined,
          usage: {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
          },
        };
      }
    }
  }

  async listModels(): Promise<string[]> {
    return ['claude-3-5-sonnet-latest', 'claude-3-7-sonnet-latest', 'claude-sonnet-4-5'];
  }

  async healthCheck(): Promise<boolean> {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }
}