import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { OpenAIError } from '../openai-error';

@Catch()
export class OpenAIExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const e = exception instanceof OpenAIError ? exception : null;
    const status = e?.status ?? (exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR);
    const message = e?.message ?? (exception instanceof HttpException ? String(exception.getResponse()) : 'Internal server error');
    response.status(status).json({ error: { message, type: e?.type ?? (status >= 500 ? 'server_error' : 'invalid_request_error'), code: e?.code ?? null } });
  }
}