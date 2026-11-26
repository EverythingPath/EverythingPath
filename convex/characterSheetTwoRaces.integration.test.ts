// @vitest-environment edge-runtime
// rotation-6 fix r3 (both reviews of round 3): creating a one-off race while
// a race is selected leaves two active races. That is the writer's
// behaviour before rotation-6 (this test passes on 0158082f), left for root;
// the read gives each active race's per-day maximum, so the Race panel shows
// every one (`rule-value-row-coverage.test.tsx`, "with two active races the
// Race panel shows each one’s maximum, …"). Test fixtures only.
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    await ctx.db.insert('user', {
      tokenIdentifier: 'test|owner',
      orgIds: [{ orgId: 'org', role: 'member' }],
      characterSheetDemo: true,
    });
    return ctx.db.insert('campaign', {
      name: 'Two races',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'two-races',
        version: 1,
        workerKey: '0',
        caseKey: 'two-races',
        campaignKey: 'two-races',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Two races fixture',
    kind: 'pc',
    operationId: 'create',
  });
  return {
    t,
    owner,
    scope: { organizationId: 'org', campaignId, characterId },
  };
}

const race = (name: string, key: string, amount: number) => ({
  name,
  modifiers: [],
  stacksWithItself: false,
  sources: [],
  detail: { kind: 'race' as const, racialTraits: [] },
  ruleValues: [
    { kind: 'dailyMaximum' as const, key, unit: 'uses' as const, amount },
  ],
});

test('a one-off race created while a race is selected leaves both active, and the read gives each one’s maximum', async () => {
  const { t, owner, scope } = await fixture();
  const selectedId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      ...race('Selected race', 'fixture_selected', 3),
      scope: 'global',
      ruleIdentity: 'fixture-selected-race',
    }),
  );
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: selectedId,
    operationId: 'select-race',
  });
  await owner.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'one-off-race',
    definition: race('One-off race', 'fixture_one_off', 11),
  });
  const sheet = await owner.query(api.characterSheet.read, scope);
  expect(
    sheet?.entries.filter((entry) => entry.kind === 'race' && entry.active),
  ).toHaveLength(2);
  expect(
    sheet?.calculated.dailyMaxima.map(({ key, value }) => ({ key, value })),
  ).toEqual([
    { key: 'fixture_selected', value: 3 },
    { key: 'fixture_one_off', value: 11 },
  ]);
});
