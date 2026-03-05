/**
 * OAuth 2.1 provider for the MCP HTTP endpoint.
 *
 * Implements:
 *  - RFC 9728  Protected Resource Metadata  (/.well-known/oauth-protected-resource)
 *  - RFC 8414  Authorization Server Metadata (/.well-known/oauth-authorization-server)
 *  - RFC 7591  Dynamic Client Registration   (POST /register)
 *  - OAuth 2.1 Authorization Code + PKCE     (GET|POST /authorize, POST /token)
 *  - OAuth 2.0 Client Credentials grant      (POST /token) — fallback for CLI/Warp
 *
 * Storage is delegated to an OAuthStore implementation (in-memory or PostgreSQL).
 */

import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Env } from './config/env.js';
import { createStore, type OAuthStore } from './store/index.js';
import { logger } from './util/logger.js';

// ── Env check ──────────────────────────────────────────────────────────────────

export function isAuthEnabled(env: Env): boolean {
  return Boolean(env.MCP_AUTH_SECRET);
}

// ── Store lifecycle ────────────────────────────────────────────────────────────

let store: OAuthStore;
let cleanupTimer: ReturnType<typeof setInterval> | undefined;

/** Initialise the OAuth store. Must be called once before handling requests. */
export async function initAuthStore(env: Env): Promise<void> {
  store = await createStore(env);

  // Periodic cleanup of expired auth codes & tokens
  if (cleanupTimer) clearInterval(cleanupTimer);
  cleanupTimer = setInterval(() => { void store.cleanup(); }, 60_000);
  cleanupTimer.unref();
}

/** Shut down the store (pool connections, etc.). */
export async function closeAuthStore(): Promise<void> {
  if (cleanupTimer) { clearInterval(cleanupTimer); cleanupTimer = undefined; }
  await store?.close();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, body: unknown, extraHeaders?: Record<string, string>): void {
  res.writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, limit = 64 * 1024): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/** Derive the public-facing base URL from the request (reverse-proxy aware). */
