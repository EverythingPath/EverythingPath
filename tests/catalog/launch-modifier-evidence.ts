// The plain-Modifiers family's full-inventory control evidence: every
// committed inventory row carrying a Modifier, with the entry and issues the
// current importer gives it from the pinned store, read as
// `buildLaunchVerification` reads the pinned checkouts.
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { importCatalog } from '../../scripts/catalog/import';
import { itemAbilityHelperId } from '../../scripts/catalog/inventory';
import { parseLaunchInventory } from '../../scripts/catalog/launch-inventory-document';
import type { LaunchRow } from '../../scripts/catalog/launch-inventory-schema';
import { readReleaseScope } from '../../scripts/catalog/release-scope';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { materializePinnedTree, pinnedStore } from './pinned-sources';

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
const listed = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];
export type Issue = { field: string; reason?: string };
/**
 * A row's real evidence, as the build reads it: the entry its scoped import
 * emits, or `undefined` when the import loaded the row's source and emits no
 * entry for it (an excluded record, a resource), its full import's issues,
 * and the reason the import classified its record by.
 */
export type RealEntry = {
  entry: Record<string, unknown> | undefined;
  issues: Issue[];
  reason: string;
};

/** The issue fields the family's disqualifiers name. */
export const disqualifying = ['changes', 'curation', 'racialTraitRule'];
export const disqualifies = ({ field }: Issue) =>
  disqualifying.some((name) => field === name || field.startsWith(`${name}.`));

/** A row's outstanding, non-prose Modifier mechanisms. */
export const modifierNames = (row: LaunchRow) =>
  row.mechanisms
    .filter(
      ({ status, disposition, name }) =>
        status === 'outstanding' &&
        disposition !== 'permitted prose' &&
        name.startsWith('Modifier '),
    )
    .map(({ name }) => name);

/**
 * What the importer reads beyond a row's own file, each pack whole from the
 * pinned store (every tree carries both manifests and every declared pack
 * folder):
 * - `pf1-content/src/pf-racial-traits`: its folder records, whose ancestry
 *   excludes the Race Builder subtree (`findRaceBuilderFolders`, `classify`)
 *   and places a trait in its race folder, and its trait records, a race
 *   folder's standard and alternate traits (`planRacialTraits`);
 * - `pf1/packs/races`: the races whose plan moves changes between a race and
 *   its traits and retires their notes (`planRacialTraits`);
 * - the item-ability helper, the curation seeds (`collectHelperSeeds`).
 *
 * Everything else it reads across records is outside what the family reads:
 * the other admitted records resolve description links and prerequisites
 * (`lookup`, `resolveKey`), classes give spells their class tags
 * (`spellClassTags`) and a reviewed class its schedule rows. The gate-host
 * audit `launch-modifiers-canonical.test.ts` holds the control to the build.
 */
const contextPacks = [
  ['pf1-content', 'src/pf-racial-traits'],
  ['pf1', 'packs/races'],
] as const;
const contextFiles = [
  `pf1-content/src/pf-special-qualities/_Weapon_Enchant_Conditional_Modifiers_${itemAbilityHelperId}.yaml`,
];

/** Every file of the context packs in the store, as `<repo>/<path>`. */
async function contextPackFiles() {
  const files: string[] = [];
  for (const [repo, directory] of contextPacks)
    for (const file of await readdir(join(pinnedStore, repo, directory), {
      recursive: true,
    }))
      if (/\.ya?ml$/.test(file)) files.push(`${repo}/${directory}/${file}`);
  return files.sort();
}

/**
 * Each row's real evidence, from the pinned store with the importer's
 * context: each row's one Foundry source (an Eidolon evolution also cites the
 * PRD), checked against the inventory's raw hash, imported with the context
 * packs. A row whose source the import did not load has no real evidence and
 * throws.
 */
async function realEntries(rows: readonly LaunchRow[]) {
  const files = rows.map(({ key, sources }) => {
    const [bound, ...others] = sources.filter(
      ({ repository }) => repository === 'pf1' || repository === 'pf1-content',
    );
    if (!bound || others.length)
      throw new Error(`${key} binds no single Foundry source.`);
    return {
      key,
      file: `${bound.repository}/${bound.locator}`,
      sha: bound.rawSha256,
    };
  });
  const unpinned = files.filter(
    ({ file }) => !existsSync(join(pinnedStore, file)),
  );
  if (unpinned.length)
    throw new Error(
      `The pinned store lacks ${unpinned.length} sources: ${unpinned.map(({ file }) => file).join(', ')}`,
    );
  const tree = await materializePinnedTree(
    [
      ...new Set([
        ...files.map(({ file }) => file),
        ...(await contextPackFiles()),
        ...contextFiles,
      ]),
    ],
    { sha256: Object.fromEntries(files.map(({ file, sha }) => [file, sha])) },
  );
  try {
    const { loaded, entries, issues } = await importedEvidence(tree);
    return new Map(
      rows.map(({ key }): [string, RealEntry] => {
        const reason = loaded.get(key);
        if (reason === undefined)
          throw new Error(`No real evidence for ${key}.`);
        return [
          key,
          { entry: entries.get(key), issues: issues.get(key) ?? [], reason },
        ];
      }),
    );
  } finally {
    await tree.dispose();
  }
}

