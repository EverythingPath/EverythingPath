import { z } from 'zod';
import { uuidKey } from '../records.ts';
import data from './attribution-227.json' with { type: 'json' };
import type {
  Attribution227Match,
  HeldAttribution227Match,
  MatchedAttribution227,
} from './attribution-227-matches.ts';

/**
 * The #227 admission rule (owner decision of 2026-11-10, item 1): a definition
 * is admitted on its record's declared book when every notice that book needs
 * has a reviewed Registry record, no hold is in force and its key is not an
 * exception here (`admission.ts`, `classifyCandidate`). The legal batches stay
 * evidence: a hold of a superseded kind stops holding; every other hold a
 * batch names (importer gaps, broken references, recorded source
 * discrepancies) is kept as a `retained-hold` exception, except a
 * broken-reference hold whose references the gate shows resolving
 * (`resolved-reference`).
 */
const text = z.string().min(1);
const nonEmpty = <T extends z.ZodType>(item: T) =>
  z.array(item).nonempty().readonly();

/** Whether a hold ID has a kind's segment: `-<segment>-` inside it or `-<segment>` at its end. */
const hasSegment = (id: string, segment: string) =>
  id.includes(`-${segment}-`) || id.endsWith(`-${segment}`);
const brokenReferenceSegment = 'broken-reference';

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
  /**
   * A batch's broken-reference hold whose links now resolve. It holds
   * nothing and admits nothing: the gate checks, on every build, that the
   * importer resolved each named reference to a record of the pinned sources
   * and linked it in the imported candidate (`resolvedReferenceRefusal`),
   * and fails the candidate when one isn't;
   * otherwise the rule decides the row as for any other key. Only for a key
   * whose other batch holds are all superseded or cleared
   * (`findResolvedReferenceProblems`).
   */
  z.strictObject({
    kind: z.literal('resolved-reference'),
    externalKey: text,
    batch: text,
    holdId: text.refine((id) => hasSegment(id, brokenReferenceSegment), {
      message: 'Not a broken-reference hold.',
    }),
    /** The links the hold was raised for, as the source writes them. */
    references: nonEmpty(text),
    /**
     * Its own reason, or the name of one the file stores once under
     * `sharedReasons` for the entries whose reason is the same.
     */
    reason: z.union([text, z.strictObject({ shared: text })]),
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
    /**
     * A reason several `resolved-reference` entries give, stored once by
     * name; each such entry cites it (`reason: { shared: <name> }`).
     */
    sharedReasons: z.record(text, text).readonly(),
    exceptions: z.array(exceptionSchema).readonly(),
  })
  .superRefine((rule, context) => {
    const cited = new Set<string>();
    const stored = new Set(Object.values(rule.sharedReasons));
    rule.exceptions.forEach((exception, index) => {
      if (exception.kind !== 'resolved-reference') return;
      const { reason } = exception;
      const issue = (message: string) =>
        context.addIssue({
          code: 'custom',
          path: ['exceptions', index, 'reason'],
          message,
        });
      if (typeof reason !== 'string') {
        cited.add(reason.shared);
        if (!Object.hasOwn(rule.sharedReasons, reason.shared))
          issue(`No shared reason is named ${reason.shared}.`);
      } else if (stored.has(reason))
        issue('A reason another entry gives is stored once, in sharedReasons.');
      else stored.add(reason);
    });
    for (const name of Object.keys(rule.sharedReasons))
      if (!cited.has(name))
        context.addIssue({
          code: 'custom',
          path: ['sharedReasons', name],
          message: 'No entry cites this shared reason.',
        });
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
type Attribution227Entry = Attribution227Rule['exceptions'][number];
/** An exception that holds its key: a retained hold or a reviewer's. */
export type Attribution227Exception = Exclude<
  Attribution227Entry,
  { kind: 'resolved-reference' }
>;
/** A broken-reference hold the gate retires while its references resolve. */
export type ResolvedReference227 = Extract<
  Attribution227Entry,
  { kind: 'resolved-reference' }
>;
type NonEmpty<T> = readonly [T, ...T[]];

export const committedAttribution227 = attribution227Schema.parse(data);

const isResolvedReference = (
  entry: Attribution227Entry,
): entry is ResolvedReference227 => entry.kind === 'resolved-reference';

/**
 * Whether a legal batch's hold still holds under the rule: not of a superseded
 * kind, not a notice hold the clearances clear (`inForce`, as the launch
 * inventory reads `held-notices.json`), and not a broken-reference hold a
 * `resolved-reference` exception names (the gate checks that one).
 */
export function holdsUnderAttribution227(
  rule: Pick<Attribution227Rule, 'supersededHoldKinds' | 'exceptions'>,
  inForce: (id: string) => boolean,
) {
  const resolved = new Set(
    rule.exceptions.filter(isResolvedReference).map(({ holdId }) => holdId),
  );
  return (id: string) =>
    inForce(id) &&
    !resolved.has(id) &&
    !rule.supersededHoldKinds.some(
      (kind) => kind.kind === 'superseded' && hasSegment(id, kind.segment),
    );
}

/**
 * A candidate's exception under the rule, by its own key or its attribution
 * owner's: one that holds it. A `resolved-reference` entry holds nothing.
 */
export function attribution227Exceptions(
  rule: Pick<Attribution227Rule, 'exceptions'>,
) {
  const byKey = new Map(
    rule.exceptions.flatMap((exception) =>
      isResolvedReference(exception)
        ? []
        : [[exception.externalKey, exception] as const],
    ),
  );
  return (...keys: string[]) =>
    keys.map((key) => byKey.get(key)).find((exception) => exception);
}

/** A key's `resolved-reference` exception, if the rule has one. */
export function attribution227ResolvedReferences(
  rule: Pick<Attribution227Rule, 'exceptions'>,
) {
  const byKey = new Map(
    rule.exceptions
      .filter(isResolvedReference)
      .map((exception) => [exception.externalKey, exception]),
  );
  return (key: string) => byKey.get(key);
}

/**
 * The gate's check of a `resolved-reference` exception against the build:
 * each named reference must resolve through the importer's link resolution
 * (`uuidKey`, its reviewed wrong-pack links included) to a key the imported
 * candidate links (`links`: its references and every catalog link the
 * importer wrote in it, an embedded copy kept as an unsupported value
 * included). The importer writes a link only to a record it found in the
 * pinned sources (`map.ts`, `createSanitizer`), so a scoped
 * import that leaves the record out still shows it resolved. Returns the
 * failure reason for the first that doesn't, or `undefined` when all do.
 */
export function resolvedReferenceRefusal(
  exception: ResolvedReference227,
  { links }: { links: readonly string[] },
) {
  for (const reference of exception.references) {
    const key = uuidKey(reference);
    const problem = !key
      ? 'names no catalog record'
      : !links.includes(key)
        ? `resolves to ${key}, which the imported candidate doesn't link`
        : undefined;
    if (problem)
      return `Stale #227 resolved-reference exception ${exception.holdId}: ${reference} ${problem}.`;
  }
  return undefined;
}

/** A legal batch's record of a candidate, as the exception check reads it. */
export type BatchHoldRecord = {
  holdIds: readonly string[];
  /** What the record says about its holds (its rationale). */
  rationale: string;
};

/**
 * Each `resolved-reference` exception the legal batches don't bear out: its
 * batch has no record of the key, or no such hold on it; the record doesn't
 * cite a reference it names (by record ID); or the key keeps another hold,
 * so it stays a `retained-hold` exception. Empty when every entry is sound.
 */
export function findResolvedReferenceProblems(
  rule: Pick<Attribution227Rule, 'supersededHoldKinds' | 'exceptions'>,
  recordOf: (batch: string, externalKey: string) => BatchHoldRecord | undefined,
  inForce: (id: string) => boolean,
) {
  const holds = holdsUnderAttribution227(rule, inForce);
  return rule.exceptions.filter(isResolvedReference).flatMap((exception) => {
    const { externalKey, batch, holdId } = exception;
    const record = recordOf(batch, externalKey);
    if (!record) return [`${externalKey}: ${batch} has no record of it.`];
    if (!record.holdIds.includes(holdId))
      return [`${externalKey}: ${batch} records no hold ${holdId}.`];
    const kept = record.holdIds.filter((id) => id !== holdId && holds(id));
    return [
      ...exception.references
        .filter(
          (reference) =>
            !record.rationale.includes(reference.split('.').at(-1) ?? ''),
        )
        .map(
          (reference) =>
            `${externalKey}: ${batch}'s record doesn't cite ${reference}.`,
        ),
      ...(kept.length
        ? [
            `${externalKey}: keeps ${kept.join(', ')}, so it stays a retained-hold exception.`,
          ]
        : []),
    ];
  });
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

/**
 * What the rule admitted a definition on: the books its record declares, or
 * for a record that declares none, its scripted match's books
 * (`attribution-227-matches.json`, `matchedBooks`).
 */
export type Attribution227Basis =
  | { kind: 'declared-book'; books: NonEmpty<string> }
  | {
      kind: 'scripted-match';
      books: NonEmpty<string>;
      match: MatchedAttribution227;
    };

/** Why the rule holds a definition it reads books for. */
export type Attribution227Hold =
  | { kind: 'exception'; exception: Attribution227Exception }
  | { kind: 'no-notice'; basis: Attribution227Basis }
  | {
      kind: 'unreviewed-notices';
      basis: Attribution227Basis;
      notices: NonEmpty<string>;
    }
  | { kind: 'notice-holds'; holds: NonEmpty<string> }
  /** The scripted match holds the record (`association-only`, `ambiguous-word-order`). */
  | { kind: 'scripted-match-held'; match: HeldAttribution227Match }
  /** The file lists the key under another name or kind: the import changed. */
  | { kind: 'stale-match'; match: Attribution227Match }
  /**
   * The match reads a reviewed PCGen record that no longer applies
   * (`reviewed-pcgen-records.json`): held on its class association without
   * it (`held`), or on nothing.
   */
  | {
      kind: 'stale-reviewed-record';
      problem: string;
      held?: HeldAttribution227Match;
    };

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

/** How a fallback found a PCGen line, as a reason names it. */
const fallbackRules = {
  'reviewed-record': 'its reviewed PCGen record',
  'word-order': 'a KEY with the same words in another order',
  'without-parenthetical': 'the PCGen name without its trailing parenthetical',
} as const;

/** Each matched book with what names it: a PCGen line, a stored assessment or a class. */
function describeMatch(match: MatchedAttribution227) {
  return [
    ...match.evidence.map((item) => {
      switch (item.kind) {
        case 'pcgen':
          return `${item.book} via ${item.file}:${item.line}`;
        case 'pcgen-fallback':
          return `${item.book} via ${item.file}:${item.line} (${fallbackRules[item.rule]})`;
        case 'stored-assessment':
          return `${list(item.notices)} via stored assessment (${item.batch}, PCGen ${item.comparison.file}:${item.comparison.line})`;
      }
    }),
    ...match.classes.map(
      (item) =>
        `${list(item.books)} via class ${item.name} (${item.externalKey})`,
    ),
  ].join('; ');
}

const describeBasis = (basis: Attribution227Basis) =>
  basis.kind === 'declared-book'
    ? `declared book ${list(basis.books)}`
    : `scripted match ${describeMatch(basis.match)}`;

function describeHeldMatch({ hold }: HeldAttribution227Match) {
  if (hold.kind === 'ambiguous-word-order')
    return `the KEYs with its words in another order name several PCGen objects: ${hold.candidates
      .map((item) => `${item.book} via ${item.file}:${item.line}`)
      .join('; ')}`;
  const classes = hold.classes
    .map((item) => `${item.name} (${list(item.books)})`)
    .join(', ');
  return `no PCGen match or stored assessment; only its class association names a book: ${classes}`;
}

/** A stale match's reason: the import changed, or its reviewed record no longer applies. */
function describeStale(
  hold: Extract<
    Attribution227Hold,
    { kind: 'stale-match' | 'stale-reviewed-record' }
  >,
) {
  if (hold.kind === 'stale-match')
    return `Held under #227: scripted match is stale: it names ${hold.match.kind} "${hold.match.name}"; regenerate it with pnpm catalog:attribution-227-matches --write.`;
  const without = hold.held
    ? describeHeldMatch(hold.held)
    : 'no PCGen match or stored assessment names a book';
  return `Held under #227: its reviewed PCGen record (reviewed-pcgen-records.json) is stale: ${hold.problem}; without it, ${without}.`;
}

/** The admission row's reason for a decision the rule made. */
export function describeAttribution227Decision(
  decision: Exclude<Attribution227Decision, { kind: 'not-applicable' }>,
) {
  if (decision.kind === 'admitted')
    return `Admitted under #227: ${describeBasis(decision.basis)}.`;
  const { hold } = decision;
  switch (hold.kind) {
    case 'exception':
      return hold.exception.kind === 'retained-hold'
        ? `Held under #227: named holds kept: ${list(hold.exception.holdIds)} (${hold.exception.batch}).`
        : `Held under #227: reviewed exception: ${hold.exception.reason}`;
    case 'no-notice':
      return `Held under #227: ${describeBasis(hold.basis)} gives no required notice.`;
    case 'unreviewed-notices':
      return `Held under #227: ${describeBasis(hold.basis)} lacks reviewed notices: ${list(hold.notices)}.`;
    case 'notice-holds':
      return `Held under #227: notice holds ${hold.holds.join('; ')}.`;
    case 'scripted-match-held':
      return `Held under #227: scripted match held: ${describeHeldMatch(hold.match)}.`;
    case 'stale-match':
    case 'stale-reviewed-record':
      return describeStale(hold);
  }
}

export const isNonEmpty = <T>(items: readonly T[]): items is NonEmpty<T> =>
  items.length > 0;
