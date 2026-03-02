#!/usr/bin/env node
import { createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadEnv } from './config/env.js';
import { registerTools } from './mcp/tools.js';
import { logger } from './util/logger.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

/**
 * Create and wire up a fresh McpServer + transport.
 * In stateless mode each request gets its own transport so a bad request
 * can never poison subsequent ones.
 */
function createMcpHandler(env: ReturnType<typeof loadEnv>) {
  return async (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => {
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

async function main(): Promise<void> {
  const env = loadEnv();
  const handleMcp = createMcpHandler(env);

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    // Health-check endpoint
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // MCP endpoint — Streamable HTTP (POST + GET + DELETE)
    if (url.pathname === '/mcp') {
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

  httpServer.listen(PORT, HOST, () => {
    logger.info('MCP server listening on http://%s:%d/mcp', HOST, PORT);
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal startup error');
  process.exit(1);
});
