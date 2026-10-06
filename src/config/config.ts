import { registerAs } from '@nestjs/config';
import Joi from 'joi';

export const config = registerAs('app', () => {
  const values = {
    port: Number(process.env.PORT ?? 3000),
    timeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 60000),
    retries: Number(process.env.PROVIDER_RETRIES ?? 1),
    bodyLimit: process.env.BODY_LIMIT ?? '1mb',
    defaultRpm: Number(process.env.DEFAULT_RPM ?? 60),
    cacheTtl: Number(process.env.CACHE_TTL_SECONDS ?? 300),
    defaultQuota: Number(process.env.DEFAULT_MONTHLY_TOKEN_QUOTA ?? 0),
  };

  const schema = Joi.object({
    port: Joi.number().port().required(),
    timeoutMs: Joi.number().integer().min(100).max(300000).required(),
    retries: Joi.number().integer().min(0).max(5).required(),
    bodyLimit: Joi.string().pattern(/^\\d+(kb|mb|gb)$/i).required(),
    defaultRpm: Joi.number().integer().min(1).max(100000).required(),
    cacheTtl: Joi.number().integer().min(1).max(86400).required(),
    defaultQuota: Joi.number().integer().min(0).required(),
  });

  const { error } = schema.validate(values);
  if (error) throw error;

  const csv = (value: string | undefined): string[] =>
    (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);

  return {
    ...values,
    enabledProviders: csv(process.env.ENABLED_PROVIDERS ?? 'openai,anthropic,ollama'),
    fallbackEnabled: process.env.FALLBACK_ENABLED === 'true',
    fallbackModels: csv(process.env.FALLBACK_MODELS),
    cacheEnabled: process.env.CACHE_ENABLED !== 'false',
    rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    promptLogging: process.env.LOG_PROMPTS === 'true',
  };
});