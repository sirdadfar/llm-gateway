import { registerAs } from '@nestjs/config';
import Joi from 'joi';

export const config = registerAs('app', () => {
  const values = { port: Number(process.env.PORT ?? 3000), timeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 60000), retries: Number(process.env.PROVIDER_RETRIES ?? 1) };
  const schema = Joi.object({ port: Joi.number().port().required(), timeoutMs: Joi.number().integer().min(100).required(), retries: Joi.number().integer().min(0).max(5).required() });
  const { error } = schema.validate(values);
  if (error) throw error;
  return {
    ...values,
    enabledProviders: (process.env.ENABLED_PROVIDERS ?? '').split(',').map((x) => x.trim()).filter(Boolean),
    fallbackEnabled: process.env.FALLBACK_ENABLED === 'true',
    fallbackModels: (process.env.FALLBACK_MODELS ?? '').split(',').map((x) => x.trim()).filter(Boolean),
    cacheEnabled: process.env.CACHE_ENABLED !== 'false',
    cacheTtl: Number(process.env.CACHE_TTL_SECONDS ?? 300),
    rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    defaultRpm: Number(process.env.DEFAULT_RPM ?? 60),
    defaultQuota: Number(process.env.DEFAULT_MONTHLY_TOKEN_QUOTA ?? 0),
    promptLogging: process.env.LOG_PROMPTS === 'true',
  };
});