---
title: "Multi-Pass Thinking Pipeline"
type: component
tags: [prompt, pipeline, thinking-method, multi-pass, training-data]
last_updated: 2026-05-10
---

# Multi-Pass Thinking Pipeline

`thinking-prompt-pipeline` adalah orchestrator multi-pass yang menjalankan beberapa provider call berurutan sebelum final answer dikembalikan ke user.

Ini bukan satu system prompt besar. Alurnya adalah `prompt user -> step 1 -> hasil 1 -> step 2 -> hasil 2 -> ... -> step 10 -> hasil 10 -> final aggregation -> response user`.

## Responsibilities

- Menerima `messages` dari OpenAI-compatible request.
- Mempertahankan semua message asli dari client.
- Menjalankan default 10 thinking step secara serial.
- Memakai output step sebelumnya sebagai context untuk step berikutnya.
- Menjalankan final aggregation setelah semua thinking step selesai.
- Mengembalikan hanya final answer ke user secara default.
- Menyimpan semua prompt step, output step, metrics, dan final answer ke [[logging-system]] serta training trace.
- Dapat dimatikan melalui `THINKING_PIPELINE_ENABLED=false`.

## Required MVP Thinking Sequence

1. Problem Framing
2. First Principles Thinking
3. Socratic Thinking
4. Root Cause Thinking
5. Systems Thinking
6. Hypothesis-Driven Thinking
7. Inversion Thinking
8. Trade-off Thinking
9. Second-Order Thinking
10. Probabilistic Thinking

Default MVP wajib menggunakan tepat 10 provider calls di atas. `Decision Matrix` dan `Synthesis` bisa menjadi deferred extended analysis, sedangkan `Answer` dibuat oleh final aggregation setelah 10 output selesai.

## Step Contract

Setiap step menghasilkan record:

```text
step_index
step_name
step_prompt
step_output
provider
model
usage
timing
success
```

Step berikutnya menerima `original_messages` dan semua `previous_step_results`.

## Output Contract

Final aggregator mengembalikan response user:

```text
<ANSWER>
jawaban final yang jelas dan praktis
</ANSWER>
```

## Observability

Pipeline harus mengirim prompt asli, prompt step 1-10, output step 1-10, final prompt, dan final answer ke [[logging-system]] sesuai setting redaction, `LOG_INCLUDE_CONTENT`, dan `TRAINING_TRACE_ENABLED`.

## Related Spec

- [[001.openai-compatible-thinking-method-proxy]]
