import type { Env } from '../config/env.js';
import type { OAuthStore } from './types.js';
import { InMemoryStore } from './memory.js';
import { PostgresStore } from './postgres.js';
import { logger } from '../util/logger.js';

export type { OAuthStore } from './types.js';
export type { ClientRecord, AuthCodeRecord, TokenRecord } from './types.js';

export async function createStore(env: Env): Promise<OAuthStore> {
  if (env.DATABASE_URL) {
    logger.info('Using PostgreSQL OAuth store');
    const store = new PostgresStore(env.DATABASE_URL);
    await store.init();
    return store;
  }

  logger.info('Using in-memory OAuth store (no DATABASE_URL)');
  return new InMemoryStore();
}
