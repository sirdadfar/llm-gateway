export interface ChatMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | Array<Record<string, unknown>>; name?: string; }
export interface ChatRequest { model: string; messages: ChatMessage[]; temperature?: number; maxTokens?: number; topP?: number; stop?: string | string[]; [key: string]: unknown; }
export interface Usage { promptTokens: number; completionTokens: number; totalTokens: number; }
export interface ChatResult { id: string; model: string; content: string; finishReason: string; usage: Usage; }
export interface StreamChunk { id: string; model: string; delta: string; role?: string; finishReason?: string; usage?: Usage; }
export interface LLMProvider { readonly name: string; chat(request: ChatRequest, signal?: AbortSignal): Promise<ChatResult>; chatStream(request: ChatRequest, signal?: AbortSignal): AsyncIterable<StreamChunk>; listModels(): Promise<string[]>; healthCheck(): Promise<boolean>; }