/**
 * An import's evidence, read as `buildLaunchVerification` reads it: the
 * entries the import scoped to the release scope's keys (those it loaded)
 * emits, the full import's issues, and every key the import loaded with its
 * classification's reason.
 */
export async function importedEvidence(paths: {
  systemPath: string;
  contentPath: string;
}) {
  const options = {
    ...paths,
    remaps: JSON.parse(
      await readFile('scripts/catalog/reviewed-remaps.json', 'utf8'),
    ) as unknown,
    curation: reviewedCuration,
  };
  const full = await importCatalog(options);
  const loaded = new Map(
    full.comparison.records.map(({ externalKey, reason }) => [
      externalKey,
      reason,
    ]),
  );
  const issues = new Map(
    full.unsupported.entries.map(({ externalKey, issues: found }) => [
      externalKey,
      found.map(
        ({ field, reason }): Issue => ({
          field,
          ...(reason === undefined ? {} : { reason }),
        }),
      ),
    ]),
  );
  const { importKeys } = await readReleaseScope({ version: 'campaign-mvp-v1' });
  const scoped = await importCatalog({
    ...options,
    scopeKeys: importKeys.filter((key) => loaded.has(key)),
  });
  const entries = new Map(
    scoped.catalog.entries.map((entry) => [entry.externalKey, asRecord(entry)]),
  );
  return { loaded, entries, issues };
}

let controlRows:
  | Promise<{
      committed: ReturnType<typeof parseLaunchInventory>;
      catalogRows: LaunchRow[];
      modifierRows: LaunchRow[];
      real: Map<string, RealEntry>;
    }>
  | undefined;
/**
 * The committed inventory, its catalog rows and every one carrying a
 * Modifier, of every kind, with its real evidence (`realEntries`). None is
 * substituted; a row without real evidence fails. Loaded once.
 */
export const loadControlRows = () =>
  (controlRows ??= (async () => {
    const committed = parseLaunchInventory(
      JSON.parse(
        await readFile('scripts/catalog/scopes/campaign-mvp-v1.json', 'utf8'),
      ),
    );
    const catalogRows = committed.rows.filter(
      ({ catalogKey, key }) => catalogKey && !/^(?:notice|rule)\//.test(key),
    );
    const modifierRows = catalogRows.filter((row) => modifierNames(row).length);
    return {
      committed,
      catalogRows,
      modifierRows,
      real: await realEntries(modifierRows),
    };
  })());

/** An entry's Modifiers as `<target> <bonus type> <value>`; null for a conditional one. */
function modifierWords(entry: Record<string, unknown>) {
  const words = listed(entry.modifiers).map((value) => {
    const { target, bonusType, value: amount, ...rest } = asRecord(value);
    const shown =
      typeof amount === 'number' ? amount : String(asRecord(amount).formula);
    return Object.keys(rest).length
      ? null
      : `${String(target)} ${String(bonusType)} ${shown}`;
  });
  return words.includes(null) ? null : words;
}

/** An entry's feat slots as `slot <count>`; null for a typed one. */
function slotWords(entry: Record<string, unknown>) {
  const words = listed(entry.grantsSlots).map((value) => {
    const { kind, count, feats: _listedFeats, ...rest } = asRecord(value);
    return kind !== 'feat' || Object.keys(rest).length
      ? null
      : `slot ${String(count)}`;
  });
  return words.includes(null) ? null : words;
}

/**
 * The outputs an entry carries, sorted: its Modifiers, its feat slots and a
 * `rank` per bonus skill rank per level; null when one is outside them.
 */
export function entryOutputs(entry: Record<string, unknown>) {
  const modifiers = modifierWords(entry);
  const slots = slotWords(entry);
  const ranks = Number(asRecord(entry.detail).bonusSkillRanksPerLevel ?? 0);
  return modifiers && slots
    ? [...modifiers, ...slots, ...Array<string>(ranks).fill('rank')].sort()
    : null;
}

/**
 * What the family reads of a row's evidence: whether it has an entry, the
 * entry's kind and outputs, and the issues its disqualifiers name.
 */
export const evidenceShown = (
  entry: Record<string, unknown> | undefined,
  issues: readonly Issue[],
) => ({
  entry: entry
    ? { kind: asRecord(entry.detail).kind, outputs: entryOutputs(entry) }
    : null,
  issues: issues
    .filter(disqualifies)
    .map(({ field, reason }) => `${field}: ${reason ?? ''}`)
    .sort(),
});
