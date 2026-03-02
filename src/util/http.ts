import got from 'got';

/**
 * Shared got defaults.
 * Each consumer extends this with their own prefixUrl / hooks.
 * Reads tuning values directly from process.env so the module can be
 * imported before loadEnv() runs (e.g. in tests).
 */
export const httpDefaults = got.extend({
  responseType: 'json' as const,
  decompress: true,
  timeout: {
    request: parseInt(process.env['HTTP_TIMEOUT_MS'] ?? '15000', 10),
  },
  retry: {
    limit: parseInt(process.env['HTTP_RETRY_LIMIT'] ?? '2', 10),
    methods: ['GET'],
    statusCodes: [408, 429, 500, 502, 503, 504, 521, 522, 524],
  },
  headers: {
    'accept-encoding': 'gzip, deflate, br',
  },
});
