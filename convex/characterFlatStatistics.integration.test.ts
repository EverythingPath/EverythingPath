// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { defaultAbilityScores } from '../src/lib/character-sheet';

const modules = import.meta.glob('./**/*.ts');
const stats = {
  level: 4,
  strength: 12,
  dexterity: 13,
  constitution: 14,
  intelligence: 15,
  wisdom: 16,
  charisma: 17,
};
const flatColumns = (character: Record<string, unknown> | null) => ({
  level: character?.level,
  strength: character?.strength,
  dexterity: character?.dexterity,
  constitution: character?.constitution,
  intelligence: character?.intelligence,
  wisdom: character?.wisdom,
  charisma: character?.charisma,
});

async function fixture({ sheetCampaign }: { sheetCampaign: boolean }) {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const seeded = await owner.run((ctx) => seedAcceptedCampaign(ctx));
  const campaignId = seeded.key.campaignId;
  if (sheetCampaign)
    await t.run((ctx) =>
      ctx.db.patch('campaign', campaignId, {
        e2eFixture: {
          namespace: 'sheet',
          version: 1,
          workerKey: '0',
          caseKey: 'sheet',
          campaignKey: 'sheet',
        },
      }),
    );
  // Created under legacy authority, so its flat columns hold its statistics.
  const characterId = await owner.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: {
      campaignId,
      name: 'Vessa',
      description: '',
      kind: 'pc',
      ...stats,
    },
  });
  // Activation is a later slice; seed the authority it selects.
  async function selectAuthority(authority: 'legacy' | 'sheet') {
    await t.run(async (ctx) => {
      const control = await ctx.db.query('initialMigrationControl').unique();
      if (control)
        return ctx.db.patch('initialMigrationControl', control._id, {
          authority,
        });
      const runId = await ctx.db.insert('initialMigrationRun', {
        operationId: 'activation',
        epoch: 0,
        // An activated run carries its activation records; the open gate never
        // reads this run's stage, so a seeded authority needs none.
        state: 'maintenance',
        frontendBuild: 'build',
        catalogManifest: 'catalog',
        startedAt: 0,
        deadline: 60000,
      });
      await ctx.db.insert('initialMigrationControl', {
        key: 'character-sheet',
        epoch: 0,
        closed: false,
        authority,
        runId,
      });
    });
  }
  const stored = (id: Id<'character'>) =>
    t.run((ctx) => ctx.db.get('character', id));
  return {
    t,
    owner,
    campaignId,
    characterId,
    selectAuthority,
    stored,
    militiaScope: { campaignId, militiaId: seeded.key.militiaId },
  };
}

test('under sheet authority the ledger writers record statistics on the sheet and leave the flat columns alone', async () => {
  const { owner, campaignId, characterId, selectAuthority, stored } =
    await fixture({ sheetCampaign: true });
  await selectAuthority('sheet');
  const createdId = await owner.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: {
      campaignId,
      name: 'Orrin',
      description: '',
      kind: 'pc',
      ...stats,
      level: 6,
    },
  });
  // The flat columns hold the same placeholders a Character Sheet's creation
  // writes; the statistics live on the sheet.
  expect(flatColumns(await stored(createdId))).toEqual({
    level: 1,
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  });
  expect(
    await owner.query(api.characterSheet.read, {
      organizationId: 'org',
      characterId: createdId,
    }),
  ).toMatchObject({
    character: { sheetMode: 'militiaOnly' },
    calculated: { level: 6, abilities: { charisma: { score: 17 } } },
  });
  const listed = await owner.query(api.character.listByCampaign, {
    organizationId: 'org',
    campaignId,
  });
  expect(listed.find((row) => row._id === createdId)).toMatchObject({
    ...stats,
    level: 6,
  });

  await owner.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId,
    patch: { name: 'Vessa the Bold', level: 5, strength: 18 },
  });
  expect(await stored(characterId)).toMatchObject({
    name: 'Vessa the Bold',
    ...stats,
  });
  expect(
    await owner.query(api.characterSheet.read, {
      organizationId: 'org',
      characterId,
    }),
  ).toMatchObject({
    calculated: { level: 5, abilities: { strength: { score: 18 } } },
  });
});

