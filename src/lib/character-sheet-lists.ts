// The list words the sheet's messages share: an armor limit's reason and the
// eidolon warnings name several things in one sentence (rotation-5).

/** Joins names as "A", "A and B", "A, B and C"; no names, "". */
export function listAll(names: readonly string[]) {
  if (names.length < 2) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
}
