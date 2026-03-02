import got from 'got';
import { logger } from '../util/logger.js';
import { OAUTH_TOKEN_URL } from '../config/regions.js';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  sub: string;
}

const REFRESH_SKEW_MS = 120_000; // refresh if < 2 min left

export class TokenManager {
  private accessToken: string | null = null;
  private expiresAt = 0;
  private pendingRequest: Promise<string> | null = null;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  /** Return a valid bearer token, minting a new one if necessary. */
  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt - REFRESH_SKEW_MS) {
      return this.accessToken;
    }

    // Single-flight: share one in-flight request across concurrent callers
    if (!this.pendingRequest) {
      this.pendingRequest = this.mint().finally(() => {
        this.pendingRequest = null;
      });
    }

    return this.pendingRequest;
  }

  /** Invalidate the cached token (e.g. after a 401). */
  invalidate(): void {
    this.accessToken = null;
    this.expiresAt = 0;
  }

  private async mint(): Promise<string> {
    logger.debug('Minting new OAuth token from %s', OAUTH_TOKEN_URL);

    const resp = await got.post<TokenResponse>(OAUTH_TOKEN_URL, {
      form: { grant_type: 'client_credentials' },
      username: this.clientId,
      password: this.clientSecret,
      responseType: 'json',
      timeout: { request: 10_000 },
      retry: { limit: 1 },
    });

    const { access_token, expires_in } = resp.body;
    this.accessToken = access_token;
    this.expiresAt = Date.now() + expires_in * 1000;

    logger.debug('Token minted, expires in %ds', expires_in);
    return access_token;
  }
}
