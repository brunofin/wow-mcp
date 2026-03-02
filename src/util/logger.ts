import pino from 'pino';

/**
 * Application logger.
 * Writes to stderr so stdout stays clean for MCP stdio transport.
 * Reads LOG_LEVEL directly from process.env so it can be imported
 * before loadEnv() has run (e.g. in tests).
 */
export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino/file', options: { destination: 2 } } // fd 2 = stderr
      : undefined,
  // In production, raw JSON to stderr (Docker logging driver picks it up)
  ...(process.env.NODE_ENV === 'production' && {
    destination: pino.destination(2),
  }),
});
