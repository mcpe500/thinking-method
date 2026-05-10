import type { ILogSink, LogEntry } from '../interfaces/types.js';
import { ConsoleSink } from './ConsoleSink.js';
import { FileSink } from './FileSink.js';

export class DualSink implements ILogSink {
  private consoleSink: ConsoleSink;
  private fileSink: FileSink;

  constructor(filePath: string) {
    this.consoleSink = new ConsoleSink();
    this.fileSink = new FileSink(filePath);
  }

  async write(entry: LogEntry): Promise<void> {
    await this.consoleSink.write(entry);
    await this.fileSink.write(entry);
  }

  async flush(): Promise<void> {
    await this.fileSink.flush();
  }

  async close(): Promise<void> {
    await this.fileSink.close();
  }
}