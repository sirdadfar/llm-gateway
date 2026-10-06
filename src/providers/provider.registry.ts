import { Injectable } from '@nestjs/common';
import { OpenAIError } from '../common/openai-error';
import { LLMProvider } from './llm-provider.interface';
import { AnthropicProvider } from './anthropic.provider';
import { OllamaProvider } from './ollama.provider';
import { OpenAIProvider } from './openai.provider';

@Injectable()
export class ProviderRegistry {
  constructor(private readonly openai: OpenAIProvider, private readonly anthropic: AnthropicProvider, private readonly ollama: OllamaProvider) {}
  resolve(model: string): LLMProvider {
    if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')) return this.openai;
    if (model.startsWith('claude-')) return this.anthropic;
    if (model.startsWith('ollama/')) return this.ollama;
    if (model === 'fast' || model === 'smart') return model === 'fast' ? this.openai : this.anthropic;
    throw new OpenAIError(`Unknown model: ${model}`, 'invalid_request_error', 'model_not_found', 404);
  }
  all(): LLMProvider[] { return [this.openai, this.anthropic, this.ollama].filter((p) => (process.env.ENABLED_PROVIDERS ?? '').split(',').includes(p.name)); }
}