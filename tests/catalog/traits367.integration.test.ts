/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { expect, test } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import type { CatalogReleaseStatus } from '../../src/lib/catalog/release-validators';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedTraitDefinition } from '../fixtures/traits-367/sheet';
import { heldTraits } from '../fixtures/traits-367/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');

function local(scope: unknown) {
  if (typeof scope !== 'object' || scope === null || !('local' in scope))
    throw new Error('Expected a local Situation');
  return scope as { local: string };
}

test('isolated held trait selections preview the reviewed numbers, keep trait bonuses from stacking and enforce shared campaign access', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const) {
      await ctx.db.insert('user', {
        tokenIdentifier: `trait367|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed traits #367',
      description: '',
      organizationId: 'org',
      ownerId: 'trait367|owner',
      e2eFixture: {
        namespace: 'traits-367',
        version: 1,
        workerKey: '0',
        caseKey: 'reviewed',
        campaignKey: 'reviewed',
      },
    });
    const otherCampaignId = await ctx.db.insert('campaign', {
      name: 'Other isolated campaign',
      description: '',
      organizationId: 'org',
      ownerId: 'trait367|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'trait367|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'trait367|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'trait367|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed trait preview',
    kind: 'pc',
    operationId: 'create-traits-367',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'base-scores',
  });
  const watcher = reviewedTraitDefinition(
    'Goblin Watcher (Rise of the Runelords)',
  );
  const bastard = reviewedTraitDefinition('Bastard');
  const honor = reviewedTraitDefinition('Honor-Driven (Human; Ulfen)');
  const scarred = reviewedTraitDefinition('Scarred');
  for (const definition of [watcher, bastard, honor, scarred])
    expect(
      heldTraits.find((row) => row.externalKey === definition.ruleIdentity)
        ?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise the held bodies without a release.
  const ids = await t.run(async (ctx) => {
    const insert = (definition: typeof watcher) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      });
    return {
      watcher: await insert(watcher),
      bastard: await insert(bastard),
      honor: await insert(honor),
      scarred: await insert(scarred),
      foreign: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...watcher,
        stacksWithItself: false,
      }),
    };
  });
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: ids.watcher,
    operationId: 'select-watcher',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  expect([
    saved.calculated.breakdowns['skill.per'].total,
    saved.calculated.breakdowns['skill.apr'].total,
  ]).toEqual([1, 1]);
  // The treasure-hoard +5 replaces the +1: trait bonuses do not stack.
  const hoard = watcher.modifiers.find((row) => row.condition?.situation);
  expect(
    calculateCharacterSheetPreview(
      saved,
      {},
      {
        situations: [
          { ...local(hoard?.condition?.situation), sheetEntryId: first },
        ],
      },
    ).breakdowns['skill.apr'].total,
  ).toBe(5);
  const second = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 1,
    catalogEntryId: ids.bastard,
    operationId: 'select-bastard',
  });
  // Staged replacement equals the saved replacement: Honor-Driven for Goblin
  // Watcher, beside Bastard. Both give +1 trait on Sense Motive; they don't stack.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  expect(current.calculated.breakdowns['skill.sen'].total).toBe(1);
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === first ? { ...row, catalogEntryId: ids.honor } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: first,
    catalogEntryId: ids.honor,
    operationId: 'replace-with-honor',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!replaced) throw new Error('Missing replaced sheet');
  expect(staged.derivedStatistics).toEqual(
    replaced.calculated.derivedStatistics,
  );
  expect([
    replaced.calculated.breakdowns['skill.sen'].total,
    replaced.calculated.breakdowns['skill.per'].total,
    replaced.calculated.breakdowns['skill.apr'].total,
  ]).toEqual([1, 0, 0]);
  expect(replaced.entries.find((row) => row._id === second)).toMatchObject({
    catalogEntryId: ids.bastard,
  });
  // The drawback slot takes the drawback, whose penalties apply as written,
  // and adds one trait to the budget.
  await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: ids.scarred,
    operationId: 'select-scarred',
  });
  const scarredSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!scarredSheet) throw new Error('Missing drawback sheet');
  expect([
    scarredSheet.calculated.breakdowns['skill.dis'].total,
    scarredSheet.calculated.breakdowns['skill.blf'].total,
  ]).toEqual([-5, -2]);
  expect(scarredSheet.calculated.selectionRules.budgets.traits).toBe(3);
  expect(
    calculateCharacterSheetPreview(scarredSheet).derivedStatistics,
  ).toEqual(scarredSheet.calculated.derivedStatistics);
  await expect(
    member.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId: first,
      catalogEntryId: ids.foreign,
      operationId: 'foreign-entry',
    }),
  ).rejects.toThrow();
  await expect(
    member.query(api.characterSheet.read, {
      ...scope,
      campaignId: otherCampaignId,
    }),
  ).rejects.toThrow();
  for (const actor of [t, outsider]) {
    await expect(actor.query(api.characterSheet.read, scope)).rejects.toThrow();
    await expect(actor.query(api.catalogCopies.list, scope)).rejects.toThrow();
    await expect(
      actor.mutation(api.characterSheet.editSelection, {
        ...scope,
        entryId: first,
        active: false,
        operationId: 'denied-edit',
      }),
    ).rejects.toThrow();
  }
  expect(
    (await owner.query(api.characterSheet.read, scope))?.entries.find(
      (row) => row._id === first,
    ),
  ).toMatchObject({ active: true, catalogEntryId: ids.honor });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});

// The one release boundary for the trait and racial-trait batches (#367–#401):
// a held-only release through import, serialization, staging, finalization,
// fixture-only activation and legal readback. The other batches' copies swapped
// only the three held keys and were retired; their sheet tests stay.
// The in-test import and release build take a few seconds unloaded.
test('an isolated release of held traits roundtrips without publishing any held trait', async () => {
  const { materializePinnedTree } = await import('./pinned-sources');
  const { importCatalog } = await import('../../scripts/catalog/import');
  const { reviewedCuration } =
    await import('../../scripts/catalog/reviewed-curation-data');
  const { createCatalogRelease, serializeCatalogRelease } =
    await import('../../scripts/catalog/release');
  const { validateCatalogReleaseArtifact } =
    await import('../../src/lib/catalog/release-schema');
  const { catalogRuntimeCompatibility } =
    await import('../../src/lib/catalog/runtime-compatibility');
  const { releaseLegalInputsSchema } =
    await import('../../src/lib/catalog/release-legal-inputs');
  const { computeFingerprint } =
    await import('../../scripts/catalog/admission');
  const { reviewedAdmission, legalResources } =
    await import('../../src/lib/catalog/reviewed-data');
  const { default: remaps } =
    await import('../../scripts/catalog/reviewed-remaps.json');
  const controls = heldTraits.filter((row) =>
    ['Goblin Watcher (Rise of the Runelords)', 'Scarred', 'Bastard'].includes(
      row.name,
    ),
  );
  expect(controls).toHaveLength(3);
  const files = controls.map((row) => `${row.source.repo}/${row.source.path}`);
  const tree = await materializePinnedTree(files, {
    sha256: Object.fromEntries(
      controls.map((row) => [
        `${row.source.repo}/${row.source.path}`,
        row.source.sha256,
      ]),
    ),
  });
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: controls.map((row) => row.externalKey),
    });
    expect(artifact.curation.passed).toBe(true);
    const release = await createCatalogRelease({
      artifact,
      attribution: reviewedAdmission,
      legalResources,
      releaseNumber: 367,
      compatibility: catalogRuntimeCompatibility,
      inputValues: {
        remaps,
        curation: reviewedCuration,
        localData: [],
        parsers: 'isolated-traits-367-proof',
        sanitizers: 'isolated-traits-367-proof',
        ruleResources: [],
        upstreamVerification: { status: 'unverified' },
      },
    });
    const transported = await validateCatalogReleaseArtifact(
      JSON.parse(serializeCatalogRelease(release)),
    );
    expect(computeFingerprint(transported)).toBe(computeFingerprint(release));
    const rows = transported.batches.flat();
    for (const row of controls)
      expect(
        rows.some(
          (published) =>
            published.kind === 'definition' &&
            published.key === row.externalKey,
        ),
        row.name,
      ).toBe(false);
    const t = convexTest(schema, modules);
    const writeBatch = makeFunctionReference<
      'mutation',
      { releaseNumber: number; batchIndex: number; rows: unknown },
      CatalogReleaseStatus
    >('catalogRelease:writeBatch');
    await t.mutation(internal.catalogRelease.begin, {
      manifest: transported.manifest,
    });
    for (const [batchIndex, batch] of transported.batches.entries())
      await t.mutation(writeBatch, {
        releaseNumber: 367,
        batchIndex,
        rows: batch,
      });
    await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 367 });
    expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
    // This control exists only in convex-test's isolated database. No
    // deployment, production catalog or held body is published by the test.
    await t.run(async (ctx) => {
      const releaseId = (
        await ctx.db
          .query('catalogRelease')
          .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 367))
          .unique()
      )?._id;
      if (!releaseId) throw new Error('Missing isolated prepared release');
      await ctx.db.insert('catalogReleaseControl', {
        key: 'global',
        releaseNumber: 367,
        releaseId,
        schemaIdentity: catalogRuntimeCompatibility.schema,
        calculationIdentity: catalogRuntimeCompatibility.calculation,
        isFixtureOnly: true,
      });
    });
    const legal = releaseLegalInputsSchema.parse(
      await t.query(api.catalogRelease.legalInputs, {}),
    );
    // No held trait's notices become required by a release that admits none.
    for (const row of controls)
      for (const code of row.requiredNotices.filter(
        (code) => code !== 'PZO1110',
      ))
        expect(legal.requiredNotices, `${row.name} ${code}`).not.toContain(
          code,
        );
    expect(computeFingerprint(legal.registry)).toBe(
      computeFingerprint(reviewedAdmission.registry),
    );
    expect(computeFingerprint(legal.resources)).toBe(
      computeFingerprint(legalResources),
    );
  } finally {
    await tree.dispose();
  }
}, 90_000);
