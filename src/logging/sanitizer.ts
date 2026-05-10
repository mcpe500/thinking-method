import { env } from '../config/env.js';

const SENSITIVE_PATTERNS = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: 'sk-***REDACTED***' },
  { pattern: /Bearer\s+[a-zA-Z0-9\-_]+/g, replacement: 'Bearer ***REDACTED***' },
  { pattern: /api[_-]?key["\s:=]+[a-zA-Z0-9\-_]{10,}/gi, replacement: 'api_key: ***REDACTED***' },
  { pattern: /password["\s:=]+[^\s,}\]]{4,}/gi, replacement: 'password: ***REDACTED***' },
  { pattern: /token["\s:=]+[a-zA-Z0-9\-_]{10,}/gi, replacement: 'token: ***REDACTED***' },
  { pattern: /x-api-key["\s:=]+[a-zA-Z0-9\-_]{10,}/gi, replacement: 'x-api-key: ***REDACTED***' },
];

const MAX_CONTENT_LENGTH = env.LOG_INCLUDE_CONTENT ? 10000 : 500;

export function sanitize(text: string): string {
  let result = text;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_PATTERNS.some(p => p.pattern.test(key))) {
      result[key] = '***REDACTED***';
    } else if (typeof value === 'string') {
      result[key] = sanitize(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(v => typeof v === 'string' ? sanitize(v) : v);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function truncate(text: string, maxLength = MAX_CONTENT_LENGTH): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...[truncated]';
}

export function sanitizeError(error: Error): string {
  return sanitize(error.message);
}