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

export type ReviewedFeatExample = 'Free Spirit' | 'Enemy Cult' | 'Shield Wall';

// These selected bodies have no Catalog Entry ID conditions. Accept only shared
// or local Situations, never imported external keys as stored references.
const localSituationSchema = z.union([
  z.string().min(1),
  z.strictObject({
    local: z.string().min(1).max(4096),
  }),
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
// reviewed rule identity and mechanics without constructing an assessment or
// Catalog Release. The unusable repeatable:unreviewed field is omitted; no
// replacement repeatability fact or missing rule mechanic is invented.
export function reviewedFeatDefinition(name: ReviewedFeatExample) {
  const entry = importedCatalogEntrySchema.parse(
    preview.entries.find((candidate) => candidate.name === name),
  );
  if (entry.detail.kind !== 'feat') throw new Error('Expected a feat fixture');
  const { repeatable: _repeatable, ...detail } = entry.detail;
  return {
    name: `Reviewed fixture: ${entry.name}`,
    ruleIdentity: entry.externalKey,
    description: entry.description,
    sources: entry.sources,
    ...(entry.prerequisiteText
      ? { prerequisiteText: entry.prerequisiteText }
      : {}),
    ...(entry.prerequisites ? { prerequisites: entry.prerequisites } : {}),
    // Imported slot feats are stable keys; these feat bodies have none.
    ...(entry.grantsSlots
      ? {
          grantsSlots: entry.grantsSlots.map(
            ({ feats: _feats, ...slot }) => slot,
          ),
        }
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
    detail,
  };
}

export function reviewedFeatSheet(
  name: ReviewedFeatExample,
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
      {
        _id: 'feat-row',
        kind: 'feat',
        active: true,
        catalogEntryId: 'feat',
        state: { kind: 'feat' },
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
      { _id: 'feat', ...reviewedFeatDefinition(name) },
    ],
  };
}
