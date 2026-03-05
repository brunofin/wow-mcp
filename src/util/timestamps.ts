/**
 * Recursively walk a JSON-serialisable value and add human-readable ISO 8601
 * siblings for any field whose name contains "timestamp" and whose value looks
 * like an epoch-millisecond number.
 *
 * Example:
 *   { "last_login_timestamp": 1772546842000 }
 * becomes:
 *   { "last_login_timestamp": 1772546842000, "last_login_timestamp_iso": "2026-03-03T14:07:22.000Z" }
 */

// Plausible epoch-ms range: 2000-01-01 … 2100-01-01
const EPOCH_MS_MIN = 946_684_800_000;
const EPOCH_MS_MAX = 4_102_444_800_000;

function isEpochMs(v: unknown): v is number {
  return typeof v === 'number' && v >= EPOCH_MS_MIN && v <= EPOCH_MS_MAX;
}

const TIMESTAMP_RE = /timestamp/i;

export function enrichTimestamps<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map(enrichTimestamps) as T;
  }

  const obj = value as Record<string, unknown>;
  const enriched: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(obj)) {
    enriched[key] = enrichTimestamps(val);

    if (TIMESTAMP_RE.test(key) && isEpochMs(val)) {
      enriched[`${key}_iso`] = new Date(val).toISOString();
    }
  }

  return enriched as T;
}
