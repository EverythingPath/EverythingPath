import { z } from 'zod';
import {
  abilityKeys,
  abilityTargets,
  type CharacterSheetInput,
} from '../../../src/lib/character-sheet';
import { outputSchema } from '../../../src/lib/catalog/curation-output-schema';
import preview from './preview.json';

// A deliberately narrow fixture adapter: imported numeric Modifiers already
// match the public resolver. It leaves unreviewed repeatability and all attack
// identities untouched, and does not install or activate a Catalog Release.
export function featFixtureDefinition(name: 'Lightning Reflexes') {
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
        .extend({ target: z.literal('save.ref'), value: z.number() })
        .strict()
        .parse(modifier),
    ),
    detail: { kind: 'feat' as const },
  };
}

export function featFixtureSheet(
  name: 'Lightning Reflexes',
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
          value: ability === 'dexterity' ? 14 : 10,
        })),
      },
      { _id: 'feat', ...featFixtureDefinition(name) },
    ],
  };
}
