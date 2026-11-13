import { appendTo, toPcgenKey } from './keys';
import {
  locatorId,
  type PcgenInventory,
  type PcgenOwnedRow,
  type PcgenOwner,
  type PcgenOwnerKind,
} from './inventory';
import { type PcgenRecord } from './lst';
import { tagValue } from './tokens';

export type PcgenVariantGroupKind =
  | 'reprint'
  | 'unchained'
  | 'separate-keys'
  | 'same-book-duplicate'
  | 'prestige';

function groupKind(owners: readonly PcgenOwner[]): PcgenVariantGroupKind {
  if (owners.some((owner) => owner.kind === 'prestige')) return 'prestige';
  const unchained = owners.filter(({ record }) =>
    record.locator.key.includes('Unchained'),
  );
  if (unchained.length > 0 && unchained.length < owners.length)
    return 'unchained';
  const keys = new Set(
    owners.map(({ record }) => toPcgenKey(record.locator.key)),
  );
  if (keys.size > 1) return 'separate-keys';
  const books = new Set(owners.map(({ record }) => record.book));
  return books.size > 1 ? 'reprint' : 'same-book-duplicate';
}

function variantGroupKey(owner: PcgenOwner) {
  if (owner.record.isPfs) return null;
  if (owner.kind === 'prestige') return `prestige|${owner.record.locator.key}`;
  if (owner.kind !== 'canonical') return null;
  const className = (owner.className ?? '').replace('Unchained ', '');
  return `${className}|${owner.record.name.toLowerCase()}`;
}

/**
 * Plan §1 and Appendix D: archetypes (canonical, outside `_pfs`) that share a
 * class and display name under more than one key or book, and prestige
 * classes defined more than once. Unchained classes count as their base
 * class. A group is the original and Unchained versions when only some keys
 * name the Unchained class; a reprint when one key spans books; a same-book
 * duplicate when one key repeats in one book; otherwise deliberately
 * separate keys.
 */
export function variantGroups(inventory: PcgenInventory) {
  const groups = new Map<string, PcgenOwner[]>();
  for (const owner of inventory.owners) {
    const key = variantGroupKey(owner);
    if (key !== null) appendTo(groups, key, owner);
  }
  return [...groups.values()]
    .filter((owners) => owners.length > 1)
    .map((owners) => ({ kind: groupKind(owners), owners }));
}

/** A resolution as Appendix G counts it: `same-pack, variants kept` when other variants of the key exist. */
export function resolutionLabel(row: PcgenOwnedRow) {
  return row.binding === 'same-pack' && row.variants > 1
    ? 'same-pack, variants kept'
    : row.binding;
}

const countBy = <T>(items: readonly T[], labelOf: (item: T) => string) => {
  const counts: Record<string, number> = {};
  for (const item of items)
    counts[labelOf(item)] = (counts[labelOf(item)] ?? 0) + 1;
  return counts;
};

/** Distinct feature records of some rows, by locator. */
function distinctFeatures(rows: readonly PcgenOwnedRow[]) {
  const byLocator = new Map<string, PcgenRecord>();
  for (const row of rows)
    if (row.feature) byLocator.set(locatorId(row.feature), row.feature);
  return [...byLocator.values()];
}

const directAndAll = <T>(
  direct: readonly T[],
  all: readonly T[],
  count: (items: readonly T[]) => number,
) => ({
  direct: count(direct),
  all: count(all),
});

function ownedCounts(rows: readonly PcgenOwnedRow[], owners: number) {
  const directRows = rows.filter((row) => row.depth === 1);
  const [direct, all] = [distinctFeatures(directRows), distinctFeatures(rows)];
  return {
    owners,
    ownersWithFeatures: new Set(rows.map((row) => locatorId(row.owner.record)))
      .size,
    rows: directAndAll(directRows, rows, (items) => items.length),
    records: directAndAll(direct, all, (items) => items.length),
    namePI: directAndAll(
      direct,
      all,
      (items) => items.filter((record) => record.isNamePI).length,
    ),
    descPI: directAndAll(
      direct,
      all,
      (items) => items.filter((record) => record.isDescPI).length,
    ),
  };
}

function lineCounts(owners: readonly PcgenOwner[]) {
  const archetypes = owners.filter((owner) => owner.kind !== 'prestige');
  const prestige = owners.filter((owner) => owner.kind === 'prestige');
  const live = archetypes.filter((owner) => owner.kind !== 'helper');
  const books = prestige.filter(({ record }) => !record.isPfs);
  const piOf = (list: readonly PcgenOwner[]) => ({
    namePI: list.filter(({ record }) => record.isNamePI).length,
    descPI: list.filter(({ record }) => record.isDescPI).length,
  });
  return {
    archetypeLines: countBy(archetypes, ({ kind, record }) =>
      record.isPfs ? `${kind} (_pfs)` : kind,
    ),
    prestigeLines: {
      records: books.length,
      names: new Set(books.map(({ record }) => record.locator.key)).size,
      pfs: prestige.length - books.length,
    },
    productIdentity: {
      archetypeLines: piOf(live),
      prestigeLines: piOf(prestige),
    },
  };
}

function ownedByKind({ owners, rows }: PcgenInventory) {
  const ownedOf = (kind: PcgenOwnerKind) =>
    ownedCounts(
      rows.filter((row) => row.owner.kind === kind),
      owners.filter((owner) => owner.kind === kind).length,
    );
  return {
    canonical: ownedOf('canonical'),
    noncanonical: ownedOf('noncanonical'),
    'familiar/companion': ownedOf('familiar/companion'),
    option: ownedOf('option'),
    prestige: ownedOf('prestige'),
    helper: ownedOf('helper'),
    allExceptHelper: ownedCounts(
      rows.filter((row) => row.owner.kind !== 'helper'),
      owners.filter((owner) => owner.kind !== 'helper').length,
    ),
  };
}

function sharedRecordCount(rows: readonly PcgenOwnedRow[]) {
  const owning = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.feature) continue;
    const owners = owning.get(locatorId(row.feature)) ?? new Set<string>();
    owning.set(locatorId(row.feature), owners.add(locatorId(row.owner.record)));
  }
  return [...owning.values()].filter((owners) => owners.size > 1).length;
}

const isCrossBook = (row: PcgenOwnedRow) =>
  row.feature !== null && row.feature.book !== row.owner.record.book;

/** The Appendix A, F and G totals of an inventory. */
export function summarizePcgenInventory(inventory: PcgenInventory) {
  const core = inventory.rows.filter((row) => row.owner.kind !== 'helper');
  const direct = core.filter((row) => row.depth === 1);
  return {
    ...lineCounts(inventory.owners),
    owned: ownedByKind(inventory),
    resolution: {
      direct: countBy(direct, resolutionLabel),
      all: countBy(core, resolutionLabel),
    },
    selectorGrants: inventory.selectorGrants,
    multiVariantKeys: new Set(
      core
        .filter((row) => row.feature && row.variants > 1)
        .map((row) => toPcgenKey(row.key)),
    ).size,
    crossBookRows: directAndAll(
      direct,
      core,
      (rows) => rows.filter(isCrossBook).length,
    ),
    copyRows: core.filter((row) => row.feature?.copyOf).length,
    sharedRecords: sharedRecordCount(core),
    directRecordsWithoutDesc: distinctFeatures(direct).filter(
      (record) => !(tagValue(record.tokens, 'DESC') ?? '').trim(),
    ).length,
    unresolved: core.filter((row) => row.binding === 'unresolved'),
  };
}
