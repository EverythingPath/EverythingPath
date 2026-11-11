/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import type { CatalogReleaseStatus } from '../../src/lib/catalog/release-validators';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedFeatDefinition } from '../fixtures/feats-355/sheet';
import { review } from '../fixtures/feats-355/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import {
  featReleaseFixtureCalculation,
  findReleaseCompatibilityProblems,
} from './release-compatibility';

import { reviewedFeatDefinition as priorFeatDefinition } from '../fixtures/feats-349/sheet';

const modules = import.meta.glob('../../convex/**/*.ts');

test('isolated saved admitted and held-body previews match the resolver and enforce campaign access', async () => {
  const name = 'Skill Focus (Climb)';
  const target = 'skill.clm';
  const t = convexTest(schema, modules);
  const { campaignId, wrongCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `feat355|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed feats #355',
      description: '',
      organizationId: 'org',
      ownerId: 'feat355|owner',
      e2eFixture: {
        namespace: 'feats-355',
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
      ownerId: 'feat355|owner',
    });
    return { campaignId, wrongCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'feat355|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'feat355|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'feat355|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed feat preview',
    kind: 'pc',
    operationId: 'create-feats-355',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const focus = reviewedFeatDefinition(name);
  const citystep = reviewedFeatDefinition('Carrion Feeder');
  const style = reviewedFeatDefinition('Brain Eater');
  expect(
    review.candidates.find((row) => row.externalKey === focus.ruleIdentity)
      ?.disposition,
  ).toBe('admitted');
  expect(
    review.candidates.find((row) => row.externalKey === citystep.ruleIdentity)
      ?.disposition,
  ).toBe('held');
  // Skill Focus is admitted; the other bodies remain held globally. Character-scoped
  // isolated fixtures exercise previews without bypassing new global admission.
  const { focusId, citystepId, styleId } = await t.run(async (ctx) => ({
    focusId: await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ...focus,
      stacksWithItself: false,
    }),
    styleId: await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ...style,
      stacksWithItself: false,
    }),
    citystepId: await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ...citystep,
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
  // #724: no ranks and the skill's ability at 10, so Skill Focus adds +3
  // with nothing selected.
  expect(saved.calculated.breakdowns[target].total).toBe(3);
  expect(saved.permanentCalculated.breakdowns[target].total).toBe(3);
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  expect(focus.modifiers).toEqual([
    {
      target: target,
      bonusType: 'untyped',
      value: {
        formula: `3 + 3 * min(1, floor(@skillRanks.${target.slice('skill.'.length)} / 10))`,
      },
    },
  ]);
  expect(calculateCharacterSheetPreview(saved).breakdowns[target].total).toBe(
    3,
  );
  expect(
    (await member.query(api.catalogCopies.list, scope)).find(
      (row) => row._id === focusId,
    ),
  ).toMatchObject(focus);
  const copyId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ...focus,
      name: 'Climb Catalog Copy',
      copiedFrom: focusId,
      stacksWithItself: false,
    }),
  );
  const duplicateId = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: copyId,
    operationId: 'second-engineering',
  });
  const linguisticId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ...priorFeatDefinition('Skill Focus (Linguistics)'),
      stacksWithItself: false,
    }),
  );
  const otherId = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: linguisticId,
    operationId: 'select-other-skill',
  });
  // #724: Skill Focus (Linguistics) applies its +3 with no Situation.
  const mixedSaved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!mixedSaved) throw new Error('Missing mixed saved sheet');
  // #724: both copies apply +3 (no ranks) with nothing selected; one Source.
  const mixedOptions = {};
  const mixedPreview = calculateCharacterSheetPreview(
    mixedSaved,
    {},
    mixedOptions,
  );
  expect(mixedPreview.breakdowns[target].total).toBe(3);
  expect(mixedPreview.breakdowns['skill.lin'].total).toBe(3);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: duplicateId,
    active: false,
    operationId: 'disable-high-copy',
  });
  const lowerSaved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!lowerSaved) throw new Error('Missing lower saved sheet');
  expect(
    calculateCharacterSheetPreview(lowerSaved, {}, mixedOptions).breakdowns[
      target
    ].total,
  ).toBe(3);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    active: false,
    operationId: 'disable-original',
  });
  const inactiveFocus = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!inactiveFocus) throw new Error('Missing inactive Skill Focus');
  expect(
    calculateCharacterSheetPreview(inactiveFocus, {}, mixedOptions).breakdowns[
      target
    ].total,
  ).toBe(0);
  expect(
    calculateCharacterSheetPreview(inactiveFocus, {}, mixedOptions).breakdowns[
      'skill.lin'
    ].total,
  ).toBe(3);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    active: true,
    operationId: 'restore-original',
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: otherId,
    active: false,
    operationId: 'disable-other-skill',
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    catalogEntryId: styleId,
    operationId: 'replace-with-style',
  });
  const styleSaved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!styleSaved) throw new Error('Missing Brain Eater sheet');
  for (const projected of [
    styleSaved.calculated,
    calculateCharacterSheetPreview(
      styleSaved,
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
      (row) => row._id === styleId,
    ),
  ).toMatchObject(style);
  const staged = calculateCharacterSheetPreview(saved, {
    entries: saved.entries.map((row) =>
      row._id === selectedId ? { ...row, catalogEntryId: citystepId } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    catalogEntryId: citystepId,
    operationId: 'replace-with-carrion',
  });
  const citystepSaved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!citystepSaved) throw new Error('Missing Carrion Feeder sheet');
  expect(staged.derivedStatistics).toEqual(
    citystepSaved.calculated.derivedStatistics,
  );
  const messageScope = citystep.modifiers[0]?.condition?.situation;
  if (typeof messageScope !== 'object' || !('local' in messageScope))
    throw new Error('Missing disease Situation');
  expect(citystepSaved.calculated.breakdowns['save.fort'].total).toBe(0);
  expect(
    calculateCharacterSheetPreview(
      citystepSaved,
      {},
      { situations: [{ ...messageScope, sheetEntryId: selectedId }] },
    ).breakdowns['save.fort'].total,
  ).toBe(2);
  expect(
    calculateCharacterSheetPreview(
      citystepSaved,
      {},
      {
        situations: [{ ...messageScope, sheetEntryId: 'other' }],
      },
    ).breakdowns['save.fort'].total,
  ).toBe(0);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    active: false,
    operationId: 'deactivate-carrion',
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
    ).breakdowns['save.fort'].total,
  ).toBe(0);
  const foreignId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: wrongCampaignId,
      ...citystep,
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
  ).toMatchObject({ active: false, catalogEntryId: citystepId });
});

test('an isolated one-admission release roundtrips and serves complete public legal inputs', async () => {
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
    await import('../fixtures/feats-355/release.json');
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
      .filter((row) => row.kind === 'definition')
      .map((row) => row.key),
  ).toEqual(['pf1-content/eLQUV5Hswm8vNLfE']);
  expect(
    release.batches.flat().filter((row) => row.kind === 'resource'),
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
