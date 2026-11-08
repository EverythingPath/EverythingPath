import type { CastingPropertyKey } from './character-sheet-archetype-casting';
import type {
  Casting,
  CastingTableKey,
  ExtraSlotKind,
} from './character-sheet-casting-tables';

// The words for casting facts shared by the calculation's conflict copy and
// the sheet's Spellcasting and Archetype views (#422).

export function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** "+1", "−3": a signed whole number with a typographic minus. */
export function signedNumber(value: number) {
  return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
}

const recordLabels: Record<Casting['record'], string> = {
  known: 'spells known',
  book: 'spellbook',
  none: 'the whole list',
};
const bookLabels: Record<NonNullable<Casting['bookType']>, string> = {
  spellbook: 'spellbook',
  formula: 'formula book',
  familiar: 'familiar',
};

/** "Spontaneous, spells known", "Prepared, formula book". */
export function describeRecording(
  recording: Pick<Casting, 'type' | 'record' | 'bookType'>,
) {
  const record =
    recording.record === 'book' && recording.bookType
      ? bookLabels[recording.bookType]
      : recordLabels[recording.record];
  return `${capitalize(recording.type)}, ${record}`;
}

/** Each casting property's name inside a sentence. */
export const castingPropertyNames: Record<CastingPropertyKey, string> = {
  presence: 'spellcasting',
  spellKind: 'spell kind',
  ability: 'casting ability',
  table: 'casting table',
  recording: 'preparation and recording',
  casterLevelOffset: 'caster level',
  spellList: 'spell list',
  grantedSpells: 'Granted Spells',
  extraSlots: 'extra slots',
};

/** "Casting ability": a casting property's name as a label. */
export function castingPropertyLabel(key: CastingPropertyKey) {
  return capitalize(castingPropertyNames[key]);
}

export const castingTableLabels: Record<CastingTableKey, string> = {
  'prepared-full': 'Prepared full table',
  'prepared-medium': 'Prepared medium table',
  'prepared-low': 'Prepared low table',
  'spontaneous-full': 'Spontaneous full table',
  'spontaneous-medium': 'Spontaneous medium table',
  'spontaneous-low': 'Spontaneous low table',
  'hybrid-full': 'Hybrid full table',
  adept: 'Adept table',
  extracts: 'Extracts table',
  'unchained-summoner': 'Unchained summoner table',
  occultist: 'Occultist table',
};

const extraSlotNames: Record<ExtraSlotKind, string> = {
  domain: 'domain',
  school: 'arcane school',
  spirit: 'spirit',
};

/** "+1 arcane school slot". */
export function describeExtraSlot(kind: ExtraSlotKind) {
  return `+1 ${extraSlotNames[kind]} slot`;
}

/**
 * The class whose spell list a class tag names: "Bard". A class absent from
 * the loaded catalog falls back to its capitalised tag.
 */
export function spellListName(
  classTag: string,
  catalog: readonly { name?: string; detail?: object }[] = [],
) {
  const owner = catalog.find((row) => {
    const casting: unknown = row.detail && Reflect.get(row.detail, 'casting');
    return (
      typeof casting === 'object' &&
      casting !== null &&
      Reflect.get(casting, 'classTag') === classTag
    );
  });
  return owner?.name ?? capitalize(classTag);
}
