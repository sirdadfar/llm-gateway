import { Module } from '@nestjs/common';
import { AnthropicProvider } from './anthropic.provider';
import { OllamaProvider } from './ollama.provider';
import { OpenAIProvider } from './openai.provider';
import { ProviderRegistry } from './provider.registry';
@Module({ providers: [OpenAIProvider, AnthropicProvider, OllamaProvider, ProviderRegistry], exports: [ProviderRegistry, OpenAIProvider, AnthropicProvider, OllamaProvider] })
export class ProvidersModule {}