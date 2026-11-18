// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

test('private equipment and proficiency edits stay with their owner', async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (const name of ['owner', 'member'])
      await ctx.db.insert('user', {
        tokenIdentifier: `test|${name}`,
        orgIds: [{ orgId: 'org', role: 'member' }],
        characterSheetDemo: true,
      });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    name: 'Private fighter',
    kind: 'pc',
    operationId: 'create',
  });
  const item = await owner.mutation(api.characterSheet.createSheetEntry, {
    characterId,
    name: 'Leather',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      armor: {
        slot: 'armor',
        category: 'light',
        bonus: 2,
        maxDex: 6,
        armorCheckPenalty: 0,
        asf: 10,
      },
    },
    operationId: 'item',
  });
  const definition = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Proficiency',
      ruleIdentity: 'proficiency',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'feat' },
      proficiencies: [{ choice: true }],
    }),
  );
  const feat = await owner.mutation(api.characterSheet.selectEntry, {
    characterId,
    catalogEntryId: definition,
    operationId: 'feat',
  });
  for (const caller of [member, t]) {
    await expect(
      caller.mutation(api.characterSheet.editEquipment, {
        characterId,
        entryId: item,
        enhancement: 2,
        operationId: 'intrusion',
      }),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheet.setManualProficiency, {
        characterId,
        proficiency: { category: 'light' },
        disposition: 'added',
        operationId: 'intrusion',
      }),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheet.setProficiencyChoice, {
        characterId,
        entryId: feat,
        choice: 'longsword',
        operationId: 'intrusion',
      }),
    ).rejects.toThrow();
    await expect(
      caller.query(api.characterSheet.read, { characterId }),
    ).rejects.toThrow();
  }
  await owner.mutation(api.characterSheet.editEquipment, {
    characterId,
    entryId: item,
    enhancement: 2,
    operationId: 'enchant',
  });
  await owner.mutation(api.characterSheet.setManualProficiency, {
    characterId,
    proficiency: { category: 'light' },
    disposition: 'added',
    operationId: 'armor-training',
  });
  await owner.mutation(api.characterSheet.setProficiencyChoice, {
    characterId,
    entryId: feat,
    choice: 'longsword',
    operationId: 'weapon-training',
  });
  const sheet = await owner.query(api.characterSheet.read, { characterId });
  expect(sheet?.calculated.equipment.items[0]).toMatchObject({
    enhancement: 2,
    proficient: true,
  });
  expect(sheet?.calculated.proficiencies.grants[0]).toMatchObject({
    proficiency: { baseType: 'longsword' },
  });
});
