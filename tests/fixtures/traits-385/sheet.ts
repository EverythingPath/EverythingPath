import { z } from 'zod';
import {
  abilityKeys,
  abilityTargets,
  modifierConditionSchema,
  modifierTargets,
  situationalNoteSchema,
  type CharacterSheetInput,
} from '../../../src/lib/character-sheet';
import { outputSchema } from '../../../src/lib/catalog/curation-output-schema';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';
import { preview } from './data';

export type ReviewedTraitExample =
  | 'Undermarket Smuggler (Goka)'
  | 'Minkai Advocate (Minkai)'
  | 'Brimstone Seer (Orc)'
  | "Tempter's Tongue (Tiefling)"
  | 'Loner of the Rocks (Oread)'
  | 'Cunning Liar (Any City)'
  | 'Heedful Readiness'
  | 'Attached'
  | 'Stargazer (Iron Gods)'
  | 'Fixer of Odds (Second Darkness)';

// These selected bodies have no Catalog Entry ID conditions. Accept only shared
// or local Situations, never imported external keys as stored references.
const localSituationSchema = z.union([
  z.string().min(1),
  z.strictObject({ local: z.string().min(1).max(4096) }),
]);
const localConditionSchema = modifierConditionSchema
  .pick({ situation: true })
  .extend({ situation: localSituationSchema })
  .strict();
const fixtureNoteSchema = situationalNoteSchema
  .safeExtend({
    situation: localSituationSchema.optional(),
    condition: localConditionSchema.optional(),
  })
  .strict();

// This character-scoped adapter exists only in isolated tests. It materializes
// a held trait's reviewed rule identity and mechanics without constructing an
// assessment or Catalog Release. Prerequisite atoms that name other entries'
// stable keys are left out; the requirement stays readable as prerequisiteText.
export function reviewedTraitDefinition(name: ReviewedTraitExample) {
  const entry = importedCatalogEntrySchema.parse(
    preview.entries.find((candidate) => candidate.name === name),
  );
  if (entry.detail.kind !== 'trait')
    throw new Error('Expected a trait fixture');
  return {
    name: `Reviewed fixture: ${entry.name}`,
    ruleIdentity: entry.externalKey,
    description: entry.description,
    sources: entry.sources,
    ...(entry.prerequisiteText
      ? { prerequisiteText: entry.prerequisiteText }
      : {}),
    modifiers: entry.modifiers.map((modifier) =>
      outputSchema.options[0]
        .omit({ kind: true })
        .extend({
          target: z.enum(modifierTargets),
          condition: localConditionSchema.optional(),
        })
        .parse(modifier),
    ),
    ...(entry.situationalNotes
      ? {
          situationalNotes: entry.situationalNotes.map((note) =>
            fixtureNoteSchema.parse(note),
          ),
        }
      : {}),
    detail: entry.detail,
  };
}

export function reviewedTraitSheet(
  ...names: ReviewedTraitExample[]
): CharacterSheetInput {
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
      ...names.map((_, index) => ({
        _id: `trait-row-${index}`,
        kind: 'trait' as const,
        active: true,
        catalogEntryId: `trait-${index}`,
        state: { kind: 'trait' as const },
      })),
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
      ...names.map((name, index) => ({
        _id: `trait-${index}`,
        ...reviewedTraitDefinition(name),
      })),
    ],
  };
}
