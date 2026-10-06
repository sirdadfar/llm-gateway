import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { OpenAIError } from '../common/openai-error';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_API_KEY;

    if (!expected) {
      throw new OpenAIError('Admin API is not configured', 'server_error', 'admin_not_configured', 503);
    }

    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    const provided = request.headers.authorization?.startsWith('Bearer ')
      ? request.headers.authorization.slice(7)
      : '';

    const left = Buffer.from(provided);
    const right = Buffer.from(expected);
    const valid =
      left.length === right.length && timingSafeEqual(left, right);

    if (!valid) {
      throw new OpenAIError('Invalid admin API key', 'authentication_error', 'invalid_api_key', 401);
    }

    return true;
  }
}