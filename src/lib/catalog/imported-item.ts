import { z } from 'zod';

const proficiency = z.enum(['simple', 'martial', 'exotic', 'always']);
const dice = z.string().regex(/^[1-9]\d*d[1-9]\d*$/);

/** Release weapons use the sheet vocabulary; native legacy bodies stay distinct. */
export const importedWeaponSchema = z.strictObject({
  baseType: z.string().min(1),
  proficiency,
  groups: z.array(z.string()),
  handedness: z.enum(['light', 'oneHanded', 'twoHanded']),
  attackType: z.enum(['melee', 'ranged']),
  dice: dice.optional(),
  damageTypes: z.array(z.string()),
  threat: z.number().int().min(1).max(20).optional(),
  mult: z.number().int().min(1).optional(),
  finesse: z.boolean(),
  monk: z.boolean(),
  thrown: z.boolean(),
  rangeIncrement: z.number().positive().optional(),
  thrownRangeIncrement: z.number().positive().optional(),
  strengthDamage: z
    .enum(['melee', 'thrown', 'bow', 'compositeBow', 'crossbow', 'sling'])
    .optional(),
  strengthRating: z.number().nonnegative().optional(),
  reload: z.enum(['free', 'move', 'fullRound']).optional(),
  // Release-only holds: refused before the stored sheet can calculate them.
  unresolved: z
    .array(z.enum(['strengthDamage', 'reload', 'criticalEffects']))
    .nonempty()
    .optional(),
});

export const legacyImportedWeaponSchema = z.strictObject({
  baseTypes: z.array(z.string()),
  groups: z.array(z.string()),
  proficiency: z.string(),
  handedness: z.string(),
  dice: z.string().nullable(),
  damageTypes: z.array(z.string()),
  threat: z.number(),
  mult: z.number(),
  finesse: z.boolean(),
  thrown: z.boolean(),
  rangeIncrement: z.number().optional(),
});

/** Validated supported profiles only; legacy native shapes remain unsupported. */
export function preparedItemWeapon({
  weapon,
}: {
  weapon:
    | z.infer<typeof importedWeaponSchema>
    | z.infer<typeof legacyImportedWeaponSchema>;
}): z.infer<typeof importedWeaponSchema> {
  if (!('baseType' in weapon))
    throw new Error(
      'unsupported or incomplete imported profile (legacy weapon shape)',
    );
  if (weapon.unresolved?.length)
    throw new Error(`unresolved ${weapon.unresolved.join(', ')}`);
  return weapon;
}
