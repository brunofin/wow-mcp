import { z } from 'zod';

// ── Shared fragments ────────────────────────────────────

const hrefObj = z.object({ href: z.string() });

const keyedRef = z.object({
  key: hrefObj.optional(),
  name: z.string(),
  id: z.number(),
});

// ── Character Achievements Summary ──────────────────────

const achievementEntry = z.object({
  id: z.number(),
  achievement: keyedRef,
  criteria: z
    .object({
      id: z.number(),
      is_completed: z.boolean().optional(),
      child_criteria: z
        .array(
          z.object({
            id: z.number(),
            amount: z.number().optional(),
            is_completed: z.boolean().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  completed_timestamp: z.number().optional(),
});

export type AchievementEntryRaw = z.infer<typeof achievementEntry>;

const categoryProgress = z.object({
  category: keyedRef,
  quantity: z.number().optional(),
  points: z.number().optional(),
});

const recentEvent = z.object({
  achievement: keyedRef,
  timestamp: z.number(),
});

export const characterAchievementsSummarySchema = z.object({
  total_quantity: z.number().optional(),
  total_points: z.number().optional(),
  achievements: z.array(achievementEntry).default([]),
  category_progress: z.array(categoryProgress).optional(),
  recent_events: z.array(recentEvent).optional(),
});

export type CharacterAchievementsSummaryRaw = z.infer<
  typeof characterAchievementsSummarySchema
>;

// ── Single Achievement Detail ───────────────────────────

export const achievementDetailSchema = z.object({
  id: z.number(),
  category: keyedRef.optional(),
  name: z.string(),
  description: z.string().optional(),
  points: z.number().optional(),
  is_account_wide: z.boolean().optional(),
  criteria: z
    .object({
      id: z.number(),
      description: z.string().optional(),
      amount: z.number().optional(),
    })
    .optional(),
  display_order: z.number().optional(),
});

export type AchievementDetailRaw = z.infer<typeof achievementDetailSchema>;
