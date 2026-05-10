---
title: "Decision: Local OpenAI-Compatible Proxy"
type: decision
tags: [architecture, opencode, proxy, provider-selection]
last_updated: 2026-05-10
---

# Decision: Local OpenAI-Compatible Proxy

## Status

Proposed.

## Decision

Bangun local OpenAI-compatible proxy di parent project `thinking-method` dan arahkan OpenCode ke `http://localhost:30000/v1`.

## Context

User ingin OpenCode bisa memakai provider yang bisa dipilih, terutama Minimax, sambil prompt diproses melalui multi-pass thinking pipeline dan seluruh prompt/output tiap step terlihat di logging/training trace.

## Alternatives Considered

### Direct OpenCode to Minimax

- Lebih sederhana.
- Tidak memberi tempat terpusat untuk multi-pass orchestration dan logging/training trace custom.
- Bergantung pada apakah Minimax sudah OpenAI-compatible penuh.

### Local OpenAI-Compatible Proxy

- Lebih banyak kode.
- Memberi kontrol penuh atas provider selection, sequential thinking orchestration, logging, training trace, dan error normalization.
- Memungkinkan provider lain ditambahkan tanpa mengubah OpenCode.

### Patch OpenCode Internals

- Risiko tinggi dan sulit dipelihara.
- Tidak portable untuk eksperimen provider lain.

## Consequences

- Project perlu runtime server sendiri dan konfigurasi `.env`.
- Kompatibilitas OpenAI harus dijaga pada endpoint `/v1/chat/completions` dan `/v1/models`.
- Logging harus punya sanitizer kuat karena prompt dan response bisa sensitif.
- Provider abstraction harus dijaga agar Minimax bukan hardcoded di route layer.
- Multi-pass pipeline membuat latency dan token usage meningkat karena satu request user dapat menjadi 10 provider calls plus final aggregation.

## Related

- [[001.openai-compatible-thinking-method-proxy]]
- [[openai-compatible-proxy]]
- [[provider-registry]]
- [[thinking-prompt-pipeline]]
- [[logging-system]]
