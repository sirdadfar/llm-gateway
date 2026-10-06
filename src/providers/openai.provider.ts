import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import { ChatRequest, ChatResult, LLMProvider, StreamChunk } from './llm-provider.interface';

@Injectable()
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private readonly client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'disabled', timeout: Number(process.env.REQUEST_TIMEOUT_MS ?? 60000), maxRetries: Number(process.env.PROVIDER_RETRIES ?? 1) });
  async chat(r: ChatRequest, signal?: AbortSignal): Promise<ChatResult> {
    const x = await this.client.chat.completions.create({ model: r.model, messages: r.messages as never[], temperature: r.temperature, max_tokens: r.maxTokens, top_p: r.topP, stop: r.stop }, { signal });
    const c = x.choices[0];
    return { id: x.id, model: x.model, content: typeof c?.message?.content === 'string' ? c.message.content : '', finishReason: c?.finish_reason ?? 'stop', usage: { promptTokens: x.usage?.prompt_tokens ?? 0, completionTokens: x.usage?.completion_tokens ?? 0, totalTokens: x.usage?.total_tokens ?? 0 } };
  }
  async *chatStream(r: ChatRequest, signal?: AbortSignal): AsyncIterable<StreamChunk> {
    const stream = await this.client.chat.completions.create({ model:r.model, messages:r.messages as never[], temperature:r.temperature, max_tokens:r.maxTokens, top_p:r.topP, stop:r.stop, stream:true, stream_options:{include_usage:true} }, {signal});
    for await (const x of stream) {
      const choice=x.choices[0];
      yield { id:x.id, model:x.model, delta:choice?.delta?.content ?? '', role:choice?.delta?.role, finishReason:choice?.finish_reason ?? undefined, usage:x.usage ? {promptTokens:x.usage.prompt_tokens,completionTokens:x.usage.completion_tokens,totalTokens:x.usage.total_tokens}:undefined };
    }
  }
  async listModels(): Promise<string[]> { const x=await this.client.models.list(); return x.data.map(m=>m.id).filter(id=>id.startsWith('gpt-')||id.startsWith('o')); }
  async healthCheck(): Promise<boolean> { if (!process.env.OPENAI_API_KEY) return false; try { await this.client.models.list(); return true; } catch { return false; } }
}