import { env } from '../config/env.js';
import { createErrorResponse, ErrorCodes } from '../errors/openaiError.js';

export interface ModelResolution {
  provider: string;
  upstreamModel: string;
}

export interface ResolutionResult {
  success: true;
  data: ModelResolution;
}

export interface ResolutionError {
  success: false;
  error: ReturnType<typeof createErrorResponse>;
}

export function resolveModel(model: string): ResolutionResult | ResolutionError {
  const defaultProvider = env.DEFAULT_PROVIDER || 'minimax';
  const defaultModel = env.DEFAULT_MODEL || 'MiniMax-M2.7';

  if (!model || model.trim() === '') {
    return {
      success: true,
      data: {
        provider: defaultProvider,
        upstreamModel: defaultModel,
      },
    };
  }

  if (model.includes('/')) {
    const parts = model.split('/');
    const provider = parts[0];
    const upstreamModel = parts.slice(1).join('/');

    if (!provider || !upstreamModel) {
      return {
        success: true,
        data: {
          provider: defaultProvider,
          upstreamModel: model,
        },
      };
    }

    return {
      success: true,
      data: {
        provider,
        upstreamModel,
      },
    };
  }

  return {
    success: true,
    data: {
      provider: defaultProvider,
      upstreamModel: model,
    },
  };
}

export function validateProvider(provider: string): boolean {
  const validProviders = ['minimax', 'openai', 'anthropic', 'ollama'];
  return validProviders.includes(provider);
}