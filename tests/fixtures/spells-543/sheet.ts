import {
  abilityKeys,
  abilityTargets,
  situationalNoteSchema,
  type CharacterSheetInput,
} from '../../../src/lib/character-sheet';
import { outputSchema } from '../../../src/lib/catalog/curation-output-schema';
import { preview } from './data';

const catalogModifierSchema = outputSchema.options[0].omit({ kind: true });

export function spellFixture(name: string) {
  const entry = preview.entries.find((row) => row.name === name);
  if (!entry) throw new Error(`Missing Spell fixture: ${name}`);
  return entry;
}

// Character-scoped adapter for isolated tests only: it records a held Spell's
// reviewed definition at one of its own class levels, without an assessment,
// Catalog Release or Spell Effect.
export function recordedSpellSheet(
  name: string,
  classTag: string,
): CharacterSheetInput {
  const spell = spellFixture(name);
  const level = spell.detail.levels[classTag];
  if (level === undefined) throw new Error(`${name} has no ${classTag} level`);
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
        _id: 'spell-row',
        kind: 'spell',
        active: true,
        catalogEntryId: spell.externalKey,
        state: { kind: 'spell', level },
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
        _id: spell.externalKey,
        ruleIdentity: spell.externalKey,
        name: spell.name,
        modifiers: spell.modifiers.map((modifier) =>
          catalogModifierSchema.parse(modifier),
        ),
        situationalNotes: spell.situationalNotes?.map((note) =>
          situationalNoteSchema.parse(note),
        ),
        detail: {
          kind: 'spell',
          levels: spell.detail.levels,
          school: spell.detail.school,
          description: spell.description,
        },
      },
    ],
  };
}
