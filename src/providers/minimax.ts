import type { AIProvider, ProviderHealth, ProviderCapabilities } from './types.js';
import type { ChatCompletionRequest, ChatCompletionResponse, ModelList } from '../http/openaiTypes.js';
import { env } from '../config/env.js';
import { createErrorResponse, ErrorCodes } from '../errors/openaiError.js';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  system?: string;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: 'text' | 'thinking';
    text?: string;
    thinking?: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
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
    console.log(`[MINIMAX] init | baseUrl=${this.baseUrl} | model=${this.model} | hasKey=${!!this.apiKey}`);
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      functionCalling: false,
      vision: false,
      jsonMode: false,
      maxContextTokens: 270000,
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

    const url = `${this.baseUrl}/messages`;
    console.log(`[MINIMAX] POST ${url}`);

    const systemMessage = request.messages.find(m => m.role === 'system');
    const userMessages = request.messages.filter(m => m.role !== 'system');

    const anthropicMessages: AnthropicMessage[] = userMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

const anthropicRequest: AnthropicRequest = {
      model: this.model,
      messages: anthropicMessages,
      max_tokens: request.max_tokens || 4096,
      temperature: request.temperature,
      top_p: request.top_p,
      ...(systemMessage && { system: systemMessage.content }),
    };

    console.log(`[MINIMAX] body:`, JSON.stringify(anthropicRequest));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicRequest),
    });

    console.log(`[MINIMAX] response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw createErrorResponse(
        `Minimax API error: ${response.status} - ${errorText}`,
        'internal_server_error',
        'provider_error',
        502
      );
    }

    const data = await response.json() as AnthropicResponse;

    const textContent = data.content
      .filter(block => block.type === 'text')
      .map(block => block.text || '')
      .join('');

    return {
      id: data.id || `minimax-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: data.model || this.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: textContent,
        },
        finish_reason: data.stop_reason || 'stop',
      }],
      usage: {
        prompt_tokens: data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.output_tokens || 0,
        total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
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
      await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 10,
        }),
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