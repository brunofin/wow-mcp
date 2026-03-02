import type { Got, OptionsInit, Response } from 'got';
import { HTTPError } from 'got';
import { httpDefaults } from '../util/http.js';
import { apiHost, type Region } from '../config/regions.js';
import { TokenManager } from './tokenManager.js';
import { TtlCache } from '../util/cache.js';
import { logger } from '../util/logger.js';
import type { Env } from '../config/env.js';

export class BlizzardClient {
  private readonly http: Got;
  private readonly tokenManager: TokenManager;
  private readonly cache: TtlCache<unknown>;

  constructor(env: Env) {
    this.tokenManager = new TokenManager(
      env.BNET_CLIENT_ID,
      env.BNET_CLIENT_SECRET,
    );
    this.cache = new TtlCache(env.CACHE_TTL_SECONDS * 1000, env.CACHE_SIZE);

    // No prefixUrl — the full URL is built per-request based on region.
    this.http = httpDefaults.extend({
      responseType: 'json' as const,
      hooks: {
        beforeRequest: [
          async (options) => {
            const token = await this.tokenManager.getAccessToken();
            options.headers['authorization'] = `Bearer ${token}`;
          },
        ],
      },
    });
  }

  /**
   * Generic request helper.
   * Builds the full URL from region + path, injects namespace + locale as
   * query params, and handles 401 retry.
   */
  async request<T>(
    path: string,
    opts: {
      region: Region;
      namespace: string;
      locale?: string;
      searchParams?: Record<string, string>;
      useCache?: boolean;
    },
  ): Promise<T> {
    const {
      region,
      namespace,
      locale = 'en_US',
      searchParams = {},
      useCache = true,
    } = opts;

    const url = `${apiHost[region]}/${path}`;
    const cacheKey = `${url}|${namespace}|${locale}|${JSON.stringify(searchParams)}`;

    if (useCache) {
      const cached = this.cache.get(cacheKey) as T | undefined;
      if (cached) {
        logger.debug('Cache HIT: %s', cacheKey);
        return cached;
      }
    }

    const requestOpts: OptionsInit = {
      searchParams: {
        namespace,
        locale,
        ...searchParams,
      },
    };

    try {
      const resp = await this.http.get(url, requestOpts) as Response<T>;
      if (useCache) this.cache.set(cacheKey, resp.body);
      return resp.body;
    } catch (err) {
      if (err instanceof HTTPError && err.response.statusCode === 401) {
        logger.warn('Got 401, refreshing token and retrying: %s', url);
        this.tokenManager.invalidate();
        const resp = await this.http.get(url, requestOpts) as Response<T>;
        if (useCache) this.cache.set(cacheKey, resp.body);
        return resp.body;
      }
      throw err;
    }
  }
}
