import type { z } from 'zod';
import type { reviewedRemapSchema } from '../../../src/lib/catalog/imported-entry-schema';
import {
  isCurrentDecision,
  lineageOf,
  locatorKeyOf,
  type IdentityKind,
  type IdentityLedger,
  type UpstreamSource,
  type VariantDecision,
} from '../everythingpath-identities';
import { pcgenBooks } from '../pcgen-books';
import { archetypeSourceSha256 } from './archetypes';
import type { PcgenEffectiveView } from './effective';
import type { PcgenInventory, PcgenOwner } from './inventory';
import type { PcgenRecord } from './lst';
import { prestigeSourceSha256 } from './prestige';

/**
 * #716 P6: `everythingpath/` keys for PCGen records (plan §5; research note
 * 716-p6 §1–§2). The identity ledger is the authority: a record it holds keeps
 * its key, and only a record it doesn't hold gets a key derived from its KEY,
 * as a proposal to freeze in the ledger.
 *
 * - An archetype is `<class>-<name>[-<tag>]` (`Ranger Archetype ~ Beast
 *   Master` is `ranger-beast-master`, `Fighter Archetype ~ Lore Warden ~ AG`
 *   `fighter-lore-warden-ag`), a prestige class `<name>`. A reviewed spelling
 *   corrects PCGen's typos.
 * - A feature is `<owner key>-<feature>`, its KEY without a leading segment
 *   naming its owner or a trailing tag its owner carries (`Synthesist ~
 *   Greater Shielded Meld` is `summoner-synthesist-greater-shielded-meld`);
 *   one whose KEY names no owner is its KEY under the class (`No Spellcasting
 *   ~ Ranger` is `ranger-no-spellcasting-ranger`). A feature several owners
 *   grant has one identity, derived under its first owner in inventory order.
 * - Same-KEY records not in the ledger share their derived key and are held
 *   as variants until a checked variant decision collapses or separates them.
 *   Separate same-KEY variants keep the bare key for the earlier book and add
 *   the later book's SOURCESHORT; so does a new record whose key a held
 *   identity, a retired key, an identity remap or an increment key already
 *   takes. Different KEYs that derive one key are held as collisions.
 * - A ledger locator the corpus lacks vanished: it needs a retirement or a
 *   locator remap. A decision whose bound hashes no longer match is stale and
 *   holds its identities.
 */

export type BookFacts = {
  /** Publication date (Foundry's registry), for the bare-slug policy. */
  date: string | null;
  /** Printed page count (Foundry's registry), for the page check. */
  pages: number | null;
};
export type IdentitySubject = {
  kind: IdentityKind;
  source: Extract<UpstreamSource, { source: 'pcgen' }>;
  sourceSha256: string;
  /** The key derived from the KEY; null when none can be (a noncanonical key). */
  derivedKey: string | null;
  book: string;
  bookShort: string | null;
};
export type IdentityHold =
  | 'variant'
  | 'collision'
  | 'noncanonical'
  | 'stale'
  | 'attribution';
export type IdentityProposal = {
  /** The proposed key; null when no free key is derivable. */
  externalKey: string | null;
  kind: IdentityKind;
  source: IdentitySubject['source'];
  hold: Exclude<IdentityHold, 'stale' | 'attribution'> | null;
};
type ReviewedRemap = z.infer<typeof reviewedRemapSchema>;

/**
 * Each crosswalk book's date and page count from Foundry's book registry
 * (`pf1/module/registry/sources.mjs`), by the PZO code the crosswalk
 * (`pcgen-books.json`) matched; a book the registry dates or counts no
 * pages for has null.
 */
export function pcgenBookFacts(registryText: string) {
  const registry = new Map(
    registryText.split(/\n\s*_id: /).flatMap((block) => {
      const id = /^"([^"]+)"/.exec(block)?.[1];
      const entry = block.split(/\n\s*\},?\n/)[0] ?? '';
      const found = /\n\s*date: "([^"]*)"/.exec(entry)?.[1];
      const date = found === undefined || found === '' ? null : found;
      const pages = /\n\s*pages: (\d+)/.exec(entry)?.[1];
      return id ? [[id, { date, pages: pages ? Number(pages) : null }]] : [];
    }),
  );
  return new Map<string, BookFacts>(
    pcgenBooks.books.map(({ book, code }) => [
      book,
      registry.get(code.id) ?? { date: null, pages: null },
    ]),
  );
}

