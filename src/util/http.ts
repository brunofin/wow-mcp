import got from 'got';
import { loadEnv } from '../config/env.js';

const env = loadEnv();

/**
 * Shared got defaults.
 * Each consumer extends this with their own prefixUrl / hooks.
 */
export const httpDefaults = got.extend({
  responseType: 'json' as const,
  decompress: true,
  timeout: {
    request: env.HTTP_TIMEOUT_MS,
  },
  retry: {
    limit: env.HTTP_RETRY_LIMIT,
    methods: ['GET'],
    statusCodes: [408, 429, 500, 502, 503, 504, 521, 522, 524],
  },
  headers: {
    'accept-encoding': 'gzip, deflate, br',
  },
});
