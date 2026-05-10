export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatCompletionRequest = {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
};

export type ChatCompletionResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type ModelList = {
  object: string;
  data: {
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }[];
};

export interface AIProvider {
  chat(model: string, request: ChatCompletionRequest): Promise<unknown>;
  streamChat(model: string, request: ChatCompletionRequest, stream: any): Promise<void>;
  listModels(): Promise<ModelList>;
}

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { HonoStreaming } from 'hono/streaming';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

class OpenAIProvider implements AIProvider {
  async chat(model: string, request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const response = await openai.chat.completions.create({
      model,
      messages: request.messages as any,
      stream: false,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
    } as any);

    return response as ChatCompletionResponse;
  }

  async streamChat(model: string, request: ChatCompletionRequest, stream: HonoStreaming): Promise<void> {
    const response = await openai.chat.completions.create({
      model,
      messages: request.messages as any,
      stream: true,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
    } as any);

    for await (const chunk of response) {
      stream.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    stream.write('data: [DONE]\n\n');
  }

  async listModels(): Promise<ModelList> {
    const response = await openai.models.list();
    return {
      object: 'list',
      data: response.data.map((m: any) => ({
        id: m.id,
        object: 'model',
        created: m.created || 0,
        owned_by: m.owned_by || 'unknown',
      })),
    };
  }
}

class AnthropicProvider implements AIProvider {
  async chat(model: string, request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const response = await anthropic.messages.create({
      model,
      messages: request.messages as any,
      max_tokens: request.max_tokens || 1024,
      temperature: request.temperature,
      stream: false,
    } as any);

    return {
      id: `anthropic-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: response.content[0].text },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async streamChat(model: string, request: ChatCompletionRequest, stream: HonoStreaming): Promise<void> {
    const response = await anthropic.messages.create({
      model,
      messages: request.messages as any,
      max_tokens: request.max_tokens || 1024,
      temperature: request.temperature,
      stream: true,
    } as any);

    for await (const chunk of response) {
      if (chunk.type === 'content_block_delta') {
        stream.write(`data: ${JSON.stringify({
          id: `anthropic-${Date.now()}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{
            index: 0,
            delta: { content: chunk.delta.text },
            finish_reason: null,
          }],
        })}\n\n`);
      }
    }
    stream.write('data: [DONE]\n\n');
  }

  async listModels(): Promise<ModelList> {
    return {
      object: 'list',
      data: [
        { id: 'claude-3-opus', object: 'model', created: 0, owned_by: 'anthropic' },
        { id: 'claude-3-sonnet', object: 'model', created: 0, owned_by: 'anthropic' },
        { id: 'claude-3-haiku', object: 'model', created: 0, owned_by: 'anthropic' },
      ],
    };
  }
}

interface OllamaMessage {
  role: string;
  content: string;
}

class OllamaProvider implements AIProvider {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }

  async chat(model: string, request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: request.messages,
        stream: false,
      }),
    });

    const data = await response.json() as any;

    return {
      id: `ollama-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: data.message?.content || '' },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
  }

  async streamChat(model: string, request: ChatCompletionRequest, stream: HonoStreaming): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: request.messages,
        stream: true,
      }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) return;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          stream.write(`data: ${JSON.stringify({
            id: `ollama-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{
              index: 0,
              delta: { content: data.message?.content || '' },
              finish_reason: null,
            }],
          })}\n\n`);
        } catch {}
      }
    }
    stream.write('data: [DONE]\n\n');
  }

  async listModels(): Promise<ModelList> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    const data = await response.json() as any;

    return {
      object: 'list',
      data: (data.models || []).map((m: any) => ({
        id: m.name,
        object: 'model',
        created: 0,
        owned_by: 'ollama',
      })),
    };
  }
}

const providers: Record<string, AIProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  ollama: new OllamaProvider(),
};

export function getProvider(name: string): AIProvider {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown provider: ${name}`);
  }
  return provider;
}

export { OpenAIProvider, AnthropicProvider, OllamaProvider };