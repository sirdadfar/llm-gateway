import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ChatRequest, ChatResult, LLMProvider, StreamChunk } from './llm-provider.interface';

@Injectable()
export class AnthropicProvider implements LLMProvider {
  readonly name='anthropic';
  private readonly client=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY||'disabled'});
  private split(r:ChatRequest) { const system=r.messages.filter(m=>m.role==='system').map(m=>typeof m.content==='string'?m.content:'').join('\n'); const messages=r.messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'assistant':'user' as 'user',content:typeof m.content==='string'?m.content:JSON.stringify(m.content)})); return {system,messages}; }
  async chat(r:ChatRequest,signal?:AbortSignal):Promise<ChatResult>{ const p=this.split(r); const x=await this.client.messages.create({model:r.model,max_tokens:r.maxTokens??1024,temperature:r.temperature,top_p:r.topP,system:p.system||undefined,messages:p.messages}, {signal}); const content=x.content.filter(b=>b.type==='text').map(b=>b.text).join(''); return {id:x.id,model:x.model,content,finishReason:x.stop_reason??'stop',usage:{promptTokens:x.usage.input_tokens,completionTokens:x.usage.output_tokens,totalTokens:x.usage.input_tokens+x.usage.output_tokens}}; }
  async *chatStream(r:ChatRequest,signal?:AbortSignal):AsyncIterable<StreamChunk>{ const p=this.split(r); const stream=this.client.messages.stream({model:r.model,max_tokens:r.maxTokens??1024,temperature:r.temperature,top_p:r.topP,system:p.system||undefined,messages:p.messages}, {signal}); for await(const e of stream){ if(e.type==='content_block_delta'&&e.delta.type==='text_delta') yield {id:e.message?.id??'',model:r.model,delta:e.delta.text}; if(e.type==='message_delta') yield {id:e.message?.id??'',model:r.model,delta:'',finishReason:e.delta.stop_reason??undefined,usage:e.usage?{promptTokens:0,completionTokens:e.usage.output_tokens,totalTokens:e.usage.output_tokens}:undefined}; } }
  async listModels():Promise<string[]>{ return ['claude-3-5-sonnet-latest','claude-3-7-sonnet-latest','claude-sonnet-4-5']; }
  async healthCheck():Promise<boolean>{ return Boolean(process.env.ANTHROPIC_API_KEY); }
}