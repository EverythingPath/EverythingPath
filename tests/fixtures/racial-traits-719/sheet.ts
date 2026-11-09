import { z } from 'zod';
import {
  abilityKeys,
  abilityTargets,
  catalogModifierTargets,
  modifierConditionSchema,
  personalBonusTypes,
  situationalNoteSchema,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from '../../../src/lib/character-sheet';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';

// Test-only adapter from imported release bodies to resolver catalog entries.
// Stable keys serve as both the entry ID and its rule identity, so no database
// reference is constructed. Imported targets are the resolver's own (#720); any
// target or bonus type the resolver does not know fails the parse rather than
// silently contributing nothing.
const modifierSchema = z.strictObject({
  target: z.enum(catalogModifierTargets),
  bonusType: z.enum(personalBonusTypes),
  value: z.number(),
  condition: modifierConditionSchema.optional(),
  stacksWithinEntry: z.literal(true).optional(),
});

export function sheetDefinition(raw: unknown): CharacterSheetCatalogEntry {
  const entry = importedCatalogEntrySchema.parse(raw);
  const detail = entry.detail;
  const base = {
    _id: entry.externalKey,
    name: entry.name,
    ruleIdentity: entry.externalKey,
    stacksWithItself: false,
    modifiers: entry.modifiers.map((modifier) =>
      modifierSchema.parse(modifier),
    ),
    ...(entry.situationalNotes
      ? {
          situationalNotes: entry.situationalNotes.map((note) =>
            situationalNoteSchema.parse(note),
          ),
        }
      : {}),
    ...(entry.grantsSlots ? { grantsSlots: entry.grantsSlots } : {}),
    ...(entry.countsAsRaces ? { countsAsRaces: entry.countsAsRaces } : {}),
    ...(entry.proficiencies ? { proficiencies: entry.proficiencies } : {}),
  };
  if (detail.kind === 'race')
    return {
      ...base,
      detail: {
        kind: 'race',
        racialHitDice: detail.racialHitDice,
        creatureTypes: detail.creatureTypes,
        creatureSubtypes: detail.creatureSubtypes,
        racialTraits: detail.racialTraits ?? [],
        ...(detail.size ? { size: detail.size } : {}),
      },
    };
  if (detail.kind === 'racialTrait')
    return {
      ...base,
      detail: {
        kind: 'racialTrait',
        ...(detail.abilityChoiceCount
          ? { abilityChoiceCount: detail.abilityChoiceCount }
          : {}),
        ...(detail.size ? { size: detail.size } : {}),
        raceEntryIds: detail.raceKeys ?? [],
        replaces: detail.replaces ?? [],
        ...(detail.unresolvedReplacements
          ? { unresolvedReplacements: detail.unresolvedReplacements }
          : {}),
        ...(detail.favoredClassCount
          ? { favoredClassCount: detail.favoredClassCount }
          : {}),
        ...(detail.bonusSkillRanksPerLevel
          ? { bonusSkillRanksPerLevel: detail.bonusSkillRanksPerLevel }
          : {}),
      },
    };
  if (detail.kind === 'feat') return { ...base, detail: { kind: 'feat' } };
  if (detail.kind === 'class')
    return {
      ...base,
      detail: {
        kind: 'class',
        classKind: detail.classKind,
        hitDie: detail.hitDie,
        bab: detail.bab,
        saves: detail.saves,
        skillRanksPerLevel: detail.skillRanksPerLevel,
        classSkills: detail.classSkills,
      },
    };
  throw new Error(`No sheet adapter for ${detail.kind} fixtures`);
}

/** Ten in every ability: the race and its traits supply every difference. */
export const baseDefinition: CharacterSheetCatalogEntry = {
  _id: 'base',
  ruleIdentity: 'fixture-base',
  modifiers: abilityKeys.map((ability) => ({
    target: abilityTargets[ability],
    bonusType: 'base',
    value: 10,
  })),
};

export function raceSheet({
  race,
  definitions,
  entries = [],
}: {
  race: string;
  definitions: CharacterSheetCatalogEntry[];
  entries?: SheetEntry[];
}): CharacterSheetInput {
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      {
        _id: 'race-row',
        kind: 'race',
        active: true,
        catalogEntryId: race,
        state: { kind: 'race' },
      },
      ...entries,
    ],
    catalogEntries: [baseDefinition, ...definitions],
  };
}

/** A selected alternate Racial Trait. */
export function alternateRow(
  catalogEntryId: string,
): Extract<SheetEntry, { kind: 'racialTrait' }> {
  return {
    _id: `alternate:${catalogEntryId}`,
    kind: 'racialTrait',
    active: true,
    catalogEntryId,
    state: { kind: 'racialTrait' },
  };
}

/** The saved state of a race's granted trait, such as an ability choice. */
export function grantedTraitRow({
  race,
  trait,
  choice,
}: {
  race: string;
  trait: string;
  choice: string;
}): SheetEntry {
  return {
    _id: `granted:${trait}`,
    kind: 'racialTrait',
    active: true,
    catalogEntryId: trait,
    grantKey: { source: race, entry: trait },
    state: { kind: 'racialTrait', choice },
  };
}
