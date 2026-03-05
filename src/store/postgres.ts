import pg from 'pg';
import { logger } from '../util/logger.js';
import type { OAuthStore, ClientRecord, AuthCodeRecord, TokenRecord } from './types.js';

const { Pool } = pg;

export class PostgresStore implements OAuthStore {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS oauth_clients (
        client_id              TEXT PRIMARY KEY,
        redirect_uris          TEXT[] NOT NULL DEFAULT '{}',
        client_name            TEXT,
        grant_types            TEXT[] NOT NULL DEFAULT '{}',
        response_types         TEXT[] NOT NULL DEFAULT '{}',
        token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
        created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS oauth_auth_codes (
        code                   TEXT PRIMARY KEY,
        client_id              TEXT NOT NULL,
        redirect_uri           TEXT NOT NULL,
        code_challenge         TEXT NOT NULL,
        code_challenge_method  TEXT NOT NULL,
        expires_at_ms          BIGINT NOT NULL,
        scope                  TEXT,
        created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS oauth_tokens (
        token                  TEXT PRIMARY KEY,
        expires_at_ms          BIGINT NOT NULL,
        created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    logger.info('PostgreSQL OAuth store initialised (tables ensured)');
  }

  // ── Clients ────────────────────────────────────────────────────────────────

  async getClient(clientId: string): Promise<ClientRecord | undefined> {
    const { rows } = await this.pool.query(
      `SELECT client_id, redirect_uris, client_name, grant_types, response_types, token_endpoint_auth_method
       FROM oauth_clients WHERE client_id = $1`,
      [clientId],
    );
    if (rows.length === 0) return undefined;
    const r = rows[0];
    return {
      clientId: r.client_id,
      redirectUris: r.redirect_uris,
      clientName: r.client_name ?? undefined,
      grantTypes: r.grant_types,
      responseTypes: r.response_types,
      tokenEndpointAuthMethod: r.token_endpoint_auth_method,
    };
  }

  async setClient(clientId: string, record: ClientRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO oauth_clients (client_id, redirect_uris, client_name, grant_types, response_types, token_endpoint_auth_method)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (client_id) DO UPDATE SET
         redirect_uris = EXCLUDED.redirect_uris,
         client_name = EXCLUDED.client_name,
         grant_types = EXCLUDED.grant_types,
         response_types = EXCLUDED.response_types,
         token_endpoint_auth_method = EXCLUDED.token_endpoint_auth_method`,
      [clientId, record.redirectUris, record.clientName ?? null, record.grantTypes, record.responseTypes, record.tokenEndpointAuthMethod],
    );
  }

  // ── Auth codes ─────────────────────────────────────────────────────────────

  async getAuthCode(code: string): Promise<AuthCodeRecord | undefined> {
    const { rows } = await this.pool.query(
      `SELECT client_id, redirect_uri, code_challenge, code_challenge_method, expires_at_ms, scope
       FROM oauth_auth_codes WHERE code = $1`,
      [code],
    );
    if (rows.length === 0) return undefined;
    const r = rows[0];
    return {
      clientId: r.client_id,
      redirectUri: r.redirect_uri,
      codeChallenge: r.code_challenge,
      codeChallengeMethod: r.code_challenge_method,
      expiresAtMs: Number(r.expires_at_ms),
      scope: r.scope ?? undefined,
    };
  }

  async setAuthCode(code: string, record: AuthCodeRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO oauth_auth_codes (code, client_id, redirect_uri, code_challenge, code_challenge_method, expires_at_ms, scope)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [code, record.clientId, record.redirectUri, record.codeChallenge, record.codeChallengeMethod, record.expiresAtMs, record.scope ?? null],
    );
  }

  async deleteAuthCode(code: string): Promise<void> {
    await this.pool.query(`DELETE FROM oauth_auth_codes WHERE code = $1`, [code]);
  }

  // ── Tokens ─────────────────────────────────────────────────────────────────

  async getToken(token: string): Promise<TokenRecord | undefined> {
    const { rows } = await this.pool.query(
      `SELECT expires_at_ms FROM oauth_tokens WHERE token = $1`,
      [token],
    );
    if (rows.length === 0) return undefined;
    return { expiresAtMs: Number(rows[0].expires_at_ms) };
  }

  async setToken(token: string, record: TokenRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO oauth_tokens (token, expires_at_ms) VALUES ($1, $2)`,
      [token, record.expiresAtMs],
    );
  }

  async deleteToken(token: string): Promise<void> {
    await this.pool.query(`DELETE FROM oauth_tokens WHERE token = $1`, [token]);
  }

  // ── Maintenance ────────────────────────────────────────────────────────────

  async cleanup(): Promise<void> {
    const now = Date.now();
    await this.pool.query(`DELETE FROM oauth_auth_codes WHERE expires_at_ms <= $1`, [now]);
    await this.pool.query(`DELETE FROM oauth_tokens WHERE expires_at_ms <= $1`, [now]);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
