import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import { OpenAIError } from '../common/openai-error';
import { ApiKey } from '../auth/api-key.entity';
import { RateLimitService } from './rate-limit.service';

type GatewayRequest = Request & { apiKey: ApiKey; body?: unknown };

@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(private readonly limiter: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GatewayRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const limit = Number(request.apiKey.monthlyTokenQuota);

    if (limit <= 0) return true;

    try {
      const remaining = await this.limiter.quotaRemaining(request.apiKey.id, limit);
      response.setHeader('X-Quota-Limit', limit);
      response.setHeader('X-Quota-Remaining', remaining);

      if (remaining <= 0) {
        throw new OpenAIError(
          'Monthly token quota exceeded',
          'rate_limit_error',
          'monthly_quota_exceeded',
          429,
        );
      }

      const body =
        request.body && typeof request.body === 'object'
          ? (request.body as Record<string, unknown>)
          : {};
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const inputCharacters = messages.reduce((total, message) => {
        if (!message || typeof message !== 'object') return total;
        const content = (message as Record<string, unknown>).content;
        return total + (typeof content === 'string' ? content.length : 0);
      }, 0);
      const maxTokens = typeof body.max_tokens === 'number' && body.max_tokens > 0 ? body.max_tokens : 1024;
      const estimatedCost = Math.ceil(inputCharacters / 4) + maxTokens;

      if (messages.length > 0 && estimatedCost > remaining) {
        throw new OpenAIError(
          'Request exceeds the remaining monthly token quota',
          'rate_limit_error',
          'monthly_quota_exceeded',
          429,
        );
      }
    } catch (error) {
      if (error instanceof OpenAIError) throw error;
      throw new OpenAIError('Quota service is unavailable', 'server_error', 'quota_unavailable', 503);
    }

    return true;
  }
}