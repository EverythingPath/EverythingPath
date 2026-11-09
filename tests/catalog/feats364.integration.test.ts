/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { expect, test } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import type { CatalogReleaseStatus } from '../../src/lib/catalog/release-validators';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedFeatDefinition } from '../fixtures/feats-364/sheet';
import { review } from '../fixtures/feats-364/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');

function local(scope: unknown) {
  if (typeof scope !== 'object' || scope === null || !('local' in scope))
    throw new Error('Expected a local Situation');
  return scope as { local: string };
}

test('isolated admitted and held-body selections preview the reviewed numbers and enforce shared campaign access', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const) {
      await ctx.db.insert('user', {
        tokenIdentifier: `feat364|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed feats #364',
      description: '',
      organizationId: 'org',
      ownerId: 'feat364|owner',
      e2eFixture: {
        namespace: 'feats-364',
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
      ownerId: 'feat364|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'feat364|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'feat364|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'feat364|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed feat preview',
    kind: 'pc',
    operationId: 'create-feats-364',
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
  const device = reviewedFeatDefinition('Skill Focus (Escape Artist)');
  const scars = reviewedFeatDefinition('Nightmare Scars');
  const rage = reviewedFeatDefinition('Sympathetic Rage');
  for (const [definition, disposition] of [
    [device, 'admitted'],
    [scars, 'held'],
    [rage, 'held'],
  ] as const)
    expect(
      review.candidates.find(
        (row) => row.externalKey === definition.ruleIdentity,
      )?.disposition,
    ).toBe(disposition);
  // Character-scoped fixtures exercise the bodies without a global release.
  const { deviceId, copyId, scarsId, rageId, foreignId } = await t.run(
    async (ctx) => ({
      deviceId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...device,
        stacksWithItself: false,
      }),
      copyId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...device,
        name: 'Skill Focus (Escape Artist) Catalog Copy',
        stacksWithItself: false,
      }),
      scarsId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...scars,
        stacksWithItself: false,
      }),
      rageId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...rage,
        stacksWithItself: false,
      }),
      foreignId: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...device,
        stacksWithItself: false,
      }),
    }),
  );
  const selectedId = await member.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: deviceId,
      operationId: 'select-device',
    },
  );
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  // #724: no ranks and the skill's ability at 10, so Skill Focus adds +3
  // with nothing selected.
  expect(saved.calculated.breakdowns['skill.esc'].total).toBe(3);
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  expect(device.modifiers).toEqual([
    {
      target: 'skill.esc',
      bonusType: 'untyped',
      value: { formula: '3 + 3 * min(1, floor(@skillRanks.esc / 10))' },
    },
  ]);
  expect(
    calculateCharacterSheetPreview(saved).breakdowns['skill.esc'].total,
  ).toBe(3);
  expect(
    (await member.query(api.catalogCopies.list, scope)).find(
      (row) => row._id === deviceId,
    ),
  ).toMatchObject(device);
  // A second copy of the same Rule Identity does not stack with the first.
  const secondId = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: copyId,
    operationId: 'select-copy',
  });
  const doubled = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!doubled) throw new Error('Missing copied selection');
  expect(doubled.calculated.breakdowns['skill.esc'].total).toBe(3);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: secondId,
    active: false,
    operationId: 'disable-copy',
  });
  // Staged replacement equals the saved replacement: Nightmare Scars.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === selectedId ? { ...row, catalogEntryId: scarsId } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    catalogEntryId: scarsId,
    operationId: 'replace-with-scars',
  });
  const scarred = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!scarred) throw new Error('Missing Nightmare Scars selection');
  expect(staged.derivedStatistics).toEqual(
    scarred.calculated.derivedStatistics,
  );
  // The Intimidate bonus is unconditional; the attitude bonus and penalty
  // apply only under their exclusive Situations.
  expect(scarred.calculated.breakdowns['skill.int'].total).toBe(2);
  expect(scarred.calculated.breakdowns['skill.dip'].total).toBe(0);
  expect(scarred.calculated.breakdowns['skill.esc'].total).toBe(0);
  const favored = local(scars.modifiers[0]?.condition?.situation);
  const disfavored = local(scars.modifiers[2]?.condition?.situation);
  const kin = calculateCharacterSheetPreview(
    scarred,
    {},
    { situations: [{ ...favored, sheetEntryId: selectedId }] },
  ).breakdowns;
  expect([kin['skill.dip'].total, kin['skill.han'].total]).toEqual([2, 2]);
  const strangers = calculateCharacterSheetPreview(
    scarred,
    {},
    { situations: [{ ...disfavored, sheetEntryId: selectedId }] },
  ).breakdowns;
  expect([strangers['skill.dip'].total, strangers['skill.han'].total]).toEqual([
    -2, -2,
  ]);
  // A held body's morale bonuses apply only under its rage Situation.
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    catalogEntryId: rageId,
    operationId: 'replace-with-rage',
  });
  const raging = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!raging) throw new Error('Missing Sympathetic Rage selection');
  expect(raging.calculated.breakdowns['ability.str'].total).toBe(10);
  expect(raging.calculated.breakdowns['save.will'].total).toBe(0);
  const rageScope = local(rage.modifiers[0]?.condition?.situation);
  const enraged = calculateCharacterSheetPreview(
    raging,
    {},
    { situations: [{ ...rageScope, sheetEntryId: selectedId }] },
  ).breakdowns;
  expect([
    enraged['ability.str'].total,
    enraged['ability.con'].total,
    enraged['save.will'].total,
  ]).toEqual([12, 12, 2]);
  await expect(
    member.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId: selectedId,
      catalogEntryId: foreignId,
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
        entryId: selectedId,
        active: false,
        operationId: 'denied-edit',
      }),
    ).rejects.toThrow();
  }
  expect(
    (await owner.query(api.characterSheet.read, scope))?.entries.find(
      (row) => row._id === selectedId,
    ),
  ).toMatchObject({ active: true, catalogEntryId: rageId });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});

// The in-test import and release build take about 8 s unloaded.
test('an isolated three-admission release roundtrips and serves complete public legal inputs', async () => {
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
  const { buildLegalPageData } =
    await import('../../src/lib/catalog/legal-page-data');
  const { computeFingerprint } =
    await import('../../scripts/catalog/admission');
  const { reviewedAdmission, legalResources } =
    await import('../../src/lib/catalog/reviewed-data');
  const { default: remaps } =
    await import('../../scripts/catalog/reviewed-remaps.json');
  const admitted = review.candidates.filter(
    (row) => row.disposition === 'admitted',
  );
  expect(admitted.map((row) => [row.name, row.disposition])).toEqual([
    ['Skill Focus (Escape Artist)', 'admitted'],
    ['Skill Focus (Appraise)', 'admitted'],
    ['Skill Focus (Knowledge [Religion])', 'admitted'],
  ]);
  const held = review.candidates.find((row) => row.name === 'Nightmare Scars');
  if (!held) throw new Error('Missing held control');
  const files = [...admitted, held].map(
    (row) => `${row.source.repo}/${row.source.path}`,
  );
  const tree = await materializePinnedTree(files, {
    sha256: Object.fromEntries(
      [...admitted, held].map((row) => [
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
      candidateKeys: [...admitted, held].map((row) => row.externalKey),
    });
    const build = (attribution: typeof reviewedAdmission) =>
      createCatalogRelease({
        artifact,
        attribution,
        legalResources,
        releaseNumber: 364,
        compatibility: catalogRuntimeCompatibility,
        inputValues: {
          remaps,
          curation: reviewedCuration,
          localData: [],
          parsers: 'isolated-feats-364-proof',
          sanitizers: 'isolated-feats-364-proof',
          ruleResources: [],
          upstreamVerification: { status: 'unverified' },
        },
      });
    const release = await build(reviewedAdmission);
    const transported = await validateCatalogReleaseArtifact(
      JSON.parse(serializeCatalogRelease(release)),
    );
    expect(computeFingerprint(transported)).toBe(computeFingerprint(release));
    const rows = transported.batches.flat();
    expect(
      rows
        .filter((row) => row.kind === 'definition')
        .map((row) => row.key)
        .sort(),
    ).toEqual(admitted.map((row) => row.externalKey).sort());
    expect(
      rows.some(
        (row) => row.kind === 'definition' && row.key === held.externalKey,
      ),
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
        releaseNumber: 364,
        batchIndex,
        rows: batch,
      });
    await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 364 });
    expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
    // This control exists only in convex-test's isolated database. No
    // deployment, production catalog or held body is published by the test.
    await t.run(async (ctx) => {
      const releaseId = (
        await ctx.db
          .query('catalogRelease')
          .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 364))
          .unique()
      )?._id;
      if (!releaseId) throw new Error('Missing isolated prepared release');
      await ctx.db.insert('catalogReleaseControl', {
        key: 'global',
        releaseNumber: 364,
        releaseId,
        schemaIdentity: catalogRuntimeCompatibility.schema,
        calculationIdentity: catalogRuntimeCompatibility.calculation,
        isFixtureOnly: true,
      });
    });
    const legal = releaseLegalInputsSchema.parse(
      await t.query(api.catalogRelease.legalInputs, {}),
    );
    expect(legal.requiredNotices).toContain('PZO1110');
    expect(computeFingerprint(legal.registry)).toBe(
      computeFingerprint(reviewedAdmission.registry),
    );
    expect(computeFingerprint(legal.resources)).toBe(
      computeFingerprint(legalResources),
    );
    const page = buildLegalPageData(legal);
    const expected = buildLegalPageData({
      registry: reviewedAdmission.registry,
      resources: legalResources,
      requiredNotices: legal.requiredNotices,
      permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    });
    expect(computeFingerprint(page)).toBe(computeFingerprint(expected));
    expect(page.outstandingNotices).toEqual([]);
  } finally {
    await tree.dispose();
  }
}, 90_000);
