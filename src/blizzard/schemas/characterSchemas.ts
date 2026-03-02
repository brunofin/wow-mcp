import { z } from 'zod';

// ── Shared fragments ────────────────────────────────────

const hrefObj = z.object({ href: z.string() });

const keyedRef = z.object({
  key: hrefObj.optional(),
  name: z.string(),
  id: z.number(),
});

const realmRef = z.object({
  key: hrefObj.optional(),
  name: z.string(),
  slug: z.string(),
  id: z.number(),
});

const factionRef = z.object({
  type: z.string(),
  name: z.string(),
});

// ── Character Profile Summary ───────────────────────────

export const characterProfileSummarySchema = z.object({
  id: z.number(),
  name: z.string(),
  gender: z.object({ type: z.string(), name: z.string() }),
  faction: factionRef,
  race: keyedRef,
  character_class: keyedRef,
  active_spec: keyedRef.optional(),
  realm: realmRef,
  guild: z
    .object({
      key: hrefObj.optional(),
      name: z.string(),
      id: z.number(),
      realm: realmRef.optional(),
      faction: factionRef.optional(),
    })
    .optional(),
  level: z.number(),
  experience: z.number().optional(),
  achievement_points: z.number().optional(),
  last_login_timestamp: z.number().optional(),
  average_item_level: z.number().optional(),
  equipped_item_level: z.number().optional(),
  active_title: z
    .object({
      key: hrefObj.optional(),
      name: z.string().optional(),
      id: z.number(),
      display_string: z.string().optional(),
    })
    .optional(),
});

export type CharacterProfileSummaryRaw = z.infer<typeof characterProfileSummarySchema>;

// ── Character Media ─────────────────────────────────────

export const characterMediaSchema = z.object({
  assets: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
});

export type CharacterMediaRaw = z.infer<typeof characterMediaSchema>;