export function getBaseUrl(req: IncomingMessage): string {
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() ?? 'http';
  const host = (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim() ?? req.headers['host'] ?? 'localhost';
  return `${proto}://${host}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── PKCE ───────────────────────────────────────────────────────────────────────

function verifyCodeChallenge(codeVerifier: string, codeChallenge: string, method: string): boolean {
  if (method !== 'S256') return false;
  const computed = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return computed === codeChallenge;
}

// ── Protected Resource Metadata (RFC 9728) ─────────────────────────────────────

export function handleProtectedResourceMetadata(env: Env, req: IncomingMessage, res: ServerResponse): void {
  if (!isAuthEnabled(env)) { res.writeHead(404).end(); return; }
  const base = getBaseUrl(req);
  json(res, 200, {
    resource: base,
    authorization_servers: [base],
    bearer_methods_supported: ['header'],
  });
}

// ── Authorization Server Metadata (RFC 8414) ──────────────────────────────────

export function handleAuthServerMetadata(env: Env, req: IncomingMessage, res: ServerResponse): void {
  if (!isAuthEnabled(env)) { res.writeHead(404).end(); return; }
  const base = getBaseUrl(req);
  json(res, 200, {
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'client_credentials'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: [],
  });
}

// ── Dynamic Client Registration (RFC 7591) ────────────────────────────────────

export async function handleRegister(env: Env, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthEnabled(env)) { res.writeHead(404).end(); return; }
  if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }).end(); return; }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse((await readBody(req)).toString('utf8')) as Record<string, unknown>;
  } catch {
    json(res, 400, { error: 'invalid_request', error_description: 'Invalid JSON body' });
    return;
  }

  const redirectUris = Array.isArray(body['redirect_uris']) ? (body['redirect_uris'] as string[]) : [];
  const clientName = typeof body['client_name'] === 'string' ? body['client_name'] : undefined;
  const grantTypes = Array.isArray(body['grant_types']) ? (body['grant_types'] as string[]) : ['authorization_code'];
  const responseTypes = Array.isArray(body['response_types']) ? (body['response_types'] as string[]) : ['code'];
  const tokenEndpointAuthMethod =
    typeof body['token_endpoint_auth_method'] === 'string' ? body['token_endpoint_auth_method'] : 'none';

  const clientId = crypto.randomUUID();
  const record = { clientId, redirectUris, clientName, grantTypes, responseTypes, tokenEndpointAuthMethod };
  await store.setClient(clientId, record);

  logger.info({ clientId, clientName }, 'Registered new OAuth client');

  json(res, 201, {
    client_id: clientId,
    client_name: clientName,
    redirect_uris: redirectUris,
    grant_types: grantTypes,
    response_types: responseTypes,
    token_endpoint_auth_method: tokenEndpointAuthMethod,
  });
}

// ── Authorization Endpoint ─────────────────────────────────────────────────────

function renderAuthorizePage(params: Record<string, string>, error?: string): string {
  const hidden = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`)
    .join('\n      ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize — WoW MCP</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 420px; margin: 80px auto; padding: 0 20px; }
    h1 { font-size: 1.4em; }
    label { display: block; margin: 16px 0 6px; font-weight: 600; }
    input[type="password"] { width: 100%; padding: 10px; font-size: 1em; box-sizing: border-box; border: 1px solid #ccc; border-radius: 6px; }
    button { margin-top: 16px; padding: 10px 24px; font-size: 1em; cursor: pointer; border: none; border-radius: 6px; background: #4f46e5; color: #fff; }
    .error { color: #c00; margin-top: 12px; }
  </style>
</head>
<body>
  <h1>🛡️ WoW MCP Authorization</h1>
  <p>Enter the server passphrase to authorize this client.</p>
  ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
  <form method="POST" action="/authorize">
    ${hidden}
    <label for="passphrase">Passphrase</label>
    <input type="password" id="passphrase" name="passphrase" required autofocus>
    <button type="submit">Authorize</button>
  </form>
</body>
</html>`;
}

export async function handleAuthorize(env: Env, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthEnabled(env)) { res.writeHead(404).end(); return; }

  if (req.method === 'GET') {
    const url = new URL(req.url ?? '/', getBaseUrl(req));
    const params: Record<string, string> = {};
    for (const key of ['response_type', 'client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state', 'scope']) {
      const v = url.searchParams.get(key);
      if (v) params[key] = v;
    }

    if (params['response_type'] !== 'code' || !params['client_id'] || !params['redirect_uri'] || !params['code_challenge']) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(renderAuthorizePage(params, 'Missing required OAuth parameters.'));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(renderAuthorizePage(params));
    return;
  }

  if (req.method === 'POST') {
    const body = (await readBody(req)).toString('utf8');
    const form = new URLSearchParams(body);

    const responseType = form.get('response_type') ?? '';
    const clientId = form.get('client_id') ?? '';
    const redirectUri = form.get('redirect_uri') ?? '';
    const codeChallenge = form.get('code_challenge') ?? '';
    const codeChallengeMethod = form.get('code_challenge_method') ?? 'S256';
    const state = form.get('state') ?? '';
    const scope = form.get('scope') ?? '';
    const passphrase = form.get('passphrase') ?? '';

    const hidden: Record<string, string> = {};
    for (const key of ['response_type', 'client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state', 'scope']) {
      const v = form.get(key);
      if (v) hidden[key] = v;
    }

    if (responseType !== 'code' || !clientId || !redirectUri || !codeChallenge) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(renderAuthorizePage(hidden, 'Missing required OAuth parameters.'));
      return;
    }

    if (!passphrase || !safeEqual(passphrase, env.MCP_AUTH_SECRET ?? '')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(renderAuthorizePage(hidden, 'Incorrect passphrase. Please try again.'));
      return;
    }

    const code = crypto.randomBytes(32).toString('base64url');
    await store.setAuthCode(code, {
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      expiresAtMs: Date.now() + 10 * 60 * 1000,
      scope: scope || undefined,
    });

    const redirect = new URL(redirectUri);
    redirect.searchParams.set('code', code);
    if (state) redirect.searchParams.set('state', state);

    res.writeHead(302, { Location: redirect.toString() });
    res.end();
    return;
  }

  res.writeHead(405, { Allow: 'GET, POST' }).end();
}

// ── Token Endpoint ─────────────────────────────────────────────────────────────

export async function handleTokenRequest(env: Env, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthEnabled(env)) { json(res, 404, { error: 'not_found' }); return; }
  if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }).end(); return; }

  let formParams: URLSearchParams;
  try {
    formParams = new URLSearchParams((await readBody(req)).toString('utf8'));
  } catch (err) {
    logger.warn({ err }, 'Failed reading /token body');
    json(res, 400, { error: 'invalid_request' });
    return;
  }

  const grantType = formParams.get('grant_type');
  const ttlSeconds = env.MCP_TOKEN_TTL_SECONDS ?? 3600;

  // ── authorization_code ────────────────────────────────────────────────────
  if (grantType === 'authorization_code') {
    const code = formParams.get('code') ?? '';
    const codeVerifier = formParams.get('code_verifier') ?? '';
    const redirectUri = formParams.get('redirect_uri') ?? '';
    const clientId = formParams.get('client_id') ?? '';

    const rec = await store.getAuthCode(code);
    if (!rec) {
      json(res, 400, { error: 'invalid_grant', error_description: 'Unknown or expired authorization code' });
      return;
    }

    await store.deleteAuthCode(code);

    if (rec.expiresAtMs <= Date.now()) {
      json(res, 400, { error: 'invalid_grant', error_description: 'Authorization code expired' });
      return;
    }

    if (rec.clientId !== clientId || rec.redirectUri !== redirectUri) {
      json(res, 400, { error: 'invalid_grant', error_description: 'Client ID or redirect URI mismatch' });
      return;
    }

    if (!codeVerifier || !verifyCodeChallenge(codeVerifier, rec.codeChallenge, rec.codeChallengeMethod)) {
      json(res, 400, { error: 'invalid_grant', error_description: 'PKCE verification failed' });
      return;
    }

    const token = crypto.randomBytes(32).toString('base64url');
    await store.setToken(token, { expiresAtMs: Date.now() + ttlSeconds * 1000 });

    json(res, 200, {
      access_token: token,
      token_type: 'Bearer',
      expires_in: ttlSeconds,
      ...(rec.scope ? { scope: rec.scope } : {}),
    }, { 'Cache-Control': 'no-store' });
    return;
  }

  // ── client_credentials (fallback for Warp / CLI) ──────────────────────────
  if (grantType === 'client_credentials') {
    const clientSecret = formParams.get('client_secret') ?? '';
    if (!clientSecret || !safeEqual(clientSecret, env.MCP_AUTH_SECRET ?? '')) {
      json(res, 401, { error: 'invalid_client' });
      return;
    }

    const token = crypto.randomBytes(32).toString('base64url');
    await store.setToken(token, { expiresAtMs: Date.now() + ttlSeconds * 1000 });

    json(res, 200, {
      access_token: token,
      token_type: 'Bearer',
      expires_in: ttlSeconds,
    }, { 'Cache-Control': 'no-store' });
    return;
  }

  json(res, 400, { error: 'unsupported_grant_type' });
}

// ── Bearer Token Validation ────────────────────────────────────────────────────

export async function validateBearerToken(env: Env, req: IncomingMessage): Promise<boolean> {
  if (!isAuthEnabled(env)) return true;

  const auth = req.headers['authorization'];
  if (typeof auth !== 'string') return false;

  const [scheme, token] = auth.split(' ', 2);
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return false;

  // Allow the raw MCP_AUTH_SECRET as a static bearer token (never expires).
  // This is the simplest auth path for clients that don't support OAuth (e.g. Warp).
  if (safeEqual(token, env.MCP_AUTH_SECRET ?? '')) return true;

  // Otherwise check the issued-token store.
  const rec = await store.getToken(token);
  if (!rec) return false;
  if (rec.expiresAtMs <= Date.now()) {
    await store.deleteToken(token);
    return false;
  }

  return true;
}
