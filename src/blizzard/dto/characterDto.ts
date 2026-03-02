import type { CharacterProfileSummaryRaw } from '../schemas/characterSchemas.js';

export interface CharacterSummaryDTO {
  id: number;
  name: string;
  realm: string;
  realmSlug: string;
  level: number;
  faction: string;
  race: string;
  class: string;
  activeSpec: string | null;
  guild: string | null;
  achievementPoints: number | null;
  lastLogin: string | null;
  averageItemLevel: number | null;
  equippedItemLevel: number | null;
  activeTitle: string | null;
}

export function toCharacterSummaryDTO(
  raw: CharacterProfileSummaryRaw,
): CharacterSummaryDTO {
  return {
    id: raw.id,
    name: raw.name,
    realm: raw.realm.name,
    realmSlug: raw.realm.slug,
    level: raw.level,
    faction: raw.faction.name,
    race: raw.race.name,
    class: raw.character_class.name,
    activeSpec: raw.active_spec?.name ?? null,
    guild: raw.guild?.name ?? null,
    achievementPoints: raw.achievement_points ?? null,
    lastLogin: raw.last_login_timestamp
      ? new Date(raw.last_login_timestamp).toISOString()
      : null,
    averageItemLevel: raw.average_item_level ?? null,
    equippedItemLevel: raw.equipped_item_level ?? null,
    activeTitle: raw.active_title?.display_string ?? null,
  };
}
