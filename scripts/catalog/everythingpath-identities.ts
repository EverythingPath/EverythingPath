import { z } from 'zod';
import {
  catalogKeySchema,
  upstreamKeyOf,
  upstreamSourceSchema,
} from '../../src/lib/catalog/imported-entry-schema.ts';
import {
  checkedReviewShape,
  hashReviewPayload,
  readReviewState,
  sortReviewedSources,
  type CheckedReview,
  type ReviewedRecord,
} from './review-receipts.ts';

/**
 * The #716 identity ledger (`everythingpath-identities.json`, plan §5). Each
 * `everythingpath/` identity maps to the upstream records it was imported
 * from, and the ledger's assignment is authoritative: a key is derived from
 * the PCGen KEY only once, for a record the ledger doesn't hold
 * (`pcgen/identities.ts`), and is frozen here.
 *
 * - Identity follows PCGen KEY lineage. Same-name records in different books
 *   stay separate identities; only a checked variant decision collapses
 *   several records into one (a reprint) or keeps same-KEY records apart (a
 *   revision). Each decision binds the effective source hash of every record
 *   it reviewed, so a changed record reopens it.
 * - Sources compare by their case-folded locator (`locatorKeyOf`), as PCGen
 *   compares KEYs, and the line is ignored, so a line shift or a KEY case
 *   change needs no review.
 * - A changed file or KEY at a pin bump needs a checked `locatorRemaps` entry
 *   from a held locator to the new one; a vanished record needs a retirement
 *   or a remap. Catalog-identity remaps (merging released identities) stay in
 *   `reviewed-remaps.json`.
 * - A `heldSources` entry keeps a record the ledger gives no identity, such
 *   as a PCGen copy that isn't a printing (USH's Arcane Trickster), held with
 *   its conflict.
 * - Every `everythingpath/` key is unique across identities, retirements and
 *   the reviewed schedules' increment keys.
 * - A decision or held source is written `drafted`. A checked one names the
 *   receipt of the review that confirmed it (`review-receipts.ts`, #757).
 */
const identityKeySchema = catalogKeySchema.refine((key) =>
  key.startsWith('everythingpath/'),
);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const reviewText = {
  rationale: z.string().min(1),
  evidence: z.string().min(1),
};
// A drafted review applies nothing; only a checked one, with its reviewer, does.
const reviewSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('drafted'), ...reviewText }),
  z.strictObject({
    status: z.literal('checked'),
    ...reviewText,
    // Its reviewer, date and review receipt (#757).
    ...checkedReviewShape,
  }),
]);
/** A reviewed record and the effective source hash it was reviewed at. */
const boundSourceSchema = z.strictObject({
  source: upstreamSourceSchema,
  sourceSha256: sha256Schema,
});
const variantDecisionSchema = z.discriminatedUnion('decision', [
  // A reprint: one identity, with the chosen record's mechanics and every source.
  z.strictObject({
    decision: z.literal('same-identity'),
    externalKey: identityKeySchema,
    sources: z.array(boundSourceSchema).min(2),
    mechanicsFrom: upstreamSourceSchema,
    review: reviewSchema,
  }),
  // A revision: each source keeps an identity of its own.
  z.strictObject({
    decision: z.literal('separate-identities'),
    identities: z
      .array(boundSourceSchema.extend({ externalKey: identityKeySchema }))
      .min(2),
    review: reviewSchema,
  }),
]);
export const identityKinds = [
  'archetype',
  'archetypeFeature',
  'prestigeClass',
  'prestigeClassFeature',
] as const;
export const identityLedgerSchema = z.strictObject({
  pcgenCommit: z.string().regex(/^[0-9a-f]{40}$/),
  identities: z.array(
    z.strictObject({
      externalKey: identityKeySchema,
      kind: z.enum(identityKinds),
      sources: z.array(upstreamSourceSchema).min(1),
    }),
  ),
  variantDecisions: z.array(variantDecisionSchema),
  // A file or KEY rename: the identity keeps its key, and `from` is the held locator.
  locatorRemaps: z.array(
    z.strictObject({
      externalKey: identityKeySchema,
      from: upstreamSourceSchema,
      to: upstreamSourceSchema,
      review: reviewSchema,
    }),
  ),
  heldSources: z.array(
    boundSourceSchema.extend({
      // The held record's kind, so the check of its scope covers it.
      kind: z.enum(identityKinds),
      // The identity whose mechanics the held record duplicates.
      duplicateOf: identityKeySchema,
      conflict: z.literal('attribution'),
      text: z.string().min(1),
      review: reviewSchema,
    }),
  ),
  retirements: z.array(
    z.strictObject({
      externalKey: identityKeySchema,
      sources: z.array(upstreamSourceSchema).min(1),
      reason: z.string().min(1),
      reviewedBy: z.string().min(1),
      reviewedOn: z.iso.date(),
    }),
  ),
});
export type IdentityLedger = z.infer<typeof identityLedgerSchema>;
export type IdentityKind = (typeof identityKinds)[number];
export type VariantDecision = IdentityLedger['variantDecisions'][number];
export type UpstreamSource = z.infer<typeof upstreamSourceSchema>;
/** Each identity's case-folded locators. */
type Ownership = Map<string, Set<string>>;

