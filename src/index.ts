import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from './config/env.js';
import { registry } from './providers/registry.js';
import { MinimaxProvider } from './providers/minimax.js';
import { ThinkingOrchestrator } from './pipeline/ThinkingOrchestrator.js';
import { resolveModel } from './models/modelResolver.js';
import { generateRequestId, generateChatId } from './utils/requestId.js';
import { logPrompt, logStep, logResponse, logMetrics, logError } from './logging/Logger.js';
import { createErrorResponse, ErrorCodes } from './errors/openaiError.js';
import type { ChatCompletionRequest, ChatCompletionResponse } from './http/openaiTypes.js';

registry.register('minimax', new MinimaxProvider());

console.log(`[PROXY] Starting on port ${env.PORT} | baseURL: ${env.MINIMAX_BASE_URL} | model: ${env.DEFAULT_MODEL} | pipeline: ${env.THINKING_PIPELINE_ENABLED ? 'ON' : 'OFF'}(${env.THINKING_STEP_COUNT} steps)`);

const app = new Hono();

app.use('*', cors());

app.get('/health', (c) => {
  const statuses = registry.healthAll();
  return c.json({ status: 'ok', providers: statuses });
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
  console.log(`[REQ] ${requestId} | resolved: provider=${resolution.success ? resolution.data.provider : 'ERROR'} model=${resolution.success ? resolution.data.upstreamModel : 'ERROR'}`);

  if (!resolution.success) {
    logError(requestId, resolution.error.code, resolution.error.message);
    return c.json(resolution.error.toJSON(), resolution.error.status as any);
  }

  const upstreamModel = resolution.data.upstreamModel;
  if (!upstreamModel || upstreamModel === 'unknown') {
    const err = createErrorResponse(
      `Invalid model resolution: upstreamModel='${upstreamModel}'. Check model format (e.g., 'minimax/MiniMax-M2.7')`,
      'invalid_request_error',
      'MODEL_RESOLUTION_FAILED',
      400
    );
    logError(requestId, err.code, err.message);
    return c.json(err.toJSON(), err.status as any);
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
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const chunk = {
            id: response.id,
            object: 'chat.completion.chunk',
            created: response.created,
            model: response.model,
            choices: [{
              index: 0,
              delta: { content: pipelineResult.final_answer },
              finish_reason: null,
            }],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          const doneChunk = {
            ...chunk,
            choices: [{ ...chunk.choices[0], finish_reason: 'stop' }],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneChunk)}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
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

app.get('/v1/models', async (c) => {
  try {
    const provider = registry.get('minimax');
    const models = await provider.listModels();
    return c.json(models);
  } catch (error) {
    return c.json(
      createErrorResponse(
        'Internal server error',
        'internal_server_error',
        ErrorCodes.INTERNAL_ERROR,
        500
      ).toJSON(),
      500
    );
  }
});

app.notFound((c) => c.json({ error: { message: 'Not found', type: 'internal_error' } }, 404));

serve({
  fetch: app.fetch,
  port: env.PORT,
});

console.log(`[PROXY] Listening on http://127.0.0.1:${env.PORT}`);