import { locatorId, type PcgenInventory } from './inventory';
import { summarizePcgenInventory, variantGroups } from './inventory-summary';

/**
 * Compact inventory evidence (#716 P3): the totals of the whole pinned tree
 * and, for chosen owners, their rows. The tests compare the rows the reader
 * finds in pinned inputs against it; an audit over a full PCGen checkout
 * regenerates all of it.
 */
export function ownerEvidence(
  inventory: PcgenInventory,
  ownerLocators: readonly string[],
) {
  return ownerLocators.map((owner) => {
    const found = inventory.owners.find(
      ({ record }) => locatorId(record) === owner,
    );
    return {
      owner,
      kind: found?.kind ?? null,
      key: found?.record.locator.key ?? null,
      className: found?.className ?? null,
      book: found?.record.book ?? null,
      rows: inventory.rows
        .filter((row) => row.owner === found)
        .map((row) => ({
          key: row.key,
          feature: row.feature ? locatorId(row.feature) : null,
          binding: row.binding,
          variants: row.variants,
          depth: row.depth,
          via: row.via,
        })),
    };
  });
}

/** The whole-tree totals: Appendices A, D, F and G. */
export function totalsEvidence(inventory: PcgenInventory) {
  const { unresolved, ...summary } = summarizePcgenInventory(inventory);
  const groups: Record<string, number> = {};
  for (const { kind } of variantGroups(inventory))
    groups[kind] = (groups[kind] ?? 0) + 1;
  return {
    ...summary,
    unresolved: unresolved.map((row) => ({
      key: row.key,
      owner: locatorId(row.owner.record),
    })),
    variantGroups: groups,
  };
}
