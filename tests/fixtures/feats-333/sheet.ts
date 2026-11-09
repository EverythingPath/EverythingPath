import { z } from 'zod';
import {
  abilityKeys,
  abilityTargets,
  type CharacterSheetInput,
} from '../../../src/lib/character-sheet';
import preview from './preview.json';

// Fixture-only narrowing leaves the imported identity and rule values intact.
// repeatable:unreviewed has no runtime representation and is omitted, without
// claiming a reviewed repeatability choice or publishing a Catalog Release.
export function featFixtureDefinition() {
  const entry = preview.entries.find((row) => row.name === 'Lunge');
  if (!entry?.prerequisites)
    throw new Error('Missing Lunge fixture or prerequisite');
  return {
    name: entry.name,
    ruleIdentity: entry.externalKey,
    description: entry.description,
    sources: entry.sources,
    modifiers: entry.modifiers.map((modifier) =>
      z
        .strictObject({
          target: z.literal('ac'),
          bonusType: z.literal('untyped'),
          value: z.literal(-2),
          condition: z.strictObject({ option: z.literal(true) }),
        })
        .parse(modifier),
    ),
    situationalNotes: entry.situationalNotes.map((note) =>
      z.strictObject({ text: z.string() }).parse(note),
    ),
    prerequisites: entry.prerequisites.map((clause) =>
      z.object({ bab: z.number() }).parse(clause),
    ),
    detail: { kind: 'feat' as const, featTypes: entry.detail.featTypes },
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
          value: ability === 'dexterity' ? 14 : 10,
        })),
      },
      { _id: 'feat', ...featFixtureDefinition() },
    ],
  };
}
