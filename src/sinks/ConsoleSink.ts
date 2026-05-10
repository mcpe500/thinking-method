import type { ILogSink } from '../interfaces/types.js';
import type { LogEntry } from '../interfaces/types.js';

export class ConsoleSink implements ILogSink {
  async write(entry: LogEntry): Promise<void> {
    const color = this.getColor(entry);
    console.log(`\x1b[${color}m${JSON.stringify(entry)}\x1b[0m`);
  }

  async flush(): Promise<void> {}
  async close(): Promise<void> {}

  private getColor(entry: LogEntry): string {
    switch (entry.category) {
      case 'error': return '31';
      case 'response': return '32';
      case 'prompt': return '36';
      case 'metrics': return '33';
      default: return '0';
    }
  }
}