/** A lowercase hyphenated slug, as `everythingpath/` ids are (`catalogKeySchema`). */
export function identitySlug(text: string) {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Reviewed spellings: PCGen's `Enlightenend Bloodrager` (Arcane Anthology
 * p.16, `arca_abilities_class.lst:13`; Adventurer's Guide p.120,
 * `ag_abilities_class.lst:698`) is the Enlightened Bloodrager its own
 * features name (`Enlightened Bloodrager ~ Enlightened Spellcasting`).
 */
const reviewedSpellings: Readonly<Record<string, string>> = {
  enlightenend: 'enlightened',
};
function keySlug(text: string) {
  return identitySlug(text)
    .split('-')
    .map((word) => reviewedSpellings[word] ?? word)
    .join('-');
}

const canonicalKey =
  /^(?<className>.+?) Archetype ~ (?<name>.+?)(?: ~ (?<tag>[A-Z]+))?$/;

/**
 * An owner's derived key, its kind, the names and tag its features' KEYs may
 * repeat, and the class (or prestige class) that scopes a feature whose KEY
 * names another owner.
 */
export function ownerDerivation(owner: PcgenOwner) {
  const { key } = owner.record.locator;
  if (owner.kind === 'prestige')
    return {
      kind: 'prestigeClass' as const,
      derivedKey: `everythingpath/${keySlug(key)}`,
      names: [keySlug(key)],
      tag: null,
      scope: keySlug(key),
    };
  const groups = canonicalKey.exec(key)?.groups;
  if (!groups?.className || !groups.name)
    return {
      kind: 'archetype' as const,
      derivedKey: null,
      names: [keySlug(owner.record.name)],
      tag: null,
      scope: keySlug(owner.className ?? owner.record.name),
    };
  const scope = keySlug(groups.className);
  const base = `${scope}-${keySlug(groups.name)}`;
  return {
    kind: 'archetype' as const,
    derivedKey: `everythingpath/${base}${groups.tag ? `-${keySlug(groups.tag)}` : ''}`,
    names: [keySlug(groups.name), base],
    tag: groups.tag ? keySlug(groups.tag) : null,
    scope,
  };
}

/**
 * A feature's key. One whose KEY's first segment names its owner is
 * `<owner key>-<the rest>`, without a trailing tag the owner carries; any
 * other, such as a feature several archetypes share (`No Spellcasting ~
 * Ranger`), is its whole KEY under the owner's class.
 */
export function featureDerivation({
  feature,
  ownerKey,
  owner,
}: {
  feature: PcgenRecord;
  ownerKey: string;
  owner: ReturnType<typeof ownerDerivation>;
}) {
  const segments = feature.locator.key
    .split(' ~ ')
    .map(keySlug)
    .filter(Boolean);
  const [first = '', ...rest] = segments;
  // `Pact Wizard ~ …` names `Pact Wizard HH`; `Investigator ~ …` names no
  // `Bonded Investigator`, though its key starts with the class.
  const [name = '', ...longer] = owner.names;
  const namesOwner =
    rest.length > 0 &&
    (name.startsWith(`${first}-`) || [name, ...longer].includes(first));
  if (!namesOwner) {
    const whole = segments.join('-');
    return `everythingpath/${whole.startsWith(`${owner.scope}-`) ? whole : `${owner.scope}-${whole}`}`;
  }
  const tail =
    owner.tag && rest.length > 1 && rest.at(-1) === owner.tag
      ? rest.slice(0, -1)
      : rest;
  return `${ownerKey}-${tail.join('-')}`;
}

const pcgenSource = (record: PcgenRecord): IdentitySubject['source'] => ({
  source: 'pcgen',
  locator: { ...record.locator },
});

function subjectOf({
  record,
  kind,
  derivedKey,
  sourceSha256,
}: {
  record: PcgenRecord;
  kind: IdentityKind;
  derivedKey: string | null;
  sourceSha256: string;
}): IdentitySubject {
  return {
    kind,
    source: pcgenSource(record),
    sourceSha256,
    derivedKey,
    book: record.book,
    bookShort: record.bookShort,
  };
}

/** The identity-bearing owners: every archetype and prestige class but helpers. */
export const keyedOwners = (inventory: PcgenInventory) =>
  inventory.owners.filter((owner) => owner.kind !== 'helper');

/** An owner record's effective source hash, as its mapper binds it. */
function ownerSha256(view: PcgenEffectiveView, owner: PcgenOwner) {
  const effective = view.records.get(owner.record);
  if (!effective) return null;
  return owner.kind === 'prestige'
    ? prestigeSourceSha256({ ...effective, record: owner.record })
    : archetypeSourceSha256(effective);
}