/**
 * A source's locator as the ledger compares it: its upstream key with the
 * PCGen KEY case-folded, as PCGen compares keys (`pcgen/keys.ts`).
 */
export function locatorKeyOf(source: UpstreamSource) {
  return source.source === 'pcgen'
    ? upstreamKeyOf({
        ...source,
        locator: { ...source.locator, key: source.locator.key.toLowerCase() },
      })
    : upstreamKeyOf(source);
}

/** An upstream key (`pcgen:<file>#<KEY>`) as `locatorKeyOf` compares it. */
export function foldUpstreamKey(upstreamKey: string) {
  if (!upstreamKey.startsWith('pcgen:')) return upstreamKey;
  const at = upstreamKey.indexOf('#');
  return at === -1
    ? upstreamKey
    : `${upstreamKey.slice(0, at + 1)}${upstreamKey.slice(at + 1).toLowerCase()}`;
}

/** The KEY lineage of a PCGen source, case-folded; a PRD source has none. */
export function lineageOf(source: UpstreamSource) {
  return source.source === 'pcgen' ? source.locator.key.toLowerCase() : null;
}

const isChecked = (review: { status: string }) => review.status === 'checked';

/**
 * Parses the ledger and checks that identities, sources and decisions agree.
 * `reservedKeys` are the other `everythingpath/` keys the release carries
 * (the reviewed schedules' increment keys), which no identity may take.
 */
export function parseIdentityLedger(
  value: unknown,
  { reservedKeys = [] }: { reservedKeys?: Iterable<string> } = {},
): IdentityLedger {
  const ledger = identityLedgerSchema.parse(value);
  const ownership = indexOwnership(ledger.identities);
  for (const decision of ledger.variantDecisions)
    reconcileDecision({ decision, ownership });
  checkHeldSources({ ledger, ownership });
  authorizeMerges(ledger);
  authorizeSplits(ledger);
  checkRetirements({ ledger, ownership });
  checkLocatorRemaps({ ledger, ownership });
  checkKeyUniqueness({ ledger, reservedKeys });
  return ledger;
}

/** Maps each identity to its sources; a source belongs to one identity. */
function indexOwnership(identities: IdentityLedger['identities']): Ownership {
  const ownership: Ownership = new Map();
  const ownerOf = new Map<string, string>();
  for (const { externalKey, sources } of identities) {
    if (ownership.has(externalKey))
      throw new Error(`Duplicate identity: ${externalKey}`);
    const keys = distinctKeys({ sources, cited: externalKey });
    ownership.set(externalKey, keys);
    for (const key of keys) {
      const owner = ownerOf.get(key);
      if (owner !== undefined)
        throw new Error(`${key} belongs to ${owner} and ${externalKey}.`);
      ownerOf.set(key, externalKey);
    }
  }
  return ownership;
}

/** A decision binds exactly the sources its identities hold. */
function reconcileDecision({
  decision,
  ownership,
}: {
  decision: VariantDecision;
  ownership: Ownership;
}) {
  if (decision.decision === 'same-identity') {
    const sources = distinctKeys({
      sources: decision.sources.map(({ source }) => source),
      cited: `The decision on ${decision.externalKey}`,
    });
    requireHeld({ ownership, externalKey: decision.externalKey, sources });
    if (!sources.has(locatorKeyOf(decision.mechanicsFrom)))
      throw new Error('A reprint takes its mechanics from one of its sources.');
    return;
  }
  distinctKeys({
    sources: decision.identities.map(({ source }) => source),
    cited: 'A separate-identities decision',
  });
  for (const { externalKey, source } of decision.identities)
    requireHeld({
      ownership,
      externalKey,
      sources: new Set([locatorKeyOf(source)]),
    });
}

