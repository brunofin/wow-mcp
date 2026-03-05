import type { OAuthStore, ClientRecord, AuthCodeRecord, TokenRecord } from './types.js';

export class InMemoryStore implements OAuthStore {
  private clients = new Map<string, ClientRecord>();
  private authCodes = new Map<string, AuthCodeRecord>();
  private tokens = new Map<string, TokenRecord>();

  async init(): Promise<void> { /* nothing to do */ }

  // ── Clients ────────────────────────────────────────────────────────────────

  async getClient(clientId: string): Promise<ClientRecord | undefined> {
    return this.clients.get(clientId);
  }

  async setClient(clientId: string, record: ClientRecord): Promise<void> {
    this.clients.set(clientId, record);
  }

  // ── Auth codes ─────────────────────────────────────────────────────────────

  async getAuthCode(code: string): Promise<AuthCodeRecord | undefined> {
    return this.authCodes.get(code);
  }

  async setAuthCode(code: string, record: AuthCodeRecord): Promise<void> {
    this.authCodes.set(code, record);
  }

  async deleteAuthCode(code: string): Promise<void> {
    this.authCodes.delete(code);
  }

  // ── Tokens ─────────────────────────────────────────────────────────────────

  async getToken(token: string): Promise<TokenRecord | undefined> {
    return this.tokens.get(token);
  }

  async setToken(token: string, record: TokenRecord): Promise<void> {
    this.tokens.set(token, record);
  }

  async deleteToken(token: string): Promise<void> {
    this.tokens.delete(token);
  }

  // ── Maintenance ────────────────────────────────────────────────────────────

  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [k, v] of this.authCodes) if (v.expiresAtMs <= now) this.authCodes.delete(k);
    for (const [k, v] of this.tokens) if (v.expiresAtMs <= now) this.tokens.delete(k);
  }

  async close(): Promise<void> { /* nothing to do */ }
}
