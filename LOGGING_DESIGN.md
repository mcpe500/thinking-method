# AI API Proxy Logging System Design

## 1. Architecture Overview

The logging system uses a formatter-sink architecture with these components:

LogEntry -> Logger -> Formatter -> Sink -> Output
           |
           +-- Filter (level, category, provider)
           +-- Sanitizer (redact sensitive data)

### Core Components

| Component | Purpose |
|-----------|---------|
| LogEntry | Structured data object with all logging fields |
| ILogFormatter | Converts LogEntry to string (JSON/text) |
| ILogSink | Outputs to destination (console/file/both) |
| Logger | Orchestrates filtering, sanitization, formatting, sinking |


## 2. Log Entry Structure

The LogEntry interface captures all relevant information:

```typescript
export interface LogEntry {
  // Metadata
  timestamp: string;           // ISO 8601
  level: LogLevel;             // DEBUG, INFO, WARN, ERROR
  category: LogCategory;       // PROMPT, RESPONSE, METRICS, ERROR, CONFIG

  // Request tracking
  request_id: string;
  context?: RequestContext;    // user_id, session_id, ip_address, user_agent

  // Content
  messages?: LogMessage[];     // For prompts (all roles, content)
  content?: string;            // For responses or plain text

  // Model/provider info
  model?: ModelInfo;           // provider, model, base_url

  // Metrics
  token_usage?: TokenUsage;    // prompt_tokens, completion_tokens, total_tokens
  timing?: TimingInfo;         // TTFB, total_duration, timestamps

  // Status
  success: boolean;
  error_code?: string;
  error_message?: string;

  // Streaming
  is_streaming?: boolean;
  streaming_chunk_index?: number;
}
```


## 4. Log Categories

| Category | Content Logged |
|----------|---------------|
| PROMPT | All incoming messages (roles, content, function calls) |
| RESPONSE | Outgoing responses (full content or chunks) |
| METRICS | Token usage, latency/timing information |
| ERROR | Error codes, error messages, stack traces |
| CONFIG | Provider/model configuration changes |


## 3. Log Levels

| Level | Value | Use Case |
|-------|-------|----------|
| DEBUG | 0 | Detailed request/response dumps, streaming chunks |
| INFO | 1 | Normal operations, successful requests |
| WARN | 2 | Retries, partial failures, slow responses |
| ERROR | 3 | Failed requests, provider errors, timeouts |


## 5. Formatters

### 5.1 JSON Formatter

Machine-readable output for log aggregation systems (ELK, Splunk, Datadog).

```typescript
export class JsonFormatter implements ILogFormatter {
    get content_type(): string { return 'application/json'; }
    format(entry: LogEntry): string {
        return JSON.stringify(entry);
    }
}
```

### 5.2 Text Formatter

Human-readable format for development and debugging.

```
[2026-05-10T12:30:00Z] [INFO] [PROMPT] [req-123] [openai/gpt-4]
  Messages:
    [user] Hello, how are you?
  Tokens: prompt=10 completion=0 total=10
  Latency: 150ms
```


## 6. Sinks (Output Destinations)

### 6.1 Console Sink

Output to stdout/stderr. Best for development.

```typescript
export class ConsoleSink implements ILogSink {
    write(entry: LogEntry): void {
        const output = this.formatter.format(entry);
        if (entry.level >= LogLevel.ERROR) {
            console.error(output);
        } else {
            console.log(output);
        }
    }
}
```

### 6.2 File Sink

Rotating file output for production. Features:
- File rotation by size or time
- Compressed archives (.gz)
- Configurable retention period

```typescript
export class FileSink implements ILogSink {
    constructor(
        private filename: string,
        private maxSizeMB: number = 100,
        private maxFiles: number = 10
    ) {}
    async write(entry: LogEntry): Promise<void> {
        // Rotate if needed, then append
    }
}
```

### 6.3 Dual Sink

Write to both console and file simultaneously.

```typescript
export class DualSink implements ILogSink {
    constructor(private console: ILogSink, private file: ILogSink) {}
    async write(entry: LogEntry): Promise<void> {
        await Promise.all([this.console.write(entry), this.file.write(entry)]);
    }
}
```


## 7. Privacy and Sanitization

### 7.1 Privacy Concerns

Prompts may contain sensitive data that should not be logged:
- Personal Identifiable Information (PII)
- API keys or credentials embedded in requests
- Health or financial information
- Proprietary business data


### 7.2 Sanitization Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| Field redaction | Replace entire field with [REDACTED] | user_id, ip_address |
| Pattern matching | Regex replacement for known patterns | Credit cards, SSNs, API keys |
| Content truncation | Limit logged content length | Very long prompts |
| Category exclusion | Do not log certain categories | Full PROMPT logs in prod |


### 7.3 Recommended Production Settings

```typescript
const productionSanitization: SanitizationConfig = {
    redact_fields: ['user_id', 'ip_address'],
    content_patterns: [
        { pattern: 'sk-[a-zA-Z0-9]{20,}', replacement: 'sk-[REDACTED]' },
        { pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b', replacement: 'XXX-XX-XXXX' }
    ],
    max_content_length: 1000
};
```


## 8. Streaming Response Logging

### 8.1 Options

