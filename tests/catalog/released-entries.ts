// pbl-seed-helper (PRD #251): named catalog entries imported from the pinned
// store, for tests that read real entries without a batch directory.
import { readdir, readFile } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';
import ledgerData from '../../scripts/catalog/everythingpath-identities.json' with { type: 'json' };
import {
  foldUpstreamKey,
  locatorKeyOf,
  parseIdentityLedger,
} from '../../scripts/catalog/everythingpath-identities';
import { importCatalog } from '../../scripts/catalog/import';
import { pcgenPin, pins } from '../../scripts/catalog/inventory';
import {
  pcgenOwnerSelection,
  type PcgenOwnerSelector,
} from '../../scripts/catalog/pcgen-owners';
import { allIncrementKeys } from '../../scripts/catalog/pcgen/schedules';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import {
  ownerEmissionFoundryFiles,
  pcgenOwnerEmissionFiles,
} from '../fixtures/pcgen-716/owner-emission-files';
import {
  materializePinnedTree,
  pinnedRecordFile,
  pinnedStore,
} from './pinned-sources';
import { sheetCatalog, type Artifact } from './rule-value-sheets';

export type ReleasedEntry = Artifact['catalog']['entries'][number];

/**
 * The committed selection's PCGen owners by the key the identity ledger
 * freezes for each selector's file and KEY (the lookup `pcgen-owners.ts`
 * makes).
 */
function pcgenOwners() {
  const ledger = parseIdentityLedger(ledgerData, {
    reservedKeys: allIncrementKeys(),
  });
  const owners = new Map<string, string>();
  for (const { externalKey, sources } of ledger.identities)
    for (const source of sources)
      if (source.source === 'pcgen')
        owners.set(locatorKeyOf(source), externalKey);
  const selectors = new Map<string, PcgenOwnerSelector>();
  for (const selector of pcgenOwnerSelection) {
    const owner = owners.get(
      foldUpstreamKey(`pcgen:${selector.file}#${selector.key}`),
    );
    if (owner !== undefined) selectors.set(owner, selector);
  }
  return selectors;
}

/** The store file of a Foundry key, found by its record's `_id`. */
async function foundryFile(key: string) {
  try {
    return await pinnedRecordFile(key);
  } catch {
    throw new Error(`The pinned store holds no record for ${key}.`);
  }
}

