import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ChatRequest, ChatResult, LLMProvider, StreamChunk } from './llm-provider.interface';

@Injectable()
export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  private readonly base = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '');
  private readonly timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 60000);

  private signal(signal?: AbortSignal): AbortSignal {
    const timeout = AbortSignal.timeout(this.timeoutMs);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
  }

  private payload(request: ChatRequest, stream: boolean) {
    return {
      model: request.model.replace(/^ollama\//, ''),
      messages: request.messages,
      stream,
      options: {
        ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
        ...(request.maxTokens === undefined ? {} : { num_predict: request.maxTokens }),
        ...(request.topP === undefined ? {} : { top_p: request.topP }),
      },
    };
  }

  async chat(request: ChatRequest, signal?: AbortSignal): Promise<ChatResult> {
    const response = await fetch(this.base + '/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(this.payload(request, false)),
      signal: this.signal(signal),
    });

    if (!response.ok) {
      throw new Error('Ollama returned HTTP ' + response.status);
    }

    const data = (await response.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
      done_reason?: string;
    };
    const promptTokens = data.prompt_eval_count ?? 0;
    const completionTokens = data.eval_count ?? 0;

    return {
      id: randomUUID(),
      model: request.model,
      content: data.message?.content ?? '',
      finishReason: data.done_reason ?? 'stop',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }

  async *chatStream(request: ChatRequest, signal?: AbortSignal): AsyncIterable<StreamChunk> {
    const response = await fetch(this.base + '/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(this.payload(request, true)),
      signal: this.signal(signal),
    });

    if (!response.ok || !response.body) {
      throw new Error('Ollama returned HTTP ' + response.status);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const id = randomUUID();

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const data = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
            done_reason?: string;
            prompt_eval_count?: number;
            eval_count?: number;
          };

          const promptTokens = data.prompt_eval_count ?? 0;
          const completionTokens = data.eval_count ?? 0;

          yield {
            id,
            model: request.model,
            delta: data.message?.content ?? '',
            finishReason: data.done ? data.done_reason ?? 'stop' : undefined,
            usage: data.done
              ? {
                  promptTokens,
                  completionTokens,
                  totalTokens: promptTokens + completionTokens,
                }
              : undefined,
          };
        }
      }

      if (buffer.trim()) {
        const data = JSON.parse(buffer) as { message?: { content?: string }; done?: boolean };
        if (data.message?.content) yield { id, model: request.model, delta: data.message.content };
      }
    } finally {
      reader.releaseLock();
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(this.base + '/api/tags', { signal: this.signal() });
      if (!response.ok) return [];
      const data = (await response.json()) as { models?: Array<{ name: string }> };
      return (data.models ?? []).map((model) => 'ollama/' + model.name);
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.base, { signal: this.signal() });
      return response.ok;
    } catch {
      return false;
    }
  }
}