/** The identity subjects of every keyed owner. */
export function ownerSubjects({
  inventory,
  view,
}: {
  inventory: PcgenInventory;
  view: PcgenEffectiveView;
}) {
  return keyedOwners(inventory).flatMap((owner) => {
    const sourceSha256 = ownerSha256(view, owner);
    if (sourceSha256 === null) return [];
    const { kind, derivedKey } = ownerDerivation(owner);
    return [
      subjectOf({ record: owner.record, kind, derivedKey, sourceSha256 }),
    ];
  });
}

/**
 * The identity subjects of every feature an owner grants directly, each once,
 * keyed under its first owner by `keyOfOwner` (the owners' assignment).
 */
export function featureSubjects({
  inventory,
  view,
  keyOfOwner,
}: {
  inventory: PcgenInventory;
  view: PcgenEffectiveView;
  keyOfOwner: (owner: PcgenOwner) => string | undefined;
}) {
  const subjects = new Map<string, IdentitySubject>();
  const owners = new Set(keyedOwners(inventory));
  for (const row of inventory.rows) {
    if (row.depth !== 1 || !row.feature || !owners.has(row.owner)) continue;
    const source = pcgenSource(row.feature);
    const locator = locatorKeyOf(source);
    const effective = view.records.get(row.feature);
    if (subjects.has(locator) || !effective) continue;
    const ownerKey = keyOfOwner(row.owner);
    subjects.set(
      locator,
      subjectOf({
        record: row.feature,
        kind:
          row.owner.kind === 'prestige'
            ? 'prestigeClassFeature'
            : 'archetypeFeature',
        derivedKey: ownerKey
          ? featureDerivation({
              feature: row.feature,
              ownerKey,
              owner: ownerDerivation(row.owner),
            })
          : null,
        sourceSha256: archetypeSourceSha256(effective),
      }),
    );
  }
  return [...subjects.values()];
}

/** Owners and features are keyed apart: features under their owners' keys. */
export type IdentityScope = 'owners' | 'features';
const scopeKinds: Readonly<Record<IdentityScope, ReadonlySet<IdentityKind>>> = {
  owners: new Set(['archetype', 'prestigeClass']),
  features: new Set(['archetypeFeature', 'prestigeClassFeature']),
};

type Assignment = {
  ledger: IdentityLedger;
  /** Which ledger entries the check covers, whatever records survive. */
  scope: IdentityScope;
  subjects: readonly IdentitySubject[];
  books: ReadonlyMap<string, BookFacts>;
  /** Reviewed catalog-identity remaps (`reviewed-remaps.json`). */
  identityRemaps?: readonly ReviewedRemap[];
  /** Other `everythingpath/` keys of the release: the increment keys. */
  reservedKeys?: Iterable<string>;
};
type HeldIdentity = {
  externalKey: string;
  kind: IdentityKind;
  source: UpstreamSource;
};
type HeldSource = IdentityLedger['heldSources'][number];

/** The scope's ledger locators, after checked locator remaps, with their identities. */
function heldLocators(
  ledger: IdentityLedger,
  kinds: ReadonlySet<IdentityKind>,
) {
  const remapped = new Map(
    ledger.locatorRemaps
      .filter(({ review }) => review.status === 'checked')
      .map(({ from, to }) => [locatorKeyOf(from), to]),
  );
  return new Map<string, HeldIdentity>(
    ledger.identities
      .filter(({ kind }) => kinds.has(kind))
      .flatMap(({ externalKey, kind, sources }) =>
        sources.map((source) => {
          const current = remapped.get(locatorKeyOf(source)) ?? source;
          return [locatorKeyOf(current), { externalKey, kind, source }];
        }),
      ),
  );
}

/** The scope's checked decisions that no longer hold, and the identities they cover. */
function staleDecisionsOf({
  ledger,
  kinds,
  currentHashes,
}: {
  ledger: IdentityLedger;
  kinds: ReadonlySet<IdentityKind>;
  currentHashes: ReadonlyMap<string, string>;
}) {
  const inScope = new Set(
    ledger.identities
      .filter(({ kind }) => kinds.has(kind))
      .map(({ externalKey }) => externalKey),
  );
  const keysOf = (decision: VariantDecision) =>
    decision.decision === 'same-identity'
      ? [decision.externalKey]
      : decision.identities.map(({ externalKey }) => externalKey);
  const stale = ledger.variantDecisions.filter(
    (decision) =>
      decision.review.status === 'checked' &&
      keysOf(decision).some((key) => inScope.has(key)) &&
      !isCurrentDecision(decision, currentHashes),
  );
  return { stale, keys: new Set(stale.flatMap(keysOf)) };
}

/**
 * Each subject the ledger holds keeps its key, held while its decision is
 * stale; a held source is held for its conflict, or as stale once its hash
 * changes; the rest wait for a proposal.
 */
