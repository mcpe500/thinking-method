import type { ChatCompletionRequest, ChatCompletionResponse, ModelList } from '../http/openaiTypes.js';

export interface ProviderCapabilities {
  streaming: boolean;
  functionCalling: boolean;
  vision: boolean;
  jsonMode: boolean;
  maxContextTokens: number;
}

export interface ProviderHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latencyMs?: number;
  error?: string;
}

export interface AIProvider {
  chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  listModels(): Promise<ModelList>;
  health(): Promise<ProviderHealth>;
  getCapabilities(): ProviderCapabilities;
}

export interface StepResult {
  step_index: number;
  step_name: string;
  step_prompt: string;
  step_output: string;
  provider: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  timing: {
    startTime: number;
    endTime: number;
    durationMs: number;
  };
  success: boolean;
}

export interface PipelineResult {
  steps: StepResult[];
  final_prompt: string;
  final_answer: string;
  total_usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  total_timing: {
    startTime: number;
    endTime: number;
    durationMs: number;
  };
}