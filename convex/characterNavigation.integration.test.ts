// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';

const modules = import.meta.glob('./**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  const campaigns = await t.run(async (ctx) => {
    for (const person of ['owner', 'member', 'outsider']) {
      await ctx.db.insert('user', {
        tokenIdentifier: `test|${person}`,
        name: person === 'owner' ? 'Vessa Player' : 'Rook Player',
        characterSheetDemo: true,
        orgIds:
          person === 'owner'
            ? [
                { orgId: 'org-a', role: 'member' },
                { orgId: 'org-b', role: 'member' },
              ]
            : person === 'member'
              ? [{ orgId: 'org-a', role: 'member' }]
              : [],
      });
    }
    const insertCampaign = (organizationId: string, name: string) =>
      ctx.db.insert('campaign', {
        name,
        organizationId,
        ownerId: 'test|owner',
        description: '',
        e2eFixture: {
          namespace: 'navigation',
          version: 1,
          workerKey: '0',
          caseKey: organizationId,
          campaignKey: organizationId,
        },
      });
    return {
      campaignB: await insertCampaign('org-b', 'Zunder'),
      campaignA: await insertCampaign('org-a', 'Ironfang'),
    };
  });
  return {
    t,
    ...campaigns,
    owner: t.withIdentity({ tokenIdentifier: 'test|owner' }),
    member: t.withIdentity({ tokenIdentifier: 'test|member' }),
    outsider: t.withIdentity({ tokenIdentifier: 'test|outsider' }),
  };
}

const characterInput = { kind: 'pc' as const, operationId: 'create' };

test('Characters groups the caller’s owned Characters with No campaign first across organizations', async () => {
  const { owner, member, outsider, campaignA, campaignB } = await fixture();
  const campaignCharacterB = await owner.mutation(api.characterSheet.create, {
    ...characterInput,
    name: 'Second campaign',
    campaignId: campaignB,
    organizationId: 'org-b',
  });
  const privateCharacter = await owner.mutation(api.characterSheet.create, {
    ...characterInput,
    name: 'Private Vessa',
  });
  const campaignCharacterA = await owner.mutation(api.characterSheet.create, {
    ...characterInput,
    name: 'First campaign',
    campaignId: campaignA,
    organizationId: 'org-a',
  });
  await member.mutation(api.characterSheet.create, {
    ...characterInput,
    name: 'Other owner',
    campaignId: campaignA,
    organizationId: 'org-a',
  });
  await outsider.mutation(api.characterSheet.create, {
    ...characterInput,
    name: 'Other private Character',
  });

  expect(await owner.query(api.character.listOwned, {})).toMatchObject([
    { kind: 'noCampaign', characters: [{ _id: privateCharacter }] },
    {
      kind: 'campaign',
      campaignId: campaignA,
      campaignName: 'Ironfang',
      organizationId: 'org-a',
      characters: [{ _id: campaignCharacterA }],
    },
    {
      kind: 'campaign',
      campaignId: campaignB,
      campaignName: 'Zunder',
      organizationId: 'org-b',
      characters: [{ _id: campaignCharacterB }],
    },
  ]);
});

test('owned campaign Characters disappear immediately after access loss while private Characters remain undisclosed', async () => {
  const { t, owner, member, outsider, campaignB } = await fixture();
  const privateCharacter = await owner.mutation(api.characterSheet.create, {
    ...characterInput,
    name: 'Private Vessa',
  });
  const shared = await owner.mutation(api.characterSheet.create, {
    ...characterInput,
    name: 'Previously accessible',
    campaignId: campaignB,
    organizationId: 'org-b',
  });
  expect(await owner.query(api.character.listOwned, {})).toHaveLength(2);
  await t.run(async (ctx) => {
    const user = await ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', 'test|owner'),
      )
      .unique();
    await ctx.db.patch('user', user!._id, {
      orgIds: [{ orgId: 'org-a', role: 'member' }],
    });
  });
  expect(await owner.query(api.character.listOwned, {})).toMatchObject([
    { kind: 'noCampaign', characters: [{ _id: privateCharacter }] },
  ]);
  for (const caller of [member, outsider])
    expect(await caller.query(api.character.listOwned, {})).toEqual([
      { kind: 'noCampaign', characters: [] },
    ]);
  expect(await t.query(api.character.listOwned, {})).toEqual([]);
  expect(
    await t
      .withIdentity({ tokenIdentifier: 'test|unknown' })
      .query(api.character.listOwned, {}),
  ).toEqual([]);
  await t.run((ctx) => ctx.db.delete('campaign', campaignB));
  expect(await owner.query(api.character.listOwned, {})).toMatchObject([
    { kind: 'noCampaign', characters: [{ _id: privateCharacter }] },
  ]);
  await expect(
    owner.query(api.characterSheet.read, { characterId: shared }),
  ).rejects.toThrow('Character not found');
});

