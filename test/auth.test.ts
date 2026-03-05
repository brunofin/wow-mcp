import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { Server, AddressInfo } from 'node:http';
import type { Env } from '../src/config/env.js';
import { createApp } from '../src/app.js';

const TEST_AUTH_SECRET = 'test-passphrase-42';

const testEnv: Env = {
  BNET_CLIENT_ID: 'fake-bnet-id',
  BNET_CLIENT_SECRET: 'fake-bnet-secret',
  LOG_LEVEL: 'fatal',
  HTTP_TIMEOUT_MS: 15_000,
  HTTP_RETRY_LIMIT: 2,
  CACHE_TTL_SECONDS: 300,
  CACHE_SIZE: 500,
  MCP_AUTH_SECRET: TEST_AUTH_SECRET,
  MCP_TOKEN_TTL_SECONDS: 3600,
};

const MCP_INIT_BODY = JSON.stringify({
  jsonrpc: '2.0',
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0' },
  },
  id: 1,
});

/** Generate a PKCE code_verifier and its S256 code_challenge. */
function generatePkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

describe('OAuth 2.1 auth', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    server = createApp(testEnv);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const { port } = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // ── Metadata discovery ────────────────────────────────────────────────────

  it('serves /.well-known/oauth-protected-resource', async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { resource: string; authorization_servers: string[] };
    assert.ok(body.resource);
    assert.ok(Array.isArray(body.authorization_servers));
  });

  it('serves /.well-known/oauth-authorization-server with S256', async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.ok(body['authorization_endpoint']);
    assert.ok(body['token_endpoint']);
    assert.ok(body['registration_endpoint']);
    const methods = body['code_challenge_methods_supported'] as string[];
    assert.ok(methods.includes('S256'), 'Must include S256');
  });

  // ── Dynamic client registration ───────────────────────────────────────────

  it('registers a new client via POST /register', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'test-client',
        redirect_uris: ['http://localhost:9999/callback'],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      }),
    });
    assert.equal(res.status, 201);
    const body = (await res.json()) as { client_id: string };
    assert.ok(body.client_id);
  });

  // ── /mcp without token ────────────────────────────────────────────────────

  it('rejects /mcp without a token (401)', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: MCP_INIT_BODY,
    });
    assert.equal(res.status, 401);
    const wwwAuth = res.headers.get('www-authenticate');
    assert.ok(wwwAuth?.includes('resource_metadata'), 'WWW-Authenticate should include resource_metadata');
  });

  // ── Client credentials (backward compat for Warp/CLI) ─────────────────────

  it('rejects /token client_credentials with wrong secret (401)', async () => {
    const res = await fetch(`${baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials&client_id=any&client_secret=wrong',
    });
    assert.equal(res.status, 401);
  });

  it('issues token via client_credentials with correct secret (200)', async () => {
    const res = await fetch(`${baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=any&client_secret=${TEST_AUTH_SECRET}`,
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { access_token: string; token_type: string };
    assert.ok(body.access_token);
    assert.equal(body.token_type, 'Bearer');
  });

  // ── Authorization code + PKCE (full ChatGPT flow) ────────────────────────

  it('completes full authorization_code + PKCE flow', async () => {
    // 1. Register a client
    const regRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'pkce-test',
        redirect_uris: ['http://localhost:9999/callback'],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      }),
    });
    const { client_id } = (await regRes.json()) as { client_id: string };

    // 2. Generate PKCE pair
    const { codeVerifier, codeChallenge } = generatePkce();

    // 3. GET /authorize — should render the form (200)
    const authorizeUrl = `${baseUrl}/authorize?response_type=code&client_id=${client_id}` +
      `&redirect_uri=${encodeURIComponent('http://localhost:9999/callback')}` +
      `&code_challenge=${codeChallenge}&code_challenge_method=S256&state=xyz`;

    const authPageRes = await fetch(authorizeUrl);
    assert.equal(authPageRes.status, 200);
    const html = await authPageRes.text();
    assert.ok(html.includes('passphrase'), 'Page should contain passphrase input');

    // 4. POST /authorize with correct passphrase — should redirect with code
    const postRes = await fetch(`${baseUrl}/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual', // Don't follow redirect
      body: new URLSearchParams({
        response_type: 'code',
        client_id,
        redirect_uri: 'http://localhost:9999/callback',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state: 'xyz',
        passphrase: TEST_AUTH_SECRET,
      }).toString(),
    });
    assert.equal(postRes.status, 302);
    const location = postRes.headers.get('location')!;
    assert.ok(location.startsWith('http://localhost:9999/callback'));

    const callbackUrl = new URL(location);
    const code = callbackUrl.searchParams.get('code')!;
    assert.ok(code, 'Redirect should contain code');
    assert.equal(callbackUrl.searchParams.get('state'), 'xyz');

    // 5. Exchange code for token
    const tokenRes = await fetch(`${baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: codeVerifier,
        redirect_uri: 'http://localhost:9999/callback',
        client_id,
      }).toString(),
    });
    assert.equal(tokenRes.status, 200);
    const tokenBody = (await tokenRes.json()) as { access_token: string; token_type: string };
    assert.ok(tokenBody.access_token);
    assert.equal(tokenBody.token_type, 'Bearer');

    // 6. Use token to call /mcp
    const mcpRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${tokenBody.access_token}`,
      },
      body: MCP_INIT_BODY,
    });
    assert.equal(mcpRes.status, 200);
    const mcpText = await mcpRes.text();
    assert.ok(mcpText.includes('"mcp-wow-profile"'));
  });

  // ── Static secret as bearer token (Warp / simple clients) ──────────────

  it('allows /mcp with MCP_AUTH_SECRET as a static bearer token (200)', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${TEST_AUTH_SECRET}`,
      },
      body: MCP_INIT_BODY,
    });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('"mcp-wow-profile"'));
  });

  // ── Bogus token ───────────────────────────────────────────────────────────

  it('rejects /mcp with a bogus token (401)', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': 'Bearer totally-fake-token',
      },
      body: MCP_INIT_BODY,
    });
    assert.equal(res.status, 401);
  });
});
