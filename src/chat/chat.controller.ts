import { Body, Controller, Headers, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ApiKey } from '../auth/api-key.entity';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { QuotaGuard } from '../rate-limit/quota.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { ChatCompletionDto } from './dto/chat-completion.dto';
import { ChatService } from './chat.service';

type AuthenticatedRequest = Request & { apiKey: ApiKey };

@ApiTags('chat')
@ApiBearerAuth()
@Controller('v1/chat')
@UseGuards(ApiKeyGuard, RateLimitGuard, QuotaGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('completions')
  @ApiOperation({ summary: 'Create an OpenAI-compatible chat completion' })
  async completions(
    @Body() dto: ChatCompletionDto,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    if (!dto.stream) {
      const result = await this.chat.complete(dto, request.apiKey, headers);
      response.setHeader('X-Cache', result.cache);
      return response.json(result.body);
    }

    const controller = new AbortController();
    request.on('close', () => {
      if (!response.writableEnded) controller.abort();
    });

    response.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.flushHeaders();

    try {
      for await (const chunk of this.chat.stream(dto, request.apiKey, controller.signal)) {
        if (controller.signal.aborted || response.writableEnded) break;

        const payload = {
          id: chunk.id,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: dto.model,
          choices: [
            {
              index: 0,
              delta: {
                ...(chunk.role ? { role: chunk.role } : {}),
                ...(chunk.delta ? { content: chunk.delta } : {}),
              },
              finish_reason: chunk.finishReason ?? null,
            },
          ],
          ...(chunk.usage
            ? {
                usage: {
                  prompt_tokens: chunk.usage.promptTokens,
                  completion_tokens: chunk.usage.completionTokens,
                  total_tokens: chunk.usage.totalTokens,
                },
              }
            : {}),
        };

        response.write('data: ' + JSON.stringify(payload) + '\n\n');
      }

      if (!response.writableEnded && !controller.signal.aborted) {
        response.write('data: [DONE]\n\n');
        response.end();
      }
    } catch (error) {
      if (!controller.signal.aborted && !response.writableEnded) {
        response.write(
          'data: ' +
            JSON.stringify({
              error: {
                message: error instanceof Error ? error.message : 'Stream failed',
                type: 'server_error',
                code: 'stream_error',
              },
            }) +
            '\n\n',
        );
        response.end();
      }
    }
  }
}