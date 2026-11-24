import { z } from 'zod';
import {
  abilityKeys,
  abilityTargets,
  type AbilityScores,
  type CharacterSheetInput,
} from '../../../src/lib/character-sheet';
import { outputSchema } from '../../../src/lib/catalog/curation-output-schema';
import preview from './preview.json';

type FixtureFeat = 'Improved Initiative' | 'Intimidating Prowess';

// The one statistic each fixture feat changes, and its value's shape.
const modifierShapes = {
  'Improved Initiative': { target: z.literal('init'), value: z.number() },
  // #726: the Strength modifier, with no floor.
  'Intimidating Prowess': {
    target: z.literal('skill.int'),
    value: z.object({ formula: z.string() }).strict(),
  },
} as const;

// A deliberately narrow fixture adapter: imported Modifiers already match the
// public resolver. It leaves unreviewed repeatability and all attack
// identities untouched, and does not install or activate a Catalog Release.
export function featFixtureDefinition(name: FixtureFeat) {
  const entry = preview.entries.find((row) => row.name === name);
  if (!entry) throw new Error(`Missing feat fixture: ${name}`);
  return {
    name: entry.name,
    ruleIdentity: entry.externalKey,
    description: entry.description,
    sources: entry.sources,
    modifiers: entry.modifiers.map((modifier) =>
      outputSchema.options[0]
        .pick({ target: true, bonusType: true, value: true })
        .extend(modifierShapes[name])
        .strict()
        .parse(modifier),
    ),
    detail: { kind: 'feat' as const },
  };
}

export function featFixtureSheet({
  name,
  scores = { dexterity: 14 },
}: {
  name: FixtureFeat;
  scores?: Partial<AbilityScores>;
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
          value: scores[ability] ?? 10,
        })),
      },
      { _id: 'feat', ...featFixtureDefinition(name) },
    ],
  };
}
