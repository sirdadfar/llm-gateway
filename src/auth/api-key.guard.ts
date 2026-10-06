import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { OpenAIError } from '../common/openai-error';
import { ApiKeyService } from './api-key.service';
@Injectable()
export class ApiKeyGuard implements CanActivate {
 constructor(private readonly keys:ApiKeyService){}
 async canActivate(ctx:ExecutionContext):Promise<boolean>{const req=ctx.switchToHttp().getRequest<Request&{apiKey?:unknown}>();const h=req.headers.authorization;if(!h?.startsWith('Bearer '))throw new OpenAIError('Missing API key','authentication_error','invalid_api_key',401);const key=await this.keys.findActive(h.slice(7).trim());if(!key)throw new OpenAIError('Invalid API key','authentication_error','invalid_api_key',401);req.apiKey=key;return true}
}