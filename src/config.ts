import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173'),
  MAX_MESSAGE_LENGTH: z.coerce.number().int().positive().default(4000),
  RATE_LIMIT_PER_SEC: z.coerce.number().int().positive().default(5),
  PERSISTENCE_PATH: z.string().default('./data/chat-store.json'),
  PERSISTENCE_FLUSH_MS: z.coerce.number().int().positive().default(2000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  port: env.PORT,
  host: env.HOST,
  corsOrigins: env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  maxMessageLength: env.MAX_MESSAGE_LENGTH,
  rateLimitPerSec: env.RATE_LIMIT_PER_SEC,
  persistencePath: env.PERSISTENCE_PATH,
  persistenceFlushMs: env.PERSISTENCE_FLUSH_MS,
  nodeEnv: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
} as const;

export type Config = typeof config;
