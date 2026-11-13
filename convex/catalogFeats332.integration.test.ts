// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { featFixtureDefinition } from '../tests/fixtures/feats-332/sheet';
import review from '../scripts/catalog/legal/feats-332.json';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

test('an isolated admitted Great Fortitude definition survives shared saved-sheet edits and public reads', async () => {
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
      name: 'Isolated feats #332',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'feats-332',
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
    name: 'Fortitude curation fixture',
    kind: 'pc',
    operationId: 'create-feats-332',
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
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
  const fighter = initial?.catalogEntries.find(
    (entry) => entry.detail?.kind === 'class' && entry.name === 'Fighter',
  );
  if (!level || !fighter)
    throw new Error('Missing isolated baseline Class Level');
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: fighter._id,
    hpGained: 10,
    operationId: 'fighter-baseline',
  });
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { constitution: 14 },
    operationId: 'con-14',
  });
  const before = await owner.query(api.characterSheet.read, scope);
  expect(before?.calculated.derivedStatistics.fortitude.total).toBe(4); // Fighter 1 grants +2; Constitution 14 adds +2 before the feat.
  const selectionId = await member.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: featId,
      operationId: 'choose-reviewed-fortitude',
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
    expect(projection?.derivedStatistics.fortitude.total).toBe(6);
    expect(projection?.derivedStatistics.fortitude.applied).toContainEqual(
      expect.objectContaining({
        sheetEntryId: selectionId,
        source: 'pf1/fVRnBIHR4Jq6btvm',
        value: 2,
      }),
    );
  }
  const observed = await member.query(api.characterSheet.read, scope);
  expect(observed?.calculated.derivedStatistics.fortitude.total).toBe(6);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: false,
    operationId: 'switch-off-reviewed-fortitude',
  });
  const inactive = await owner.query(api.characterSheet.read, scope);
  expect(inactive?.calculated.derivedStatistics.fortitude.total).toBe(4);
  expect(inactive?.permanentCalculated.derivedStatistics.fortitude.total).toBe(
    4,
  );
  expect(
    inactive?.entries.find((entry) => entry._id === selectionId),
  ).toMatchObject({ active: false, catalogEntryId: featId });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: true,
    operationId: 'restore-reviewed-fortitude',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated
      .derivedStatistics.fortitude.total,
  ).toBe(6);
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
      .derivedStatistics.fortitude.total,
  ).toBe(6);
});
