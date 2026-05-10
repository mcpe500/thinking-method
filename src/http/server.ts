import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from '../config/env.js';
import { registry } from '../providers/registry.js';
import { MinimaxProvider } from '../providers/minimax.js';
import { ThinkingOrchestrator } from '../pipeline/ThinkingOrchestrator.js';
import { traceWriter } from '../training/traceWriter.js';
import { resolveModel } from '../models/modelResolver.js';
import { generateRequestId, generateChatId } from '../utils/requestId.js';
import { logPrompt, logStep, logResponse, logMetrics, logError } from '../logging/Logger.js';
import { sseLine, createDoneSignal } from '../streaming/sse.js';
import type { ChatCompletionRequest, ChatCompletionResponse } from './openaiTypes.js';

const app = new Hono();

app.use('*', cors());

console.log(`[PROXY] Starting on port ${env.PORT} | baseURL: ${env.MINIMAX_BASE_URL} | model: ${env.DEFAULT_MODEL} | pipeline: ${env.THINKING_PIPELINE_ENABLED ? 'ON' : 'OFF'}(${env.THINKING_STEP_COUNT} steps)`);

app.get('/health', (c) => {
  const providerStatuses = registry.healthAll();
  return c.json({
    status: 'ok',
    providers: providerStatuses,
  });
});

app.post('/v1/chat/completions', async (c) => {
  const requestId = generateRequestId();
  const body = await c.req.json() as ChatCompletionRequest;

  console.log(`[REQ] ${requestId} | model=${body.model} | msgs=${body.messages?.length || 0} | stream=${body.stream || false}`);

  logPrompt({
    requestId,
    provider: body.model?.split('/')[0] || 'minimax',
    model: body.model || 'unknown',
    messages: body.messages || [],
  });

  const resolution = resolveModel(body.model || '');
  if (!resolution.success) {
    logError(requestId, resolution.error.code, resolution.error.message);
    return c.json(resolution.error.toJSON(), resolution.error.status as any);
  }

  const provider = registry.get(resolution.data.provider);
  const orchestrator = new ThinkingOrchestrator(provider);

  try {
    const pipelineResult = await orchestrator.run(requestId, {
      ...body,
      model: resolution.data.upstreamModel,
    });

    for (const step of pipelineResult.steps) {
      logStep({
        requestId,
        stepIndex: step.step_index,
        stepName: step.step_name,
        prompt: step.step_prompt,
        output: step.step_output,
        success: step.success,
        usage: step.usage,
        timing: step.timing,
      });
    }

    logResponse({
      requestId,
      content: pipelineResult.final_answer,
      usage: pipelineResult.total_usage,
      timing: pipelineResult.total_timing,
    });

    logMetrics({
      requestId,
      totalCalls: pipelineResult.steps.length + 1,
      totalUsage: pipelineResult.total_usage,
      totalTimingMs: pipelineResult.total_timing?.durationMs || 0,
    });

    if (traceWriter.isEnabled()) {
      const trace = traceWriter.createTraceFromPipeline(
        requestId,
        body.messages || [],
        resolution.data.provider,
        resolution.data.upstreamModel,
        pipelineResult
      );
      traceWriter.write(trace);
    }

    const response: ChatCompletionResponse = {
      id: generateChatId(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: body.model || resolution.data.upstreamModel,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: pipelineResult.final_answer,
        },
        finish_reason: 'stop',
      }],
      usage: pipelineResult.total_usage,
    };

    if (body.stream) {
      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const chunk = {
            id: response.id,
            object: 'chat.completion.chunk',
            created: response.created,
            model: response.model,
            choices: [{
              index: 0,
              delta: { content: response.choices[0].message.content },
              finish_reason: null,
            }],
          };
          controller.enqueue(encoder.encode(sseLine(chunk)));
          await new Promise(resolve => setTimeout(resolve, 10));
          const doneChunk = {
            ...chunk,
            choices: [{ ...chunk.choices[0], finish_reason: 'stop' }],
          };
          controller.enqueue(encoder.encode(sseLine(doneChunk)));
          controller.enqueue(encoder.encode(createDoneSignal()));
          controller.close();
        },
      });
      return c.body(stream);
    }

    return c.json(response);
  } catch (error) {
    console.error(`[ERR] ${requestId} | ${error instanceof Error ? error.message : 'Unknown'}`);
    const message = error instanceof Error ? error.message : 'Unknown error';
    logError(requestId, 'PIPELINE_ERROR', message);
    return c.json({
      error: {
        message,
        type: 'internal_server_error',
        code: 'pipeline_error',
      },
    }, 500);
  }
});

export function createServer() {
  registry.register('minimax', new MinimaxProvider());

  console.log(`
╔═══════════════════════════════════════════════════════╗
║   OpenAI-Compatible Thinking Method Proxy             ║
║   Port: ${String(env.PORT).padEnd(41)}║
║   Pipeline: ${env.THINKING_PIPELINE_ENABLED ? 'enabled' : 'disabled'}                              ║
║   Steps: ${String(env.THINKING_STEP_COUNT).padEnd(44)}║
╚═══════════════════════════════════════════════════════╝
  `);

  return {
    fetch: app.fetch,
    port: env.PORT,
  };
}