/** Several sources share an identity only through a checked reprint decision. */
function authorizeMerges({ identities, variantDecisions }: IdentityLedger) {
  for (const { externalKey, sources } of identities)
    if (
      sources.length > 1 &&
      !variantDecisions.some(
        (decision) =>
          decision.decision === 'same-identity' &&
          isChecked(decision.review) &&
          decision.externalKey === externalKey,
      )
    )
      throw new Error(
        `${externalKey} has several sources but no checked same-identity decision.`,
      );
}

/**
 * Records sharing a KEY are source variants: frozen as separate identities,
 * they need a checked separate-identities decision naming both (plan §5).
 */
function authorizeSplits(ledger: IdentityLedger) {
  const identitiesOf = new Map<
    string,
    { lineage: string; keys: Set<string> }
  >();
  for (const { externalKey, kind, sources } of ledger.identities)
    for (const source of sources) {
      const lineage = lineageOf(source);
      if (lineage === null) continue;
      const at = JSON.stringify([kind, lineage]);
      const group = identitiesOf.get(at) ?? { lineage, keys: new Set() };
      identitiesOf.set(at, { lineage, keys: group.keys.add(externalKey) });
    }
  const reviewedTogether = (first: string, second: string) =>
    ledger.variantDecisions.some(
      (decision) =>
        decision.decision === 'separate-identities' &&
        isChecked(decision.review) &&
        decision.identities.some(({ externalKey }) => externalKey === first) &&
        decision.identities.some(({ externalKey }) => externalKey === second),
    );
  for (const { lineage, keys } of identitiesOf.values()) {
    const [first, ...rest] = [...keys];
    for (const other of rest)
      if (first && !reviewedTogether(first, other))
        throw new Error(
          `${first} and ${other} share the KEY ${lineage} but no checked separate-identities decision.`,
        );
  }
}

function checkRetirements({
  ledger,
  ownership,
}: {
  ledger: IdentityLedger;
  ownership: Ownership;
}) {
  for (const { externalKey } of ledger.retirements)
    if (ownership.has(externalKey))
      throw new Error(
        `Retired identity ${externalKey} is still in the ledger.`,
      );
}

/**
 * A locator remap moves one held locator of an identity to a new locator no
 * other identity holds. Each locator is remapped at most once, in either
 * role, so no remap is ambiguous or chained.
 */
function checkLocatorRemaps({
  ledger,
  ownership,
}: {
  ledger: IdentityLedger;
  ownership: Ownership;
}) {
  const held = new Map<string, string>();
  for (const [externalKey, keys] of ownership)
    for (const key of keys) held.set(key, externalKey);
  const seen = new Set<string>();
  for (const { externalKey, from, to } of ledger.locatorRemaps) {
    const [fromKey, toKey] = [locatorKeyOf(from), locatorKeyOf(to)];
    if (fromKey === toKey)
      throw new Error(`A locator remap of ${externalKey} changes nothing.`);
    if (held.get(fromKey) !== externalKey)
      throw new Error(
        `A locator remap moves ${fromKey}, which ${externalKey} does not hold.`,
      );
    if (held.has(toKey))
      throw new Error(
        `A locator remap of ${externalKey} moves onto ${toKey}, which ${held.get(toKey)} holds.`,
      );
    for (const key of [fromKey, toKey]) {
      if (seen.has(key))
        throw new Error(`Ambiguous locator remap: ${key} is remapped twice.`);
      seen.add(key);
    }
  }
}

/** A held record names an identity it duplicates and is no identity's source. */
function checkHeldSources({
  ledger,
  ownership,
}: {
  ledger: IdentityLedger;
  ownership: Ownership;
}) {
  const sources = new Set([...ownership.values()].flatMap((keys) => [...keys]));
  for (const held of ledger.heldSources) {
    if (!ownership.has(held.duplicateOf))
      throw new Error(`A held source duplicates unknown ${held.duplicateOf}.`);
    if (sources.has(locatorKeyOf(held.source)))
      throw new Error(
        `${locatorKeyOf(held.source)} is held and an identity's source.`,
      );
  }
}

