/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import type { CatalogReleaseStatus } from '../../src/lib/catalog/release-validators';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedFeatDefinition } from '../fixtures/feats-348/sheet';
import { review } from '../fixtures/feats-348/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import {
  featReleaseFixtureCalculation,
  findReleaseCompatibilityProblems,
} from './release-compatibility';

const modules = import.meta.glob('../../convex/**/*.ts');

test('isolated saved held-body previews match the resolver and enforce campaign access', async () => {
  const name = 'Sure-Footed';
  const target = 'save.ref';
  const t = convexTest(schema, modules);
  const { campaignId, wrongCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `feat348|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed feats #348',
      description: '',
      organizationId: 'org',
      ownerId: 'feat348|owner',
      e2eFixture: {
        namespace: 'feats-348',
        version: 1,
        workerKey: '0',
        caseKey: 'reviewed',
        campaignKey: 'reviewed',
      },
    });
    const wrongCampaignId = await ctx.db.insert('campaign', {
      name: 'Other isolated campaign',
      description: '',
      organizationId: 'org',
      ownerId: 'feat348|owner',
    });
    return { campaignId, wrongCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'feat348|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'feat348|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'feat348|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed feat preview',
    kind: 'pc',
    operationId: 'create-feats-348',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const focus = reviewedFeatDefinition(name);
  const secretLanguage = reviewedFeatDefinition('Secret Language');
  const hurler = reviewedFeatDefinition('Charging Hurler');
  expect(
    review.candidates.find((row) => row.externalKey === focus.ruleIdentity)
      ?.disposition,
  ).toBe('held');
  expect(
    review.candidates.find(
      (row) => row.externalKey === secretLanguage.ruleIdentity,
    )?.disposition,
  ).toBe('held');
  // Both reviewed bodies remain held globally. Character-scoped isolated fixtures
  // exercise the public preview without constructing or publishing a Catalog Release.
  const { focusId, secretLanguageId, hurlerId } = await t.run(async (ctx) => ({
    focusId: await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ...focus,
      stacksWithItself: false,
    }),
    hurlerId: await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ...hurler,
      stacksWithItself: false,
    }),
    secretLanguageId: await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ...secretLanguage,
      stacksWithItself: false,
    }),
  }));
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
  const selectedId = await member.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: focusId,
      operationId: 'select-focus',
    },
  );
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(saved.calculated.breakdowns[target].total).toBe(0);
  expect(saved.permanentCalculated.breakdowns[target].total).toBe(0);
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  const falling = focus.modifiers[1]?.condition?.situation;
  if (typeof falling !== 'object' || !('local' in falling))
    throw new Error('Missing falling Situation');
  expect(
    calculateCharacterSheetPreview(
      saved,
      {},
      {
        situations: [{ ...falling, sheetEntryId: selectedId }],
      },
    ).breakdowns[target].total,
  ).toBe(2);
  expect(
    (await member.query(api.catalogCopies.list, scope)).find(
      (row) => row._id === focusId,
    ),
  ).toMatchObject(focus);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    catalogEntryId: hurlerId,
    operationId: 'replace-with-hurler',
  });
  const hurlerSaved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!hurlerSaved) throw new Error('Missing Charging Hurler sheet');
  for (const projected of [
    hurlerSaved.calculated,
    calculateCharacterSheetPreview(
      hurlerSaved,
      {},
      { situations: ['charging'] },
    ),
  ]) {
    expect(projected.breakdowns['attack.ranged'].total).toBe(0);
    expect(projected.breakdowns['attack.melee'].total).toBe(0);
    expect(projected.breakdowns['ac.other'].total).toBe(0);
  }
  expect(
    (await member.query(api.catalogCopies.list, scope)).find(
      (row) => row._id === hurlerId,
    ),
  ).toMatchObject(hurler);
  const staged = calculateCharacterSheetPreview(saved, {
    entries: saved.entries.map((row) =>
      row._id === selectedId
        ? { ...row, catalogEntryId: secretLanguageId }
        : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    catalogEntryId: secretLanguageId,
    operationId: 'replace-with-message',
  });
  const secretLanguageSaved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!secretLanguageSaved) throw new Error('Missing Secret Language sheet');
  expect(staged.derivedStatistics).toEqual(
    secretLanguageSaved.calculated.derivedStatistics,
  );
  const messageScope = secretLanguage.modifiers[0]?.condition?.situation;
  if (typeof messageScope !== 'object' || !('local' in messageScope))
    throw new Error('Missing secret-message Situation');
  expect(secretLanguageSaved.calculated.breakdowns['skill.blf'].total).toBe(0);
  expect(
    calculateCharacterSheetPreview(
      secretLanguageSaved,
      {},
      { situations: [{ ...messageScope, sheetEntryId: selectedId }] },
    ).breakdowns['skill.blf'].total,
  ).toBe(5);
  expect(
    calculateCharacterSheetPreview(
      secretLanguageSaved,
      {},
      {
        situations: [{ ...messageScope, sheetEntryId: 'other' }],
      },
    ).breakdowns['skill.blf'].total,
  ).toBe(0);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    active: false,
    operationId: 'deactivate-message',
  });
  const inactive = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!inactive) throw new Error('Missing inactive sheet');
  expect(
    calculateCharacterSheetPreview(
      inactive,
      {},
      { situations: [{ ...messageScope, sheetEntryId: selectedId }] },
    ).breakdowns['skill.blf'].total,
  ).toBe(0);
  const foreignId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: wrongCampaignId,
      ...secretLanguage,
      stacksWithItself: false,
    }),
  );
  await expect(
    member.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId: selectedId,
      catalogEntryId: foreignId,
      active: true,
      operationId: 'foreign-definition',
    }),
  ).rejects.toThrow();
  await expect(
    member.query(api.characterSheet.read, {
      ...scope,
      campaignId: wrongCampaignId,
    }),
  ).rejects.toThrow();
  for (const actor of [t, outsider]) {
    await expect(actor.query(api.characterSheet.read, scope)).rejects.toThrow();
    await expect(actor.query(api.catalogCopies.list, scope)).rejects.toThrow();
    await expect(
      actor.mutation(api.characterSheet.editSelection, {
        ...scope,
        entryId: selectedId,
        active: true,
        operationId: 'denied-edit',
      }),
    ).rejects.toThrow();
  }
  expect(
    (await owner.query(api.characterSheet.read, scope))?.entries.find(
      (row) => row._id === selectedId,
    ),
  ).toMatchObject({ active: false, catalogEntryId: secretLanguageId });
});

test('an isolated held-only release roundtrips and serves complete public legal inputs', async () => {
  const { validateCatalogReleaseArtifact, releaseFingerprint } =
    await import('../../src/lib/catalog/release-schema');
  const { runCatalogReleaseCommand } =
    await import('../../scripts/catalog/release-command');
  const { catalogRuntimeCompatibility } =
    await import('../../src/lib/catalog/runtime-compatibility');
  const { buildLegalPageData } =
    await import('../../src/lib/catalog/legal-page-data');
  const { reviewedAdmission } =
    await import('../../src/lib/catalog/reviewed-data');
  const { legalResourcesSchema } =
    await import('../../src/lib/catalog/legal-types');
  const { internal } = await import('../../convex/_generated/api');
  const { default: fixture } =
    await import('../fixtures/feats-348/release.json');
  const release = await validateCatalogReleaseArtifact(fixture);
  const transported = await validateCatalogReleaseArtifact(
    JSON.parse(JSON.stringify(release)),
  );
  expect(await releaseFingerprint(transported)).toBe(
    await releaseFingerprint(release),
  );
  expect(
    release.batches
      .flat()
      .filter((row) => row.kind === 'definition' || row.kind === 'resource'),
  ).toEqual([]);
  // The fixture keeps the calculation identity it was prepared with; later
  // rotations change only the current identity (#749).
  expect(
    findReleaseCompatibilityProblems({
      compatibility: release.manifest.compatibility,
      recordedCalculation: featReleaseFixtureCalculation,
    }),
  ).toEqual([]);
  const t = convexTest(schema, modules);
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
  const writeBatchBoundary = makeFunctionReference<
    'mutation',
    {
      releaseNumber: number;
      batchIndex: number;
      rows: unknown;
      writeEpoch?: number;
    },
    CatalogReleaseStatus
  >('catalogRelease:writeBatch');
  expect(
    await runCatalogReleaseCommand({
      command: { kind: 'prepare', artifact: release },
      adapter: {
        begin: (args) => t.mutation(internal.catalogRelease.begin, args),
        writeBatch: (args) => t.mutation(writeBatchBoundary, args),
        finalize: (args) => t.mutation(internal.catalogRelease.finalize, args),
        inspect: (args) => t.query(internal.catalogRelease.inspect, args),
      },
    }),
  ).toMatchObject({ state: 'prepared' });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
  // This control exists only in convex-test's isolated database. No deployment,
  // production catalog or held body is published by the test.
  await t.run((ctx) =>
    ctx.db.insert('catalogReleaseControl', {
      key: 'global',
      releaseNumber: release.manifest.releaseNumber,
      schemaIdentity: catalogRuntimeCompatibility.schema,
      calculationIdentity: release.manifest.compatibility.calculation,
    }),
  );
  const published = await t.query(api.catalogRelease.legalInputs, {});
  if (!published) throw new Error('Missing isolated legal readback');
  const legalRow = (key: string) =>
    release.batches
      .flat()
      .find((row) => row.kind === 'legal' && row.key === key)?.payload;
  expect(await releaseFingerprint(published.requiredNotices)).toBe(
    await releaseFingerprint(legalRow('requiredNotices')),
  );
  expect(await releaseFingerprint(published.permanentNoticeSuperset)).toBe(
    await releaseFingerprint(legalRow('permanentNoticeSuperset')),
  );
  expect(await releaseFingerprint(published.resources)).toBe(
    await releaseFingerprint(legalRow('resources')),
  );
  const { reconstructReleaseRegistry } =
    await import('../../src/lib/catalog/release-registry');
  expect(await releaseFingerprint(published.registry)).toBe(
    await releaseFingerprint(
      await reconstructReleaseRegistry(release.batches.flat()),
    ),
  );
  const page = buildLegalPageData(published);
  const expected = buildLegalPageData({
    registry: reviewedAdmission.registry,
    // The frozen transport keeps the resources it was prepared with; the
    // public page applies the current Paizo notice (src/lib/legal/site-legal.ts).
    resources: legalResourcesSchema.parse(legalRow('resources')),
    requiredNotices: published.requiredNotices,
    permanentNoticeSuperset: published.permanentNoticeSuperset,
  });
  expect(await releaseFingerprint(page)).toBe(
    await releaseFingerprint(expected),
  );
  expect(page.outstandingNotices).toEqual([]);
  expect(
    page.sections
      .find((section) => section.id === 'section15')
      ?.notices.map((notice) => notice.id),
  ).toEqual(expect.arrayContaining(['pf1-system', 'pf1-content', 'keepnet']));
});
