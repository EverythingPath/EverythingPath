/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import type { CatalogReleaseStatus } from '../../src/lib/catalog/release-validators';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedFeatDefinition } from '../fixtures/feats-353/sheet';
import { review } from '../fixtures/feats-353/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import {
  featReleaseFixtureCalculation,
  findReleaseCompatibilityProblems,
} from './release-compatibility';

import { reviewedFeatDefinition as priorFeatDefinition } from '../fixtures/feats-349/sheet';

const modules = import.meta.glob('../../convex/**/*.ts');

test.each([['Artifact Hunter', 'skill.umd']] as const)(
  'saved %s supports mixed copies, deactivation and access boundaries',
  async (name, target) => {
    const t = convexTest(schema, modules);
    const { campaignId, wrongCampaignId } = await t.run(async (ctx) => {
      for (const [user, orgId] of [
        ['owner', 'org'],
        ['member', 'org'],
        ['outsider', 'other'],
      ] as const)
        await ctx.db.insert('user', {
          tokenIdentifier: `feat353|${user}`,
          orgIds: [{ orgId, role: 'member' }],
          characterSheetDemo: true,
        });
      const campaignId = await ctx.db.insert('campaign', {
        name: 'Isolated reviewed feats #353',
        description: '',
        organizationId: 'org',
        ownerId: 'feat353|owner',
        e2eFixture: {
          namespace: 'feats-353',
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
        ownerId: 'feat353|owner',
      });
      return { campaignId, wrongCampaignId };
    });
    const owner = t.withIdentity({ tokenIdentifier: 'feat353|owner' });
    const member = t.withIdentity({ tokenIdentifier: 'feat353|member' });
    const outsider = t.withIdentity({ tokenIdentifier: 'feat353|outsider' });
    const characterId = await owner.mutation(api.characterSheet.create, {
      organizationId: 'org',
      campaignId,
      name: 'Reviewed feat preview',
      kind: 'pc',
      operationId: 'create-feats-353',
    });
    const scope = { organizationId: 'org', campaignId, characterId };
    const focus = reviewedFeatDefinition(name);
    const feyFriend = reviewedFeatDefinition('Ghost Whisperer');
    const torchbearer = reviewedFeatDefinition('Client');
    expect(
      review.candidates.find((row) => row.externalKey === focus.ruleIdentity)
        ?.disposition,
    ).toBe('held');
    expect(
      review.candidates.find(
        (row) => row.externalKey === feyFriend.ruleIdentity,
      )?.disposition,
    ).toBe('held');
    // All current bodies remain held globally. Character-scoped isolated
    // fixtures exercise public saved-sheet previews and authorize no global admission.
    const { focusId, feyFriendId, torchbearerId } = await t.run(
      async (ctx) => ({
        focusId: await ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          ...focus,
          stacksWithItself: false,
        }),
        torchbearerId: await ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          ...torchbearer,
          stacksWithItself: false,
        }),
        feyFriendId: await ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          ...feyFriend,
          stacksWithItself: false,
        }),
      }),
    );
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
    const highRanks = focus.modifiers[1]?.condition?.situation;
    if (typeof highRanks !== 'object' || !('local' in highRanks))
      throw new Error('Missing highRanks Situation');
    expect(
      calculateCharacterSheetPreview(
        saved,
        {},
        {
          situations: [{ ...highRanks, sheetEntryId: selectedId }],
        },
      ).breakdowns[target].total,
    ).toBe(4);
    expect(
      (await member.query(api.catalogCopies.list, scope)).find(
        (row) => row._id === focusId,
      ),
    ).toMatchObject(focus);
    const lowRanks = focus.modifiers[0]?.condition?.situation;
    if (typeof lowRanks !== 'object' || !('local' in lowRanks))
      throw new Error('Missing low ranks');
    const copyId = await t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...focus,
        name: 'Artifact Hunter Catalog Copy',
        copiedFrom: focusId,
        stacksWithItself: false,
      }),
    );
    const duplicateId = await member.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: copyId,
      operationId: 'second-skill-focus',
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
    const mixedOptions = {
      situations: [
        { ...lowRanks, sheetEntryId: selectedId },
        { ...highRanks, sheetEntryId: duplicateId },
      ],
    };
    const mixedPreview = calculateCharacterSheetPreview(
      mixedSaved,
      {},
      mixedOptions,
    );
    expect(mixedPreview.breakdowns[target].total).toBe(4);
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
    ).toBe(2);
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
      calculateCharacterSheetPreview(inactiveFocus, {}, mixedOptions)
        .breakdowns[target].total,
    ).toBe(0);
    expect(
      calculateCharacterSheetPreview(inactiveFocus, {}, mixedOptions)
        .breakdowns['skill.lin'].total,
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
      entryId: duplicateId,
      active: true,
      operationId: 'restore-high-copy-before-replacement',
    });
    await member.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId: selectedId,
      catalogEntryId: torchbearerId,
      operationId: 'replace-with-torchbearer',
    });
    const torchbearerSaved = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!torchbearerSaved) throw new Error('Missing Client sheet');
    expect(
      torchbearerSaved.entries.find((row) => row._id === selectedId),
    ).toMatchObject({ active: true, catalogEntryId: torchbearerId });
    expect(
      torchbearerSaved.entries.find((row) => row._id === duplicateId),
    ).toMatchObject({ active: true, catalogEntryId: copyId });
    const replacedPreview = calculateCharacterSheetPreview(
      torchbearerSaved,
      {},
      mixedOptions,
    );
    // The remaining Skill Focus copy still contributes; replacing the original
    // selection must remove only that selection's Skill Focus contribution.
    expect(replacedPreview.breakdowns[target].total).toBe(4);
    expect(replacedPreview.breakdowns[target].applied).toContainEqual(
      expect.objectContaining({ sheetEntryId: duplicateId, value: 4 }),
    );
    for (const contribution of [
      ...replacedPreview.breakdowns[target].applied,
      ...replacedPreview.breakdowns[target].suppressed,
    ]) {
      expect(contribution.sheetEntryId).not.toBe(selectedId);
    }
    const catalogCopies = await member.query(api.catalogCopies.list, scope);
    expect(catalogCopies.find((row) => row._id === focusId)).toMatchObject(
      focus,
    );
    expect(catalogCopies.find((row) => row._id === copyId)).toMatchObject({
      ...focus,
      name: 'Artifact Hunter Catalog Copy',
      copiedFrom: focusId,
    });
    await member.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId: duplicateId,
      active: false,
      operationId: 'disable-remaining-focus-copy',
    });
    const noFocusSaved = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!noFocusSaved) throw new Error('Missing sheet after copy deactivation');
    expect(
      calculateCharacterSheetPreview(noFocusSaved, {}, mixedOptions).breakdowns[
        target
      ].total,
    ).toBe(0);
    expect(
      (await member.query(api.catalogCopies.list, scope)).find(
        (row) => row._id === torchbearerId,
      ),
    ).toMatchObject(torchbearer);
    const staged = calculateCharacterSheetPreview(saved, {
      entries: saved.entries.map((row) =>
        row._id === selectedId ? { ...row, catalogEntryId: feyFriendId } : row,
      ),
    });
    await member.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId: selectedId,
      catalogEntryId: feyFriendId,
      operationId: 'replace-with-fey-friend',
    });
    const feyFriendSaved = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!feyFriendSaved) throw new Error('Missing Ghost Whisperer sheet');
    expect(staged.derivedStatistics).toEqual(
      feyFriendSaved.calculated.derivedStatistics,
    );
    const feyInteractionScope = feyFriend.modifiers[0]?.condition?.situation;
    if (
      typeof feyInteractionScope !== 'object' ||
      !('local' in feyInteractionScope)
    )
      throw new Error('Missing fey-interaction Situation');
    expect(feyFriendSaved.calculated.breakdowns['skill.blf'].total).toBe(0);
    expect(
      calculateCharacterSheetPreview(
        feyFriendSaved,
        {},
        { situations: [{ ...feyInteractionScope, sheetEntryId: selectedId }] },
      ).breakdowns['skill.blf'].total,
    ).toBe(2);
    expect(
      calculateCharacterSheetPreview(
        feyFriendSaved,
        {},
        {
          situations: [{ ...feyInteractionScope, sheetEntryId: 'other' }],
        },
      ).breakdowns['skill.blf'].total,
    ).toBe(0);
    await member.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId: selectedId,
      active: false,
      operationId: 'deactivate-fey-friend',
    });
    const inactive = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!inactive) throw new Error('Missing inactive sheet');
    expect(
      calculateCharacterSheetPreview(
        inactive,
        {},
        { situations: [{ ...feyInteractionScope, sheetEntryId: selectedId }] },
      ).breakdowns['skill.blf'].total,
    ).toBe(0);
    const foreignId = await t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: wrongCampaignId,
        ...feyFriend,
        stacksWithItself: false,
      }),
    );
    const foreignCharacter = await owner.mutation(api.characterSheet.create, {
      organizationId: 'org',
      campaignId,
      name: 'Other Character',
      kind: 'pc',
      operationId: 'other-character',
    });
    const foreignCharacterDefinition = await t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId: foreignCharacter,
        ...focus,
        stacksWithItself: false,
      }),
    );
    await expect(
      member.mutation(api.characterSheet.selectEntry, {
        ...scope,
        catalogEntryId: foreignCharacterDefinition,
        operationId: 'foreign-character-definition',
      }),
    ).rejects.toThrow();
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
      await expect(
        actor.query(api.characterSheet.read, scope),
      ).rejects.toThrow();
      await expect(
        actor.query(api.catalogCopies.list, scope),
      ).rejects.toThrow();
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
    ).toMatchObject({ active: false, catalogEntryId: feyFriendId });
  },
);

test('an isolated all-held release roundtrips and serves complete public legal inputs', async () => {
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
    await import('../fixtures/feats-353/release.json');
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
  ).toEqual([]);
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
