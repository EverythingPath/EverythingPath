// pbl-reseed-generic (PRD #251): test-only adapters from imported race and
// Racial Trait entries (importReleasedEntries, or an import from the pinned
// store) to resolver catalog entries, for the race sheet tests that took them
// from the racial-traits-719 and races-328 batch directories. Each builds the
// sheet input its batch adapter built from the same entry.
import { z } from 'zod';
import {
  bonusTypes,
  catalogModifierTargets,
  modifierConditionSchema,
  situationalNoteSchema,
  type CharacterSheetCatalogEntry,
} from '../../src/lib/character-sheet';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';

// Stable keys serve as both the entry ID and its rule identity, so no database
// reference is constructed. Imported targets are the resolver's own (#720); any
// target or bonus type the resolver does not know fails the parse rather than
// silently contributing nothing. A race's land speed is a `base` Modifier
// (stats-d2), so the catalog's bonus types include `base`.
const modifierSchema = z.strictObject({
  target: z.enum(catalogModifierTargets),
  bonusType: z.enum(bonusTypes),
  value: z.number(),
  condition: modifierConditionSchema.optional(),
  stacksWithinEntry: z.literal(true).optional(),
});

type ImportedEntry = z.infer<typeof importedCatalogEntrySchema>;
type Detail<Kind extends ImportedEntry['detail']['kind']> = Extract<
  ImportedEntry['detail'],
  { kind: Kind }
>;

/** The fields every adapted entry shares, its optional ones only when set. */
function baseDefinition(entry: ImportedEntry) {
  return {
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
}

function racialTraitDetail(detail: Detail<'racialTrait'>) {
  return {
    kind: 'racialTrait' as const,
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
  };
}

/** An imported race, Racial Trait, feat or class as a resolver catalog entry. */
export function sheetDefinition(raw: unknown): CharacterSheetCatalogEntry {
  const entry = importedCatalogEntrySchema.parse(raw);
  const detail = entry.detail;
  const base = baseDefinition(entry);
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
    return { ...base, detail: racialTraitDetail(detail) };
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

/** The three races without a trait folder the held adapter takes (#721). */
export const heldRaceKeys = {
  gnoll: 'pf1/ITHs6VCRdSQUsoen',
  lizardfolk: 'pf1/LU6Rgor1wTS5cCRN',
  ogre: 'pf1/gZxiUYLYsGqQYwGZ',
} as const;

const heldModifiersSchema = z.array(
  z.strictObject({
    target: z.enum(catalogModifierTargets),
    bonusType: z.enum(bonusTypes),
    value: z.number(),
  }),
);

/**
 * One of `heldRaceKeys`' imported races as a held definition without its
 * granted Racial Traits. This adapter is deliberately limited to those three
 * races; it never creates an accepted release definition or fills missing
 * mechanics.
 */
export function heldRaceDefinition(raw: unknown) {
  const entry = importedCatalogEntrySchema.parse(raw);
  if (!Object.values<string>(heldRaceKeys).includes(entry.externalKey))
    throw new Error(
      `Not a traitless held-content fixture: ${entry.externalKey}`,
    );
  if (entry.detail.kind !== 'race') throw new Error('Expected a race fixture');
  return {
    name: `Held fixture: ${entry.name}`,
    ruleIdentity: entry.externalKey,
    description: entry.description,
    sources: entry.sources,
    stacksWithItself: false,
    modifiers: heldModifiersSchema.parse(entry.modifiers),
    // Stored Racial Trait IDs; none is linked here.
    detail: { ...entry.detail, racialTraits: [] },
  };
}
