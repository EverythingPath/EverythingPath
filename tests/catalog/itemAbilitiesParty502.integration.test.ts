/// <reference types="vite/client" />
// @vitest-environment edge-runtime
// The stored candidate adapter on the pinned Bane and Flaming bodies: without
// their curation records (the base) it refuses both, because the stored
// Item Ability needs bonusEquivalent; with them it accepts both
// (docs/catalog-import/item-abilities-party-502.md).
import { expect, test } from 'vitest';
import { candidateDefinition } from '../../convex/lib/catalogCandidateDefinition';
import type { CurationData } from '../../scripts/catalog/curation';
import type {
  ReleaseJson,
  ReleaseRow,
} from '../../src/lib/catalog/release-schema';
import { prepare, releaseFixture } from '../catalog-release-fixture';

const modules = import.meta.glob('../../convex/**/*.ts');
const BANE = 'pf1-content/aaAmYJA3sBANIVeZ';
const FLAMING = 'pf1-content/bcWTxWA8Yi0V3FGZ';
const DIR = 'pf1-content/src/pf-special-qualities';

/** The pinned bodies, imported with the given overlay (none: the base). */
async function importedAbilities(curated: boolean) {
  const { materializePinnedTree } = await import('./pinned-sources');
  const { importCatalog } = await import('../../scripts/catalog/import');
  const { reviewedCuration } =
    await import('../../scripts/catalog/reviewed-curation-data');
  const { default: remaps } =
    await import('../../scripts/catalog/reviewed-remaps.json');
  const curation: CurationData = curated
    ? reviewedCuration
    : { situations: reviewedCuration.situations, records: [] };
  const tree = await materializePinnedTree([
    `${DIR}/Bane_aaAmYJA3sBANIVeZ.yaml`,
    `${DIR}/Flaming_bcWTxWA8Yi0V3FGZ.yaml`,
    `${DIR}/_Weapon_Enchant_Conditional_Modifiers_upTvrmZoeKq2LI0F.yaml`,
  ]);
  try {
    const { catalog } = await importCatalog({
      ...tree,
      remaps,
      curation,
      candidateKeys: [BANE, FLAMING],
    });
    return [BANE, FLAMING].map((key) => {
      const row = catalog.entries.find((entry) => entry.externalKey === key);
      if (!row) throw new Error(`Missing ${key}`);
      return row;
    });
  } finally {
    await tree.dispose();
  }
}

/** Each body through the candidate adapter, as reconcile discovery does. */
async function adapt(curated: boolean) {
  const entries = await importedAbilities(curated);
  const { t } = await releaseFixture(modules);
  const ids = await t.run(async (ctx) =>
    Promise.all(
      entries.map((entry) =>
        ctx.db.insert('catalogEntry', {
          scope: 'global',
          name: entry.name,
          ruleIdentity: entry.externalKey,
          stacksWithItself: false,
          sources: [],
          modifiers: [],
          detail: {
            kind: 'itemAbility',
            appliesTo: 'weapon',
            bonusEquivalent: 0,
          },
        }),
      ),
    ),
  );
  const rows: ReleaseRow[] = entries.map((entry) => ({
    kind: 'definition',
    key: entry.externalKey,
    payload: JSON.parse(JSON.stringify(entry)) as ReleaseJson,
  }));
  await prepare(t, rows);
  return t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    if (!release) throw new Error('Missing release');
    return Promise.all(
      ids.map(async (id) => {
        const stored = await ctx.db.get('catalogEntry', id);
        if (!stored) throw new Error('Missing stored entry');
        try {
          return await candidateDefinition(ctx, release, stored);
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      }),
    );
  });
}

test('the adapter refuses the uncurated bodies, as at the base', async () => {
  expect(await adapt(false)).toEqual([
    expect.stringContaining(
      `Candidate definition ${BANE} is not supported by the prepared sheet resolver`,
    ),
    expect.stringContaining(
      `Candidate definition ${FLAMING} is not supported by the prepared sheet resolver`,
    ),
  ]);
}, 90_000);

test('the adapter accepts the curated bodies with their stored Item Ability detail', async () => {
  const [bane, flaming] = await adapt(true);
  expect(bane).toMatchObject({
    ruleIdentity: BANE,
    name: 'Bane',
    modifiers: [],
    detail: {
      kind: 'itemAbility',
      appliesTo: 'weapon',
      bonusEquivalent: 1,
      choice: 'creatureType',
      foeEnhancement: 2,
    },
    situationalNotes: [
      {
        target: 'damage',
        text: 'Against a designated foe, the weapon also deals an extra 2d6 points of damage.',
      },
    ],
  });
  expect(flaming).toMatchObject({
    ruleIdentity: FLAMING,
    name: 'Flaming',
    modifiers: [],
    detail: {
      kind: 'itemAbility',
      appliesTo: 'weapon',
      bonusEquivalent: 1,
      damageDice: [{ on: 'hit', dice: '1d6', damageType: 'fire' }],
    },
    situationalNotes: [{ text: 'The fire does not harm the wielder.' }],
  });
}, 90_000);