test('under sheet authority an ordinary campaign makes new Characters with sheets, and one made before any backfill keeps its flat statistics read-only', async () => {
  const { owner, campaignId, characterId, selectAuthority, stored } =
    await fixture({ sheetCampaign: false });
  const before = await stored(characterId);
  await selectAuthority('sheet');
  // A new Character gets a Militia-only sheet holding its statistics.
  const orrinId = await owner.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: {
      campaignId,
      name: 'Orrin',
      description: '',
      kind: 'pc',
      ...stats,
    },
  });
  expect(flatColumns(await stored(orrinId))).toEqual(
    flatColumns({ level: 1, ...defaultAbilityScores }),
  );
  expect(
    await owner.query(api.characterSheet.read, {
      organizationId: 'org',
      characterId: orrinId,
    }),
  ).toMatchObject({
    character: { sheetMode: 'militiaOnly' },
    calculated: { level: 4, abilities: { charisma: { score: 17 } } },
  });
  await owner.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId: orrinId,
    patch: { level: 5 },
  });
  expect(
    await owner.query(api.characterSheet.read, {
      organizationId: 'org',
      characterId: orrinId,
    }),
  ).toMatchObject({ calculated: { level: 5 } });
  // Vessa was made before activation and has no sheet: her statistics stay
  // as legacy authority last wrote them.
  await expect(
    owner.mutation(api.character.updateCharacter, {
      organizationId: 'org',
      characterId,
      patch: { level: 5 },
    }),
  ).rejects.toThrow(
    "Level and ability scores are kept on Character Sheets, and this Character doesn't have one yet.",
  );
  expect(await stored(characterId)).toEqual(before);
  await owner.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId,
    patch: { name: 'Vessa the Bold', isActive: false },
  });
  expect(await stored(characterId)).toEqual({
    ...before,
    name: 'Vessa the Bold',
    isActive: false,
  });

  // Legacy authority keeps writing the flat columns, as before activation.
  await selectAuthority('legacy');
  await owner.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId,
    patch: { level: 5 },
  });
  expect(flatColumns(await stored(characterId))).toEqual({
    ...stats,
    level: 5,
  });
  const createdId = await owner.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: {
      campaignId,
      name: 'Orrin',
      description: '',
      kind: 'pc',
      ...stats,
    },
  });
  expect(flatColumns(await stored(createdId))).toEqual(stats);
});

test('under sheet authority a Character created in a campaign without a militia gets the Full presentation', async () => {
  const { owner, selectAuthority, stored } = await fixture({
    sheetCampaign: false,
  });
  await selectAuthority('sheet');
  // PRD #251, Implementation Decision 4: Militia-only is allowed only in a
  // campaign with a militia.
  const campaignId = await owner.mutation(api.campaign.createCampaign, {
    organizationId: 'org',
    name: 'Riddleport',
    description: '',
  });
  const characterId = await owner.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: {
      campaignId,
      name: 'Orrin',
      description: '',
      kind: 'pc',
      ...stats,
    },
  });
  expect(flatColumns(await stored(characterId))).toEqual(
    flatColumns({ level: 1, ...defaultAbilityScores }),
  );
  expect(
    await owner.query(api.characterSheet.read, {
      organizationId: 'org',
      characterId,
    }),
  ).toMatchObject({
    character: { sheetMode: 'full' },
    calculated: { level: 4, abilities: { charisma: { score: 17 } } },
  });
});

test('under sheet authority the archive, owner and deletion writers reach their handlers', async () => {
  const { t, owner, campaignId, characterId, selectAuthority, stored } =
    await fixture({ sheetCampaign: true });
  await selectAuthority('sheet');
  await owner.mutation(api.character.archiveCharacter, {
    organizationId: 'org',
    characterId,
    isActive: false,
  });
  expect(await stored(characterId)).toMatchObject({ isActive: false });
  const playerId = await t.run(async (ctx) => {
    const player = await ctx.db
      .query('user')
      .filter((q) => q.eq(q.field('tokenIdentifier'), 'test|player'))
      .unique();
    if (!player) throw new Error('Missing player');
    return player._id;
  });
  await owner.mutation(api.character.reassignOwner, {
    organizationId: 'org',
    campaignId,
    characterId,
    ownerUserId: playerId,
    operationId: 'reassign',
  });
  expect(await stored(characterId)).toMatchObject({ ownerId: 'test|player' });
  // The handler runs and keeps its own refusal of hard deletion.
  await expect(
    owner.mutation(api.character.deleteCharacter, {
      organizationId: 'org',
      characterId,
    }),
  ).rejects.toThrow('Keep archived characters to preserve militia history.');
});
