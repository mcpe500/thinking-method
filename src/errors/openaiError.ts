import type { OpenAIError } from '../http/openaiTypes.js';

export class OpenAIErrorResponse extends Error {
  public readonly status: number;
  public readonly type: string;
  public readonly code: string;
  public readonly param?: string;

  constructor(message: string, status: number, type: string, code: string, param?: string) {
    super(message);
    this.status = status;
    this.type = type;
    this.code = code;
    this.param = param;
  }

  toJSON(): OpenAIError {
    return {
      error: {
        message: this.message,
        type: this.type,
        code: this.code,
        param: this.param,
      },
    };
  }
}

export function createErrorResponse(message: string, type: string, code: string, status = 400): OpenAIErrorResponse {
  return new OpenAIErrorResponse(message, status, type, code);
}

export const ErrorCodes = {
  PROVIDER_NOT_FOUND: 'provider_not_found',
  MODEL_NOT_FOUND: 'model_not_found',
  INVALID_REQUEST: 'invalid_request_error',
  AUTH_ERROR: 'invalid_api_error',
  PROVIDER_CONFIG_MISSING: 'provider_config_missing',
  PIPELINE_ERROR: 'pipeline_error',
  INTERNAL_ERROR: 'internal_server_error',
} as const;