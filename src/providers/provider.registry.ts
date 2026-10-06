import { Injectable } from '@nestjs/common';
import { OpenAIError } from '../common/openai-error';
import { LLMProvider } from './llm-provider.interface';
import { AnthropicProvider } from './anthropic.provider';
import { OllamaProvider } from './ollama.provider';
import { OpenAIProvider } from './openai.provider';

type Routes = Record<string, string[]>;

@Injectable()
export class ProviderRegistry {
  private readonly routes: Routes = this.read('MODEL_ROUTES_JSON', {
    openai: ['gpt-*', 'o1*', 'o3*', 'o4*'],
    anthropic: ['claude-*'],
    ollama: ['ollama/*'],
  });

  private readonly aliases: Record<string, string> = this.read('MODEL_ALIASES_JSON', {
    fast: 'gpt-4o-mini',
    smart: 'claude-sonnet-4-5',
  });

  constructor(
    private readonly openai: OpenAIProvider,
    private readonly anthropic: AnthropicProvider,
    private readonly ollama: OllamaProvider,
  ) {}

  private read<T>(key: string, fallback: T): T {
    try {
      return process.env[key] ? (JSON.parse(process.env[key]!) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private enabledProviders(): Set<string> {
    return new Set(
      (process.env.ENABLED_PROVIDERS ?? 'openai,anthropic,ollama')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  private provider(name: string): LLMProvider {
    if (!this.enabledProviders().has(name)) {
      throw new OpenAIError(
        'Provider is disabled',
        'service_unavailable',
        'provider_disabled',
        503,
      );
    }

    const provider = { openai: this.openai, anthropic: this.anthropic, ollama: this.ollama }[name];
    if (!provider) {
      throw new OpenAIError(
        'Provider is not configured',
        'server_error',
        'provider_not_found',
        503,
      );
    }

    return provider;
  }

  canonicalModel(model: string): string {
    return this.aliases[model] ?? model;
  }

  resolve(model: string): LLMProvider {
    const resolved = this.canonicalModel(model);

    for (const [name, patterns] of Object.entries(this.routes)) {
      if (!this.enabledProviders().has(name)) continue;

      for (const pattern of patterns) {
        if (pattern.endsWith('/*') && resolved.startsWith(pattern.slice(0, -1))) {
          return this.provider(name);
        }

        if (pattern.endsWith('*') && resolved.startsWith(pattern.slice(0, -1))) {
          return this.provider(name);
        }

        if (pattern === resolved) {
          return this.provider(name);
        }
      }
    }

    throw new OpenAIError(
      'Unknown model: ' + model,
      'invalid_request_error',
      'model_not_found',
      404,
    );
  }

  all(): LLMProvider[] {
    const providers = {
      openai: this.openai,
      anthropic: this.anthropic,
      ollama: this.ollama,
    };

    return [...this.enabledProviders()]
      .map((name) => providers[name as keyof typeof providers])
      .filter((provider): provider is LLMProvider => Boolean(provider));
  }
}