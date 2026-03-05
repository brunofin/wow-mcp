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
  // Optional OAuth 2.1 auth for the MCP HTTP endpoint.
  // When set, /mcp requires a Bearer token obtained via the OAuth authorization
  // code + PKCE flow (ChatGPT, browser clients) or client_credentials grant (Warp, CLI).
  // This value is the passphrase users enter on the /authorize login page,
  // and also serves as the client_secret for client_credentials grants.
  MCP_AUTH_SECRET: z.string().min(1).optional(),
  MCP_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  // Optional PostgreSQL connection string for persistent OAuth stores.
  // When set, tokens/clients/auth codes survive restarts.
  // When absent, in-memory stores are used (default).
  DATABASE_URL: z.string().min(1).optional(),
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
