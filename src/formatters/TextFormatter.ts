import type { ILogFormatter } from '../interfaces/types.js';
import type { LogEntry, LogLevel, LogCategory } from '../interfaces/types.js';

const LEVEL_NAMES: Record<number, string> = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
const CATEGORY_NAMES: Record<string, string> = {
  prompt: 'PROMPT',
  response: 'RESPONSE',
  metrics: 'METRICS',
  error: 'ERROR',
  config: 'CONFIG',
};

export class TextFormatter implements ILogFormatter {
  content_type = 'text/plain';

  format(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${LEVEL_NAMES[entry.level] || 'INFO'}]`,
      `[${CATEGORY_NAMES[entry.category as string] || entry.category}]`,
      `[req=${String(entry.request_id).slice(0, 8)}]`,
    ];

    if (entry.model) {
      parts.push(`${entry.model.provider}/${entry.model.model}`);
    }

    const lines = [parts.join(' ')];

    if (entry.messages && entry.messages.length > 0) {
      lines.push('  Messages:');
      for (const msg of entry.messages as Array<{ role: string; content: string }>) {
        lines.push(`    [${msg.role}]: ${msg.content}`);
      }
    }

    if (entry.content) {
      lines.push(`  Content: ${entry.content}`);
    }

    if (entry.token_usage) {
      lines.push(`  Tokens: prompt=${entry.token_usage.prompt_tokens || 0} completion=${entry.token_usage.completion_tokens || 0}`);
    }

    if (entry.timing) {
      lines.push(`  Timing: ${entry.timing.total_duration_ms}ms`);
    }

    if (entry.error_message) {
      lines.push(`  ERROR [${entry.error_code}]: ${entry.error_message}`);
    }

    return lines.join('\n');
  }
}
