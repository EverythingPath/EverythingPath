import reviewedCastingTables from '../../scripts/catalog/reviewed-casting-tables.json';
import { z } from 'zod';
import { abilityKeys } from './character-sheet-abilities';

export const castingTableKeys = [
  'prepared-full',
  'prepared-medium',
  'prepared-low',
  'spontaneous-full',
  'spontaneous-medium',
  'spontaneous-low',
  'hybrid-full',
  'adept',
  'extracts',
  'unchained-summoner',
  'occultist',
] as const;
export type CastingTableKey = (typeof castingTableKeys)[number];
export type Casting = z.infer<typeof classCastingSchema>;
export const MAX_LEVEL = 20;
export type CastingTableRow = {
  spellsPerDay: (number | null)[];
  spellsKnown?: (number | null)[];
  preparedPerDay?: (number | null)[];
  castableSpellLevels?: number[];
};

export const classCastingSchema = z.object({
  classTag: z.string(),
  type: z.enum(['prepared', 'spontaneous', 'hybrid']),
  spellKind: z.enum(['arcane', 'divine', 'psychic', 'alchemy']),
  ability: z.enum(abilityKeys),
  cantrips: z.boolean(),
  casterLevelOffset: z.number(),
  table: z.enum(castingTableKeys),
  record: z.enum(['known', 'book', 'none']),
  bookType: z.enum(['spellbook', 'formula', 'familiar']).optional(),
});
// CRB pp. 77–78 and 206–209: the eight schools an arcane specialist chooses among.
export const spellSchoolKeys = [
  'abj',
  'con',
  'div',
  'enc',
  'evo',
  'ill',
  'nec',
  'trs',
] as const;
export type SpellSchoolKey = (typeof spellSchoolKeys)[number];
// Universal Spells (Wish) belong to no school a specialist chooses or opposes.
export const spellSchools = [...spellSchoolKeys, 'uni'] as const;
export type SpellSchool = (typeof spellSchools)[number];
export function isSpellSchool(value: string | undefined): value is SpellSchool {
  return spellSchools.some((school) => school === value);
}
export const castingAdvanceKinds = ['any', 'arcane', 'divine'] as const;
export type CastingAdvanceKind = (typeof castingAdvanceKinds)[number];
/** Per Prestige Class level, the kind of each "+1 level of existing class" it gives. */
export const classCastingAdvancesSchema = z.array(
  z.object({
    classLevel: z.number().int().min(1),
    kinds: z.array(z.enum(castingAdvanceKinds)),
  }),
);
export const spellcastingOptionKinds = [
  'domain',
  'subdomain',
  'school',
  'bloodline',
] as const;
export type SpellcastingOptionKind = (typeof spellcastingOptionKinds)[number];
export const extraSlotKinds = ['domain', 'school', 'spirit'] as const;
export type ExtraSlotKind = (typeof extraSlotKinds)[number];
/**
 * Class-feature casting facts. Slot-style grants follow the Spellcasting's
 * castable levels (advances included); schedule-style grants follow the
 * granting class's own Class Levels (CRB pp. 38, 72 and 77; FAQ).
 */
export const classFeatureSpellcastingSchema = z.object({
  optionKind: z.enum(spellcastingOptionKinds).optional(),
  chooses: z.enum(spellcastingOptionKinds).optional(),
  /**
   * A prompt-owning feature's: `false` when its own text grants the chosen
   * options' powers only, so their Granted Spells and extra slot are
   * withheld (the Inquisitor's Domain, APG p. 38; PRD #251 D10). Absent, a
   * chosen option grants them to any Spellcasting.
   */
  optionGrantsSpells: z.literal(false).optional(),
  extraSlot: z.enum(extraSlotKinds).optional(),
  school: z.enum(spellSchoolKeys).optional(),
  oppositionSchoolCount: z.number().int().nonnegative().optional(),
  grantedSpells: z
    .object({
      style: z.enum(['slot', 'schedule']),
      schedule: z
        .array(
          z.object({
            spellLevel: z.number().int().min(1).max(9),
            classLevel: z.number().int().min(1),
          }),
        )
        .optional(),
      spells: z.array(
        z.object({
          spellLevel: z.number().int().min(0).max(9),
          catalogEntryId: z.string(),
        }),
      ),
    })
    .optional(),
});
export type ClassFeatureSpellcasting = z.infer<
  typeof classFeatureSpellcastingSchema
>;
const castingAllowanceSchema = z
  .array(z.number().int().nonnegative().nullable())
  .length(10);
export const reviewedCastingTablesSchema = z.object({
  version: z.literal(1),
  tables: z.record(
    z.enum(castingTableKeys),
    z.object({
      includesZeroLevel: z.boolean(),
      rows: z
        .array(
          z.object({
            spellsPerDay: castingAllowanceSchema,
            spellsKnown: castingAllowanceSchema.optional(),
            preparedPerDay: castingAllowanceSchema.optional(),
            castableSpellLevels: z
              .array(z.number().int().min(0).max(9))
              .optional(),
          }),
        )
        .length(MAX_LEVEL),
    }),
  ),
  classes: z.record(z.string(), classCastingSchema),
});
export type ReviewedCastingTables = z.infer<typeof reviewedCastingTablesSchema>;
export const defaultCastingTables = reviewedCastingTablesSchema.parse(
  reviewedCastingTables,
);
const classCasting: Record<string, Casting> = Object.fromEntries(
  Object.entries(defaultCastingTables.classes).map(([key, value]) => [
    key,
    classCastingSchema.parse(value),
  ]),
);

export function findReviewedClassCasting(
  classTag: string,
): Casting | undefined {
  return Object.hasOwn(classCasting, classTag)
    ? classCasting[classTag]
    : undefined;
}

/** Rows are indexed by spell level, including a nullable zero-level column. */
export function findCastingTableRow(
  table: CastingTableKey,
  castingLevel: number,
  resources: ReviewedCastingTables = defaultCastingTables,
): CastingTableRow | undefined {
  if (!Number.isInteger(castingLevel) || castingLevel < 1) return undefined;
  return resources.tables[table].rows[Math.min(MAX_LEVEL, castingLevel) - 1];
}

export function castingTableIncludesZeroLevel(
  table: CastingTableKey,
  resources: ReviewedCastingTables = defaultCastingTables,
): boolean {
  return resources.tables[table].includesZeroLevel;
}
