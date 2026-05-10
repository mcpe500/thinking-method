import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { registry } from './providers/registry.js';
import { MinimaxProvider } from './providers/minimax.js';
import { createErrorResponse, ErrorCodes } from './errors/openaiError.js';
import type { ChatCompletionRequest } from './http/openaiTypes.js';

const logger = createLogger('server');

registry.register('minimax', new MinimaxProvider());

const app = new Hono();

app.use('*', cors());

app.get('/health', (c) => c.json({ status: 'ok' }));

app.post('/v1/chat/completions', async (c) => {
  try {
    const body = await c.req.json() as ChatCompletionRequest;
    const provider = registry.get('minimax');
    const response = await provider.chatCompletion(body);
    return c.json(response);
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      return c.json((error as any).toJSON(), (error as any).status);
    }
    logger.error(`Chat completion error: ${error}`);
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

app.get('/v1/models', async (c) => {
  try {
    const provider = registry.get('minimax');
    const models = await provider.listModels();
    return c.json(models);
  } catch (error) {
    logger.error(`List models error: ${error}`);
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

const port = env.PORT;

logger.info(`Starting server on port ${port}`);

console.log(`Server starting on http://127.0.0.1:${port}`);

serve({
  fetch: app.fetch,
  port,
});

export default app;