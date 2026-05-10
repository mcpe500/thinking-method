export const THINKING_STEPS = [
  'Problem Framing',
  'First Principles Thinking',
  'Socratic Thinking',
  'Root Cause Thinking',
  'Systems Thinking',
  'Hypothesis-Driven Thinking',
  'Inversion Thinking',
  'Trade-off Thinking',
  'Second-Order Thinking',
  'Probabilistic Thinking',
] as const;

export type ThinkingStepName = typeof THINKING_STEPS[number];

export function getStepNames(): string[] {
  return [...THINKING_STEPS];
}

export function getStepCount(): number {
  return THINKING_STEPS.length;
}
