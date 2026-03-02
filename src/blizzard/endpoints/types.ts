import { z } from 'zod';
import { regionEnum, type Region } from '../../config/regions.js';

// ── Namespace types ────────────────────────────────────

export type NamespaceType = 'static' | 'dynamic' | 'profile';

export function resolveNamespace(type: NamespaceType, region: Region): string {
  return `${type}-${region}`;
}

// ── Endpoint definition ────────────────────────────────

export interface EndpointDef {
  /** MCP tool name (e.g. "wow_achievement_get"). */
  toolName: string;
  /** Short human-readable title. */
  title: string;
  /** MCP tool description. */
  description: string;
  /** URL path template. No leading slash. Use {param} for path params. */
  path: string;
  /** Which Blizzard namespace to use. */
  namespace: NamespaceType;
  /** Zod schemas for tool input parameters (path params + any extras). */
  inputSchema: Record<string, z.ZodType>;
  /** If true, an extra optional `searchQuery` param is added for arbitrary query params. */
  isSearch?: boolean;
}

// ── Path builder ───────────────────────────────────────

/**
 * Replace `{param}` placeholders in a path template with actual values.
 * String values are lowercased and URI-encoded (Blizzard requires lowercase paths).
 */
export function buildPath(
  template: string,
  params: Record<string, unknown>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = params[key];
    if (val == null) throw new Error(`Missing required path parameter: ${key}`);
    const str = typeof val === 'string' ? val.toLowerCase() : String(val);
    return encodeURIComponent(str);
  });
}

// ── Schema helpers ─────────────────────────────────────

/** Positive integer ID param. */
export const id = (desc: string) => z.number().int().positive().describe(desc);
/** Non-empty string slug param. */
export const slug = (desc: string) => z.string().min(1).describe(desc);

/** Region param — injected into every tool automatically. */
export const regionSchema = regionEnum
  .default('us')
  .describe('API region: "us", "eu", "kr", or "tw" (default: "us")');

/** Locale param — injected into every tool automatically. */
export const localeSchema = z
  .string()
  .default('en_US')
  .describe('Response locale (e.g. "en_US", "es_MX", "pt_BR", "de_DE", "fr_FR", "ko_KR"). Default: "en_US"');

/** Shared character input params. */
export const characterParams = {
  realmSlug: slug('Realm slug (lowercase, hyphenated). Example: "tichondrius", "area-52"'),
  characterName: slug('Character name (case-insensitive)'),
};

/** Shared guild input params. */
export const guildParams = {
  realmSlug: slug('Realm slug (lowercase, hyphenated)'),
  nameSlug: slug('Guild name slug (lowercase, hyphenated)'),
};
