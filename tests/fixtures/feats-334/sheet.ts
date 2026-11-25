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
import preview from './preview.json';

export type HeldFeatExample = 'Storm-Lashed' | 'Additional Traits';

// Neither selected body has Catalog Entry ID conditions. Reject such fields
// rather than treating imported external keys as stored Convex references.
const localSituationSchema = z.strictObject({
  local: z.string().min(1).max(4096),
});
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

// This character-scoped adapter exists only in isolated tests. The source body
// remains held, and no accepted assessment or Catalog Release is constructed.
// Only the unusable repeatable:unreviewed field is omitted; no replacement
// repeatability fact or missing rule mechanic is invented.
export function heldFeatDefinition(name: HeldFeatExample) {
  const entry = importedCatalogEntrySchema.parse(
    preview.entries.find((candidate) => candidate.name === name),
  );
  if (entry.detail.kind !== 'feat') throw new Error('Expected a feat fixture');
  const { repeatable: _repeatable, ...detail } = entry.detail;
  return {
    name: `Held fixture: ${entry.name}`,
    ruleIdentity: entry.externalKey,
    description: entry.description,
    sources: entry.sources,
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

export function heldFeatSheet(name: HeldFeatExample): CharacterSheetInput {
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
          value: ability === 'constitution' ? 14 : 10,
        })),
      },
      { _id: 'feat', ...heldFeatDefinition(name) },
    ],
  };
}
