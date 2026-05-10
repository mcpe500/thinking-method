import type { AIProvider } from '../providers/types.js';
import type { StepResult, PipelineResult } from '../providers/types.js';
import type { ChatCompletionRequest } from '../http/openaiTypes.js';
import { env } from '../config/env.js';
import { buildStepPrompt, buildFinalAggregationPrompt, extractAnswer, extractStepResult } from './promptBuilder.js';
import { getStepNames } from './thinkingSteps.js';

export class ThinkingOrchestrator {
  private provider: AIProvider;
  private stepCount: number;
  private pipelineEnabled: boolean;
  private returnMode: 'final' | 'all';

  constructor(provider: AIProvider) {
    this.provider = provider;
    this.stepCount = env.THINKING_STEP_COUNT || 10;
    this.pipelineEnabled = env.THINKING_PIPELINE_ENABLED ?? true;
    this.returnMode = env.THINKING_RETURN_MODE || 'final';
  }

  async run(
    requestId: string,
    originalRequest: ChatCompletionRequest
  ): Promise<PipelineResult> {
    if (!this.pipelineEnabled) {
      const response = await this.provider.chatCompletion(originalRequest);
      const startTime = Date.now();
      return {
        steps: [],
        final_prompt: '',
        final_answer: response.choices[0]?.message?.content || '',
        total_usage: response.usage,
        total_timing: { startTime, endTime: startTime, durationMs: 0 },
      };
    }

    const steps: StepResult[] = [];
    const stepNames = getStepNames();
    const originalUserPrompt = this.extractUserPrompt(originalRequest.messages);
    const startTime = Date.now();

    for (let i = 0; i < this.stepCount; i++) {
      const stepName = stepNames[i] || `Step ${i + 1}`;
      const stepIndex = i + 1;

      const stepPrompt = buildStepPrompt(
        stepIndex,
        stepName,
        originalUserPrompt,
        steps
      );

      const stepStartTime = Date.now();

      try {
        const response = await this.provider.chatCompletion({
          model: originalRequest.model,
          messages: [{ role: 'user', content: stepPrompt }],
          temperature: 0.7,
          max_tokens: 2048,
        });

        const stepEndTime = Date.now();
        const stepOutput = extractStepResult(
          response.choices[0]?.message?.content || ''
        );

        steps.push({
          step_index: stepIndex,
          step_name: stepName,
          step_prompt: stepPrompt,
          step_output: stepOutput,
          provider: 'minimax',
          model: originalRequest.model,
          usage: response.usage,
          timing: {
            startTime: stepStartTime,
            endTime: stepEndTime,
            durationMs: stepEndTime - stepStartTime,
          },
          success: true,
        });
      } catch (error) {
        const stepEndTime = Date.now();
        steps.push({
          step_index: stepIndex,
          step_name: stepName,
          step_prompt: stepPrompt,
          step_output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          provider: 'minimax',
          model: originalRequest.model,
          timing: {
            startTime: stepStartTime,
            endTime: stepEndTime,
            durationMs: stepEndTime - stepStartTime,
          },
          success: false,
        });
      }
    }

    const finalPrompt = buildFinalAggregationPrompt(originalUserPrompt, steps);
    let finalAnswer = '';

    try {
      const finalResponse = await this.provider.chatCompletion({
        model: originalRequest.model,
        messages: [{ role: 'user', content: finalPrompt }],
        temperature: 0.7,
        max_tokens: 4096,
      });
      finalAnswer = extractAnswer(finalResponse.choices[0]?.message?.content || '');
    } catch (error) {
      finalAnswer = `Error in final aggregation: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    const totalEndTime = Date.now();
    const totalPromptTokens = steps.reduce((sum, s) => sum + (s.usage?.prompt_tokens || 0), 0);
    const totalCompletionTokens = steps.reduce((sum, s) => sum + (s.usage?.completion_tokens || 0), 0);

    return {
      steps,
      final_prompt: finalPrompt,
      final_answer: finalAnswer,
      total_usage: {
        prompt_tokens: totalPromptTokens,
        completion_tokens: totalCompletionTokens,
        total_tokens: totalPromptTokens + totalCompletionTokens,
      },
      total_timing: {
        startTime,
        endTime: totalEndTime,
        durationMs: totalEndTime - startTime,
      },
    };
  }

  private extractUserPrompt(messages: any[]): string {
    return messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n');
  }
}
