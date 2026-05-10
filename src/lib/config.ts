import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('30000'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  DEFAULT_PROVIDER: z.string().default('openai'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function config(): Env {
  if (cachedEnv) return cachedEnv;

  const rawEnv = {
    PORT: process.env.PORT || '30000',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    DEFAULT_PROVIDER: process.env.DEFAULT_PROVIDER || 'openai',
    LOG_LEVEL: (process.env.LOG_LEVEL as Env['LOG_LEVEL']) || 'info',
  };

  cachedEnv = envSchema.parse(rawEnv);
  return cachedEnv;
}

export const env: Env = (() => {
  const c = config();
  return new Proxy(c, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as keyof Env];
      }
      return undefined;
    },
  });
})();