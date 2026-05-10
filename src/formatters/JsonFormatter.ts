import type { ILogFormatter } from '../interfaces/types.js';
import type { LogEntry } from '../interfaces/types.js';

export class JsonFormatter implements ILogFormatter {
  content_type = 'application/json';

  format(entry: LogEntry): string {
    return JSON.stringify(entry);
  }
}
