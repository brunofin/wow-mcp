#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadEnv } from './config/env.js';
import { registerTools } from './mcp/tools.js';
import { logger } from './util/logger.js';

async function main(): Promise<void> {
  const env = loadEnv();

  const server = new McpServer({
    name: 'mcp-wow-profile',
    version: '1.0.0',
  });

  registerTools(server, env);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('MCP server started (stdio transport)');
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal startup error');
  process.exit(1);
});
