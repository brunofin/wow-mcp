import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server, AddressInfo } from 'node:http';
import type { Env } from '../src/config/env.js';
import { createApp } from '../src/app.js';

const TEST_CLIENT_ID = 'test-client';
const TEST_CLIENT_SECRET = 'test-secret';

const testEnv: Env = {
  BNET_CLIENT_ID: 'fake-bnet-id',
  BNET_CLIENT_SECRET: 'fake-bnet-secret',
  LOG_LEVEL: 'fatal',
  HTTP_TIMEOUT_MS: 15_000,
  HTTP_RETRY_LIMIT: 2,
  CACHE_TTL_SECONDS: 300,
  CACHE_SIZE: 500,
  MCP_CLIENT_ID: TEST_CLIENT_ID,
  MCP_CLIENT_SECRET: TEST_CLIENT_SECRET,
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

async function obtainToken(baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${TEST_CLIENT_ID}&client_secret=${TEST_CLIENT_SECRET}`,
  });
  const body = (await res.json()) as { access_token: string };
  return body.access_token;
}

describe('OAuth2 client-credentials auth', () => {
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

  it('rejects /mcp without a token (401)', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: MCP_INIT_BODY,
    });

    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: { message: string } };
    assert.equal(body.error.message, 'Unauthorized');
  });

  it('rejects /token with wrong credentials (401)', async () => {
    const res = await fetch(`${baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials&client_id=wrong&client_secret=wrong',
    });

    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, 'invalid_client');
  });

  it('issues a token with correct credentials (200)', async () => {
    const res = await fetch(`${baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${TEST_CLIENT_ID}&client_secret=${TEST_CLIENT_SECRET}`,
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { access_token: string; token_type: string; expires_in: number };
    assert.ok(body.access_token);
    assert.equal(body.token_type, 'Bearer');
    assert.equal(typeof body.expires_in, 'number');
  });

  it('allows /mcp with a valid token (200)', async () => {
    const token = await obtainToken(baseUrl);

    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${token}`,
      },
      body: MCP_INIT_BODY,
    });

    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('"mcp-wow-profile"'));
  });

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
