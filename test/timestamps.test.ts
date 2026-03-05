import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { enrichTimestamps } from '../src/util/timestamps.js';

describe('enrichTimestamps', () => {
  it('adds _iso sibling for *timestamp* fields', () => {
    const input = { last_login_timestamp: 1772546842000 };
    const result = enrichTimestamps(input) as Record<string, unknown>;
    assert.equal(result['last_login_timestamp'], 1772546842000);
    assert.equal(result['last_login_timestamp_iso'], '2026-03-03T14:07:22.000Z');
  });

  it('handles completed_timestamp in nested arrays', () => {
    const input = {
      achievements: [
        { id: 1, completed_timestamp: 1609459200000 },
        { id: 2, completed_timestamp: 1640995200000 },
      ],
    };
    const result = enrichTimestamps(input) as Record<string, unknown>;
    const achievements = result['achievements'] as Record<string, unknown>[];
    assert.equal(achievements[0]['completed_timestamp_iso'], '2021-01-01T00:00:00.000Z');
    assert.equal(achievements[1]['completed_timestamp_iso'], '2022-01-01T00:00:00.000Z');
  });

  it('ignores non-timestamp fields and non-epoch values', () => {
    const input = { name: 'test', id: 42, timestamp_flag: true };
    const result = enrichTimestamps(input) as Record<string, unknown>;
    assert.equal(Object.keys(result).length, 3); // no extra _iso keys
  });

  it('ignores numbers outside plausible epoch-ms range', () => {
    const input = { some_timestamp: 123 }; // way too small
    const result = enrichTimestamps(input) as Record<string, unknown>;
    assert.equal(result['some_timestamp_iso'], undefined);
  });

  it('passes through primitives and null unchanged', () => {
    assert.equal(enrichTimestamps(null), null);
    assert.equal(enrichTimestamps(42), 42);
    assert.equal(enrichTimestamps('hello'), 'hello');
  });
});
