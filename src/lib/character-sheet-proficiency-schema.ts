import { z } from 'zod';

export const proficiencyCategories = [
  'simple',
  'martial',
  'firearm',
  'light',
  'medium',
  'heavy',
  'shield',
  'towerShield',
] as const;
export const manualProficiencySchema = z.union([
  z.object({ category: z.enum(proficiencyCategories) }),
  z.object({
    baseType: z.string().trim().min(1),
    asMartial: z.literal(true).optional(),
  }),
  z.object({ group: z.string().trim().min(1) }),
]);
export type ManualProficiency = z.infer<typeof manualProficiencySchema>;
export type ProficiencyGrant = ManualProficiency | { choice: true };
