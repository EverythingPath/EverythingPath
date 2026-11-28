// pbl-released-spells-1 (PRD #251): the spell resolver and sheet tests' seam
// over entries imported with importReleasedEntries. It builds what the spell
// batch adapters built from their preview (tests/fixtures/spells-NNN/
// sheet.ts: `spellFixture`, `recordedSpellSheet`, `oracleClassFixture`) from
// imported entries instead, looking a Spell up by the name a batch test used
// (released-spell-keys.ts) and checking the imported entry carries it.
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import {
  importedCatalogEntrySchema,
  importedSpellDetailSchema,
} from '../../src/lib/catalog/imported-entry-schema';
import {
  abilityKeys,
  abilityTargets,
  situationalNoteSchema,
  type CharacterSheetInput,
} from '../../src/lib/character-sheet';
import type { ReleasedEntry } from './released-entries';
import { spellBatches, type SpellBatch } from './released-spell-keys';

export type ReleasedEntries = ReadonlyMap<string, ReleasedEntry>;

const catalogModifierSchema = outputSchema.options[0].omit({ kind: true });
const spellSchema = importedCatalogEntrySchema.extend({
  detail: importedSpellDetailSchema,
});

/** An imported entry as a Spell; it refuses a missing key or another kind. */
export function importedSpell(entries: ReleasedEntries, key: string) {
  const row = entries.get(key);
  if (!row) throw new Error(`${key} was not imported`);
  return spellSchema.parse(row);
}

/** An imported entry as a class, as `oracleClassFixture` gave the Oracle. */
export function importedClass(entries: ReleasedEntries, key: string) {
  const row = entries.get(key);
  if (!row) throw new Error(`${key} was not imported`);
  const entry = importedCatalogEntrySchema.parse(row);
  if (entry.detail.kind !== 'class')
    throw new Error(`${key} is no class: ${entry.detail.kind}`);
  return { ...entry, detail: entry.detail };
}

export type ImportedSpell = ReturnType<typeof importedSpell>;

/**
 * A sheet with ability scores of 10 and one recorded Spell at its level on
 * the named class's list, as the batch adapters' `recordedSpellSheet` built
 * it: the Spell's Modifiers as the resolver takes them (a Modifier the
 * catalog schema refuses throws), its Situational Notes through the sheet's
 * Note schema, its class levels, school and description. It refuses a class
 * the Spell has no level for.
 */
export function recordedSpellSheet(
  spell: ImportedSpell,
  classTag: string,
): CharacterSheetInput {
  const level = spell.detail.levels[classTag];
  if (level === undefined)
    throw new Error(`${spell.name} has no ${classTag} level`);
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

/** The same sheet without its Spell row: the baseline a Spell must not move. */
export function withoutSpell(input: CharacterSheetInput): CharacterSheetInput {
  return {
    ...input,
    entries: input.entries.filter((entry) => entry.kind !== 'spell'),
  };
}

/**
 * The lookups one spell batch's tests made over their preview, over the
 * imported entries: `spell(name)`, the batch's Spell of that name (its key
 * from released-spell-keys.ts, and the imported entry must carry the name),
 * and `sheet(name, classTag)`, `recordedSpellSheet` for it.
 */
export function spellBatch(entries: ReleasedEntries, batch: SpellBatch) {
  const keys: Readonly<Record<string, string>> = spellBatches[batch];
  function spell(name: string) {
    const key = keys[name];
    if (key === undefined) throw new Error(`${batch} names no Spell ${name}`);
    const entry = importedSpell(entries, key);
    if (entry.name !== name)
      throw new Error(`${key} is ${entry.name}, not ${name}`);
    return entry;
  }
  const sheet = (name: string, classTag: string) =>
    recordedSpellSheet(spell(name), classTag);
  return { spell, sheet };
}
