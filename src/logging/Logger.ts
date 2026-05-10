import { LogLevel, LogCategory } from '../interfaces/types.js';
import type { LogEntry } from '../interfaces/types.js';
import { env } from '../config/env.js';
import { sanitize, truncate } from './sanitizer.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('logging');

export interface PromptLogData {
  requestId: string;
  provider: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
}

export interface ResponseLogData {
  requestId: string;
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  timing?: {
    durationMs: number;
  };
}

export interface StepLogData {
  requestId: string;
  stepIndex: number;
  stepName: string;
  prompt: string;
  output: string;
  success: boolean;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  timing?: {
    durationMs: number;
  };
}

export interface MetricsLogData {
  requestId: string;
  totalCalls: number;
  totalUsage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  totalTimingMs: number;
}

function formatPrompt(messages: Array<{ role: string; content: string }>): string {
  return messages.map(m => `[${m.role}]: ${truncate(m.content, 500)}`).join('\n');
}

export function logPrompt(data: PromptLogData): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    category: LogCategory.PROMPT,
    request_id: data.requestId,
    model: { provider: data.provider, model: data.model },
    messages: data.messages as any,
    success: true,
  };
  
  if (env.LOG_LEVEL === 'debug') {
    logger.info(`[PROMPT] Request ${data.requestId} to ${data.provider}/${data.model}`);
    logger.info(`Messages:\n${formatPrompt(data.messages)}`);
  }
  
  console.log(JSON.stringify(entry));
}

export function logStep(data: StepLogData): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    category: LogCategory.PROMPT,
    request_id: data.requestId,
    model: { provider: 'minimax', model: 'unknown' },
    content: truncate(data.output, 1000),
    success: data.success,
  };

  if (env.LOG_LEVEL === 'debug') {
    logger.info(`[STEP ${data.stepIndex}] ${data.stepName} - ${data.success ? 'OK' : 'FAILED'}`);
    logger.debug(`Step prompt:\n${truncate(data.prompt, 300)}`);
    logger.debug(`Step output:\n${truncate(data.output, 500)}`);
  }

  console.log(JSON.stringify(entry));
}

export function logResponse(data: ResponseLogData): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    category: LogCategory.RESPONSE,
    request_id: data.requestId,
    content: truncate(data.content, 2000),
    token_usage: data.usage,
    timing: { total_duration_ms: data.timing?.durationMs || 0 },
    success: true,
  };

  if (env.LOG_LEVEL === 'debug') {
    logger.info(`[RESPONSE] Request ${data.requestId}`);
    logger.info(`Content preview: ${truncate(data.content, 200)}`);
  }

  console.log(JSON.stringify(entry));
}

export function logMetrics(data: MetricsLogData): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    category: LogCategory.METRICS,
    request_id: data.requestId,
    token_usage: data.totalUsage,
    timing: { total_duration_ms: data.totalTimingMs },
    success: true,
  };

  logger.info(`[METRICS] Request ${data.requestId}: ${data.totalCalls} calls, ${data.totalTimingMs}ms`);

  console.log(JSON.stringify(entry));
}

export function logError(requestId: string, code: string, message: string): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.ERROR,
    category: LogCategory.ERROR,
    request_id: requestId,
    error_code: code,
    error_message: sanitize(message),
    success: false,
  };

  logger.error(`[ERROR] Request ${requestId}: ${code} - ${sanitize(message)}`);

  console.log(JSON.stringify(entry));
}