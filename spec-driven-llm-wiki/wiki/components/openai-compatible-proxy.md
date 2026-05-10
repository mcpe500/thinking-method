---
title: "OpenAI-Compatible Proxy"
type: component
tags: [proxy, openai-compatible, opencode, http]
last_updated: 2026-05-10
---

# OpenAI-Compatible Proxy

`openai-compatible-proxy` adalah komponen HTTP lokal di parent project `thinking-method` yang menyediakan API kompatibel OpenAI untuk OpenCode dan client lain.

## Responsibilities

- Menjalankan server lokal di `localhost:30000`.
- Menyediakan endpoint `GET /health`, `GET /v1/models`, dan `POST /v1/chat/completions`.
- Menerima request OpenAI Chat Completions dari OpenCode.
- Memanggil [[provider-registry]] untuk memilih provider dan model upstream.
- Memanggil [[thinking-prompt-pipeline]] untuk menjalankan default 10 provider calls berurutan sebelum final answer.
- Memanggil [[logging-system]] untuk mencatat prompt, response, metrics, dan error.
- Mengembalikan response dan error dalam format OpenAI-compatible.

## Inputs

- OpenAI-compatible chat completion request.
- Runtime config dari `.env`.
- Provider registry yang sudah berisi provider seperti `minimax`.

## Outputs

- OpenAI-compatible chat completion response.
- OpenAI-compatible error response.
- Structured logs untuk observability.
- Training trace berisi prompt/output tiap thinking step jika enabled.

## Related Spec

- [[001.openai-compatible-thinking-method-proxy]]
- [[local-openai-compatible-proxy]]
