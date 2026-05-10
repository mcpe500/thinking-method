import type { StepResult } from '../providers/types.js';

export interface TrainingTrace {
  request_id: string;
  original_messages: Array<{
    role: string;
    content: string;
  }>;
  provider: string;
  model: string;
  steps: Array<{
    step_index: number;
    step_name: string;
    prompt: string;
    output: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    timing?: {
      startTime: number;
      endTime: number;
      durationMs: number;
    };
    success: boolean;
  }>;
  final_prompt: string;
  final_answer: string;
  total_usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  created_at: string;
}