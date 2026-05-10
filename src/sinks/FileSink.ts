import type { ILogSink } from '../interfaces/types.js';
import type { LogEntry } from '../interfaces/types.js';
import * as fs from 'fs';
import * as path from 'path';

export class FileSink implements ILogSink {
  private filePath: string;
  private stream: fs.WriteStream;

  constructor(filePath: string) {
    this.filePath = filePath;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.stream = fs.createWriteStream(filePath, { flags: 'a' });
  }

  async write(entry: LogEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stream.write(JSON.stringify(entry) + '\n', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.stream.once('drain', resolve);
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.stream.end(() => resolve());
    });
  }
}
