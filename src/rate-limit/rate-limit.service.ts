import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
}

@Injectable()
export class RateLimitService {
  private readonly redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  private readonly script = [
    "local key=KEYS[1]",
    "local now=tonumber(ARGV[1])",
    "local window=tonumber(ARGV[2])",
    "local limit=tonumber(ARGV[3])",
    "local member=ARGV[4]",
    "redis.call('ZREMRANGEBYSCORE',key,0,now-window)",
    "local count=redis.call('ZCARD',key)",
    "if count>=limit then",
    "  local first=redis.call('ZRANGE',key,0,0,'WITHSCORES')",
    "  local reset=tonumber(first[2] or now)+window",
    "  return {0,0,reset}",
    "end",
    "redis.call('ZADD',key,now,member)",
    "redis.call('EXPIRE',key,math.ceil(window/1000)+1)",
    "return {1,limit-count-1,now+window}",
  ].join(';');

  async consume(key: string, limit: number, requestId: string): Promise<RateLimitResult> {
    const now = Date.now();
    const result = (await this.redis.eval(
      this.script,
      1,
      'llm:rl:' + key,
      now,
      60000,
      limit,
      requestId + ':' + now + ':' + randomUUID(),
    )) as number[];

    return {
      allowed: Number(result[0]) === 1,
      remaining: Math.max(0, Number(result[1])),
      reset: Number(result[2]),
    };
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async quotaRemaining(key: string, limit: number): Promise<number> {
    if (limit <= 0) return Number.MAX_SAFE_INTEGER;
    const month = new Date().toISOString().slice(0, 7);
    const value = await this.redis.get('llm:quota:' + month + ':' + key);
    return Math.max(0, limit - Number(value ?? 0));
  }

  async consumeQuota(key: string, tokens: number, limit: number): Promise<boolean> {
    if (limit <= 0 || tokens <= 0) return true;
    const month = new Date().toISOString().slice(0, 7);
    const quotaKey = 'llm:quota:' + month + ':' + key;
    const total = await this.redis.incrby(quotaKey, tokens);
    if (total === tokens) await this.redis.expire(quotaKey, 35 * 24 * 60 * 60);
    return total <= limit;
  }
}