const folderLine = /^folder: *['"]?([\w-]+)['"]?\s*$/m;
const racialTraitPack = 'pf1-content/src/pf-racial-traits/';

/**
 * A Foundry record's store file and, for a racial trait, the folder records
 * it sits in up to its pack's top: the importer places a racial trait under
 * its race by them, and reads no other pack's folders for an entry.
 */
async function foundryFiles(key: string) {
  const repo = key.slice(0, key.indexOf('/'));
  const file = await foundryFile(key);
  const files = [file];
  if (!file.startsWith(racialTraitPack)) return files;
  for (let at = file; ; ) {
    const text = await readFile(`${pinnedStore}/${at}`, 'utf8');
    const folder = folderLine.exec(text)?.[1];
    if (folder === undefined || folder === 'null') return files;
    at = await foundryFile(`${repo}/${folder}`);
    files.push(at);
  }
}

/**
 * The store's PCGen owner input files and the Foundry files they name, for a
 * test that materialises them itself; tests read that list here, not from its
 * fixture directory.
 */
export { ownerEmissionFoundryFiles, pcgenOwnerEmissionFiles };

/**
 * The store files `importReleasedEntries` materialises for Foundry keys: each
 * key's record and, for a racial trait, its folder records. For a test that
 * imports those records itself, with import options the helper does not take
 * (pbl-reseed-generic: a remap of one of them).
 */
export async function releasedRecordFiles(keys: readonly string[]) {
  const files: string[] = [];
  for (const key of new Set(keys)) {
    if (!/^pf1(?:-content)?\//.test(key))
      throw new Error(`${key} is no Foundry key.`);
    files.push(...(await foundryFiles(key)));
  }
  return [...new Set(files)];
}

/**
 * The selector of a PCGen owner the store's PCGen owner inputs
 * (`pcgenOwnerEmissionFiles`) hold the file of.
 */
function pcgenSelector(
  owners: ReadonlyMap<string, PcgenOwnerSelector>,
  key: string,
) {
  const selector = owners.get(key);
  if (!selector)
    throw new Error(
      `${key} is no PCGen owner of the committed selection, so the pinned store holds no record for it.`,
    );
  if (!pcgenOwnerEmissionFiles.includes(selector.file))
    throw new Error(
      `The pinned store's PCGen owner inputs lack ${selector.file}, the file of ${key}.`,
    );
  return selector;
}

/** `importReleasedEntries`' options: its `context` keys (see there). */
type ReleasedImportOptions = { context?: readonly string[] };

/**
 * The store files of `importReleasedEntries`' context keys: each Foundry
 * record and, in the racial trait pack, its folders. It refuses a key that is
 * also named, and one the store holds no record for.
 */
async function contextFiles(
  options: ReleasedImportOptions | undefined,
  named: readonly string[],
) {
  const files: string[] = [];
  for (const key of new Set(options?.context ?? [])) {
    if (named.includes(key))
      throw new Error(`${key} is named both as an entry and as context.`);
    if (!/^pf1(?:-content)?\//.test(key))
      throw new Error(`The pinned store holds no record for ${key}.`);
    files.push(...(await foundryFiles(key)));
  }
  return files;
}

/**
 * Imports the named entries from the pinned store (`tests/fixtures/pinned`)
 * with the real importer, the committed remaps and the reviewed curation, and
 * hands back what it emits.
 *
 * - A `pf1/…` or `pf1-content/…` key brings its own store record, found by
 *   its `_id` (`pinnedRecordFile`), and, for a racial trait, the folder
 *   records it sits in; nothing else. An `everythingpath/…` key is a PCGen
 *   owner of the committed selection (`pcgenOwnerSelection`), by its frozen
 *   identity: it brings the PCGen owner inputs and the Foundry classes and
 *   class abilities they name (`owner-emission-files.ts`), and the import
 *   emits the owners asked for.
 * - The import reads only those files, so an entry's links, spell levels,
 *   race keys and other references resolve against everything materialised:
 *   the named keys' records, a racial trait's folders and, once any named key
 *   is a PCGen owner, the whole PCGen owner input set (its classes and class
 *   abilities among them, which `entries` then holds too). Name every key an
 *   assertion depends on. A reference whose target was not materialised is
 *   not reliably reported: depending on the reference it is kept as upstream
 *   gives it (a spell's class levels), emptied (a racial trait's race keys)
 *   or diagnosed (a spell's missing class). A test that needs a reference
 *   unresolved must not rely on leaving a key out of a list that names a
 *   PCGen owner.
 * - `entries` holds every entry the import emits, by key: each named key's,
 *   and what the importer emits with them (a class's schedule increments, a
 *   race's local rows, an owner's features, the PCGen inputs' Foundry rows).
 *   `sheetCatalog` gives them as the sheet resolver takes them, as
 *   `rule-value-sheets.ts` does (its kinds: classes, class features,
 *   archetypes, feats and Spell Effects).
 * - `artifact` is the import's whole artifact, as the importer returns it, for
 *   a test that reads what the import reports (`catalog.racialTraits`,
 *   `curation.missing`) as well as what it emits.
 * - `context` names Foundry records materialised for reference only, from
 *   which no entry is expected: a race folder that holds none of the named
 *   traits (such as "Lashunta", `pf1-content/AdTesmy8kKMUm2wL`). Each brings
 *   its store record and, in the racial trait pack, the folders it sits in.
 *   Without it nothing changes.
 * - It refuses an empty list, a key the store holds no record for, and a key
 *   the import does not emit, naming the key; and a context key the store
 *   holds no record for, or one that is also a named key, naming it. The tree
 *   it imports is removed however the import ends.
 */
export async function importReleasedEntries(
  keys: readonly string[],
  options?: ReleasedImportOptions,
) {
  if (keys.length === 0) throw new Error('Name at least one entry key.');
  const named = [...new Set(keys)];
  const owners = named.some((key) => key.startsWith('everythingpath/'))
    ? pcgenOwners()
    : new Map<string, PcgenOwnerSelector>();
  const files: string[] = [];
  const selection: PcgenOwnerSelector[] = [];
  for (const key of named) {
    if (/^pf1(?:-content)?\//.test(key))
      files.push(...(await foundryFiles(key)));
    else if (key.startsWith('everythingpath/'))
      selection.push(pcgenSelector(owners, key));
    else throw new Error(`The pinned store holds no record for ${key}.`);
  }
  files.push(...(await contextFiles(options, named)));
  if (selection.length > 0)
    files.push(
      ...ownerEmissionFoundryFiles,
      ...pcgenOwnerEmissionFiles.map(
        (path) => `pcgen/${pcgenPin.directory}/${path}`,
      ),
    );
  const remaps: unknown = JSON.parse(
    await readFile('scripts/catalog/reviewed-remaps.json', 'utf8'),
  );
  const tree = await materializePinnedTree([...new Set(files)]);
  let artifact: Artifact;
  try {
    artifact = await importCatalog({
      systemPath: tree.systemPath,
      contentPath: tree.contentPath,
      remaps,
      curation: reviewedCuration,
      ...(selection.length > 0 && {
        pcgen: { path: tree.pcgenPath, selection },
      }),
      wholeCorpus: false,
    });
  } finally {
    await tree.dispose();
  }
  const entries: ReadonlyMap<string, ReleasedEntry> = new Map(
    artifact.catalog.entries.map((entry) => [entry.externalKey, entry]),
  );
  const missing = named.filter((key) => !entries.has(key));
  if (missing.length > 0)
    throw new Error(
      `The import of the pinned store's records emits no entry for ${missing.join(', ')}.`,
    );
  return { entries, artifact, sheetCatalog: () => sheetCatalog(artifact) };
}

/** A release scope's import selection, as `openReleaseScope` gives it. */
export type ScopeSelection = {
  importKeys: readonly string[];
  pcgenKeys: readonly string[] | undefined;
};

/**
 * Every file under the store's Foundry pack directories and, with PCGen, its
 * PCGen data folder (`pcgenPin.directory`), as `materializePinnedTree` lists
 * them, sorted.
 */
async function wholeStoreFiles(pcgen: boolean) {
  const tops = [
    ...(['pf1', 'pf1-content'] as const).map(
      (repo) => `${repo}/${pins[repo].directory}`,
    ),
    ...(pcgen ? [`pcgen/${pcgenPin.directory}`] : []),
  ];
  const files: string[] = [];
  for (const top of tops) {
    const root = join(pinnedStore, top);
    for (const entry of await readdir(root, {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!entry.isFile()) continue;
      const path = relative(root, join(entry.parentPath, entry.name));
      if (path.includes(sep)) files.push(posix.join(top, ...path.split(sep)));
    }
  }
  return files.sort();
}

/**
 * Imports a release scope's selection from the whole pinned store as the
 * release operator imports it from the pinned checkouts
 * (`release-operator.ts`, `readBuildInputs`): every store file of the
 * Foundry packs (and, for a scope with PCGen rows, of the PCGen data folder)
 * is materialised, the scope's `importKeys` are the import's scope keys and
 * its `pcgenKeys` the PCGen scope keys, with the committed remaps and the
 * reviewed curation. A scope entry's references resolve against every store
 * record, so a record added to the store can change an entry that refers to
 * it; `catalog-digest-fidelity.test.ts` says whether the store holds what a
 * faithful import needs.
 *
 * It hands back every row the import emits, entries then resources (a
 * companion, a companion feature), as emitted: index them with
 * `emittedRowsByKey`, which refuses a repeated key. A selected key the import does not
 * emit is not refused: the operator's import over the pinned checkouts leaves
 * the same keys out (26 racial traits of campaign-mvp-v1 on 2026-11-26).
 */
export async function importReleasedScope(scope: ScopeSelection) {
  const pcgen = scope.pcgenKeys !== undefined;
  const remaps: unknown = JSON.parse(
    await readFile('scripts/catalog/reviewed-remaps.json', 'utf8'),
  );
  const tree = await materializePinnedTree(await wholeStoreFiles(pcgen));
  let artifact: Artifact;
  try {
    artifact = await importCatalog({
      systemPath: tree.systemPath,
      contentPath: tree.contentPath,
      remaps,
      curation: reviewedCuration,
      scopeKeys: [...scope.importKeys],
      ...(scope.pcgenKeys && {
        pcgen: { path: tree.pcgenPath, scopeKeys: scope.pcgenKeys },
      }),
      wholeCorpus: false,
    });
  } finally {
    await tree.dispose();
  }
  // A resource has an entry's shape.
  const rows: readonly ReleasedEntry[] = [
    ...artifact.catalog.entries,
    ...artifact.catalog.resources,
  ];
  return rows;
}

/**
 * Each key emitted more than once, as `<key> (<n> times)`, in key order: an
 * import emits each entry once, so a repeated key is a fault to report
 * before rows are indexed by key, which would keep only one of them.
 */
export function repeatedKeys(rows: readonly { externalKey: string }[]) {
  const counts = new Map<string, number>();
  for (const { externalKey } of rows)
    counts.set(externalKey, (counts.get(externalKey) ?? 0) + 1);
  return [...counts]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => `${key} (${count} times)`)
    .sort();
}

/**
 * The rows by key, once no key is repeated; otherwise it throws naming what
 * emitted them (`source`) and each repeated key with its count (the first
 * twenty, then how many more).
 */
export function emittedRowsByKey<Row extends { externalKey: string }>(
  rows: readonly Row[],
  source: string,
): ReadonlyMap<string, Row> {
  const repeated = repeatedKeys(rows);
  if (repeated.length > 0)
    throw new Error(
      `${source} emits ${repeated.length} key(s) more than once: ${repeated.slice(0, 20).join(', ')}${repeated.length > 20 ? `, and ${repeated.length - 20} more` : ''}`,
    );
  return new Map(rows.map((row) => [row.externalKey, row]));
}
