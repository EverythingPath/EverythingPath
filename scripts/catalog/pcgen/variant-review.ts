import {
  isCurrentDecision,
  locatorKeyOf,
  type IdentityLedger,
} from '../everythingpath-identities';
import type { StructureReviewItem } from '../structure-curation';
import type { PcgenEffectiveView } from './effective';
import {
  keyedOwners,
  ownerSubjects,
  type BookFacts,
  type IdentitySubject,
} from './identities';
import type { PcgenInventory, PcgenOwner } from './inventory';
import { variantGroups } from './inventory-summary';

/**
 * #716 P6: the review items of PCGen's source variants (plan §5, Appendix D;
 * research note 716-p6 §2). Each member of a variant group no current checked
 * decision covers gets a `variant` item and a `conflict` per compared fact
 * that differs; an owner whose effective SOURCEPAGE is past its book's
 * printed length gets a `page` conflict. A ledger-held record
 * (`heldSources`) is no member: the assignment reports it with its conflict.
 * Items are bound to each subject's key and hash.
 */

type ReviewItem = Omit<StructureReviewItem, 'externalKey' | 'sourceSha256'>;
type ReviewContext = {
  view: PcgenEffectiveView;
  ledger: IdentityLedger;
  books: ReadonlyMap<string, BookFacts>;
  subjects: ReadonlyMap<string, IdentitySubject>;
  keys: ReadonlyMap<string, string>;
};

const tagOf = (token: string) =>
  token.slice(0, Math.max(0, token.indexOf(':')));
const atOf = ({ file, line }: { file: string; line: number }) =>
  `${file.split('/').at(-1) ?? file}:${line}`;
const locatorOf = (owner: PcgenOwner) =>
  locatorKeyOf({ source: 'pcgen', locator: owner.record.locator });
const tokensOf = (view: PcgenEffectiveView, owner: PcgenOwner) =>
  (view.records.get(owner.record)?.tokens ?? []).map(({ token }) => token);

/** The compared facts of an owner: what a variant's conflict items name. */
function factsOf(view: PcgenEffectiveView, owner: PcgenOwner) {
  const tokens = tokensOf(view, owner);
  const sorted = (values: string[]) => [...new Set(values)].sort();
  const levels =
    owner.kind === 'prestige'
      ? [
          ...tokens.filter((token) => tagOf(token) === 'MAXLEVEL'),
          `levels:${owner.record.levelLines.length}`,
        ]
      : tokens.flatMap((token) =>
          token.startsWith('ABILITY:')
            ? [...token.matchAll(/PRECLASS:1,[^=|]+=(\d+)/g)].map(
                (match) =>
                  `${(token.split('|')[2] ?? '').split(' ~ ').at(-1)}@${match[1]}`,
              )
            : [],
        );
  return {
    level: sorted(levels),
    replaces: sorted(
      tokens.filter(
        (token) =>
          /^FACT:\w+_(CF|Archetype)_\w+\|true$/i.test(token) ||
          tagOf(token) === 'TYPE',
      ),
    ),
    prerequisites: sorted(tokens.filter((token) => /^!?PRE/.test(token))),
    text: sorted(tokens.filter((token) => tagOf(token) === 'DESC')),
  };
}
type Facts = ReturnType<typeof factsOf>;
const factFields = ['level', 'replaces', 'prerequisites', 'text'] as const;

/**
 * The owner's effective SOURCEPAGE, after its `.MOD` lines, when it is past
 * the book's printed length: PCGen copied another book's page.
 */
export function pageConflict(
  view: PcgenEffectiveView,
  owner: PcgenOwner,
  books: ReadonlyMap<string, BookFacts>,
): ReviewItem | null {
  const { record } = owner;
  const cited = tokensOf(view, owner)
    .filter((token) => tagOf(token) === 'SOURCEPAGE')
    .at(-1)
    ?.slice('SOURCEPAGE:'.length);
  const page = Number(/(\d+)/.exec(cited ?? '')?.[1] ?? Number.NaN);
  const pages = books.get(record.book)?.pages ?? null;
  return pages !== null && page > pages
    ? {
        kind: 'conflict',
        id: 'page',
        text: `${record.locator.key} cites ${cited} (${atOf(record.locator)}), but ${record.book} has ${pages} pages.`,
        fields: ['sources'],
      }
    : null;
}

