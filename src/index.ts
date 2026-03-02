#!/usr/bin/env node
import { createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadEnv } from './config/env.js';
import { registerTools } from './mcp/tools.js';
import { logger } from './util/logger.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

async function main(): Promise<void> {
  const env = loadEnv();

  const mcpServer = new McpServer({
    name: 'mcp-wow-profile',
    version: '1.0.0',
  });

  registerTools(mcpServer, env);

  // Stateless Streamable-HTTP transport (no session tracking needed).
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await mcpServer.connect(transport);

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
      await transport.handleRequest(req, res);
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
