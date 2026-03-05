import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  handleAuthServerMetadata,
  handleAuthorize,
  handleProtectedResourceMetadata,
  handleRegister,
  handleTokenRequest,
  initAuthStore,
  isAuthEnabled,
  validateBearerToken,
  getBaseUrl,
} from './auth.js';
import type { Env } from './config/env.js';
import { registerTools } from './mcp/tools.js';
import { logger } from './util/logger.js';

function createMcpHandler(env: Env) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    const server = new McpServer({
      name: 'mcp-wow-profile',
      version: '1.0.0',
    });

    registerTools(server, env);
    await server.connect(transport);

    await transport.handleRequest(req, res);
    await transport.close();
    await server.close();
  };
}

/**
 * Create the HTTP server with all routes wired up.
 * Does NOT call `.listen()` — the caller decides the port.
 */
export async function createApp(env: Env): Promise<Server> {
  await initAuthStore(env);
  const handleMcp = createMcpHandler(env);

  if (isAuthEnabled(env)) {
    logger.info('OAuth 2.1 auth is ENABLED (authorization_code + PKCE, client_credentials)');
  } else {
    logger.warn('No MCP_AUTH_SECRET set — /mcp is UNAUTHENTICATED');
  }

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    // Health-check endpoint (always public)
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // ── OAuth 2.1 discovery & endpoints ──────────────────────────────────
    if (url.pathname === '/.well-known/oauth-protected-resource') {
      handleProtectedResourceMetadata(env, req, res);
      return;
    }

    if (url.pathname === '/.well-known/oauth-authorization-server') {
      handleAuthServerMetadata(env, req, res);
      return;
    }

    if (url.pathname === '/register') {
      try {
        await handleRegister(env, req, res);
      } catch (err) {
        logger.error({ err }, '/register error');
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'server_error' }));
        }
      }
      return;
    }

    if (url.pathname === '/authorize') {
      try {
        await handleAuthorize(env, req, res);
      } catch (err) {
        logger.error({ err }, '/authorize error');
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal server error');
        }
      }
      return;
    }

    if (url.pathname === '/token') {
      try {
        await handleTokenRequest(env, req, res);
      } catch (err) {
        logger.error({ err }, '/token error');
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'server_error' }));
        }
      }
      return;
    }

    // ── MCP endpoint — Streamable HTTP (POST + GET + DELETE) ─────────────
    if (url.pathname === '/mcp') {
      if (!(await validateBearerToken(env, req))) {
        const base = getBaseUrl(req);
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'WWW-Authenticate': `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
        });
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32600, message: 'Unauthorized' }, id: null }));
        return;
      }

      try {
        await handleMcp(req, res);
      } catch (err) {
        logger.error({ err }, 'MCP request error');
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null }));
        }
      }
      return;
    }

    res.writeHead(404).end();
  });
}
