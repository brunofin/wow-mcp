import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Env } from './config/env.js';
import { logger } from './util/logger.js';

export function isAuthEnabled(env: Env): boolean {
  return Boolean(env.MCP_CLIENT_ID && env.MCP_CLIENT_SECRET);
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);

  // timingSafeEqual throws if lengths differ.
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

type TokenRecord = {
  expiresAtMs: number;
};

const tokenStore = new Map<string, TokenRecord>();
let cleanupIntervalStarted = false;

function startCleanupLoop(): void {
  if (cleanupIntervalStarted) return;
  cleanupIntervalStarted = true;

  // Cleanup isn't critical; keep it simple.
  setInterval(() => {
    const now = Date.now();
    for (const [token, rec] of tokenStore.entries()) {
      if (rec.expiresAtMs <= now) tokenStore.delete(token);
    }
  }, 60_000).unref();
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, limitBytes = 32 * 1024): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseBasicAuth(header: string | undefined): { clientId: string; clientSecret: string } | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ', 2);
  if (!scheme || scheme.toLowerCase() !== 'basic' || !value) return null;

  let decoded: string;
  try {
    decoded = Buffer.from(value, 'base64').toString('utf8');
  } catch {
    return null;
  }

  // Per RFC 7617, username:password
  const idx = decoded.indexOf(':');
  if (idx < 0) return null;
  return {
    clientId: decoded.slice(0, idx),
    clientSecret: decoded.slice(idx + 1),
  };
}

export function validateBearerToken(env: Env, req: IncomingMessage): boolean {
  if (!isAuthEnabled(env)) return true;

  const auth = req.headers['authorization'];
  if (typeof auth !== 'string') return false;

  const [scheme, token] = auth.split(' ', 2);
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return false;

  const rec = tokenStore.get(token);
  if (!rec) return false;
  if (rec.expiresAtMs <= Date.now()) {
    tokenStore.delete(token);
    return false;
  }

  return true;
}

export async function handleTokenRequest(env: Env, req: IncomingMessage, res: ServerResponse): Promise<void> {
  startCleanupLoop();

  if (!isAuthEnabled(env)) {
    json(res, 404, { error: 'not_found' });
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { Allow: 'POST' }).end();
    return;
  }

  // Accept client credentials via HTTP Basic (preferred), or form body.
  const basic = parseBasicAuth(typeof req.headers['authorization'] === 'string' ? req.headers['authorization'] : undefined);

  let grantType: string | undefined;
  let clientId: string | undefined;
  let clientSecret: string | undefined;

  if (basic) {
    clientId = basic.clientId;
    clientSecret = basic.clientSecret;
  }

  try {
    const body = (await readBody(req)).toString('utf8');
    const params = new URLSearchParams(body);
    grantType = params.get('grant_type') ?? undefined;
    clientId = clientId ?? (params.get('client_id') ?? undefined);
    clientSecret = clientSecret ?? (params.get('client_secret') ?? undefined);
  } catch (err) {
    logger.warn({ err }, 'Failed reading /token request body');
  }

  if (grantType !== 'client_credentials') {
    json(res, 400, { error: 'unsupported_grant_type' });
    return;
  }

  if (!clientId || !clientSecret) {
    json(res, 401, { error: 'invalid_client' });
    return;
  }

  const ok = safeEqual(clientId, env.MCP_CLIENT_ID ?? '') && safeEqual(clientSecret, env.MCP_CLIENT_SECRET ?? '');
  if (!ok) {
    json(res, 401, { error: 'invalid_client' });
    return;
  }

  const ttlSeconds = env.MCP_TOKEN_TTL_SECONDS ?? 3600;
  const token = crypto.randomBytes(32).toString('base64url');
  tokenStore.set(token, { expiresAtMs: Date.now() + ttlSeconds * 1000 });

  json(res, 200, {
    access_token: token,
    token_type: 'Bearer',
    expires_in: ttlSeconds,
  });
}