function reconcileSubjects({
  subjects,
  held,
  heldSources,
  staleKeys,
}: {
  subjects: readonly IdentitySubject[];
  held: ReadonlyMap<string, HeldIdentity>;
  heldSources: ReadonlyMap<string, HeldSource>;
  staleKeys: ReadonlySet<string>;
}) {
  const keys = new Map<string, string>();
  const holds = new Map<string, IdentityHold>();
  const pending: IdentitySubject[] = [];
  for (const subject of subjects) {
    const locator = locatorKeyOf(subject.source);
    const identity = held.get(locator);
    const heldSource = heldSources.get(locator);
    if (identity) {
      keys.set(locator, identity.externalKey);
      if (staleKeys.has(identity.externalKey)) holds.set(locator, 'stale');
    } else if (heldSource)
      holds.set(
        locator,
        heldSource.sourceSha256 === subject.sourceSha256
          ? 'attribution'
          : 'stale',
      );
    else pending.push(subject);
  }
  return { keys, holds, pending };
}

const lineageKey = (subject: { kind: IdentityKind; source: UpstreamSource }) =>
  `${subject.kind} ${lineageOf(subject.source)}`;

/** Earlier book first; an undated book last; then by locator. */
function byBookOrder(books: ReadonlyMap<string, BookFacts>) {
  const dateOf = ({ book }: IdentitySubject) => books.get(book)?.date ?? '9999';
  return (left: IdentitySubject, right: IdentitySubject) =>
    dateOf(left).localeCompare(dateOf(right)) ||
    locatorKeyOf(left.source).localeCompare(locatorKeyOf(right.source));
}

const proposal = (
  subject: IdentitySubject,
  externalKey: string | null,
  hold: IdentityProposal['hold'],
): IdentityProposal => ({
  externalKey,
  kind: subject.kind,
  source: subject.source,
  hold,
});

type ProposalContext = {
  taken: Set<string>;
  heldLineages: ReadonlySet<string>;
  books: ReadonlyMap<string, BookFacts>;
};

/** Same-KEY records with a free key share it, held as variants while more than one. */
function proposeShared(
  derivedKey: string,
  members: readonly IdentitySubject[],
  { taken, heldLineages }: ProposalContext,
) {
  taken.add(derivedKey);
  return members.map((subject) =>
    proposal(
      subject,
      derivedKey,
      members.length > 1 || heldLineages.has(lineageKey(subject))
        ? 'variant'
        : null,
    ),
  );
}

/**
 * The earliest book keeps a free bare key and the rest add their book: a
 * same-KEY record beside a held identity is a variant, any other a
 * collision, and so is one with no free key.
 */
function proposeByBook(
  derivedKey: string,
  members: readonly IdentitySubject[],
  { taken, heldLineages, books }: ProposalContext,
) {
  const hasSharedKey = new Set(members.map(lineageKey)).size === 1;
  return [...members].sort(byBookOrder(books)).map((subject, index) => {
    const candidate =
      index === 0 && !taken.has(derivedKey)
        ? derivedKey
        : subject.bookShort
          ? `${derivedKey}-${identitySlug(subject.bookShort)}`
          : null;
    const isFree = candidate !== null && !taken.has(candidate);
    if (isFree) taken.add(candidate);
    const isVariant = hasSharedKey && heldLineages.has(lineageKey(subject));
    return proposal(
      subject,
      isFree ? candidate : null,
      isFree && isVariant ? 'variant' : 'collision',
    );
  });
}

/** Proposals for subjects the ledger doesn't hold (see the module comment). */
function propose(
  pending: readonly IdentitySubject[],
  context: ProposalContext,
) {
  const groups = new Map<string, IdentitySubject[]>();
  const noncanonical: IdentityProposal[] = [];
  for (const subject of pending)
    if (subject.derivedKey === null)
      noncanonical.push(proposal(subject, null, 'noncanonical'));
    else
      groups.set(subject.derivedKey, [
        ...(groups.get(subject.derivedKey) ?? []),
        subject,
      ]);
  return [
    ...noncanonical,
    ...[...groups].flatMap(([derivedKey, members]) =>
      new Set(members.map(lineageKey)).size === 1 &&
      !context.taken.has(derivedKey)
        ? proposeShared(derivedKey, members, context)
        : proposeByBook(derivedKey, members, context),
    ),
  ];
}

