import type { StepResult } from '../providers/types.js';

export function buildStepPrompt(
  stepIndex: number,
  stepName: string,
  originalUserPrompt: string,
  previousSteps: StepResult[]
): string {
  const previousResultsText = previousSteps.length > 0
    ? previousSteps.map(s => `Step ${s.step_index} (${s.step_name}): ${s.step_output}`).join('\n\n')
    : 'No previous results yet.';

  return `You are executing one step in a multi-pass thinking pipeline.

Original user request:
${originalUserPrompt}

Previous step results:
${previousResultsText}

Current step:
${stepIndex}. ${stepName}

Task:
- Focus only on this current thinking method.
- Produce a concise but complete structured result for this step.
- Do not produce the final answer unless this is the final aggregation step.
- Make the output useful as training data.

Return format:
<STEP_RESULT step="${stepIndex}" name="${stepName}">
...
</STEP_RESULT>`;
}

export function buildFinalAggregationPrompt(
  originalUserPrompt: string,
  stepResults: StepResult[]
): string {
  const allStepsText = stepResults.map(s => 
    `Step ${s.step_index} (${s.step_name}):
${s.step_output}`
  ).join('\n\n---\n\n');

  return `You are the final aggregator.

Original user request:
${originalUserPrompt}

All step results:
${allStepsText}

Task:
- Read all completed step results.
- Synthesize them into the strongest final answer.
- Do not invent facts not supported by the original request or step results.
- Return only the final user-facing response unless debug return mode is enabled.

Return format:
<ANSWER>
...
</ANSWER>`;
}

export function extractAnswer(text: string): string {
  const match = text.match(/<ANSWER>([\s\S]*?)<\/ANSWER>/);
  return match ? match[1].trim() : text;
}

export function extractStepResult(text: string): string {
  const match = text.match(/<STEP_RESULT[^>]*>([\s\S]*?)<\/STEP_RESULT>/);
  return match ? match[1].trim() : text;
}
