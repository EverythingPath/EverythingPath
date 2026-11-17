// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { featFixtureDefinition } from '../tests/fixtures/feats-331/sheet';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

/**
 * A shared saved sheet in an isolated #331 campaign: a 1st-level Fighter with
 * the reviewed feat definition installed on the Character but not chosen yet.
 */
async function setUpSavedFeatSheet({
  feat,
  caseKey,
  characterName,
}: {
  feat: Parameters<typeof featFixtureDefinition>[0];
  caseKey: string;
  characterName: string;
}) {
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
      name: 'Isolated feats #331',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'feats-331',
        version: 1,
        workerKey: '0',
        caseKey,
        campaignKey: caseKey,
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
    name: characterName,
    kind: 'pc',
    operationId: `create-${caseKey}`,
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  // Fixture-only materialization preserves the imported identity and numbers.
  // The narrower runtime body omits repeatable:unreviewed; no inferred 'no' or
  // permanent release metadata is supplied by this adapter.
  const definition = featFixtureDefinition(feat);
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
  return {
    t,
    owner,
    member,
    outsider,
    scope,
    wrongCampaignId,
    definition,
    featId,
  };
}

/** The statistic totals the feat's contribution in every given projection. */
function expectFeatContribution({
  statistics,
  sheetEntryId,
  source,
  value,
  total,
}: {
  statistics: readonly ({ total: number; applied: unknown[] } | undefined)[];
  sheetEntryId: string;
  source: string;
  value: number;
  total: number;
}) {
  expect(statistics).not.toHaveLength(0);
  for (const statistic of statistics) {
    expect(statistic?.total).toBe(total);
    expect(statistic?.applied).toContainEqual(
      expect.objectContaining({ sheetEntryId, source, value }),
    );
  }
}

test('an isolated admitted Improved Initiative definition survives shared saved-sheet edits and public reads', async () => {
  const {
    t,
    owner,
    member,
    outsider,
    scope,
    wrongCampaignId,
    definition,
    featId,
  } = await setUpSavedFeatSheet({
    feat: 'Improved Initiative',
    caseKey: 'curation',
    characterName: 'Initiative curation fixture',
  });
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { dexterity: 14 },
    operationId: 'dex-14',
  });
  const before = await owner.query(api.characterSheet.read, scope);
  expect(before?.calculated.derivedStatistics.initiative.total).toBe(2); // Dex 14 contributes +2 before the +4 feat.
  const selectionId = await member.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: featId,
      operationId: 'choose-reviewed-initiative',
    },
  );
  const selected = await owner.query(api.characterSheet.read, scope);
  expect(
    selected?.catalogEntries.find((entry) => entry._id === featId),
  ).toMatchObject(definition);

  expect(
    selected?.entries.find((entry) => entry._id === selectionId),
  ).toMatchObject({ active: true, kind: 'feat', catalogEntryId: featId });
  expectFeatContribution({
    statistics: [selected?.calculated, selected?.permanentCalculated].map(
      (projection) => projection?.derivedStatistics.initiative,
    ),
    sheetEntryId: selectionId,
    source: 'pf1/Uuiu3p982omhMEPj',
    value: 4,
    total: 6,
  });
  const observed = await member.query(api.characterSheet.read, scope);
  expect(observed?.calculated.derivedStatistics.initiative.total).toBe(6);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: false,
    operationId: 'switch-off-reviewed-initiative',
  });
  const inactive = await owner.query(api.characterSheet.read, scope);
  expect(inactive?.calculated.derivedStatistics.initiative.total).toBe(2);
  expect(inactive?.permanentCalculated.derivedStatistics.initiative.total).toBe(
    2,
  );
  expect(
    inactive?.entries.find((entry) => entry._id === selectionId),
  ).toMatchObject({ active: false, catalogEntryId: featId });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: true,
    operationId: 'restore-reviewed-initiative',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated
      .derivedStatistics.initiative.total,
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
      .derivedStatistics.initiative.total,
  ).toBe(6);
});

// CRB p. 128: Intimidating Prowess adds the Strength modifier to Intimidate,
// with no floor (#726), so a saved sheet follows Strength edits both ways.
test('a saved sheet adds Intimidating Prowess Strength 8 as -1 and Strength 16 as +3 on Intimidate', async () => {
  const { owner, scope, featId } = await setUpSavedFeatSheet({
    feat: 'Intimidating Prowess',
    caseKey: 'intimidating-prowess',
    characterName: 'Intimidate curation fixture',
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 8, charisma: 10 },
    operationId: 'strength-8',
  });
  const selectionId = await owner.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: featId,
      operationId: 'choose-intimidating-prowess',
    },
  );
  const intimidate = async () => {
    const sheet = await owner.query(api.characterSheet.read, scope);
    return [sheet?.calculated, sheet?.permanentCalculated].map(
      (projection) => projection?.breakdowns['skill.int'],
    );
  };
  const contribution = {
    sheetEntryId: selectionId,
    source: 'pf1/O0jbkTJcIji9BNiF',
  };
  // Charisma 10 and no ranks: the feat's Strength modifier is the total.
  expectFeatContribution({
    statistics: await intimidate(),
    ...contribution,
    value: -1,
    total: -1,
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 16 },
    operationId: 'strength-16',
  });
  expectFeatContribution({
    statistics: await intimidate(),
    ...contribution,
    value: 3,
    total: 3,
  });
});
