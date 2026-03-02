import { z } from 'zod';
import { regionSchema, localeSchema } from '../blizzard/endpoints/types.js';

export const characterInputSchema = {
  region: regionSchema,
  locale: localeSchema,
  realmSlug: z
    .string()
    .min(1)
    .describe('Realm slug (lowercase, hyphenated). Example: "tichondrius", "area-52"'),
  characterName: z
    .string()
    .min(1)
    .describe('Character name (case-insensitive)'),
};
