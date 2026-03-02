import { z } from 'zod';

export const regionEnum = z.enum(['us', 'eu', 'kr', 'tw']);
export type Region = z.infer<typeof regionEnum>;

/** API host per region. */
export const apiHost: Record<Region, string> = {
  us: 'https://us.api.blizzard.com',
  eu: 'https://eu.api.blizzard.com',
  kr: 'https://kr.api.blizzard.com',
  tw: 'https://tw.api.blizzard.com',
};

/**
 * Global OAuth token endpoint.
 * A single client_id/client_secret works across all regions.
 */
export const OAUTH_TOKEN_URL = 'https://oauth.battle.net/token';
