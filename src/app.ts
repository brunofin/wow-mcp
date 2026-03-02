import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { handleTokenRequest, isAuthEnabled, validateBearerToken } from './auth.js';
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
export function createApp(env: Env): Server {
  const handleMcp = createMcpHandler(env);

  if (isAuthEnabled(env)) {
    logger.info('OAuth2 client-credentials auth is ENABLED on /mcp');
  } else {
    logger.warn('No MCP_CLIENT_ID / MCP_CLIENT_SECRET set — /mcp is UNAUTHENTICATED');
  }

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    // Health-check endpoint (always public)
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // OAuth2 token endpoint
    if (url.pathname === '/token') {
      try {
        await handleTokenRequest(env, req, res);
      } catch (err) {
        logger.error({ err }, '/token request error');
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'server_error' }));
        }
      }
      return;
    }

    // MCP endpoint — Streamable HTTP (POST + GET + DELETE)
    if (url.pathname === '/mcp') {
      // Enforce bearer-token auth when credentials are configured.
      if (!validateBearerToken(env, req)) {
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer',
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
