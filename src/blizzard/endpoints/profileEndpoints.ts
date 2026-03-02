import type { EndpointDef } from './types.js';
import { id, slug, characterParams, guildParams } from './types.js';

/**
 * All World of Warcraft Profile API endpoint definitions.
 * Namespace: profile-{region}.
 *
 * NOTE: Account Profile endpoints (e.g. /profile/user/wow) require the
 * authorization code flow and are NOT included here — this server uses
 * client credentials only.
 */
export const profileEndpoints: EndpointDef[] = [
  // ── Character Profile API ────────────────────────────
  {
    toolName: 'wow_character_profileSummary',
    title: 'Character Profile Summary',
    description:
      'Returns a character profile summary (name, realm, level, class, race, faction, guild, item level, last login, etc.).',
    path: 'profile/wow/character/{realmSlug}/{characterName}',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },
  {
    toolName: 'wow_character_profileStatus',
    title: 'Character Profile Status',
    description:
      'Returns the status and a unique revision id for a character. A 304 Not Modified response indicates the character has not been modified since the last request.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/status',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },

  // ── Character Achievements API ───────────────────────
  {
    toolName: 'wow_character_achievements',
    title: 'Character Achievements Summary',
    description:
      'Returns a summary of achievements for a character, including completed achievements, total points, and category progress.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/achievements',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },
  {
    toolName: 'wow_character_achievementStatistics',
    title: 'Character Achievement Statistics',
    description:
      'Returns achievement statistics for a character (kill counts, distances traveled, etc.).',
    path: 'profile/wow/character/{realmSlug}/{characterName}/achievements/statistics',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },

  // ── Character Appearance API ─────────────────────────
  {
    toolName: 'wow_character_appearance',
    title: 'Character Appearance Summary',
    description:
      'Returns a summary of a character\'s appearance settings (face, skin, hair, etc.).',
    path: 'profile/wow/character/{realmSlug}/{characterName}/appearance',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },

  // ── Character Collections API ────────────────────────
  {
    toolName: 'wow_character_collectionsIndex',
    title: 'Character Collections Index',
    description: 'Returns an index of collection types for a character.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/collections',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },
  {
    toolName: 'wow_character_decorCollection',
    title: 'Character Decor Collection',
    description: 'Returns a summary of decor collected by a character.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/collections/decor',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },
  {
    toolName: 'wow_character_heirloomsCollection',
    title: 'Character Heirlooms Collection',
    description: 'Returns a summary of heirlooms collected by a character.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/collections/heirlooms',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },
  {
    toolName: 'wow_character_mountsCollection',
    title: 'Character Mounts Collection',
    description: 'Returns a summary of mounts collected by a character.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/collections/mounts',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },
  {
    toolName: 'wow_character_petsCollection',
    title: 'Character Pets Collection',
    description: 'Returns a summary of battle pets collected by a character.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/collections/pets',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },
  {
    toolName: 'wow_character_toysCollection',
    title: 'Character Toys Collection',
    description: 'Returns a summary of toys collected by a character.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/collections/toys',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },
  {
    toolName: 'wow_character_transmogsCollection',
    title: 'Character Transmog Collection',
    description: 'Returns a summary of transmog appearances collected by a character.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/collections/transmogs',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },

  // ── Character Encounters API ─────────────────────────
  {
    toolName: 'wow_character_encountersSummary',
    title: 'Character Encounters Summary',
    description: 'Returns a summary of a character\'s encounters (dungeons and raids).',
    path: 'profile/wow/character/{realmSlug}/{characterName}/encounters',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },
  {
    toolName: 'wow_character_dungeons',
    title: 'Character Dungeons',
    description: 'Returns a summary of a character\'s completed dungeons.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/encounters/dungeons',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },
  {
    toolName: 'wow_character_raids',
    title: 'Character Raids',
    description: 'Returns a summary of a character\'s completed raids.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/encounters/raids',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },

  // ── Character Equipment API ──────────────────────────
  {
    toolName: 'wow_character_equipment',
    title: 'Character Equipment Summary',
    description: 'Returns a summary of the items equipped by a character.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/equipment',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },

  // ── Character House API ──────────────────────────────
  {
    toolName: 'wow_character_house',
    title: 'Character House Summary',
    description: 'Returns a summary of a character\'s house.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/house/house-{houseNumber}',
    namespace: 'profile',
    inputSchema: {
      ...characterParams,
      houseNumber: id('House number (typically 1)'),
    },
  },

  // ── Character Hunter Pets API ────────────────────────
  {
    toolName: 'wow_character_hunterPets',
    title: 'Character Hunter Pets',
    description:
      'Returns a summary of the hunter pets for a character (only relevant for Hunter class).',
    path: 'profile/wow/character/{realmSlug}/{characterName}/hunter-pets',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },

  // ── Character Media API ──────────────────────────────
  {
    toolName: 'wow_character_media',
    title: 'Character Media Summary',
    description: 'Returns render URLs (avatar, inset, main) for a character.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/character-media',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },

  // ── Character Mythic Keystone Profile API ─────────────
  {
    toolName: 'wow_character_mythicKeystoneProfile',
    title: 'Character Mythic Keystone Profile',
    description:
      'Returns the mythic keystone profile index for a character (current period best runs, etc.).',
    path: 'profile/wow/character/{realmSlug}/{characterName}/mythic-keystone-profile',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },
  {
    toolName: 'wow_character_mythicKeystoneSeason',
    title: 'Character Mythic Keystone Season Details',
    description:
      'Returns mythic keystone season details for a character (best runs for a specific season).',
    path: 'profile/wow/character/{realmSlug}/{characterName}/mythic-keystone-profile/season/{seasonId}',
    namespace: 'profile',
    inputSchema: {
      ...characterParams,
      seasonId: id('Mythic keystone season ID'),
    },
  },

  // ── Character Professions API ────────────────────────
  {
    toolName: 'wow_character_professions',
    title: 'Character Professions Summary',
    description: 'Returns a summary of professions for a character.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/professions',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },

  // ── Character PvP API ────────────────────────────────
  {
    toolName: 'wow_character_pvpSummary',
    title: 'Character PvP Summary',
    description: 'Returns a PvP summary for a character.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/pvp-summary',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },
  {
    toolName: 'wow_character_pvpBracket',
    title: 'Character PvP Bracket Statistics',
    description:
      'Returns PvP bracket statistics for a character (rating, wins, losses, etc.).',
    path: 'profile/wow/character/{realmSlug}/{characterName}/pvp-bracket/{pvpBracket}',
    namespace: 'profile',
    inputSchema: {
      ...characterParams,
      pvpBracket: slug('PvP bracket (e.g. "2v2", "3v3", "rbg")'),
    },
  },

  // ── Character Quests API ─────────────────────────────
  {
    toolName: 'wow_character_quests',
    title: 'Character Quests',
    description: 'Returns a list of quests a character has in their quest log.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/quests',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },
  {
    toolName: 'wow_character_completedQuests',
    title: 'Character Completed Quests',
    description: 'Returns a list of quests a character has completed.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/quests/completed',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },

  // ── Character Reputations API ────────────────────────
  {
    toolName: 'wow_character_reputations',
    title: 'Character Reputations Summary',
    description: 'Returns a summary of a character\'s reputations.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/reputations',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },

  // ── Character Soulbinds API ──────────────────────────
  {
    toolName: 'wow_character_soulbinds',
    title: 'Character Soulbinds',
    description: 'Returns a character\'s soulbind and conduit selections.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/soulbinds',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },

  // ── Character Specializations API ────────────────────
  {
    toolName: 'wow_character_specializations',
    title: 'Character Specializations Summary',
    description: 'Returns a summary of a character\'s specializations.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/specializations',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },

  // ── Character Statistics API ─────────────────────────
  {
    toolName: 'wow_character_statistics',
    title: 'Character Statistics Summary',
    description:
      'Returns a character\'s combat statistics (strength, agility, intellect, stamina, crit, haste, mastery, versatility, etc.).',
    path: 'profile/wow/character/{realmSlug}/{characterName}/statistics',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },

  // ── Character Titles API ─────────────────────────────
  {
    toolName: 'wow_character_titles',
    title: 'Character Titles Summary',
    description: 'Returns a summary of titles a character has obtained.',
    path: 'profile/wow/character/{realmSlug}/{characterName}/titles',
    namespace: 'profile',
    inputSchema: { ...characterParams },
  },

  // ── Guild API ────────────────────────────────────────
  {
    toolName: 'wow_guild_get',
    title: 'Guild',
    description: 'Returns a guild by realm slug and guild name slug.',
    path: 'data/wow/guild/{realmSlug}/{nameSlug}',
    namespace: 'profile',
    inputSchema: { ...guildParams },
  },
  {
    toolName: 'wow_guild_activity',
    title: 'Guild Activity',
    description: 'Returns a guild\'s activity feed.',
    path: 'data/wow/guild/{realmSlug}/{nameSlug}/activity',
    namespace: 'profile',
    inputSchema: { ...guildParams },
  },
  {
    toolName: 'wow_guild_achievements',
    title: 'Guild Achievements',
    description: 'Returns a guild\'s achievements.',
    path: 'data/wow/guild/{realmSlug}/{nameSlug}/achievements',
    namespace: 'profile',
    inputSchema: { ...guildParams },
  },
  {
    toolName: 'wow_guild_roster',
    title: 'Guild Roster',
    description: 'Returns a guild\'s roster.',
    path: 'data/wow/guild/{realmSlug}/{nameSlug}/roster',
    namespace: 'profile',
    inputSchema: { ...guildParams },
  },
];
