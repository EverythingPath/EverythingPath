import type { CanonicalWeekState } from './canonical-weekly-source';
import type {
  MissingReference,
  StagedReference,
} from './correction-staged-choices';
import type {
  MilitiaSectionKey,
  SectionValues,
} from './militia-correction-sections';

// Same-identity restoration: when a correction removed something the open
// week's choices still use, an ordinary section correction can add it back
// under the identity those choices refer to, rather than a new one. Only
// facts this device saw accepted are reused; anything else is entered again.

type Snapshot = CanonicalWeekState['militiaSnapshot'];
type Team = SectionValues['teams'][number];
type Settlement = SectionValues['settlements'][number];
type Item = SectionValues['items'][number];
type Cache = SectionValues['caches'][number];

type Rows = { team: Team; settlement: Settlement; item: Item; cache: Cache };
/** Identity kinds a section correction can restore. */
export type RestorableKind = keyof Rows;
export type RestorableRow<K extends RestorableKind = RestorableKind> = Rows[K];

type Adapter<K extends RestorableKind> = {
  section: MilitiaSectionKey;
  rows: (snapshot: Snapshot) => readonly Rows[K][];
  identity: (row: Rows[K]) => string;
  /** The row to fill in when no facts were captured for the identity. */
  blank: (id: string) => Rows[K];
  /**
   * Identities a restored row refers to that `snapshot` lacks: snapshot
   * integrity needs them restored first, e.g. the items a cache holds.
   */
  prerequisites?: (row: Rows[K], snapshot: Snapshot) => MissingReference[];
};

// Facts nobody entered stay unset or unrecorded: the player enters them (a
// team's name, type and condition; an item's value, weight and location; a
// cache's class, status and security), and the form reports them as
// required.
// Safe cast: unentered facts stay undefined until the player enters them; the
// form requires them.
const unset = undefined as never;
const adapters: { [K in RestorableKind]: Adapter<K> } = {
  team: {
    section: 'teams',
    rows: (snapshot) => snapshot.roster.teams,
    identity: (team) => team.teamId,
    blank: (teamId) => ({
      teamId,
      name: '',
      teamType: unset,
      status: unset,
      rewardCapExempt: false,
      managerCharacterId: null,
      notes: '',
    }),
  },
  settlement: {
    section: 'settlements',
    rows: (snapshot) => snapshot.settlements,
    identity: (town) => town.settlementId,
    blank: (settlementId) => ({
      settlementId,
      name: '',
      reputation: null,
      secured: null,
      occupied: null,
      temporaryReputationShift: null,
      refugeActivatedWeek: null,
      refugeActiveUntilWeek: null,
    }),
  },
  item: {
    section: 'items',
    rows: (snapshot) => snapshot.economy?.items ?? [],
    identity: (item) => item.itemId,
    blank: (itemId) => ({
      itemId,
      name: '',
      valueCopper: unset,
      weight: unset,
      location: unset,
    }),
  },
  cache: {
    section: 'caches',
    rows: (snapshot) => snapshot.economy?.caches ?? [],
    identity: (cache) => cache.cacheId,
    blank: (cacheId) => ({
      cacheId,
      cacheClass: unset,
      location: '',
      secure: unset,
      extradimensional: unset,
      itemIds: [],
      status: unset,
      returnActivityWeek: null,
    }),
    prerequisites: (cache, snapshot) =>
      cache.itemIds
        .filter(
          (itemId) =>
            !snapshot.economy?.items.some((item) => item.itemId === itemId),
        )
        .map((id) => ({ kind: 'item', id })),
  },
};
// Safe cast: adapters is keyed by every RestorableKind.
const kinds = Object.keys(adapters) as RestorableKind[];

const isRestorable = (kind: string): kind is RestorableKind => kind in adapters;

/** The section whose correction restores the kind, or null. */
export function restoringSection(kind: string): MilitiaSectionKey | null {
  return isRestorable(kind) ? adapters[kind].section : null;
}

/** The kinds of identity the section's correction can restore. */
export function restorableKinds(section: MilitiaSectionKey): RestorableKind[] {
  return kinds.filter((kind) => adapters[kind].section === section);
}

/** Accepted rows last seen on this device, by kind and identity. */
export type CapturedFacts = {
  readonly [K in RestorableKind]: ReadonlyMap<string, Rows[K]>;
};
export const noCapturedFacts: CapturedFacts = {
  team: new Map(),
  settlement: new Map(),
  item: new Map(),
  cache: new Map(),
};

