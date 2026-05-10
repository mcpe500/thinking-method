import { z } from 'zod';

const envSchema = z.object({
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().default(30000),
  DEFAULT_PROVIDER: z.string().default('minimax'),
  DEFAULT_MODEL: z.string().default('abab6.5s-chat'),
  MINIMAX_API_KEY: z.string().optional(),
  MINIMAX_BASE_URL: z.string().default('https://api.minimax.chat'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'text']).default('text'),
  LOG_DIR: z.string().default('logs'),
  LOG_INCLUDE_CONTENT: z.string().default('true').transform(v => v === 'true'),
  THINKING_PIPELINE_ENABLED: z.string().default('true').transform(v => v === 'true'),
  THINKING_STEP_COUNT: z.coerce.number().default(10),
  THINKING_RETURN_MODE: z.enum(['final', 'all']).default('final'),
  TRAINING_TRACE_ENABLED: z.string().default('true').transform(v => v === 'true'),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;
  cachedEnv = envSchema.parse(process.env);
  return cachedEnv;
}

export const env = loadEnv();
