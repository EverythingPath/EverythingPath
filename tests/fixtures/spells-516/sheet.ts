import {
  abilityKeys,
  abilityTargets,
  situationalNoteSchema,
  type CharacterSheetInput,
} from '../../../src/lib/character-sheet';
import {
  importedCatalogEntrySchema,
  importedSpellDetailSchema,
} from '../../../src/lib/catalog/imported-entry-schema';
import preview from './preview.json';

export function spellFixture(name: string) {
  const entry = preview.entries.find((row) => row.name === name);
  if (!entry) throw new Error(`Missing Spell fixture: ${name}`);
  return importedCatalogEntrySchema
    .extend({ detail: importedSpellDetailSchema })
    .parse(entry);
}

export function recordedSpellSheet(name: string): CharacterSheetInput {
  const spell = spellFixture(name);
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
        state: { kind: 'spell', level: spell.detail.levels.wizard },
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
        modifiers: [],
        situationalNotes: spell.situationalNotes?.map((note) =>
          situationalNoteSchema.parse(note),
        ),
        detail: {
          kind: 'spell',
          levels: spell.detail.levels,
          school: spell.detail.school,
        },
      },
    ],
  };
}
