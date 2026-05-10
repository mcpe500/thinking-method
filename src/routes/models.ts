import { Hono } from 'hono';
import { createLogger } from '../lib/logger.js';
import { getProvider } from '../lib/providers.js';

const logger = createLogger('models');
const models = new Hono();

models.get('/models', async (c) => {
  const providerName = c.req.query('provider') || 'openai';

  logger.info({ provider: providerName }, 'Models list request');

  try {
    const provider = getProvider(providerName);
    const modelList = await provider.listModels();
    return c.json(modelList);
  } catch (error) {
    logger.error({ error }, 'Models list failed');
    return c.json({ error: { message: error.message, type: 'internal_error' } }, 500);
  }
});

export { models as modelRoutes };