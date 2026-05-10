---
title: "Logging System"
type: component
tags: [logging, observability, prompt, response, sanitizer]
last_updated: 2026-05-10
---

# Logging System

`logging-system` mengikuti desain di `LOGGING_DESIGN.md` untuk mencatat alur request proxy secara terstruktur.

## Existing Design

Desain yang sudah ada:

```text
LogEntry -> Logger -> Formatter -> Sink -> Output
           |
           +-- Filter
           +-- Sanitizer
```

Interface dasar sudah tersedia di `src/interfaces/types.ts`:

- `LogEntry`
- `LogLevel`
- `LogCategory`
- `ILogFormatter`
- `ILogSink`
- `LoggerConfig`

## Responsibilities

- Mencatat prompt asli dari request OpenCode.
- Mencatat prompt dan output untuk setiap step dari [[thinking-prompt-pipeline]].
- Mencatat final aggregation prompt dan final answer.
- Mencatat response dari provider seperti Minimax untuk semua provider calls.
- Mencatat metrics seperti latency, token usage, streaming timing, total provider calls, dan per-step timing.
- Mencatat error provider/config dalam bentuk sanitized.
- Menyediakan formatter text dan JSON.
- Menyediakan sink console dan file.
- Menulis training trace terstruktur jika `TRAINING_TRACE_ENABLED=true`.

## Required Categories

- `PROMPT`
- `RESPONSE`
- `METRICS`
- `ERROR`
- `CONFIG`

## Training Trace

Training trace wajib memungkinkan user melihat ulang seluruh proses:

```text
request id
original messages
provider/model
step 1 prompt + output + metrics
step 2 prompt + output + metrics
...
step 10 prompt + output + metrics
final prompt
final answer
total usage
```

## Sanitization Rules

- Redact API key, authorization header, cookies, bearer token, dan secret environment.
- Jangan kirim stack trace internal ke client.
- Content logging harus bisa dikontrol dengan `LOG_INCLUDE_CONTENT`.
- Long content boleh dipotong sesuai `max_content_length`.
- Training trace tetap wajib melewati sanitizer sebelum ditulis.

## Related Components

- [[openai-compatible-proxy]]
- [[provider-registry]]
- [[thinking-prompt-pipeline]]
- [[001.openai-compatible-thinking-method-proxy]]