| Option | Pros | Cons |
|--------|------|------|
| Log final only | Lower volume, simpler processing | No visibility into streaming issues |
| Log incrementally | Full visibility, troubleshooting | High volume, performance overhead |
| Log first + last N | Balance of visibility and volume | May miss middle issues |

### 8.2 Recommended Approach

Log streaming responses in chunks only at DEBUG level, with chunk index:

```typescript
// At DEBUG level, log every Nth chunk or first/last
if (level === LogLevel.DEBUG && is_streaming) {
    // Log first chunk, last chunk, and every 10th chunk
    if (chunkIndex === 0 || chunkIndex % 10 === 0 || isLastChunk) {
        sink.write(entry);
    }
}
```

### 8.3 Streaming Log Entry Additions

```typescript
is_streaming: boolean;       // True if this is a streaming response
streaming_chunk_index: number; // Monotonic index per request
// content contains just the chunk, not full response
```


## 9. Performance Considerations

### 9.1 Async Logging

Always use async I/O to avoid blocking the request thread:

```typescript
export class AsyncLogger {
    private buffer: LogEntry[] = [];
    private flushInterval: NodeJS.Timeout;

    constructor(private bufferSize = 100) {
        this.flushInterval = setInterval(() => this.flush(), 1000);
    }

    async log(entry: LogEntry): Promise<void> {
        this.buffer.push(entry);
        if (this.buffer.length >= this.bufferSize) {
            await this.flush();
        }
    }
}
```

### 9.2 Performance Impact Summary

| Operation | Latency Impact |
|-----------|---------------|
| Console logging (sync) | 0.1-0.5ms per entry |
| File logging (async, buffered) | 1-5ms per entry |
| JSON serialization | 0.05-0.2ms per entry |
| Sanitization regex | 0.01-0.1ms per entry |

### 9.3 Recommendations

- Use async mode in production
- Buffer entries and flush periodically
- Use JSON formatter in production (easier to parse/query)
- Use Text formatter for development only
- Sample or filter at high load


## 10. Usage Example

```typescript
import { Logger, LogLevel, LogCategory } from './src/logger';
import { JsonFormatter, TextFormatter } from './src/formatters';
import { ConsoleSink, FileSink } from './src/sinks';

// Development: Console with text format
const devLogger = new Logger({
    level: LogLevel.DEBUG,
    formatter: new TextFormatter(),
    sinks: [new ConsoleSink()]
});

// Production: Dual sink with JSON, sanitization
const prodLogger = new Logger({
    level: LogLevel.INFO,
    formatter: new JsonFormatter(),
    sinks: [new ConsoleSink(), new FileSink('./logs/api.log')],
    sanitization: {
        redact_fields: ['user_id', 'ip_address'],
        content_patterns: [
            { pattern: 'sk-[a-zA-Z0-9]{20,}', replacement: 'sk-[REDACTED]' }
        ],
        max_content_length: 1000
    }
});

// Log a prompt
await logger.logPrompt({
    request_id: 'req-123',
    messages: [{ role: 'user', content: 'Hello' }],
    model: { provider: 'openai', model: 'gpt-4' }
});

// Log a response
await logger.logResponse({
    request_id: 'req-123',
    content: 'Hello! How can I help you?',
    token_usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    timing: { total_duration_ms: 150, request_received_at: '...', response_sent_at: '...' },
    success: true
});
```


### 11.2 Key Implementation Decisions

1. **Separation of Concerns**: Formatters handle serialization, sinks handle output, logger orchestrates.

2. **Interface-based Design**: All formatters and sinks implement interfaces, allowing easy testing and extension.

3. **Sanitization at Logger Level**: Sanitization happens before formatting, ensuring no sensitive data reaches sinks.

4. **Streaming Chunk Index**: Each chunk gets an incrementing index to enable reconstruction or sampling.

5. **Buffer-based Async**: Uses an in-memory buffer flushed periodically to reduce I/O overhead.

6. **TTFB Tracking**: Separate tracking of time-to-first-byte for streaming response performance analysis.


## 11. Implementation Notes

### 11.1 File Structure

```
src/
|-- interfaces/
|   |-- types.ts          # All TypeScript interfaces and enums
|
|-- formatters/
|   |-- JsonFormatter.ts  # JSON output for machine parsing
|   |-- TextFormatter.ts  # Human-readable text output
|
|-- sinks/
|   |-- ConsoleSink.ts    # stdout/stderr output
|   |-- FileSink.ts       # Rotating file output
|   |-- DualSink.ts       # Both console and file
|
|-- utils/
|   |-- Sanitizer.ts      # Content sanitization utilities
|   |-- Filter.ts         # Log filtering utilities
|
|-- Logger.ts            # Main logger class
|-- index.ts             # Public exports
```


### 11.3 Testing Recommendations

- Unit test formatters with sample LogEntry objects
- Unit test sanitizer with known sensitive patterns
- Integration test with actual file I/O
- Benchmark serialization performance with realistic payloads
- Test stream chunk logging under load

### 11.4 Future Enhancements

- Add structured query support (like Loki/Prometheus labels)
- Add log compression for file sinks
- Add network sink for remote logging (Elasticsearch, etc.)
- Add sampling rate configuration for high-volume scenarios
- Add automatic log retention policies