function remember<K extends RestorableKind>(
  kind: K,
  previous: ReadonlyMap<string, Rows[K]>,
  snapshot: Snapshot,
) {
  // Safe cast: adapters maps each kind to its own adapter; TypeScript cannot
  // correlate the generic index.
  const adapter = adapters[kind] as Adapter<K>;
  const next = new Map(previous);
  for (const row of adapter.rows(snapshot))
    next.set(adapter.identity(row), row);
  return next;
}

/**
 * Adds the newest accepted facts to what this device has seen. A row that a
 * correction removed keeps the facts it had just before.
 */
export function rememberFacts(
  previous: CapturedFacts,
  snapshot: Snapshot,
): CapturedFacts {
  return {
    team: remember('team', previous.team, snapshot),
    settlement: remember('settlement', previous.settlement, snapshot),
    item: remember('item', previous.item, snapshot),
    cache: remember('cache', previous.cache, snapshot),
  };
}

export type MissingIdentity<K extends RestorableKind = RestorableKind> =
  K extends RestorableKind
    ? {
        kind: K;
        id: string;
        /** The open week's choices that use it. */
        neededBy: StagedReference[];
        /** Its accepted facts, when this device saw them. */
        captured: Rows[K] | null;
        /** Missing identities its captured facts need restored first. */
        requires: MissingReference[];
        /** Missing identities whose restoration needs this one first. */
        requiredBy: MissingReference[];
      }
    : never;

/** The missing identities of one kind, e.g. items to restore before caches. */
export function missingOfKind<K extends RestorableKind>(
  identities: readonly MissingIdentity[],
  kind: K,
): MissingIdentity<K>[] {
  return identities.filter(
    (identity): identity is MissingIdentity<K> => identity.kind === kind,
  );
}

function prerequisitesOf(identity: MissingIdentity, snapshot: Snapshot) {
  // Safe cast: adapters maps each kind to its own adapter; TypeScript cannot
  // correlate the union index.
  const adapter = adapters[identity.kind] as Adapter<RestorableKind>;
  return identity.captured && adapter.prerequisites
    ? adapter.prerequisites(identity.captured, snapshot)
    : [];
}

/**
 * The restorable identities the open week's staged choices use but
 * `snapshot`, the militia, lacks, in the order the week first needs them.
 * Carried context is never broken by a saved correction, so it is not
 * listed. A captured row that refers to other missing identities (a cache
 * holding removed items) requires them first; those follow, needed by it.
 */
export function missingIdentities(
  references: readonly StagedReference[],
  captured: CapturedFacts,
  snapshot: Snapshot,
): MissingIdentity[] {
  const found = new Map<string, MissingIdentity>();
  const entry = ({ kind, id }: { kind: RestorableKind; id: string }) => {
    const key = `${kind}:${id}`;
    const existing = found.get(key);
    if (existing) return existing;
    // Safe cast: kind and captured come from the same RestorableKind.
    const created = {
      kind,
      id,
      neededBy: [],
      captured: captured[kind].get(id) ?? null,
      requires: [],
      requiredBy: [],
    } as MissingIdentity;
    found.set(key, created);
    return created;
  };
  for (const reference of references) {
    if (reference.phase === null) continue;
    for (const { kind, id } of reference.missing)
      if (isRestorable(kind)) entry({ kind, id }).neededBy.push(reference);
  }
  for (const identity of [...found.values()])
    for (const required of prerequisitesOf(identity, snapshot)) {
      if (!isRestorable(required.kind)) continue;
      identity.requires.push(required);
      entry({ kind: required.kind, id: required.id }).requiredBy.push({
        kind: identity.kind,
        id: identity.id,
      });
    }
  return [...found.values()];
}

/** The row that restores a missing identity: its captured facts, or blank. */
export function restoredRow<K extends RestorableKind>(
  missing: MissingIdentity<K>,
): Rows[K] {
  // Safe cast: MissingIdentity<K> distributes, so its kind is K.
  const adapter: Adapter<K> = adapters[missing.kind as K];
  // Safe cast: MissingIdentity<K> distributes, so its captured rows are
  // Rows[K].
  return (missing.captured as Rows[K] | null) ?? adapter.blank(missing.id);
}

/** Whether a section's rows already hold the identity. */
export function holdsIdentity(
  kind: RestorableKind,
  rows: readonly RestorableRow[],
  id: string,
) {
  // Safe cast: each adapter identifies only rows of its own kind, which these
  // rows are.
  const identity = adapters[kind].identity as (row: RestorableRow) => string;
  return rows.some((row) => identity(row) === id);
}
