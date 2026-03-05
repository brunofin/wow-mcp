#!/usr/bin/env node
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { logger } from './util/logger.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

const env = loadEnv();
const server = await createApp(env);

server.listen(PORT, HOST, () => {
  logger.info('MCP server listening on http://%s:%d/mcp', HOST, PORT);
});
