import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { createHash } from 'crypto';

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}

@Injectable()
export class CacheService {
  private readonly redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  private readonly enabled = process.env.CACHE_ENABLED !== 'false';
  private readonly ttl = Number(process.env.CACHE_TTL_SECONDS ?? 300);

  key(input: unknown): string {
    return 'llm:cache:' + createHash('sha256').update(JSON.stringify(stable(input))).digest('hex');
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) return null;
    const value = await this.redis.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async set(key: string, value: unknown): Promise<void> {
    if (!this.enabled) return;
    await this.redis.set(key, JSON.stringify(value), 'EX', this.ttl);
  }
}