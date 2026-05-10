---
title: "Provider Registry"
type: component
tags: [provider, registry, minimax, routing]
last_updated: 2026-05-10
---

# Provider Registry

`provider-registry` adalah komponen yang memisahkan route OpenAI-compatible dari detail provider upstream.

## Responsibilities

- Menyimpan daftar provider yang tersedia.
- Menentukan provider dan upstream model dari field `model` request.
- Mendukung format model `provider/model`.
- Menyediakan fallback ke `DEFAULT_PROVIDER` dan `DEFAULT_MODEL`.
- Mengekspos model list untuk endpoint `/v1/models`.
- Menyediakan health status per provider.

## Initial Provider

Provider awal yang wajib ada adalah `minimax`.

Aturan konfigurasi Minimax:

- API key dibaca dari `MINIMAX_API_KEY`.
- Base URL dibaca dari `MINIMAX_BASE_URL`.
- Default model dibaca dari `DEFAULT_MODEL`.
- Secret tidak boleh hardcoded atau muncul di log.

## Resolution Rules

```text
"minimax/abab6.5s-chat" -> provider=minimax, upstream_model=abab6.5s-chat
"abab6.5s-chat" -> provider=DEFAULT_PROVIDER, upstream_model=abab6.5s-chat
"" -> provider=DEFAULT_PROVIDER, upstream_model=DEFAULT_MODEL
```

## Related Components

- [[openai-compatible-proxy]]
- [[logging-system]]
- [[001.openai-compatible-thinking-method-proxy]]
