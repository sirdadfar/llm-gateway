import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import { OpenAIError } from '../common/openai-error';
import { ApiKey } from '../auth/api-key.entity';
import { RateLimitService } from './rate-limit.service';

type GatewayRequest = Request & { apiKey: ApiKey; id?: string };

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly limiter: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GatewayRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    if (process.env.RATE_LIMIT_ENABLED === 'false') return true;

    let result;
    try {
      result = await this.limiter.consume(request.apiKey.id, Math.max(1, request.apiKey.requestsPerMinute), request.id ?? 'request');
    } catch {
      throw new OpenAIError('Rate limiting service is unavailable', 'server_error', 'rate_limit_unavailable', 503);
    }

    response.setHeader('X-RateLimit-Limit', request.apiKey.requestsPerMinute);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', Math.ceil(result.reset / 1000));

    if (!result.allowed) {
      response.setHeader('Retry-After', Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)));
      throw new OpenAIError('Rate limit exceeded', 'rate_limit_error', 'rate_limit_exceeded', 429);
    }

    return true;
  }
}