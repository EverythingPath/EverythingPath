// @vitest-environment node
// A gate-host audit (scripts/orchestration/host-audits.json), pbl-catalog-digest
// (PRD #251). For each committed release scope, every entry that the store
// import of its selection (`importReleasedScope`, which the catalog digest
// hashes) emits equals the entry the release operator's scoped import emits
// from the pinned checkouts, key for key, with no allowlist: the raw rows
// are compared structurally as `toStrictEqual` compares them (a property
// undefined on one side and absent on the other differs), and either import
// emitting a key more than once fails it, naming the key, before rows are
// indexed by key. The operator's
// import is `readBuildInputs`' `importCatalog` call in `release-operator.ts`
// with its default remaps and curation and the scope's keys. It is what says
// whether the store holds every record a faithful import of each scope needs:
// a scope entry's references resolve against whatever records are present.
// Only remote CI, which has no pinned checkouts, skips it, saying so; on the
// gate host a checkout that is missing, dirty or at another pin fails it.
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  attribution227Checkouts,
  attribution227PinnedCheckouts,
  isRemoteCi,
} from '../../scripts/catalog/attribution-227-generation';
import { importCatalog } from '../../scripts/catalog/import';
import { pcgenDataPath } from '../../scripts/catalog/operator';
import { verifiedPinnedCatalogCheckouts } from '../../scripts/catalog/pinned-import';
import { pinnedCheckoutProblem } from '../../scripts/catalog/pinned-checkouts';
import {
  openReleaseScope,
  type OperatorScope,
} from '../../scripts/catalog/release-scopes';
import { digestScopes } from './catalog-digest';
import {
  emittedRowsByKey,
  importReleasedEntries,
  importReleasedScope,
} from './released-entries';

const problems = attribution227PinnedCheckouts.flatMap(
  (checkout) => pinnedCheckoutProblem(checkout) ?? [],
);
const skip = problems.length > 0 && isRemoteCi(process.env);
if (skip)
  process.stdout.write(
    `skipped: no pinned checkouts (remote CI): ${problems.join('; ')}\n`,
  );

const readJson = async (name: string): Promise<unknown> =>
  JSON.parse(await readFile(`scripts/catalog/${name}`, 'utf8'));

/** The operator's scoped import of a scope from the verified pinned checkouts, every row as emitted. */
async function operatorRows(scope: OperatorScope) {
  const { system, content } = attribution227Checkouts;
  const pcgen = scope.pcgenKeys ? attribution227Checkouts.pcgen : undefined;
  const { verification } = await verifiedPinnedCatalogCheckouts({
    system,
    content,
    pcgen,
  });
  const artifact = await importCatalog({
    systemPath: system,
    contentPath: content,
    remaps: await readJson('reviewed-remaps.json'),
    curation: await readJson('reviewed-curation.json'),
    scopeKeys: scope.importKeys,
    ...(pcgen && {
      pcgen: { path: pcgenDataPath(pcgen), scopeKeys: scope.pcgenKeys },
    }),
    wholeCorpus: verification.status === 'verified',
  });
  return [...artifact.catalog.entries, ...artifact.catalog.resources];
}

type Row = { externalKey: string };

/**
 * Each key whose rows are not structurally equal, with the top-level
 * properties that differ (`-` for a row only one import emits). It indexes
 * each import with `emittedRowsByKey`, so a repeated key throws first.
 */
function fidelityDifferences(
  storeRows: readonly Row[],
  operatorRows: readonly Row[],
) {
  const store = emittedRowsByKey(storeRows, 'The store import');
  const operator = emittedRowsByKey(operatorRows, 'The operator’s import');
  const keys = [...new Set([...store.keys(), ...operator.keys()])].sort();
  return keys.flatMap((key) => {
    const ours = store.get(key) as Record<string, unknown> | undefined;
    const theirs = operator.get(key) as Record<string, unknown> | undefined;
    if (!ours || !theirs) return [`${key}: -`];
    if (isDeepStrictEqual(ours, theirs)) return [];
    const properties = [
      ...new Set([...Object.keys(ours), ...Object.keys(theirs)]),
    ].filter(
      (property) =>
        Object.hasOwn(ours, property) !== Object.hasOwn(theirs, property) ||
        !isDeepStrictEqual(ours[property], theirs[property]),
    );
    return [`${key}: ${properties.sort().join(', ') || '(prototype)'}`];
  });
}

describe('the fidelity comparison', () => {
  // Lightning Reflexes (Core Rulebook p. 130), one real emitted entry.
  const key = 'pf1/0bZf3SDkvVOe2ujH';
  const entry = async () => {
    const found = (await importReleasedEntries([key])).entries.get(key);
    if (!found) throw new Error(`No entry ${key}.`);
    return found;
  };

  it('fails when the operator’s import emits a key twice, naming the key and its count', async () => {
    const row = await entry();
    expect(() => fidelityDifferences([row], [row, row])).toThrow(
      `The operator’s import emits 1 key(s) more than once: ${key} (2 times)`,
    );
  });

  it('fails when the store import emits a key twice, naming the key and its count', async () => {
    const row = await entry();
    expect(() => fidelityDifferences([row, row, row], [row])).toThrow(
      `The store import emits 1 key(s) more than once: ${key} (3 times)`,
    );
  });

  it('tells a property undefined on one side from one absent on the other', async () => {
    const row = await entry();
    // Lightning Reflexes has no prerequisites; its row has no such property.
    expect(Object.hasOwn(row, 'prerequisites')).toBe(false);
    const undefinedPrerequisites = { ...row, prerequisites: undefined };
    expect(fidelityDifferences([row], [{ ...row }])).toEqual([]);
    expect(fidelityDifferences([undefinedPrerequisites], [row])).toEqual([
      `${key}: prerequisites`,
    ]);
  });
});

describe('the store import of each committed scope against the release operator’s scoped import', () => {
  for (const version of digestScopes)
    it.skipIf(skip)(
      `emits every ${version} entry as the operator’s import from the pinned checkouts emits it`,
      async () => {
        if (problems.length > 0)
          throw new Error(
            `the catalog digest's fidelity audit cannot run on the gate host, where it is required: ${problems.join('; ')}`,
          );
        const scope = await openReleaseScope({ version });
        const store = await importReleasedScope(scope);
        const operator = await operatorRows(scope);
        expect(store.length).toBeGreaterThan(0);
        expect(fidelityDifferences(store, operator)).toEqual([]);
      },
      600_000,
    );
});
