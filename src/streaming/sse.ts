import type { ChatCompletionChunk } from '../http/openaiTypes.js';

export function sseLine(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function createChunk(
  id: string,
  model: string,
  content: string,
  finishReason: string | null = null
): ChatCompletionChunk {
  return {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      delta: { content },
      finish_reason: finishReason,
    }],
  };
}

export function createDoneSignal(): string {
  return 'data: [DONE]\n\n';
}

export async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('data: ')) {
        yield trimmed.slice(6);
      }
    }
  }
}
