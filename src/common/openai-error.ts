export class OpenAIError extends Error {
  constructor(public readonly message: string, public readonly type = 'invalid_request_error', public readonly code: string | null = null, public readonly status = 400) { super(message); this.name = 'OpenAIError'; }
}
export interface OpenAIErrorBody { error: { message: string; type: string; code: string | null } }