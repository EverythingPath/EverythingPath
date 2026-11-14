/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { candidateDefinition } from '../../convex/lib/catalogCandidateDefinition';
import { combinedFormEntries } from '../../src/lib/character-sheet-combined-form';
import type {
  ReleaseJson,
  ReleaseRow,
} from '../../src/lib/catalog/release-schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import {
  activationArgs,
  prepare,
  reconcile,
  releaseFixture,
  type ReleaseTest,
} from '../catalog-release-fixture';

const modules = import.meta.glob('../../convex/**/*.ts');
const ENTERTAINERS_OUTFIT = 'pf1/6kZGQ2chmr3jpS1t';
const LEATHER = 'pf1/6YCQkebsf4vR508H';
const BRACERS = 'pf1/7r3OittOtOxLNlKS';

/** Fresh uncurated imports of the pinned outfit, bracers and leather. */
async function importedItems() {
  const { materializePinnedTree } = await import('./pinned-sources');
  const { importCatalog } = await import('../../scripts/catalog/import');
  const { default: remaps } =
    await import('../../scripts/catalog/reviewed-remaps.json');
  const tree = await materializePinnedTree([
    'pf1/packs/items/entertainer-s-outfit.6kZGQ2chmr3jpS1t.yaml',
    'pf1/packs/items/bracers-of-armor-4.7r3OittOtOxLNlKS.yaml',
    'pf1/packs/armors-and-shields/leather-armor.6YCQkebsf4vR508H.yaml',
  ]);
  try {
    const { catalog } = await importCatalog({ ...tree, remaps });
    const entry = (key: string) => {
      const row = catalog.entries.find((row) => row.externalKey === key);
      if (!row) throw new Error(`Missing ${key}`);
      return row;
    };
    return {
      outfit: entry(ENTERTAINERS_OUTFIT),
      bracers: entry(BRACERS),
      leather: entry(LEATHER),
    };
  } finally {
    await tree.dispose();
  }
}

/** An imported entry as a release row's JSON payload. */
const releasePayload = (entry: unknown) =>
  JSON.parse(JSON.stringify(entry)) as ReleaseJson;

/** A stored global item, which the release's definition row replaces. */
function installItem(t: ReleaseTest, ruleIdentity: string) {
  return t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: ruleIdentity,
      ruleIdentity,
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'item', consumable: false },
    }),
  );
}

test('released pinned clothing, bracers and enchanted leather retain their shape and effective saved AC (#762)', async () => {
  const { outfit, bracers, leather } = await importedItems();
  const { t, owner, scope } = await releaseFixture(modules);
  const ids = new Map<string, Id<'catalogEntry'>>();
  for (const key of [ENTERTAINERS_OUTFIT, BRACERS, LEATHER])
    ids.set(key, await installItem(t, key));
  // Both worn, as the impact run finds them: active item entries.
  for (const key of [ENTERTAINERS_OUTFIT, BRACERS, LEATHER])
    await t.run((ctx) =>
      ctx.db.insert('characterSheetEntry', {
        characterId: scope.characterId,
        catalogEntryId: ids.get(key)!,
        kind: 'item',
        active: true,
        state: { kind: 'item' },
      }),
    );
  const rows: ReleaseRow[] = [outfit, bracers, leather].map((payload) => ({
    kind: 'definition',
    key: payload.externalKey,
    payload: releasePayload(payload),
  }));
  await prepare(t, rows);
  // Reconciling evaluates the sheet through catalogCandidateDefinition.ts.
  const runId = await reconcile(t, scope.characterId);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  const definition = (key: string) =>
    saved.catalogEntries.find((row) => row._id === ids.get(key));
  // The released definitions, as stored: no armor block on either item.
  expect(definition(ENTERTAINERS_OUTFIT)).toMatchObject({
    name: "Entertainer's outfit",
    detail: { kind: 'item', price: 3, weight: 4 },
    modifiers: [],
  });
  expect(definition(ENTERTAINERS_OUTFIT)?.detail).not.toHaveProperty('armor');
  expect(definition(BRACERS)?.detail).not.toHaveProperty('armor');
  // Neutral base abilities, mundane leather2 and bracers4 (CRB pp.151,504).
  expect(
    Object.values(saved.calculated.abilities).map((ability) => ability.score),
  ).toEqual([10, 10, 10, 10, 10, 10]);
  expect(saved.calculated.breakdowns['ac.armor'].total).toBe(4);
  expect(saved.calculated.derivedStatistics.ac.total).toBe(14);
  const leatherRow = saved.entries.find(
    (row) => row.kind === 'item' && row.catalogEntryId === ids.get(LEATHER),
  );
  const bracersRow = saved.entries.find(
    (row) => row.kind === 'item' && row.catalogEntryId === ids.get(BRACERS),
  );
  if (!leatherRow || !bracersRow) throw new Error('Missing equipment');
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|member',
      orgIds: [{ orgId: 'org', role: 'member' }],
    }),
  );
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  await owner.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: leatherRow._id,
    enhancement: 1,
    operationId: 'leather-one',
  });
  for (const reader of [owner, member]) {
    const shared = withSheetCatalog(
      await reader.query(api.characterSheet.read, scope),
    );
    expect(
      shared?.entries.find((row) => row._id === leatherRow._id)?.state,
    ).toMatchObject({ enhancement: 1 });
    expect(shared?.calculated.breakdowns['ac.armor'].total).toBe(4);
    expect(shared?.calculated.derivedStatistics.ac.total).toBe(14);
  }
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: bracersRow._id,
    active: false,
    operationId: 'bracers-off',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated.breakdowns[
      'ac.armor'
    ].total,
  ).toBe(3);
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: bracersRow._id,
    active: true,
    operationId: 'bracers-on',
  });
  await member.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: leatherRow._id,
    enhancement: 3,
    operationId: 'leather-three',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated.breakdowns[
      'ac.armor'
    ].total,
  ).toBe(5);
  // Neither outfit nor bracers is worn armor: fused form keeps both, but not leather.
  expect(combinedFormEntries(saved.entries, saved.catalogEntries)).toEqual(
    saved.entries.filter(
      (row) =>
        !('catalogEntryId' in row) || row.catalogEntryId !== ids.get(LEATHER),
    ),
  );
}, 60_000);

test('the release candidate path refuses the outfit’s former empty-category armor block', async () => {
  const { outfit } = await importedItems();
  const { t } = await releaseFixture(modules);
  const id = await installItem(t, ENTERTAINERS_OUTFIT);
  // The shape the importer gave clothing before #762.
  const former = {
    ...outfit,
    detail: {
      ...outfit.detail,
      armor: {
        slot: 'armor',
        category: '',
        bonus: 0,
        maxDex: null,
        armorCheckPenalty: 0,
        asf: 0,
      },
    },
  };
  await prepare(t, [
    {
      kind: 'definition',
      key: ENTERTAINERS_OUTFIT,
      payload: releasePayload(former),
    },
  ]);
  await expect(
    t.run(async (ctx) => {
      const release = await ctx.db
        .query('catalogRelease')
        .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
        .unique();
      const stored = await ctx.db.get('catalogEntry', id);
      if (!release || !stored) throw new Error('Missing release or entry');
      return candidateDefinition(ctx, release, stored);
    }),
  ).rejects.toThrow('not supported by the prepared sheet resolver');
}, 60_000);
