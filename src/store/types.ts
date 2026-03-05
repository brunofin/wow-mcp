// ── OAuth store types ──────────────────────────────────────────────────────────

export interface ClientRecord {
  clientId: string;
  redirectUris: string[];
  clientName?: string;
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: string;
}

export interface AuthCodeRecord {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  expiresAtMs: number;
  scope?: string;
}

export interface TokenRecord {
  expiresAtMs: number;
}

// ── Store interface ────────────────────────────────────────────────────────────

export interface OAuthStore {
  /** One-time initialisation (e.g. create tables). */
  init(): Promise<void>;

  // Clients
  getClient(clientId: string): Promise<ClientRecord | undefined>;
  setClient(clientId: string, record: ClientRecord): Promise<void>;

  // Authorization codes
  getAuthCode(code: string): Promise<AuthCodeRecord | undefined>;
  setAuthCode(code: string, record: AuthCodeRecord): Promise<void>;
  deleteAuthCode(code: string): Promise<void>;

  // Tokens
  getToken(token: string): Promise<TokenRecord | undefined>;
  setToken(token: string, record: TokenRecord): Promise<void>;
  deleteToken(token: string): Promise<void>;

  /** Remove expired auth codes and tokens. */
  cleanup(): Promise<void>;

  /** Shut down connections. */
  close(): Promise<void>;
}
