import type { AIProvider, ProviderHealth, ProviderCapabilities } from './types.js';
import type { ChatCompletionRequest, ChatCompletionResponse, ModelList } from '../http/openaiTypes.js';
import { env } from '../config/env.js';
import { createErrorResponse, ErrorCodes } from '../errors/openaiError.js';

interface MinimaxMessage {
  role: string;
  content: string;
}

interface MinimaxRequest {
  model: string;
  messages: MinimaxMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface MinimaxResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class MinimaxProvider implements AIProvider {
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor() {
    this.baseUrl = env.MINIMAX_BASE_URL;
    this.apiKey = env.MINIMAX_API_KEY || '';
    this.model = env.DEFAULT_MODEL;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      functionCalling: false,
      vision: false,
      jsonMode: false,
      maxContextTokens: 32000,
    };
  }

  private ensureConfig(): void {
    if (!this.apiKey) {
      throw createErrorResponse(
        'MINIMAX_API_KEY is not configured',
        'invalid_request_error',
        ErrorCodes.PROVIDER_CONFIG_MISSING,
        500
      );
    }
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.ensureConfig();

    const minimaxRequest: MinimaxRequest = {
      model: request.model || this.model,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: request.temperature,
      top_p: request.top_p,
      max_tokens: request.max_tokens,
      stream: false,
    };

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(minimaxRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw createErrorResponse(
        `Minimax API error: ${response.status} - ${errorText}`,
        'internal_server_error',
        'provider_error',
        502
      );
    }

    const data = await response.json() as MinimaxResponse;

    return {
      id: data.id || `minimax-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: data.model || this.model,
      choices: data.choices.map((c, i) => ({
        index: i,
        message: {
          role: c.message.role as any,
          content: c.message.content,
        },
        finish_reason: c.finish_reason,
      })),
      usage: data.usage,
    };
  }

  async listModels(): Promise<ModelList> {
    return {
      object: 'list',
      data: [
        {
          id: this.model,
          object: 'model',
          created: 1687882411,
          owned_by: 'minimax',
        },
      ],
    };
  }

  async health(): Promise<ProviderHealth> {
    try {
      this.ensureConfig();
      const start = Date.now();
      await fetch(`${this.baseUrl}/v1/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      return {
        status: 'healthy',
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}