import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env.js';
import { sanitize } from '../logging/sanitizer.js';
import type { TrainingTrace } from './traceTypes.js';
import type { PipelineResult, StepResult } from '../providers/types.js';

export class TrainingTraceWriter {
  private enabled: boolean;
  private logDir: string;

  constructor() {
    this.enabled = env.TRAINING_TRACE_ENABLED ?? true;
    this.logDir = env.LOG_DIR || 'logs';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  write(trace: TrainingTrace): void {
    if (!this.enabled) return;

    const sanitizedTrace = this.sanitizeTrace(trace);
    const filename = `trace_${trace.request_id}_${Date.now()}.json`;
    const filepath = path.join(this.logDir, 'training', filename);

    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      if (!fs.existsSync(path.join(this.logDir, 'training'))) {
        fs.mkdirSync(path.join(this.logDir, 'training'), { recursive: true });
      }
      fs.writeFileSync(filepath, JSON.stringify(sanitizedTrace, null, 2));
    } catch (error) {
      console.error('Failed to write training trace:', error);
    }
  }

  private sanitizeTrace(trace: TrainingTrace): TrainingTrace {
    return {
      ...trace,
      final_answer: sanitize(trace.final_answer),
    };
  }

  createTraceFromPipeline(
    requestId: string,
    originalMessages: Array<{ role: string; content: string }>,
    provider: string,
    model: string,
    pipelineResult: PipelineResult
  ): TrainingTrace {
    return {
      request_id: requestId,
      original_messages: originalMessages,
      provider,
      model,
      steps: pipelineResult.steps.map((s: StepResult) => ({
        step_index: s.step_index,
        step_name: s.step_name,
        prompt: s.step_prompt,
        output: s.step_output,
        usage: s.usage,
        timing: s.timing,
        success: s.success,
      })),
      final_prompt: pipelineResult.final_prompt,
      final_answer: pipelineResult.final_answer,
      total_usage: pipelineResult.total_usage,
      created_at: new Date().toISOString(),
    };
  }
}

export const traceWriter = new TrainingTraceWriter();