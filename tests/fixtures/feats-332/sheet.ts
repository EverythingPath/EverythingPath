import { z } from 'zod';
import {
  abilityKeys,
  abilityTargets,
  type CharacterSheetInput,
} from '../../../src/lib/character-sheet';
import { outputSchema } from '../../../src/lib/catalog/curation-output-schema';
import preview from './preview.json';

// The imported numeric body is used unchanged. This fixture adapter omits the
// importer's unusable repeatable:unreviewed field without inventing a choice
// fact or creating release metadata.
export function featFixtureDefinition() {
  const entry = preview.entries.find((row) => row.name === 'Great Fortitude');
  if (!entry) throw new Error('Missing Great Fortitude fixture');
  return {
    name: entry.name,
    ruleIdentity: entry.externalKey,
    description: entry.description,
    sources: entry.sources,
    modifiers: entry.modifiers.map((modifier) =>
      outputSchema.options[0]
        .pick({ target: true, bonusType: true, value: true })
        .extend({ target: z.literal('save.fort'), value: z.number() })
        .strict()
        .parse(modifier),
    ),
    detail: { kind: 'feat' as const },
  };
}

export function featFixtureSheet(): CharacterSheetInput {
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
      { _id: 'feat', ...featFixtureDefinition() },
    ],
  };
}
