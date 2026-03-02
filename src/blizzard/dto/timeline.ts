import type { CharacterAchievementsSummaryRaw } from '../schemas/achievementSchemas.js';

export interface TimelineEntry {
  achievementId: number;
  achievementName: string;
  completedAt: string; // ISO-8601
  completedTimestamp: number;
}

export interface AchievementsTimelineDTO {
  characterName?: string;
  totalCompleted: number;
  earliest: TimelineEntry | null;
  latest: TimelineEntry | null;
  entries: TimelineEntry[];
}

/**
 * Flatten an achievements summary into a chronologically sorted timeline.
 * Only includes achievements with a completed_timestamp.
 */
export function toAchievementsTimeline(
  raw: CharacterAchievementsSummaryRaw,
  characterName?: string,
): AchievementsTimelineDTO {
  const entries: TimelineEntry[] = raw.achievements
    .filter((a) => a.completed_timestamp != null)
    .map((a) => ({
      achievementId: a.achievement.id,
      achievementName: a.achievement.name,
      completedAt: new Date(a.completed_timestamp!).toISOString(),
      completedTimestamp: a.completed_timestamp!,
    }))
    .sort((a, b) => a.completedTimestamp - b.completedTimestamp);

  return {
    characterName,
    totalCompleted: entries.length,
    earliest: entries[0] ?? null,
    latest: entries.at(-1) ?? null,
    entries,
  };
}
