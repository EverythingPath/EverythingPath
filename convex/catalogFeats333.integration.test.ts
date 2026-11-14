// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { featFixtureDefinition } from '../tests/fixtures/feats-333/sheet';
import review from '../scripts/catalog/legal/feats-333.json';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

test('an isolated admitted Lunge definition survives shared saved-sheet edits and public reads', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, wrongCampaignId } = await t.run(async (ctx) => {
    for (const [name, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `test|${name}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated feats #333',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'feats-333',
        version: 1,
        workerKey: '0',
        caseKey: 'curation',
        campaignKey: 'curation',
      },
    });
    const wrongCampaignId = await ctx.db.insert('campaign', {
      name: 'Other isolated campaign',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
    });
    return { campaignId, wrongCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Lunge curation fixture',
    kind: 'pc',
    operationId: 'create-feats-333',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  // Fixture-only materialization preserves the imported identity and numbers.
  // The narrower runtime body omits repeatable:unreviewed; no inferred 'no' or
  // permanent release metadata is supplied by this adapter.
  const definition = featFixtureDefinition();
  expect(
    review.candidates.find(
      (row) => row.externalKey === definition.ruleIdentity,
    ),
  ).toMatchObject({ disposition: 'supported/admitted' });
  const featId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ...definition,
      stacksWithItself: false,
    }),
  );
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { dexterity: 14 },
    operationId: 'dex-14',
  });
  const before = await owner.query(api.characterSheet.read, scope);
  expect(before?.calculated.derivedStatistics.ac.total).toBe(12);
  const selectionId = await member.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: featId,
      operationId: 'choose-reviewed-lunge',
    },
  );
  const selected = await owner.query(api.characterSheet.read, scope);
  expect(
    selected?.catalogEntries.find((entry) => entry._id === featId),
  ).toMatchObject(definition);

  expect(
    selected?.entries.find((entry) => entry._id === selectionId),
  ).toMatchObject({ active: true, kind: 'feat', catalogEntryId: featId });
  for (const projection of [
    selected?.calculated,
    selected?.permanentCalculated,
  ]) {
    expect(projection?.derivedStatistics.ac.total).toBe(12);
    expect(projection?.derivedStatistics.ac.conditional).toContainEqual(
      expect.objectContaining({
        sheetEntryId: selectionId,
        source: 'pf1/xq2TFr7bsYBBHOi5',
        value: -2,
        condition: { situation: { option: featId } },
      }),
    );
  }
  // Imported identity stays intact; only the AC Situation is demonstrated.
  expect(definition.ruleIdentity).toBe('pf1/xq2TFr7bsYBBHOi5');
  const observed = await member.query(api.characterSheet.read, scope);
  expect(observed?.calculated.derivedStatistics.ac.total).toBe(12);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: false,
    operationId: 'switch-off-reviewed-lunge',
  });
  const inactive = await owner.query(api.characterSheet.read, scope);
  expect(inactive?.calculated.derivedStatistics.ac.total).toBe(12);
  expect(inactive?.permanentCalculated.derivedStatistics.ac.total).toBe(12);
  expect(
    inactive?.calculated.derivedStatistics.ac.conditional,
  ).not.toContainEqual(
    expect.objectContaining({ source: definition.ruleIdentity }),
  );
  expect(
    inactive?.entries.find((entry) => entry._id === selectionId),
  ).toMatchObject({ active: false, catalogEntryId: featId });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: true,
    operationId: 'restore-reviewed-lunge',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated
      .derivedStatistics.ac.conditional,
  ).toContainEqual(
    expect.objectContaining({ source: definition.ruleIdentity, value: -2 }),
  );
  await expect(
    member.query(api.characterSheet.read, {
      ...scope,
      campaignId: wrongCampaignId,
    }),
  ).rejects.toThrow();
  await expect(
    member.mutation(api.characterSheet.editSelection, {
      ...scope,
      campaignId: wrongCampaignId,
      entryId: selectionId,
      active: false,
      operationId: 'wrong-campaign-refused',
    }),
  ).rejects.toThrow();
  await expect(t.query(api.characterSheet.read, scope)).rejects.toThrow();
  await expect(
    outsider.query(api.characterSheet.read, scope),
  ).rejects.toThrow();
  await expect(
    outsider.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId: selectionId,
      active: false,
      operationId: 'outsider-refused',
    }),
  ).rejects.toThrow();
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated
      .derivedStatistics.ac.total,
  ).toBe(12);
});
