import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import { OpenAIError } from '../common/openai-error';
import { ApiKey } from '../auth/api-key.entity';
import { ChatCompletionDto } from '../chat/dto/chat-completion.dto';
import { RateLimitService } from './rate-limit.service';

type GatewayRequest = Request & { apiKey: ApiKey };

@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(private readonly limiter: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GatewayRequest & { body: ChatCompletionDto }>();
    const response = context.switchToHttp().getResponse<Response>();
    const limit = Number(request.apiKey.monthlyTokenQuota);

    if (limit <= 0) return true;

    try {
      const remaining = await this.limiter.quotaRemaining(request.apiKey.id, limit);
      response.setHeader('X-Quota-Limit', limit);
      response.setHeader('X-Quota-Remaining', remaining);

      if (remaining <= 0) {
        throw new OpenAIError('Monthly token quota exceeded', 'rate_limit_error', 'monthly_quota_exceeded', 429);
      }

      const inputCharacters = request.body.messages.reduce(
        (total, message) => total + message.content.length,
        0,
      );
      const estimatedInput = Math.ceil(inputCharacters / 4);
      const estimatedOutput = request.body.max_tokens ?? 1024;
      const estimatedCost = estimatedInput + estimatedOutput;

      if (estimatedCost > remaining) {
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