// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { initializeCharacterSheet } from './lib/characterSheet';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';

const modules = import.meta.glob('./**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  const member = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const seeded = await member.run((ctx) => seedAcceptedCampaign(ctx));
  await t.run((ctx) =>
    ctx.db.patch('campaign', seeded.key.campaignId, {
      e2eFixture: {
        namespace: 'activation',
        version: 1,
        workerKey: '0',
        caseKey: 'activation',
        campaignKey: 'activation',
      },
    }),
  );
  return {
    t,
    member,
    seeded,
    scope: {
      campaignId: seeded.key.campaignId,
      militiaId: seeded.key.militiaId,
    },
  };
}

test('selected facts change live review identity while preserving other militia facts and the Weekly Draft', async () => {
  const { t, member, seeded, scope } = await fixture();
  const before = await member.query(api.canonicalLedger.read, scope);
  const draft = await member.query(
    api.canonicalDraftPersistence.observe,
    seeded.key,
  );
  await t.run(async (ctx) => {
    await initializeCharacterSheet(ctx, {
      characterId: seeded.characterId,
      operationId: 'initialize',
      updatedBy: 'test|gm',
      level: 12,
      scores: {
        strength: 10,
        dexterity: 11,
        constitution: 12,
        intelligence: 13,
        wisdom: 14,
        charisma: 15,
      },
    });
    const releaseId = await ctx.db.insert('catalogRelease', {
      releaseNumber: 2,
      state: 'prepared',
      baseReleaseNumber: null,
      manifest: {
        formatVersion: 1,
        releaseNumber: 2,
        baseRelease: null,
        inputs: {
          upstream: 'a',
          remaps: 'a',
          curation: 'a',
          localData: 'a',
          parsers: 'a',
          sanitizers: 'a',
          ruleResources: 'a',
          legal: 'a',
          attribution: 'a',
        },
        compatibility: catalogRuntimeCompatibility,
        inputFingerprint: 'a',
        outputFingerprint: 'a',
        artifactFingerprint: 'a',
        batches: [],
      },
      nextBatchIndex: 0,
      batchCount: 0,
      stagedRows: 0,
      reportCategories: [],
      legalKeys: [],
    });
    const runId = await ctx.db.insert('catalogImpactRun', {
      releaseId,
      cursor: null,
      discoveryStage: 'sheets',
      isDiscoveryComplete: true,
      lifecycle: 'ready',
    });
    await ctx.db.insert('catalogCampaignFacts', {
      runId,
      campaignId: scope.campaignId,
      baseGeneration: 0,
      generation: 1,
      changedCount: 1,
    });
    await ctx.db.insert('catalogReleaseControl', {
      key: 'global',
      releaseId,
      impactRunId: runId,
      releaseNumber: 2,
      schemaIdentity: catalogRuntimeCompatibility.schema,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
    });
    const facts = before.state.militiaSnapshot.characters.find(
      (row) => row.characterId === seeded.characterId,
    )!;
    const existingFacts = await ctx.db
      .query('catalogCharacterFacts')
      .withIndex('by_characterId', (q) =>
        q.eq('characterId', seeded.characterId),
      )
      .unique();
    if (!existingFacts) throw new Error('Missing initialized facts');
    await ctx.db.replace('catalogCharacterFacts', existingFacts._id, {
      characterId: seeded.characterId,
      releaseNumber: 2,
      generation: 1,
      facts: { ...facts, characterId: seeded.characterId, charisma: 19 },
    });
  });
  const current = await member.query(api.canonicalLedger.read, scope);
  expect(current.revision).toBe(before.revision + 1);
  expect(current.state.militiaSnapshot.characters[0]?.charisma).toBe(19);
  expect(
    (
      await member.query(api.character.listByCampaign, {
        campaignId: scope.campaignId,
        organizationId: 'org',
      })
    ).find((row) => row._id === seeded.characterId)?.charisma,
  ).toBe(19);
  expect({
    ...current.state,
    militiaSnapshot: {
      ...current.state.militiaSnapshot,
      characters: before.state.militiaSnapshot.characters,
    },
  }).toEqual(before.state);
  expect(
    await member.query(api.canonicalDraftPersistence.observe, seeded.key),
  ).toEqual(draft);
  expect(
    (
      await member.query(api.canonicalDraftPersistence.workspace, {
        campaignId: scope.campaignId,
      })
    )?.snapshot.characters[0]?.charisma,
  ).toBe(19);
  await member.mutation(api.canonicalLedger.save, {
    ...scope,
    expectedRevision: current.revision,
    snapshot: {
      ...current.state.militiaSnapshot,
      treasuryCopper: current.state.militiaSnapshot.treasuryCopper + 123,
    },
    reason: 'Treasure found',
  });
  const corrected = await member.query(api.canonicalLedger.read, scope);
  expect(corrected.revision).toBe(current.revision + 1);
  expect(corrected.state.militiaSnapshot.characters[0]?.charisma).toBe(19);
  expect(corrected.state.militiaSnapshot.treasuryCopper).toBe(
    before.state.militiaSnapshot.treasuryCopper + 123,
  );
});
