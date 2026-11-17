import { z } from 'zod';
import {
  abilityKeys,
  abilityTargets,
  catalogModifierTargets,
  personalBonusTypes,
  type CharacterSheetInput,
} from '../../../src/lib/character-sheet';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';
import preview from './preview.json';

export const heldRaceExamples = [
  {
    key: 'pf1/ITHs6VCRdSQUsoen',
    name: 'Gnoll',
    scores: [12, 10, 12, 10, 10, 10],
  },
  {
    key: 'pf1/LU6Rgor1wTS5cCRN',
    name: 'Lizardfolk',
    scores: [12, 10, 12, 10, 10, 10],
  },
  { key: 'pf1/gZxiUYLYsGqQYwGZ', name: 'Ogre', scores: [14, 10, 12, 8, 10, 8] },
];

const modifiersSchema = z.array(
  z.strictObject({
    target: z.enum(catalogModifierTargets),
    bonusType: z.enum(personalBonusTypes),
    value: z.number(),
  }),
);
function previewEntry(key: string) {
  return importedCatalogEntrySchema.parse(
    preview.entries.find((candidate) => candidate.externalKey === key),
  );
}
/** The held definition fields every fixture entry shares. */
function heldEnvelope(entry: ReturnType<typeof previewEntry>) {
  return {
    name: `Held fixture: ${entry.name}`,
    ruleIdentity: entry.externalKey,
    description: entry.description,
    sources: entry.sources,
    stacksWithItself: false,
    modifiers: modifiersSchema.parse(entry.modifiers),
  };
}

// This adapter is deliberately limited to the three test races without a
// trait folder, each granting only its reviewed ability score trait (#721).
// It never creates an accepted release definition or fills missing mechanics.
export function heldRaceDefinition(key: string) {
  if (!heldRaceExamples.some((example) => example.key === key))
    throw new Error(`Not a traitless held-content fixture: ${key}`);
  const entry = previewEntry(key);
  if (entry.detail.kind !== 'race') throw new Error('Expected a race fixture');
  return {
    ...heldEnvelope(entry),
    // Stored Racial Trait IDs; the stable keys are `heldRaceTraitKeys`.
    detail: { ...entry.detail, racialTraits: [] },
  };
}

/** The stable keys of the race's granted Racial Traits. */
export function heldRaceTraitKeys(key: string) {
  const entry = previewEntry(key);
  return entry.detail.kind === 'race' ? (entry.detail.racialTraits ?? []) : [];
}

/**
 * The race's granted ability score trait, which carries its adjustments. Its
 * race and replacement references are stored IDs, which the caller links.
 */
export function heldRaceTraitDefinition(traitKey: string) {
  const entry = previewEntry(traitKey);
  if (entry.detail.kind !== 'racialTrait')
    throw new Error('Expected a Racial Trait fixture');
  return {
    ...heldEnvelope(entry),
    detail: {
      kind: 'racialTrait' as const,
      raceEntryIds: [],
      replaces: [],
    },
  };
}

export function heldRaceSheet(key: string): CharacterSheetInput {
  const race = heldRaceDefinition(key);
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
        catalogEntryId: key,
        state: { kind: 'race' },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'fixture-base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: 10,
        })),
      },
      {
        _id: key,
        ...race,
        detail: { ...race.detail, racialTraits: heldRaceTraitKeys(key) },
      },
      ...heldRaceTraitKeys(key).map((traitKey) => {
        const trait = heldRaceTraitDefinition(traitKey);
        return {
          _id: traitKey,
          ...trait,
          detail: { ...trait.detail, raceEntryIds: [key] },
        };
      }),
    ],
  };
}
