import pino from 'pino';
import { loadEnv } from '../config/env.js';

const env = loadEnv();

/**
 * Application logger.
 * Writes to stderr so stdout stays clean for MCP stdio transport.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino/file', options: { destination: 2 } } // fd 2 = stderr
      : undefined,
  // In production, raw JSON to stderr (Docker logging driver picks it up)
  ...(process.env.NODE_ENV === 'production' && {
    destination: pino.destination(2),
  }),
});
