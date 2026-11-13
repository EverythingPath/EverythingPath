import type { UnverifiedReason } from '~/lib/catalog/imported-entry-schema';

/**
 * A released definition's Verified / Unverified label, as the builder shows
 * it (#227). A Catalog Copy, a personal adjustment and a definition from a
 * release built before labels carry none.
 */
export type EntryLabel =
  | { state: 'verified' }
  | { state: 'unverified'; reasons: readonly string[] };

/** What the live read stores on a definition: the label's state alone. */
export function entryLabel(definition: {
  verification?: 'verified' | 'unverified';
}): EntryLabel | undefined {
  if (definition.verification === 'verified') return { state: 'verified' };
  if (definition.verification === 'unverified')
    return { state: 'unverified', reasons: [] };
  return undefined;
}

const reasonPhrases: Record<UnverifiedReason, string> = {
  'no verification projection': 'No verification evidence in this release',
  'verification projection stale': 'Verification evidence out of date',
  'outside the launch inventory': 'Not in the launch inventory',
  'structure not verified': 'Structure not yet verified',
  'definition differs from the verified one':
    'Differs from the verified definition',
  'retained without its imported entry': 'Kept without its imported entry',
  'unproven mechanism': 'Mechanics not yet proven',
  'no curation record': 'No curation record',
  'unresolved curation mechanics': 'Curation mechanics unresolved',
};
const phraseFor = new Map<string, string>(Object.entries(reasonPhrases));
const genericPhrase = 'Not yet verified';

/**
 * Why an entry is unverified, in plain words, one phrase per reason: an
 * unknown reason, or none, reads as the generic phrase, never as raw text.
 */
export function describeUnverifiedReasons(reasons: readonly string[]) {
  const phrases = reasons.map(
    (reason) => phraseFor.get(reason) ?? genericPhrase,
  );
  return phrases.length === 0 ? [genericPhrase] : [...new Set(phrases)];
}

/** The reasons as one description: "No curation record. Not in …". */
export function describeUnverified(reasons: readonly string[]) {
  return describeUnverifiedReasons(reasons)
    .map((phrase) => `${phrase}.`)
    .join(' ');
}
