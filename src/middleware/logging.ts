import { Context, Next } from 'hono';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('http');

export async function loggingMiddleware(c: Context, next: Next) {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  logger.info({ method, path }, 'Incoming request');

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  logger.info({ method, path, status, duration }, 'Response sent');
}