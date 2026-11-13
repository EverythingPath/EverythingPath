import type {
  CharacterSheetInput,
  SheetEntry,
  SheetWarning,
} from './character-sheet';
import type { ResolvedSpellcasting } from './character-sheet-spellcasting';
import { isOppositionSchoolSpell } from './character-sheet-spellcasting-features';
import { effectiveSpellListLevel } from './character-sheet-archetype-casting';
import {
  spellCollectionWarnings,
  spellCountWarnings,
} from './character-sheet-spell-warnings';

export type ResolvedCollectionSpell = {
  entryId: string;
  catalogEntryId: string;
  ruleIdentity: string;
  name: string;
  classEntryId: string | null;
  castingClassName: string | null;
  school?: string;
  description?: string;
  spellLevel: number | null;
  explicitLevel: number | null;
  offList: boolean;
  /** CRB p. 77: preparing an opposition-school Spell uses two slots. */
  twoSlots: boolean;
};

export type ResolvedSpellCollection = {
  classEntryId: string;
  classTag: string;
  record: ResolvedSpellcasting['record'];
  heading: 'Spells known' | 'Spellbook' | 'Formula book' | 'Familiar' | null;
  readOnly: boolean;
  spells: ResolvedCollectionSpell[];
  levels: { spellLevel: number; count: number; allowance: number | null }[];
};

export type ResolvedSpellCollections = {
  collections: ResolvedSpellCollection[];
  spellsWithoutSpellcasting: ResolvedCollectionSpell[];
};

export function spellCollectionHeading(
  casting: Pick<ResolvedSpellcasting, 'record' | 'bookType' | 'spellKind'>,
) {
  // A whole-list caster has no list; a pending recording choice has none yet.
  if (casting.record === 'none' || casting.record === null) return null;
  if (casting.record === 'known') return 'Spells known';
  if (casting.bookType === 'familiar') return 'Familiar';
  if (
    casting.bookType === 'formula' ||
    (!casting.bookType && casting.spellKind === 'alchemy')
  )
    return 'Formula book';
  return 'Spellbook';
}

function collectionSpell({
  input,
  entry,
  casting,
}: {
  input: CharacterSheetInput;
  entry: Extract<SheetEntry, { kind: 'spell' }>;
  casting: ResolvedSpellcasting | undefined;
}): ResolvedCollectionSpell {
  const definition = input.catalogEntries.find(
    (catalog) => catalog._id === entry.catalogEntryId,
  );
  const detail =
    definition?.detail?.kind === 'spell' ? definition.detail : undefined;
  // #422: the effective list; null while an Archetype choice decides it.
  const listLevel =
    casting && detail
      ? effectiveSpellListLevel(casting.spellList, {
          ruleIdentity: definition?.ruleIdentity ?? entry.catalogEntryId,
          levels: detail.levels,
        })
      : undefined;
  const castingClass = input.catalogEntries.find(
    (catalog) => catalog._id === entry.state.castingClassId,
  );
  return {
    entryId: entry._id,
    catalogEntryId: entry.catalogEntryId,
    ruleIdentity: definition?.ruleIdentity ?? entry.catalogEntryId,
    name: definition?.name ?? 'Spell',
    classEntryId: entry.state.castingClassId ?? null,
    castingClassName: castingClass?.name ?? casting?.name ?? null,
    ...(detail?.school ? { school: detail.school } : {}),
    ...(detail?.description ? { description: detail.description } : {}),
    spellLevel: listLevel ?? entry.state.level ?? null,
    explicitLevel: entry.state.level ?? null,
    offList: casting !== undefined && listLevel === undefined,
    twoSlots:
      casting !== undefined &&
      casting.type !== null &&
      casting.type !== 'spontaneous' &&
      isOppositionSchoolSpell(casting.school, detail?.school),
  };
}

/** Recorded collections reuse the casting calculation and retain unmatched selections. */
export function calculateSpellCollections({
  input,
  spellcastings,
}: {
  input: CharacterSheetInput;
  spellcastings: readonly ResolvedSpellcasting[];
}): ResolvedSpellCollections & { warnings: SheetWarning[] } {
  const collections: ResolvedSpellCollection[] = spellcastings.map(
    (casting) => ({
      classEntryId: casting.classEntryId,
      classTag: casting.classTag,
      record: casting.record,
      heading: spellCollectionHeading(casting),
      readOnly: casting.record === 'none',
      spells: [],
      levels: casting.slots.map((slot) => ({
        spellLevel: slot.spellLevel,
        count: 0,
        allowance: casting.record === 'known' ? slot.known : null,
      })),
    }),
  );
  const spellsWithoutSpellcasting: ResolvedCollectionSpell[] = [];
  const warnings: SheetWarning[] = [];
  const recorded = new Map<string, Extract<SheetEntry, { kind: 'spell' }>>();
  for (const entry of input.entries) {
    if (entry.kind !== 'spell' || entry.grantKey) continue;
    const definition = input.catalogEntries.find(
      (catalog) => catalog._id === entry.catalogEntryId,
    );
    const key = JSON.stringify([
      entry.state.castingClassId ?? null,
      definition?.ruleIdentity ?? entry.catalogEntryId,
    ]);
    // Legacy duplicate records remain stored; the latest chosen definition
    // supplies the single collection row and its level.
    recorded.set(key, entry);
  }
  for (const entry of recorded.values()) {
    const casting = spellcastings.find(
      (item) => item.classEntryId === entry.state.castingClassId,
    );
    const spell = collectionSpell({ input, entry, casting });
    const collection = collections.find(
      (item) => item.classEntryId === casting?.classEntryId && !item.readOnly,
    );
    warnings.push(...spellCollectionWarnings({ input, spell, casting }));
    if (!collection) {
      spellsWithoutSpellcasting.push(spell);
      continue;
    }
    collection.spells.push(spell);
    if (spell.spellLevel === null) continue;
    const level = collection.levels.find(
      (row) => row.spellLevel === spell.spellLevel,
    );
    if (!level) {
      collection.levels.push({
        spellLevel: spell.spellLevel,
        count: 1,
        allowance: null,
      });
      continue;
    }
    level.count++;
  }
  for (const collection of collections) {
    collection.levels.sort((a, b) => a.spellLevel - b.spellLevel);
    collection.spells.sort(
      (a, b) =>
        (a.spellLevel ?? Infinity) - (b.spellLevel ?? Infinity) ||
        a.name.localeCompare(b.name),
    );
    warnings.push(...spellCountWarnings({ input, collection }));
  }
  return { collections, spellsWithoutSpellcasting, warnings };
}