/** An item on an owner's subject, when the assignment keys it. */
function bind(
  { subjects, keys }: ReviewContext,
  owner: PcgenOwner,
  item: ReviewItem,
): StructureReviewItem[] {
  const locator = locatorOf(owner);
  const externalKey = keys.get(locator);
  const subject = subjects.get(locator);
  return externalKey && subject
    ? [{ ...item, externalKey, sourceSha256: subject.sourceSha256 }]
    : [];
}

/** Whether a current checked decision reviewed every one of the owners. */
function isDecided(
  { ledger, subjects }: ReviewContext,
  owners: readonly PcgenOwner[],
) {
  const currentHashes = new Map(
    [...subjects].map(([locator, { sourceSha256 }]) => [locator, sourceSha256]),
  );
  return ledger.variantDecisions.some((decision) => {
    if (!isCurrentDecision(decision, currentHashes)) return false;
    const reviewed = new Set(
      (decision.decision === 'same-identity'
        ? decision.sources
        : decision.identities
      ).map(({ source }) => locatorKeyOf(source)),
    );
    return owners.every((owner) => reviewed.has(locatorOf(owner)));
  });
}

/** Whether the ledger holds the owner's current record as a held source. */
function isHeldSource({ ledger, subjects }: ReviewContext, owner: PcgenOwner) {
  return ledger.heldSources.some(
    ({ source, sourceSha256 }) =>
      locatorKeyOf(source) === locatorOf(owner) &&
      subjects.get(locatorOf(owner))?.sourceSha256 === sourceSha256,
  );
}

/** One undecided group's `variant` item and differing-fact conflicts on each member. */
function groupItems(
  context: ReviewContext,
  { kind, owners }: { kind: string; owners: readonly PcgenOwner[] },
) {
  const facts = new Map(
    owners.map((owner) => [owner, factsOf(context.view, owner)]),
  );
  const isDifferent = (field: keyof Facts) =>
    new Set(owners.map((owner) => JSON.stringify(facts.get(owner)?.[field])))
      .size > 1;
  const differing = factFields.filter(isDifferent);
  return owners.flatMap((owner) => {
    const others = owners
      .filter((other) => other !== owner)
      .map(
        ({ record }) =>
          `${record.locator.key} (${record.book}, ${atOf(record.locator)})`,
      )
      .join('; ');
    return [
      ...bind(context, owner, {
        kind: 'variant',
        id: 'variant',
        text: `A ${kind} variant of ${others}: no current checked variant decision collapses or separates them.`,
      }),
      ...differing.flatMap((field) =>
        bind(context, owner, {
          kind: 'conflict',
          id: `variant:${field}`,
          text: `${owner.record.locator.key} (${atOf(owner.record.locator)}) differs from ${others} in its ${field}: ${(facts.get(owner)?.[field] ?? []).join(' ') || 'none'}.`,
        }),
      ),
    ];
  });
}

/** The variant and page review items of a corpus's owners. */
export function variantReviewItems({
  inventory,
  view,
  ledger,
  books,
  keys,
}: {
  inventory: PcgenInventory;
  view: PcgenEffectiveView;
  ledger: IdentityLedger;
  books: ReadonlyMap<string, BookFacts>;
  /** The owners' assigned keys (`assignPcgenIdentities(...).owners.keys`). */
  keys: ReadonlyMap<string, string>;
}): StructureReviewItem[] {
  const context: ReviewContext = {
    view,
    ledger,
    books,
    keys,
    subjects: new Map(
      ownerSubjects({ inventory, view }).map((subject) => [
        locatorKeyOf(subject.source),
        subject,
      ]),
    ),
  };
  const variantItems = variantGroups(inventory).flatMap((group) => {
    const owners = group.owners.filter(
      (owner) => !isHeldSource(context, owner),
    );
    return owners.length < 2 || isDecided(context, owners)
      ? []
      : groupItems(context, { kind: group.kind, owners });
  });
  const pageItems = keyedOwners(inventory).flatMap((owner) => {
    const item = pageConflict(view, owner, books);
    return item ? bind(context, owner, item) : [];
  });
  return [...variantItems, ...pageItems];
}
