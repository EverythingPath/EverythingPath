/** "1st", "2nd", "3rd", "4th", "11th", "22nd"…: a spell or class level in words. */
export function ordinal(level: number) {
  const tens = level % 100;
  if (tens >= 11 && tens <= 13) return `${level}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[level % 10] ?? 'th';
  return `${level}${suffix}`;
}

/** "A", "A or B", "A, B or C": alternatives in words. */
export function listAlternatives(names: readonly string[]) {
  if (names.length < 2) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} or ${names.at(-1) ?? ''}`;
}

/**
 * A class tag in words: the class's own name when the sheet has it, else
 * "Mystic theurge" from `mysticTheurge` and "Unchained summoner" from
 * `summonerUnchained`.
 */
export function describeClass(
  classTag: string,
  findCastingClassName: (classTag: string) => string | null,
) {
  const known = findCastingClassName(classTag);
  if (known) return known;
  const base = classTag.replace(/Unchained$/, '');
  const words = base.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  const text = base === classTag ? words : `unchained ${words}`;
  return text.replace(/^./, (letter) => letter.toUpperCase());
}