/** Keys no proposal may take: the ledger's, retired ones, remapped ones, reserved ones. */
const takenKeys = ({
  ledger,
  identityRemaps,
  reservedKeys,
}: {
  ledger: IdentityLedger;
  identityRemaps: readonly ReviewedRemap[];
  reservedKeys: Iterable<string>;
}) =>
  new Set([
    ...ledger.identities.map(({ externalKey }) => externalKey),
    ...ledger.retirements.map(({ externalKey }) => externalKey),
    ...identityRemaps.map(({ from }) => from),
    ...reservedKeys,
  ]);

/**
 * Assigns `everythingpath/` keys to one scope of a corpus through the
 * ledger, and reports what a pin bump needs reviewed: proposals for records
 * the ledger lacks, vanished ledger locators and held sources, stale
 * decisions and stale held sources. `passed` holds when the ledger accounts
 * for the scope exactly.
 */
export function assignIdentities({
  ledger,
  scope,
  subjects,
  books,
  identityRemaps = [],
  reservedKeys = [],
}: Assignment) {
  const kinds = scopeKinds[scope];
  const held = heldLocators(ledger, kinds);
  const heldSources = new Map(
    ledger.heldSources
      .filter(({ kind }) => kinds.has(kind))
      .map((entry) => [locatorKeyOf(entry.source), entry]),
  );
  const currentHashes = new Map(
    subjects.map(({ source, sourceSha256 }) => [
      locatorKeyOf(source),
      sourceSha256,
    ]),
  );
  const stale = staleDecisionsOf({ ledger, kinds, currentHashes });
  const { keys, holds, pending } = reconcileSubjects({
    subjects,
    held,
    heldSources,
    staleKeys: stale.keys,
  });
  const proposals = propose(pending, {
    taken: takenKeys({ ledger, identityRemaps, reservedKeys }),
    heldLineages: new Set([...held.values()].map(lineageKey)),
    books,
  });
  for (const { externalKey, source, hold } of proposals) {
    const locator = locatorKeyOf(source);
    if (externalKey) keys.set(locator, externalKey);
    if (hold) holds.set(locator, hold);
  }
  const vanished = [...held].flatMap(([locator, identity]) =>
    currentHashes.has(locator) ? [] : [identity],
  );
  const vanishedHeldSources = [...heldSources].flatMap(([locator, entry]) =>
    currentHashes.has(locator) ? [] : [entry],
  );
  const heldRecords = [...heldSources].flatMap(([locator, entry]) => {
    const hold = holds.get(locator);
    return hold ? [{ ...entry, hold }] : [];
  });
  const resolveKey = (key: string) =>
    identityRemaps.find(({ from }) => from === key)?.to ?? key;
  return {
    /** Each subject's key, by case-folded locator. */
    keys,
    /** Why a subject is held, by case-folded locator. */
    holds,
    proposals,
    vanished,
    vanishedHeldSources,
    staleDecisions: stale.stale,
    /** The ledger's held records present in the corpus, each with its hold. */
    heldRecords,
    /** A reference to a remapped identity resolves to the identity it merged into. */
    resolveKey,
    passed:
      !proposals.length &&
      !vanished.length &&
      !vanishedHeldSources.length &&
      !stale.stale.length &&
      heldRecords.every(({ hold }) => hold !== 'stale'),
  };
}

/**
 * Owners first, then their features under the owners' keys: the whole PCGen
 * assignment of one corpus.
 */
export function assignPcgenIdentities({
  inventory,
  view,
  ...assignment
}: Omit<Assignment, 'subjects' | 'scope'> & {
  inventory: PcgenInventory;
  view: PcgenEffectiveView;
}) {
  const owners = assignIdentities({
    ...assignment,
    scope: 'owners',
    subjects: ownerSubjects({ inventory, view }),
  });
  const keyOfOwner = (owner: PcgenOwner) =>
    owners.keys.get(
      locatorKeyOf({ source: 'pcgen', locator: owner.record.locator }),
    );
  const features = assignIdentities({
    ...assignment,
    scope: 'features',
    subjects: featureSubjects({ inventory, view, keyOfOwner }),
    reservedKeys: [...(assignment.reservedKeys ?? []), ...owners.keys.values()],
  });
  return { owners, features, keyOfOwner };
}

/**
 * The ledger with every proposal that holds nothing frozen as an identity:
 * the one time its key is derived. Held proposals (variants, collisions,
 * noncanonical keys) wait for review.
 */
export function freezeProposals(
  ledger: IdentityLedger,
  proposals: readonly IdentityProposal[],
): IdentityLedger {
  return {
    ...ledger,
    identities: [
      ...ledger.identities,
      ...proposals.flatMap(({ externalKey, kind, source, hold }) =>
        externalKey && hold === null
          ? [{ externalKey, kind, sources: [source] }]
          : [],
      ),
    ],
  };
}
