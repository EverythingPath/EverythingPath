// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { importCatalog } from '../../scripts/catalog/import';
import { parsePartyExceptions } from '../../scripts/catalog/party/party-exceptions';
import { resolvePartyReleaseScope } from '../../scripts/catalog/party/party-release-scope';
import { readReleaseScope } from '../../scripts/catalog/release-scope';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import {
  armorCategory,
  isBuckler,
} from '../../src/lib/character-sheet-armor-categories';
import { materializePinnedTree, pinnedRecordFile } from './pinned-sources';

const BUCKLER = 'pf1/gsE0PAOmCwivue5A';
const DARKWOOD_BUCKLER = 'pf1-content/NDgNFqGEuMsSQmcg';
const scopes = 'scripts/catalog/scopes';

type LaunchRow = Awaited<
  ReturnType<typeof readReleaseScope>
>['manifest']['rows'][number];

/** A launch row's one Foundry source, as a store file with its recorded digest. */
function launchSourceFile(row: LaunchRow) {
  const [source, ...rest] = row.sources.flatMap((binding) =>
    binding.repository === 'pf1' || binding.repository === 'pf1-content'
      ? [binding]
      : [],
  );
  if (!source || rest.length) throw new Error(`${row.key}: one source`);
  return {
    file: `${source.repository}/${source.locator}`,
    ...(source.rawSha256 ? { sha256: source.rawSha256 } : {}),
  };
}

async function readPartyScope() {
  const read = (path: string) => readFile(path, 'utf8');
  return resolvePartyReleaseScope({
    text: await read(`${scopes}/campaign-party-v1.json`),
    buildsBytes: await read('scripts/catalog/party/party-builds.json'),
    exceptions: parsePartyExceptions(
      JSON.parse(await read('scripts/catalog/party/party-exceptions.json')),
    ),
  });
}

/**
 * Every item row of both release scopes, as their readers yield them, with
 * the pinned upstream file it imports from: campaign-mvp-v1's rows name their
 * source; the party scope's rows name only their key, so a row the launch
 * scope lacks is found in the store by its Foundry id. No row is left out,
 * not even a launch row outside the scope's import set.
 */
async function releaseScopeItems() {
  const launch = await readReleaseScope({ version: 'campaign-mvp-v1' });
  const party = await readPartyScope();
  const files = new Map<string, { file: string; sha256?: string }>();
  for (const row of launch.manifest.rows)
    if (row.kind === 'item') files.set(row.key, launchSourceFile(row));
  const outsideImportSet = [...files.keys()].filter(
    (key) => !launch.importKeys.includes(key),
  );
  const partyOnly: string[] = [];
  for (const row of party.scope.rows)
    if (row.kind === 'item' && !files.has(row.key)) {
      partyOnly.push(row.key);
      files.set(row.key, { file: await pinnedRecordFile(row.key) });
    }
  return { files, partyOnly, outsideImportSet };
}

// The launch item rows outside campaign-mvp-v1's import set: two of the
// generic natural attacks the mapper admits from monster-abilities, which
// import and are decided, and one it excludes (scripts/catalog/map.ts).
const CLAW = 'pf1/MZnbCVzqpvPsMvfT';
const BITE = 'pf1/szjeStouwI3F3WdP';
const FREEZE = 'pf1/P3r81I2PlyyDXkzL';
/** Item rows the importer emits no entry for, each with its reason. */
const excludedByMapper: Record<string, string> = {
  [FREEZE]:
    'Only the 12 generic natural attacks and unarmed strike are admitted from monster-abilities.',
};

it(
  'of every item row in both release scopes, as imported, the sheet decides only the Buckler is a buckler; the Darkwood Buckler is not, since its pinned description calls it a light wooden shield (root, parked for the owner)',
  { timeout: 300_000 },
  async () => {
    const { files, partyOnly, outsideImportSet } = await releaseScopeItems();
    expect(outsideImportSet.sort()).toEqual([CLAW, FREEZE, BITE].sort());
    const listed = [...files.values()];
    const tree = await materializePinnedTree(
      listed.map(({ file }) => file),
      {
        sha256: Object.fromEntries(
          listed.flatMap(({ file, sha256 }) =>
            sha256 ? [[file, sha256]] : [],
          ),
        ),
      },
    );
    try {
      const { catalog, comparison } = await importCatalog({
        ...tree,
        remaps,
        wholeCorpus: false,
      });
      const imported = new Map(
        catalog.entries.map((entry) => [entry.externalKey, entry]),
      );
      // Every imported item row is decided, so a shield whose import carries
      // no armor block (the Mithral Heavy Shield, the Darkwood Shield) is
      // covered too; a row with no entry must be a listed exclusion.
      const decisions = new Map<string, boolean>();
      const excluded: string[] = [];
      const shields: string[] = [];
      for (const key of files.keys()) {
        const entry = imported.get(key);
        if (!entry) {
          excluded.push(key);
          continue;
        }
        if (entry.detail.kind !== 'item')
          throw new Error(`${key} did not import as an item`);
        const { armor } = entry.detail;
        if (armor?.slot === 'shield') shields.push(key);
        decisions.set(
          key,
          isBuckler({
            ruleIdentity: entry.externalKey,
            detail: {
              kind: 'item',
              ...(armor && {
                armor: {
                  slot: armor.slot === 'shield' ? 'shield' : 'armor',
                  category: armorCategory(armor.category),
                  armorCheckPenalty: armor.armorCheckPenalty,
                },
              }),
            },
          }),
        );
      }
      expect(excluded).toEqual(Object.keys(excludedByMapper));
      for (const key of excluded)
        expect(
          comparison.records.find((row) => row.externalKey === key),
          key,
        ).toMatchObject({ status: 'excluded', reason: excludedByMapper[key] });
      expect(decisions.has(CLAW) && decisions.has(BITE)).toBe(true);
      expect(partyOnly.length).toBeGreaterThan(0);
      expect(partyOnly.every((key) => decisions.has(key))).toBe(true);
      expect(shields).toContain(BUCKLER);
      expect(shields).toContain(DARKWOOD_BUCKLER);
      expect(shields.length).toBeGreaterThan(2);
      expect(
        [...decisions].filter(([, buckler]) => buckler).map(([key]) => key),
      ).toEqual([BUCKLER]);
      // Required in campaign-mvp-v1; imported with an empty category.
      expect(decisions.get(DARKWOOD_BUCKLER)).toBe(false);
    } finally {
      await tree.dispose();
    }
  },
);
