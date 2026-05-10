import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from './lib/logger.js';
import { config } from './lib/config.js';
import { chatRoutes } from './routes/chat.js';
import { modelRoutes } from './routes/models.js';
import { loggingMiddleware } from './middleware/logging.js';

const app = new Hono();

config();

app.use('*', cors());
app.use('*', loggingMiddleware);

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/v1', chatRoutes);
app.route('/v1', modelRoutes);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

logger.info(`Starting OpenAI-compatible proxy on port ${process.env.PORT || 30000}`);

export default {
  port: Number(process.env.PORT) || 30000,
  fetch: app.fetch,
};