import type { UnverifiedReason } from '~/lib/catalog/imported-entry-schema';

/**
 * A released definition's Verified / Unverified label, as the builder shows
 * it (#227). A Catalog Copy, a personal adjustment and a definition from a
 * release built before labels carry none. Its reasons are the release's own
 * (`unverifiedReasons`, the list the Convex validator is built from).
 */
export type EntryLabel =
  | { state: 'verified' }
  | { state: 'unverified'; reasons: readonly UnverifiedReason[] };

/**
 * The label the live read returns on a definition: the release's label with
 * its reasons, or, read before the reasons were kept, the state alone, which
 * gives no reason.
 */
export function entryLabel(definition: {
  verification?: EntryLabel | EntryLabel['state'];
}): EntryLabel | undefined {
  const label = definition.verification;
  if (label === 'verified') return { state: 'verified' };
  if (label === 'unverified') return { state: 'unverified', reasons: [] };
  return label;
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
 * Why an entry is unverified, in plain words, one phrase per reason. None
 * reads as the generic phrase, and so does a reason this client does not know
 * (one a newer server added), never as raw text.
 */
export function describeUnverifiedReasons(
  reasons: readonly UnverifiedReason[],
) {
  const phrases = reasons.map(
    (reason) => phraseFor.get(reason) ?? genericPhrase,
  );
  return phrases.length === 0 ? [genericPhrase] : [...new Set(phrases)];
}

/** The reasons as one description: "No curation record. Not in …". */
export function describeUnverified(reasons: readonly UnverifiedReason[]) {
  return describeUnverifiedReasons(reasons)
    .map((phrase) => `${phrase}.`)
    .join(' ');
}
