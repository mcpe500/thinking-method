import type { AIProvider } from '../providers/types.js';
import type { StepResult, PipelineResult } from '../providers/types.js';
import type { ChatCompletionRequest } from '../http/openaiTypes.js';
import { env } from '../config/env.js';
import { buildStepPrompt, buildFinalAggregationPrompt, extractAnswer, extractStepResult } from './promptBuilder.js';
import { getStepNames } from './thinkingSteps.js';

const MAX_INPUT_MESSAGES = 50;
const MAX_MESSAGE_CONTENT_LENGTH = 2000;

function truncateMessage(message: { role: string; content: string }): { role: string; content: string } {
  return {
    role: message.role,
    content: message.content.length > MAX_MESSAGE_CONTENT_LENGTH
      ? message.content.slice(0, MAX_MESSAGE_CONTENT_LENGTH) + '...[truncated]'
      : message.content,
  };
}

function truncateMessages(messages: any[]): any[] {
  const userMsgs = messages.filter(m => m.role === 'user' || m.role === 'system');
  const assistantMsgs = messages.filter(m => m.role === 'assistant');

  let truncated: any[] = [];

  if (userMsgs.length > MAX_INPUT_MESSAGES) {
    const toKeep = userMsgs.slice(0, 5);
    const toSummarize = userMsgs.slice(5, -5);
    const lastFew = userMsgs.slice(-5);

    const summarized = `...[${toSummarize.length} earlier messages summarized]...`;
    truncated = [...toKeep, { role: 'user', content: summarized }, ...lastFew];
  } else {
    truncated = userMsgs;
  }

  if (assistantMsgs.length > 10) {
    const lastAssistant = assistantMsgs.slice(-3);
    truncated = [...truncated, ...lastAssistant];
  }

  return truncated.map(truncateMessage);
}

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
    const model = originalRequest.model || 'MiniMax-M2.7';
    console.log(`[ORCHESTRATOR] ${requestId} | pipeline=${this.pipelineEnabled} | steps=${this.stepCount} | model=${model}`);

    if (!this.pipelineEnabled) {
      console.log(`[ORCHESTRATOR] ${requestId} | pipeline DISABLED, direct call`);
      const response = await this.provider.chatCompletion({ ...originalRequest, model });
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

    const truncatedMessages = truncateMessages(originalRequest.messages || []);
    const originalUserPrompt = this.extractUserPrompt(truncatedMessages);
    const startTime = Date.now();

    console.log(`[ORCHESTRATOR] ${requestId} | running ${this.stepCount} steps | msgs=${originalRequest.messages?.length || 0} -> truncated=${truncatedMessages.length}`);

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
      console.log(`[ORCHESTRATOR] ${requestId} | step ${stepIndex}/${this.stepCount}: ${stepName}`);

      try {
        const response = await this.provider.chatCompletion({
          model,
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
          model,
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
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.log(`[ORCHESTRATOR] ${requestId} | step ${stepIndex} FAILED: ${errorMsg}`);
        steps.push({
          step_index: stepIndex,
          step_name: stepName,
          step_prompt: stepPrompt,
          step_output: `Error: ${errorMsg}`,
          provider: 'minimax',
          model,
          timing: {
            startTime: stepStartTime,
            endTime: stepEndTime,
            durationMs: stepEndTime - stepStartTime,
          },
          success: false,
        });
      }
    }

    console.log(`[ORCHESTRATOR] ${requestId} | all steps done | building final aggregation`);
    const finalPrompt = buildFinalAggregationPrompt(originalUserPrompt, steps);
    let finalAnswer = '';

    try {
      console.log(`[ORCHESTRATOR] ${requestId} | final aggregation call | model=${model}`);
      const finalResponse = await this.provider.chatCompletion({
        model,
        messages: [{ role: 'user', content: finalPrompt }],
        temperature: 0.7,
        max_tokens: 4096,
      });
      finalAnswer = extractAnswer(finalResponse.choices[0]?.message?.content || '');
      console.log(`[ORCHESTRATOR] ${requestId} | final aggregation OK | answer_len=${finalAnswer.length}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`[ORCHESTRATOR] ${requestId} | final aggregation FAILED: ${errorMsg}`);
      finalAnswer = `Error in final aggregation: ${errorMsg}`;
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