import type {
  LaunchManifest,
  LaunchRow,
} from '../../scripts/catalog/launch-inventory-schema';

/**
 * Real campaign-mvp-v1 roots with their files in the pinned store, shared by
 * the release-scope tests. The manifest tests and the operator builds live in
 * separate files: each full manifest copy costs about 1 GB, and the operator
 * loads the reviewed attribution data.
 */
export const race = {
  human: 'pf1/e6IaBxKgMxy1yKlr',
  halfOrc: 'pf1/dCAXgdA6Db1Z3ccz',
  dwarf: 'pf1/nEltI9y37rKJTeWo',
  halfling: 'pf1/Hf31mrYb3uucNyLO',
  elf: 'pf1/NgIhxRI0axrf3fcO',
  halfElf: 'pf1/cCepRrfH5SalFfT4',
  gnome: 'pf1/efwHEwjvL9Z94MJI',
  tiefling: 'pf1/nVjKDLZSRONzYm8f',
};
export const magicalLineage = 'pf1-content/kDx6ZGhbIteoi7lG';
export const exploiter = 'everythingpath/wizard-exploiter-wizard';
export const pinnedFile: Record<string, string> = {
  [race.human]: 'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml',
  [race.halfOrc]: 'pf1/packs/races/half-orc.dCAXgdA6Db1Z3ccz.yaml',
  [race.dwarf]: 'pf1/packs/races/dwarf.nEltI9y37rKJTeWo.yaml',
  [race.halfling]: 'pf1/packs/races/halfling.Hf31mrYb3uucNyLO.yaml',
  [race.elf]: 'pf1/packs/races/elf.NgIhxRI0axrf3fcO.yaml',
  [race.halfElf]: 'pf1/packs/races/half-elf.cCepRrfH5SalFfT4.yaml',
  [race.gnome]: 'pf1/packs/races/gnome.efwHEwjvL9Z94MJI.yaml',
  [race.tiefling]: 'pf1/packs/races/tiefling.nVjKDLZSRONzYm8f.yaml',
  [magicalLineage]:
    'pf1-content/src/pf-traits/Magical_Lineage_kDx6ZGhbIteoi7lG.yaml',
};

/**
 * A reduced copy of the committed manifest: the named real roots, their
 * generated `local/` rows and the rows/edges among them. Its inventory is
 * incomplete and differs from the committed one, so it can never qualify.
 */
export function reducedManifest(
  committed: LaunchManifest,
  roots: string[],
  extra: { rows?: LaunchRow[]; edges?: LaunchManifest['edges'] } = {},
): LaunchManifest {
  const rowsByKey = new Map(committed.rows.map((row) => [row.key, row]));
  const keys = new Set(roots);
  for (const edge of committed.edges)
    if (keys.has(edge.from) && edge.to.startsWith('local/')) keys.add(edge.to);
  const rows = [...keys].map((key) => {
    const row = rowsByKey.get(key);
    if (!row) throw new Error(`No committed row ${key}.`);
    return row;
  });
  const reduced = structuredClone({
    ...committed,
    roots: committed.roots.filter(({ key }) => roots.includes(key)),
    rows,
    edges: committed.edges.filter(
      ({ from, to, kind }) =>
        kind !== 'citation' && keys.has(from) && keys.has(to),
    ),
    pools: [],
    companionPartitions: [],
    semanticContracts: [],
    semanticContexts: [],
    sourceAccounting: [],
    checkpoints: [],
    batches: [],
    ownerInventories: [],
    coverage: [],
  });
  reduced.rows.push(...structuredClone(extra.rows ?? []));
  reduced.edges.push(...structuredClone(extra.edges ?? []));
  return reduced;
}

export function findOutcome(report: { rows: { key: string }[] }, key: string) {
  const row = report.rows.find((entry) => entry.key === key);
  if (!row) throw new Error(`No scope outcome for ${key}.`);
  return row;
}
