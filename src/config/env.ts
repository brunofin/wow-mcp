import { z } from 'zod';

const envSchema = z.object({
  BNET_CLIENT_ID: z.string().min(1, 'BNET_CLIENT_ID is required'),
  BNET_CLIENT_SECRET: z.string().min(1, 'BNET_CLIENT_SECRET is required'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  HTTP_RETRY_LIMIT: z.coerce.number().int().min(0).default(2),
  CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(300),
  CACHE_SIZE: z.coerce.number().int().min(0).default(500),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | undefined;

export function loadEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const fields = result.error.flatten().fieldErrors;
    // Never log secrets – only field names + messages
    console.error('❌ Invalid environment variables:', JSON.stringify(fields, null, 2));
    process.exit(1);
  }

  _env = result.data;
  return _env;
}
