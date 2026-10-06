import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RateLimitService {
  private readonly redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  private readonly script = "local k=KEYS[1];local now=tonumber(ARGV[1]);local window=tonumber(ARGV[2]);local limit=tonumber(ARGV[3]);redis.call('ZREMRANGEBYSCORE',k,0,now-window);local count=redis.call('ZCARD',k);if count>=limit then local first=redis.call('ZRANGE',k,0,0,'WITHSCORES');local reset=tonumber(first[2] or now)+window;return {0,limit-count,reset} end;redis.call('ZADD',k,now,ARGV[4]);redis.call('EXPIRE',k,math.ceil(window/1000)+1);return {1,limit-count-1,now+window}";
  async consume(key:string,limit:number):Promise<{allowed:boolean;remaining:number;reset:number}>{const now=Date.now();const r=await this.redis.eval(this.script,1,'llm:rl:'+key,now,60000,limit,String(now)+':'+Math.random());const a=r as number[];return{allowed:Number(a[0])===1,remaining:Math.max(0,Number(a[1])),reset:Number(a[2])}}
  async quota(key:string,n:number,limit:number):Promise<boolean>{if(limit<=0)return true;const k='llm:quota:'+new Date().toISOString().slice(0,7)+':'+key,total=await this.redis.incrby(k,n);if(total===n)await this.redis.expire(k,3024000);return total<=limit}
}