/** Every `everythingpath/` key once: identities, retirements, reserved keys. */
function checkKeyUniqueness({
  ledger,
  reservedKeys,
}: {
  ledger: IdentityLedger;
  reservedKeys: Iterable<string>;
}) {
  const seen = new Set<string>();
  for (const key of [
    ...ledger.identities.map(({ externalKey }) => externalKey),
    ...ledger.retirements.map(({ externalKey }) => externalKey),
    ...reservedKeys,
  ]) {
    if (seen.has(key)) throw new Error(`The key ${key} is used twice.`);
    seen.add(key);
  }
}

function distinctKeys({
  sources,
  cited,
}: {
  sources: UpstreamSource[];
  cited: string;
}) {
  const keys = new Set<string>();
  for (const key of sources.map(locatorKeyOf)) {
    if (keys.has(key)) throw new Error(`${cited} cites ${key} more than once.`);
    keys.add(key);
  }
  return keys;
}

function requireHeld({
  ownership,
  externalKey,
  sources,
}: {
  ownership: Ownership;
  externalKey: string;
  sources: Set<string>;
}) {
  const held = ownership.get(externalKey);
  if (!held)
    throw new Error(`Variant decision names unknown identity ${externalKey}.`);
  if (held.size !== sources.size || [...held].some((key) => !sources.has(key)))
    throw new Error(
      `${externalKey} does not hold exactly the decision's sources.`,
    );
}

/** A decision's reviewed records, by case-folded locator, with their bound hashes. */
export function decisionBindings(decision: VariantDecision) {
  const bound =
    decision.decision === 'same-identity'
      ? decision.sources
      : decision.identities;
  return new Map(
    bound.map(({ source, sourceSha256 }) => [
      locatorKeyOf(source),
      sourceSha256,
    ]),
  );
}

/**
 * Whether a checked decision still holds: every record it reviewed is present
 * at the hash it was reviewed at (`currentHashes`, by case-folded locator). A
 * stale decision authorizes no collapse and no supersession.
 */
export function isCurrentDecision(
  decision: VariantDecision,
  currentHashes: ReadonlyMap<string, string>,
) {
  return (
    isChecked(decision.review) &&
    [...decisionBindings(decision)].every(
      ([locator, sha256]) => currentHashes.get(locator) === sha256,
    )
  );
}

/**
 * Lists the ledger's records whose checked state authorizes something, as a
 * review receipt covers them: each variant decision, by its kind and
 * identities, and each held source, by its locator, with the hashes they bind
 * and their payload (what the decision says, apart from its review: which
 * identity holds which record, the reprint's mechanics, the held record's
 * duplicate and conflict). Locator remaps and retirements bind no source hash
 * yet, so no receipt covers them.
 */
export function listLedgerReviews(ledger: IdentityLedger): ReviewedRecord[] {
  const decisions = ledger.variantDecisions.map((decision) => {
    const isReprint = decision.decision === 'same-identity';
    const keys = isReprint
      ? [decision.externalKey]
      : decision.identities.map(({ externalKey }) => externalKey).sort();
    return {
      id: `${decision.decision} ${keys.join(' + ')}`,
      sources: sortReviewedSources(
        [...decisionBindings(decision)].map(([subject, sourceSha256]) => ({
          subject,
          sourceSha256,
        })),
      ),
      payloadSha256: hashReviewPayload(
        isReprint
          ? { mechanicsFrom: locatorKeyOf(decision.mechanicsFrom) }
          : decision.identities
              .map(({ externalKey, source }) => [
                externalKey,
                locatorKeyOf(source),
              ])
              .sort(),
      ),
      review: readReviewState(decision.review),
      check: (review: CheckedReview) => {
        decision.review = { ...decision.review, ...review };
      },
    };
  });
  const held = ledger.heldSources.map((entry) => ({
    id: `held-source ${locatorKeyOf(entry.source)}`,
    sources: [
      { subject: locatorKeyOf(entry.source), sourceSha256: entry.sourceSha256 },
    ],
    payloadSha256: hashReviewPayload({
      kind: entry.kind,
      duplicateOf: entry.duplicateOf,
      conflict: entry.conflict,
      text: entry.text,
    }),
    review: readReviewState(entry.review),
    check: (review: CheckedReview) => {
      entry.review = { ...entry.review, ...review };
    },
  }));
  return [...decisions, ...held];
}