test('campaign Characters includes every owner and archived status, without exposing another campaign or private Characters', async () => {
  const { t, owner, member, outsider, campaignA, campaignB } = await fixture();
  const active = await owner.mutation(api.characterSheet.create, {
    ...characterInput,
    name: 'Vessa',
    campaignId: campaignA,
    organizationId: 'org-a',
  });
  const archived = await member.mutation(api.characterSheet.create, {
    ...characterInput,
    name: 'Rook',
    campaignId: campaignA,
    organizationId: 'org-a',
  });
  await member.mutation(api.characterSheet.archive, {
    characterId: archived,
    operationId: 'archive',
    isActive: false,
  });
  await owner.mutation(api.characterSheet.create, {
    ...characterInput,
    name: 'Private',
  });
  await owner.mutation(api.characterSheet.create, {
    ...characterInput,
    name: 'Other campaign',
    campaignId: campaignB,
    organizationId: 'org-b',
  });
  const args = { campaignId: campaignA, organizationId: 'org-a' };
  expect(
    await member.query(api.character.listCampaignCharacters, args),
  ).toMatchObject([
    {
      character: { _id: active, isActive: true },
      ownerName: 'Vessa Player',
      isOnRoster: false,
    },
    {
      character: { _id: archived, isActive: false },
      ownerName: 'Rook Player',
      isOnRoster: false,
    },
  ]);
  for (const caller of [outsider, t])
    expect(
      await caller.query(api.character.listCampaignCharacters, args),
    ).toEqual([]);
  expect(
    await member.query(api.character.listCampaignCharacters, {
      campaignId: campaignB,
      organizationId: 'org-a',
    }),
  ).toEqual([]);
});

test('campaign Characters distinguishes roster membership from other Characters and tolerates an absent owner', async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const seeded = await owner.run((ctx) => seedAcceptedCampaign(ctx));
  expect(
    await owner.query(api.campaign.listNavigationContexts, {
      organizationId: 'org',
    }),
  ).toEqual([{ campaignId: seeded.key.campaignId, hasMilitia: true, week: 9 }]);
  const offRoster = await owner.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: {
      campaignId: seeded.key.campaignId,
      name: 'Off roster',
      description: '',
      kind: 'npc',
      level: 1,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
  });
  await t.run((ctx) =>
    ctx.db.patch('character', offRoster, { ownerId: undefined }),
  );
  expect(
    await owner.query(api.character.listCampaignCharacters, {
      campaignId: seeded.key.campaignId,
      organizationId: 'org',
    }),
  ).toMatchObject([
    {
      character: { _id: seeded.characterId },
      ownerName: null,
      isOnRoster: true,
    },
    { character: { _id: offRoster }, ownerName: null, isOnRoster: false },
  ]);
});

test('campaign Characters refuses oversized lists instead of returning a partial ledger', async () => {
  const { t, member, campaignA } = await fixture();
  await t.run(async (ctx) => {
    for (let index = 0; index < 4097; index++)
      await ctx.db.insert('character', {
        campaignId: campaignA,
        name: `Character ${index}`,
        description: '',
        kind: 'npc',
        isActive: true,
        level: 1,
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      });
  });
  const args = { campaignId: campaignA, organizationId: 'org-a' };
  await expect(
    member.query(api.character.listByCampaign, {
      ...args,
      includeInactive: true,
    }),
  ).rejects.toThrow('Too many Characters to load');
  await expect(
    member.query(api.character.listCampaignCharacters, args),
  ).rejects.toThrow('Too many Characters to load');
});

test('campaign creation opens a Full sheet whose unscoped read supplies its safe campaign context without requiring militia', async () => {
  const { owner, member, outsider, campaignA } = await fixture();
  const characterId = await owner.mutation(api.characterSheet.create, {
    ...characterInput,
    name: 'Vessa',
    campaignId: campaignA,
    organizationId: 'org-a',
  });
  expect(
    await member.query(api.characterSheet.read, { characterId }),
  ).toMatchObject({
    character: { _id: characterId, sheetMode: 'full' },
    campaign: {
      campaignId: campaignA,
      campaignName: 'Ironfang',
      organizationId: 'org-a',
    },
    calculated: { level: 1 },
  });
  const privateId = await owner.mutation(api.characterSheet.create, {
    ...characterInput,
    name: 'Private Vessa',
  });
  expect(
    await owner.query(api.characterSheet.read, { characterId: privateId }),
  ).toMatchObject({ campaign: null });
  await expect(
    outsider.query(api.characterSheet.read, { characterId }),
  ).rejects.toThrow('Character not found');
});

test('campaign navigation distinguishes an absent militia from one awaiting setup without exposing inaccessible metadata', async () => {
  const { t, owner, member, outsider, campaignA, campaignB } = await fixture();
  await t.run((ctx) =>
    ctx.db.insert('militia', { campaignId: campaignA, name: 'Awaiting setup' }),
  );
  expect(
    await owner.query(api.campaign.listNavigationContexts, {
      organizationId: 'org-a',
    }),
  ).toEqual([{ campaignId: campaignA, hasMilitia: true }]);
  expect(
    await owner.query(api.campaign.listNavigationContexts, {
      organizationId: 'org-b',
    }),
  ).toEqual([{ campaignId: campaignB, hasMilitia: false }]);
  for (const caller of [member, outsider, t])
    expect(
      await caller.query(api.campaign.listNavigationContexts, {
        organizationId: 'org-b',
      }),
    ).toEqual([]);
  expect(await owner.query(api.campaign.listNavigationContexts, {})).toEqual(
    [],
  );
});
