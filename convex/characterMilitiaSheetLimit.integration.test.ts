// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test, vi } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import type * as CharacterSheetData from './lib/characterSheetData';

// Keep the real mutation and reads; scale only the imported entry cap.
vi.mock('./lib/characterSheetData', async (importOriginal) => ({
  ...(await importOriginal<typeof CharacterSheetData>()),
  maxCharacterChildRows: 8,
}));

const modules = import.meta.glob('./**/*.ts');

test('level growth counts base scores and personal adjustments at the entry cap and rejects one over atomically', async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|owner',
      orgIds: [{ orgId: 'org', role: 'member' }],
    }),
  );
  const campaignId = await owner.mutation(api.campaign.createCampaign, {
    organizationId: 'org',
    name: 'Before Setup',
    description: '',
  });
  await t.run(async (ctx) => {
    await ctx.db.insert('militia', { campaignId, name: 'Before Setup' });
    await ctx.db.patch('campaign', campaignId, {
      e2eFixture: {
        namespace: 'sheet',
        version: 1,
        workerKey: '0',
        caseKey: 'sheet',
        campaignKey: 'limit',
      },
    });
  });
  const characterId = await owner.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: {
      campaignId,
      name: 'At capacity',
      description: '',
      kind: 'pc',
      level: 1,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
  });
  const scope = { organizationId: 'org', characterId };
  const adjustmentId = await owner.mutation(
    api.characterSheet.createPersonalAdjustment,
    {
      ...scope,
      operationId: 'retained-adjustment',
      name: 'Charisma reward',
      modifiers: [{ target: 'ability.cha', bonusType: 'untyped', value: 2 }],
    },
  );
  const before = await owner.query(api.characterSheet.read, scope);
  await owner.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { level: 6 },
  });
  const atCapacity = await owner.query(api.characterSheet.read, scope);
  expect(atCapacity).toMatchObject({
    character: { name: 'At capacity' },
    calculated: { level: 6, abilities: { charisma: { score: 12 } } },
  });
  expect(atCapacity?.entries).toHaveLength(8);
  expect(
    atCapacity?.entries.find((entry) => entry._id === adjustmentId),
  ).toEqual(before?.entries.find((entry) => entry._id === adjustmentId));
  await expect(
    owner.mutation(api.character.updateCharacter, {
      ...scope,
      patch: { level: 7, name: 'Must not save' },
    }),
  ).rejects.toThrow('Character sheet is too large');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(atCapacity);
});
