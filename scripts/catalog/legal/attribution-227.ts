import { z } from 'zod';
import data from './attribution-227.json' with { type: 'json' };

/**
 * The #227 admission rule (owner decision of 2026-11-10, item 1): a definition
 * is admitted on its record's declared book when every notice that book needs
 * has a reviewed Registry record, no hold is in force and its key is not an
 * exception here (`admission.ts`, `classifyCandidate`). The legal batches stay
 * evidence: a hold of a superseded kind stops holding; every other hold a
 * batch names (importer gaps, broken references, recorded source
 * discrepancies) is kept as a `retained-hold` exception.
 */
const text = z.string().min(1);
const nonEmpty = <T extends z.ZodType>(item: T) =>
  z.array(item).nonempty().readonly();

const supersededHoldKindSchema = z.discriminatedUnion('kind', [
  /** A hold whose ID has this segment stops holding under the rule. */
  z.strictObject({
    kind: z.literal('superseded'),
    segment: text,
    reason: text,
  }),
  /**
   * A notice hold whose ID has this segment stops holding once the notice
   * clearances clear it; one still in force holds.
   */
  z.strictObject({
    kind: z.literal('cleared-notice'),
    segment: text,
    reason: text,
  }),
]);

const exceptionSchema = z.discriminatedUnion('kind', [
  /** The batch holds that keep holding: none is of a superseded kind. */
  z.strictObject({
    kind: z.literal('retained-hold'),
    externalKey: text,
    batch: text,
    holdIds: nonEmpty(text),
  }),
  /** A key a reviewer excludes from the rule, with the reason. */
  z.strictObject({
    kind: z.literal('reviewed'),
    externalKey: text,
    reason: text,
  }),
]);

export const attribution227Schema = z
  .strictObject({
    decision: text,
    decidedOn: z.iso.date(),
    /** The owner-decision record in the run directory, with its hash. */
    ownerDecision: z.strictObject({
      path: text,
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    }),
    /** Written `drafted`; the orchestrator marks it checked from a review receipt. */
    review: z.discriminatedUnion('status', [
      z.strictObject({ status: z.literal('drafted') }),
      z.strictObject({
        status: z.literal('checked'),
        reviewedBy: text,
        reviewedOn: z.iso.date(),
        receipt: text,
      }),
    ]),
    supersededHoldKinds: nonEmpty(supersededHoldKindSchema),
    exceptions: z.array(exceptionSchema).readonly(),
  })
  .superRefine((rule, context) => {
    const keys = rule.exceptions.map(({ externalKey }) => externalKey);
    keys.forEach((key, index) => {
      const previous = keys[index - 1];
      if (previous !== undefined && previous >= key)
        context.addIssue({
          code: 'custom',
          path: ['exceptions', index],
          message: 'Exceptions must be sorted by key, each key once.',
        });
    });
  });

export type Attribution227Rule = z.infer<typeof attribution227Schema>;
export type Attribution227Exception = Attribution227Rule['exceptions'][number];
type NonEmpty<T> = readonly [T, ...T[]];

export const committedAttribution227 = attribution227Schema.parse(data);

/** Whether a hold ID has a kind's segment: `-<segment>-` inside it or `-<segment>` at its end. */
const hasSegment = (id: string, segment: string) =>
  id.includes(`-${segment}-`) || id.endsWith(`-${segment}`);

/**
 * Whether a legal batch's hold still holds under the rule: not of a superseded
 * kind, and not a notice hold the clearances clear (`inForce`, as the launch
 * inventory reads `held-notices.json`).
 */
export function holdsUnderAttribution227(
  rule: Pick<Attribution227Rule, 'supersededHoldKinds'>,
  inForce: (id: string) => boolean,
) {
  return (id: string) =>
    inForce(id) &&
    !rule.supersededHoldKinds.some(
      (kind) => kind.kind === 'superseded' && hasSegment(id, kind.segment),
    );
}

/** A candidate's exception under the rule, by its own key or its attribution owner's. */
export function attribution227Exceptions(
  rule: Pick<Attribution227Rule, 'exceptions'>,
) {
  const byKey = new Map(
    rule.exceptions.map((exception) => [exception.externalKey, exception]),
  );
  return (...keys: string[]) =>
    keys.map((key) => byKey.get(key)).find((exception) => exception);
}

/**
 * The books an overlay entry declares by title, each the exact title of a
 * Foundry book (`pf1/module/registry/sources.mjs`, `name`) in its product
 * line, with the code Foundry gives it. An entry from upstream declares the
 * code itself.
 */
export const declaredBookTitles: Readonly<Record<string, string>> = {
  'Pathfinder RPG Core Rulebook': 'PZO1110',
  "Pathfinder RPG Advanced Player's Guide": 'PZO1115',
  'Pathfinder RPG Advanced Player’s Guide': 'PZO1115',
  'Pathfinder RPG Ultimate Magic': 'PZO1117',
  'Pathfinder RPG Ultimate Combat': 'PZO1118',
  'Pathfinder RPG Advanced Class Guide': 'PZO1129',
  'Pathfinder Unchained': 'PZO1131',
  'Pathfinder RPG Ultimate Intrigue': 'PZO1134',
  'Pathfinder RPG Ultimate Wilderness': 'PZO1140',
};

/** A declared book's code: a known title's, else the declared value itself. */
export const declaredBookCode = (book: string) =>
  Object.hasOwn(declaredBookTitles, book)
    ? (declaredBookTitles[book] ?? book)
    : book;

/** What the rule admitted a definition on. Slice 3 adds the scripted match. */
export type Attribution227Basis = {
  kind: 'declared-book';
  books: NonEmpty<string>;
};

/** Why the rule holds a definition that declares a book. */
export type Attribution227Hold =
  | { kind: 'exception'; exception: Attribution227Exception }
  | { kind: 'no-notice'; books: NonEmpty<string> }
  | {
      kind: 'unreviewed-notices';
      books: NonEmpty<string>;
      notices: NonEmpty<string>;
    }
  | { kind: 'notice-holds'; holds: NonEmpty<string> };

/** The rule's decision on a candidate the assessment path doesn't admit. */
export type Attribution227Decision =
  | { kind: 'not-applicable' }
  | {
      kind: 'admitted';
      basis: Attribution227Basis;
      requiredNotices: NonEmpty<string>;
    }
  | { kind: 'held'; hold: Attribution227Hold; requiredNotices: string[] };

const list = (items: readonly string[]) => items.join(', ');

/** The admission row's reason for a decision the rule made. */
export function describeAttribution227Decision(
  decision: Exclude<Attribution227Decision, { kind: 'not-applicable' }>,
) {
  if (decision.kind === 'admitted')
    return `Admitted under #227: declared book ${list(decision.basis.books)}.`;
  const { hold } = decision;
  switch (hold.kind) {
    case 'exception':
      return hold.exception.kind === 'retained-hold'
        ? `Held under #227: named holds kept: ${list(hold.exception.holdIds)} (${hold.exception.batch}).`
        : `Held under #227: reviewed exception: ${hold.exception.reason}`;
    case 'no-notice':
      return `Held under #227: declared book ${list(hold.books)} gives no required notice.`;
    case 'unreviewed-notices':
      return `Held under #227: declared book ${list(hold.books)} lacks reviewed notices: ${list(hold.notices)}.`;
    case 'notice-holds':
      return `Held under #227: notice holds ${hold.holds.join('; ')}.`;
  }
}

export const isNonEmpty = <T>(items: readonly T[]): items is NonEmpty<T> =>
  items.length > 0;
