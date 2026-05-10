import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { createLogger } from '../lib/logger.js';
import { getProvider } from '../lib/providers.js';
import { env } from '../lib/config.js';

const logger = createLogger('chat');
const chat = new Hono();

chat.post('/completions', async (c) => {
  const body = await c.req.json();
  const model = body.model || 'gpt-3.5-turbo';
  const providerName = body.provider || env.DEFAULT_PROVIDER || 'openai';

  logger.info({ model, provider: providerName }, 'Chat completion request');

  try {
    const provider = getProvider(providerName);
    const response = await provider.chat(model, body);

    if (body.stream) {
      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');

      return stream(c, async (stream) => {
        await provider.streamChat(model, body, stream);
      });
    }

    return c.json(response);
  } catch (error) {
    logger.error({ error }, 'Chat completion failed');
    return c.json({ error: { message: error.message, type: 'internal_error' } }, 500);
  }
});

export { chat as chatRoutes };