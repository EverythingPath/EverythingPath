// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import {
  makeFunctionReference,
  type FunctionArgs,
  type FunctionReturnType,
} from 'convex/server';
import { expect, test } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';
import { initializeCharacterSheet } from './lib/characterSheet';
import {
  requireCharacterDepartureAccess,
  type CharacterScope,
} from './lib/characterAccess';

const modules = import.meta.glob('./**/*.ts');

test('list and sheet reads project the current owner and archive state without additional profile reads', async () => {
  const { t, owner, member, users, scope } = await fixture();
  await t.run(async (ctx) => {
    await ctx.db.patch('user', users.owner, { name: '  Ada  ' });
    await initializeCharacterSheet(ctx, {
      characterId: scope.characterId,
      operationId: 'initialize',
      updatedBy: 'test|owner',
    });
  });
  await owner.mutation(api.character.archiveCharacter, {
    characterId: scope.characterId,
    organizationId: scope.organizationId,
    isActive: false,
  });
  const campaignScope = {
    campaignId: scope.campaignId,
    organizationId: scope.organizationId,
  };
  expect(
    await member.query(api.character.listByCampaign, campaignScope),
  ).toEqual([]);
  expect(
    await owner.query(api.character.listByCampaign, {
      ...campaignScope,
      includeInactive: true,
    }),
  ).toMatchObject([
    {
      isActive: false,
      owner: { userId: users.owner, name: 'Ada', isMine: true },
    },
  ]);
  expect(
    await member.query(api.character.listCampaignCharacters, campaignScope),
  ).toMatchObject([
    {
      character: { isActive: false },
      ownerName: 'Ada',
      owner: { userId: users.owner, name: 'Ada', isMine: false },
    },
  ]);
  expect(
    await owner.query(api.characterSheet.read, {
      characterId: scope.characterId,
    }),
  ).toMatchObject({
    owner: { userId: users.owner, name: 'Ada', isMine: true },
    character: { isActive: false },
  });
  await t.run((ctx) => ctx.db.patch('user', users.owner, { name: '  ' }));
  expect(await member.query(api.characterSheet.read, scope)).toMatchObject({
    owner: { name: 'Unnamed member', isMine: false },
  });
});

test('membership pages use only this organization and recheck stale and deleted profiles', async () => {
  const { t, owner, member, users, scope } = await fixture();
  for (const tokenIdentifier of ['test|owner', 'test|member'])
    await t.mutation(internal.user.addOrgIdToUser, {
      tokenIdentifier,
      orgId: 'org',
      role: 'member',
      webhookUpdatedAt: 1,
    });
  await t.run(async (ctx) => {
    for (let index = 0; index < 30; index++)
      await ctx.db.insert('user', {
        tokenIdentifier: `other|${index}`,
        orgIds: [],
      });
  });
  const first = await owner.query(api.character.listOwnerCandidates, {
    campaignId: scope.campaignId,
    paginationOpts: { cursor: null, numItems: 1 },
  });
  expect(first.page).toEqual([
    { userId: users.owner, name: 'Ada', isMine: true },
  ]);
  const second = await member.query(api.character.listOwnerCandidates, {
    campaignId: scope.campaignId,
    paginationOpts: { cursor: first.continueCursor, numItems: 1 },
  });
  expect(second.page).toEqual([
    { userId: users.member, name: 'Bryn', isMine: true },
  ]);
  expect(second.isDone).toBe(true);
  await t.run(async (ctx) => {
    await ctx.db.patch('user', users.member, { orgIds: [] });
    await ctx.db.delete('user', users.owner);
    await ctx.db.insert('user', {
      tokenIdentifier: 'test|remaining',
      orgIds: [{ orgId: 'org', role: 'member' }],
    });
  });
  const remaining = t.withIdentity({ tokenIdentifier: 'test|remaining' });
  const emptyPage = await remaining.query(api.character.listOwnerCandidates, {
    campaignId: scope.campaignId,
    paginationOpts: { cursor: null, numItems: 1 },
  });
  expect(emptyPage.page).toEqual([]);
  expect(emptyPage.isDone).toBe(false);
  const stale = await remaining.query(api.character.listOwnerCandidates, {
    campaignId: scope.campaignId,
    paginationOpts: { cursor: emptyPage.continueCursor, numItems: 10 },
  });
  expect(stale.page).toEqual([]);
  expect(stale.isDone).toBe(true);
  await expect(
    remaining.query(api.character.listOwnerCandidates, {
      campaignId: scope.campaignId,
      paginationOpts: { cursor: null, numItems: 1000 },
    }),
  ).rejects.toThrow('Choose a member page size from 1 to 100');
});

async function fixture({ prepared = true } = {}) {
  const t = convexTest(schema, modules);
  const users = await t.run(async (ctx) => {
    const owner = await ctx.db.insert('user', {
      tokenIdentifier: 'test|owner',
      name: 'Ada',
      orgIds: [{ orgId: 'org', role: 'member' }],
    });
    const member = await ctx.db.insert('user', {
      tokenIdentifier: 'test|member',
      name: 'Bryn',
      orgIds: [{ orgId: 'org', role: 'member' }],
    });
    const outsider = await ctx.db.insert('user', {
      tokenIdentifier: 'test|outsider',
      name: 'Secret profile',
      orgIds: [],
    });
    return { owner, member, outsider };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
  const campaignId = await owner.mutation(api.campaign.createCampaign, {
    name: 'Ironfang',
    description: '',
    organizationId: 'org',
  });
  if (prepared)
    await t.run((ctx) =>
      ctx.db.patch('campaign', campaignId, {
        e2eFixture: {
          namespace: 'ownership',
          version: 1,
          workerKey: '0',
          caseKey: 'ownership',
          campaignKey: 'ownership',
        },
      }),
    );
  const characterId = await owner.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: {
      campaignId,
      name: 'Vessa',
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
  const scope = { characterId, campaignId, organizationId: 'org' };
  for (const tokenIdentifier of ['test|owner', 'test|member'])
    await t.mutation(internal.user.addOrgIdToUser, {
      tokenIdentifier,
      orgId: 'org',
      role: 'member',
      webhookUpdatedAt: 0,
    });
  return { t, users, owner, member, outsider, scope };
}

async function readOwner(
  caller: Awaited<ReturnType<typeof fixture>>['owner'],
  scope: CharacterScope,
) {
  const characters = await caller.query(api.character.listByCampaign, {
    campaignId: scope.campaignId,
    organizationId: scope.organizationId ?? 'org',
    includeInactive: true,
  });
  return (
    characters.find((character) => character._id === scope.characterId)
      ?.owner ?? null
  );
}

async function checkDeparture(
  caller: Awaited<ReturnType<typeof fixture>>['owner'],
  scope: CharacterScope,
) {
  return caller.run(async (ctx) => {
    await requireCharacterDepartureAccess(ctx, scope);
    return null;
  });
}

test('production legacy Characters keep their owner until explicit cutover', async () => {
  const { t, owner, member, users, scope } = await fixture({ prepared: false });
  await t.run((ctx) =>
    ctx.db.patch('character', scope.characterId, {
      ownerLastOperationId: 'existing-owner-operation',
    }),
  );
  const listScope = {
    campaignId: scope.campaignId,
    organizationId: scope.organizationId,
  };
  const before = await owner.query(api.character.listByCampaign, listScope);
  await expect(
    member.mutation(api.character.reassignOwner, {
      ...scope,
      ownerUserId: users.member,
      operationId: 'production-owner',
    }),
  ).rejects.toThrow("Owner assignment isn't available for this campaign yet.");
  expect(await readOwner(owner, scope)).toEqual({
    userId: users.owner,
    name: 'Ada',
    isMine: true,
  });
  expect(await owner.query(api.character.listByCampaign, listScope)).toEqual(
    before,
  );
});

test('production campaigns do not expose an ownership member picker after directory preparation', async () => {
  const { member, scope } = await fixture({ prepared: false });
  await expect(
    member.query(api.character.listOwnerCandidates, {
      campaignId: scope.campaignId,
      organizationId: scope.organizationId,
      paginationOpts: { cursor: null, numItems: 10 },
    }),
  ).rejects.toThrow("Owner assignment isn't available for this campaign yet.");
});

test('independent sheet reads expose ownership eligibility from the persisted campaign', async () => {
  const { t, member, scope } = await fixture({ prepared: false });
  await t.run((ctx) =>
    initializeCharacterSheet(ctx, {
      characterId: scope.characterId,
      operationId: 'initialize',
      updatedBy: 'test|owner',
    }),
  );
  const independent = { characterId: scope.characterId };
  expect(
    await member.query(api.characterSheet.read, independent),
  ).toMatchObject({
    campaign: { campaignId: scope.campaignId, ownershipAvailable: false },
  });
  await t.run((ctx) =>
    ctx.db.patch('campaign', scope.campaignId, {
      e2eFixture: {
        namespace: 'ownership',
        version: 1,
        workerKey: '0',
        caseKey: 'ownership',
        campaignKey: 'ownership',
      },
    }),
  );
  expect(
    await member.query(api.characterSheet.read, independent),
  ).toMatchObject({
    campaign: { campaignId: scope.campaignId, ownershipAvailable: true },
  });
});

test('a campaign member assigns ownership to themselves without approval and both members retain editing', async () => {
  const { owner, member, users, scope } = await fixture();
  await member.mutation(api.character.reassignOwner, {
    ...scope,
    ownerUserId: users.member,
    operationId: 'take-owner',
  });
  await owner.mutation(api.character.updateCharacter, {
    characterId: scope.characterId,
    organizationId: scope.organizationId,
    patch: { description: 'Still shared' },
  });
  await member.mutation(api.character.archiveCharacter, {
    characterId: scope.characterId,
    organizationId: scope.organizationId,
    isActive: false,
  });
  expect(
    await owner.query(api.character.listByCampaign, {
      campaignId: scope.campaignId,
      organizationId: scope.organizationId,
      includeInactive: true,
    }),
  ).toMatchObject([
    {
      ownerId: 'test|member',
      ownerLastOperationId: 'take-owner',
      description: 'Still shared',
      isActive: false,
    },
  ]);
});

test('legacy assignments record each operation even when the recipient already owns the Character', async () => {
  const { owner, member, users, scope } = await fixture();
  const listArgs = {
    campaignId: scope.campaignId,
    organizationId: scope.organizationId,
  };
  const before = await owner.query(api.character.listByCampaign, listArgs);
  expect(before[0]?.ownerLastOperationId).toBeUndefined();
  for (const operationId of ['same-owner-first', 'same-owner-second']) {
    await member.mutation(api.character.reassignOwner, {
      ...scope,
      ownerUserId: users.owner,
      operationId,
    });
    const after = await owner.query(api.character.listByCampaign, listArgs);
    expect(after[0]).toEqual({
      ...before[0],
      ownerLastOperationId: operationId,
    });
  }
});

test('claiming a Character immediately supplies departure authority and invalidates the former owner', async () => {
  const { owner, member, users, scope } = await fixture();
  expect(await checkDeparture(owner, scope)).toBeNull();
  await expect(checkDeparture(member, scope)).rejects.toThrow(
    'Only the current owner',
  );
  await member.mutation(api.character.reassignOwner, {
    ...scope,
    ownerUserId: users.member,
    operationId: 'claim',
  });
  expect(await checkDeparture(member, scope)).toBeNull();
  await expect(checkDeparture(owner, scope)).rejects.toThrow(
    'Only the current owner',
  );
  expect(
    await owner.query(api.character.listByCampaign, {
      campaignId: scope.campaignId,
      organizationId: scope.organizationId,
    }),
  ).toMatchObject([
    {
      _id: scope.characterId,
      campaignId: scope.campaignId,
      ownerId: 'test|member',
    },
  ]);
});

test('members see protected owner names and a bounded directory containing only current members', async () => {
  const { owner, member, outsider, users, scope } = await fixture();
  expect(await readOwner(member, scope)).toEqual({
    userId: users.owner,
    name: 'Ada',
    isMine: false,
  });
  let cursor: string | null = null;
  const names: string[] = [];
  let isDone = false;
  while (!isDone) {
    const page: FunctionReturnType<typeof api.character.listOwnerCandidates> =
      await member.query(api.character.listOwnerCandidates, {
        campaignId: scope.campaignId,
        organizationId: scope.organizationId,
        paginationOpts: { cursor, numItems: 1 },
      });
    names.push(...page.page.map((person) => person.name));
    cursor = page.continueCursor;
    isDone = page.isDone;
  }
  expect(names.sort()).toEqual(['Ada', 'Bryn']);
  expect(await readOwner(outsider, scope)).toBeNull();
  await expect(
    outsider.query(api.character.listOwnerCandidates, {
      campaignId: scope.campaignId,
      organizationId: scope.organizationId,
      paginationOpts: { cursor: null, numItems: 10 },
    }),
  ).rejects.toThrow('You do not have access');
  await owner.mutation(api.character.reassignOwner, {
    ...scope,
    ownerUserId: users.member,
    operationId: 'assign-another',
  });
  expect(await readOwner(member, scope)).toEqual({
    userId: users.member,
    name: 'Bryn',
    isMine: true,
  });
});

test('independent campaign sheets derive their organization and refuse an asserted different organization', async () => {
  const { member, users, scope } = await fixture();
  const independent = {
    characterId: scope.characterId,
    campaignId: scope.campaignId,
  };
  expect(await readOwner(member, independent)).toEqual({
    userId: users.owner,
    name: 'Ada',
    isMine: false,
  });
  const members = await member.query(api.character.listOwnerCandidates, {
    campaignId: scope.campaignId,
    paginationOpts: { cursor: null, numItems: 10 },
  });
  expect(members.page.map((candidate) => candidate.name).sort()).toEqual([
    'Ada',
    'Bryn',
  ]);
  await member.mutation(api.character.reassignOwner, {
    ...independent,
    ownerUserId: users.member,
    operationId: 'independent',
  });
  expect(await checkDeparture(member, independent)).toBeNull();
  expect(
    await readOwner(member, { ...independent, organizationId: 'other' }),
  ).toBeNull();
  await expect(
    member.query(api.character.listOwnerCandidates, {
      campaignId: scope.campaignId,
      organizationId: 'other',
      paginationOpts: { cursor: null, numItems: 10 },
    }),
  ).rejects.toThrow('You do not have access');
  expect(await readOwner(member, independent)).toEqual({
    userId: users.member,
    name: 'Bryn',
    isMine: true,
  });
});

test('outsiders, missing accounts and recipients without current access cannot change ownership', async () => {
  const { t, owner, member, outsider, users, scope } = await fixture();
  const command = {
    ...scope,
    ownerUserId: users.member,
    operationId: 'reassign',
  };
  for (const caller of [outsider, t])
    await expect(
      caller.mutation(api.character.reassignOwner, command),
    ).rejects.toThrow('You do not have access');
  await expect(
    member.mutation(api.character.reassignOwner, {
      ...command,
      ownerUserId: users.outsider,
    }),
  ).rejects.toThrow('Choose a current campaign member');
  await t.run((ctx) => ctx.db.delete('user', users.outsider));
  await expect(
    owner.mutation(api.character.reassignOwner, {
      ...command,
      ownerUserId: users.outsider,
    }),
  ).rejects.toThrow('Choose a current campaign member');
  await expect(
    member.mutation(api.character.reassignOwner, {
      ...command,
      organizationId: 'other',
    }),
  ).rejects.toThrow('You do not have access');
  const otherCampaign = await owner.mutation(api.campaign.createCampaign, {
    name: 'Other',
    description: '',
    organizationId: 'org',
  });
  await expect(
    member.mutation(api.character.reassignOwner, {
      ...command,
      campaignId: otherCampaign,
    }),
  ).rejects.toThrow('Character not found');
  const candidates = await member.query(api.character.listOwnerCandidates, {
    campaignId: scope.campaignId,
    organizationId: 'org',
    paginationOpts: { cursor: null, numItems: 10 },
  });
  expect(
    candidates.page.some((candidate) => candidate.userId === users.member),
  ).toBe(true);
  await t.run((ctx) => ctx.db.patch('user', users.member, { orgIds: [] }));
  await expect(
    owner.mutation(api.character.reassignOwner, command),
  ).rejects.toThrow('Choose a current campaign member');
  expect(await readOwner(owner, scope)).toEqual({
    userId: users.owner,
    name: 'Ada',
    isMine: true,
  });
});

test('a departed or deleted old owner does not prevent a surviving member assigning an archived Character', async () => {
  const { t, owner, member, users, scope } = await fixture();
  await owner.mutation(api.character.archiveCharacter, {
    organizationId: 'org',
    characterId: scope.characterId,
    isActive: false,
  });
  await t.run((ctx) => ctx.db.patch('user', users.owner, { orgIds: [] }));
  expect(await readOwner(member, scope)).toEqual({
    userId: users.owner,
    name: 'Ada',
    isMine: false,
  });
  await expect(checkDeparture(owner, scope)).rejects.toThrow(
    'You do not have access',
  );
  await expect(
    owner.mutation(api.character.reassignOwner, {
      ...scope,
      ownerUserId: users.member,
      operationId: 'stale-owner',
    }),
  ).rejects.toThrow('You do not have access');
  await member.mutation(api.character.reassignOwner, {
    ...scope,
    ownerUserId: users.member,
    operationId: 'surviving-member',
  });
  await t.run(async (ctx) => {
    await ctx.db.patch('character', scope.characterId, {
      ownerId: 'test|owner',
    });
    await ctx.db.delete('user', users.owner);
  });
  expect(await readOwner(member, scope)).toBeNull();
  await t.run((ctx) =>
    ctx.db.patch('character', scope.characterId, { ownerId: undefined }),
  );
  expect(await readOwner(member, scope)).toBeNull();
  await member.mutation(api.character.reassignOwner, {
    ...scope,
    ownerUserId: users.member,
    operationId: 'replace-deleted',
  });
  expect(await readOwner(member, scope)).toEqual({
    userId: users.member,
    name: 'Bryn',
    isMine: true,
  });
  expect(
    await member.query(api.character.listByCampaign, {
      campaignId: scope.campaignId,
      organizationId: 'org',
      includeInactive: true,
    }),
  ).toMatchObject([{ ownerId: 'test|member', isActive: false }]);
});

test('a Character outside a campaign cannot be transferred even by its owner', async () => {
  const { t, owner, member, users, scope } = await fixture();
  await t.run(async (ctx) => {
    await ctx.db.patch('user', users.owner, { characterSheetDemo: true });
    await ctx.db.patch('character', scope.characterId, {
      campaignId: undefined,
      sheetDemo: true,
    });
    await initializeCharacterSheet(ctx, {
      characterId: scope.characterId,
      operationId: 'private-fixture',
      updatedBy: 'test|owner',
    });
  });
  for (const caller of [owner, member])
    await expect(
      caller.mutation(api.character.reassignOwner, {
        ...scope,
        ownerUserId: users.member,
        operationId: 'private',
      }),
    ).rejects.toThrow('Character not found');
  const missingCampaignBoundary = makeFunctionReference<
    'mutation',
    Omit<
      FunctionArgs<typeof api.character.reassignOwner>,
      'campaignId' | 'organizationId'
    >,
    null
  >('character:reassignOwner');
  await expect(
    owner.mutation(missingCampaignBoundary, {
      characterId: scope.characterId,
      ownerUserId: users.member,
      operationId: 'private-without-campaign',
    }),
  ).rejects.toThrow();
  expect(
    await owner.query(api.characterSheet.read, {
      characterId: scope.characterId,
    }),
  ).toMatchObject({
    character: { _id: scope.characterId, ownerId: 'test|owner' },
  });
});

test('maintenance freezes ownership and reopened epochs reject commands from the previous window', async () => {
  const { t, member, users, scope } = await fixture();
  const command = { ...scope, ownerUserId: users.member, operationId: 'gated' };
  const run = await t.mutation(internal.initialMigration.start, {
    operationId: 'migration',
    expectedEpoch: 0,
    frontendBuild: 'test',
    catalogManifest: 'test',
    maintenanceBudgetMs: 60000,
  });
  await expect(
    member.mutation(api.character.reassignOwner, command),
  ).rejects.toThrow('MAINTENANCE');
  expect(await readOwner(member, scope)).toEqual({
    userId: users.owner,
    name: 'Ada',
    isMine: false,
  });
  await t.mutation(internal.initialMigration.abortBeforeActivation, run);
  await expect(
    member.mutation(api.character.reassignOwner, command),
  ).rejects.toThrow('RELOAD_REQUIRED');
  await member.mutation(api.character.reassignOwner, {
    ...command,
    writeEpoch: 2,
  });
  expect(await readOwner(member, scope)).toEqual({
    userId: users.member,
    name: 'Bryn',
    isMine: true,
  });
});

test('prepared sheet ownership stays isolated until activation and preserves live Accepted Warnings', async () => {
  const { t, owner, member, users, scope } = await fixture({ prepared: false });
  await t.run((ctx) =>
    initializeCharacterSheet(ctx, {
      characterId: scope.characterId,
      operationId: 'initialize',
      updatedBy: 'test|owner',
    }),
  );
  const command = {
    ...scope,
    ownerUserId: users.member,
    operationId: 'sheet-owner',
  };
  const productionSheet = await owner.query(api.characterSheet.read, scope);
  await expect(
    member.mutation(api.character.reassignOwner, command),
  ).rejects.toThrow("Owner assignment isn't available for this campaign yet.");
  await expect(
    member.query(api.character.listOwnerCandidates, {
      campaignId: scope.campaignId,
      paginationOpts: { cursor: null, numItems: 10 },
    }),
  ).rejects.toThrow("Owner assignment isn't available for this campaign yet.");
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(
    productionSheet,
  );
  expect(await readOwner(owner, scope)).toEqual({
    userId: users.owner,
    name: 'Ada',
    isMine: true,
  });
  await t.run((ctx) =>
    ctx.db.patch('campaign', scope.campaignId, {
      e2eFixture: {
        namespace: 'ownership',
        version: 1,
        workerKey: '0',
        caseKey: 'ownership',
        campaignKey: 'ownership',
      },
    }),
  );
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    operationId: 'point-buy',
    settings: { abilityMethod: { kind: 'pointBuy', budget: 20 } },
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    operationId: 'scores',
    scores: {
      strength: 18,
      dexterity: 18,
      constitution: 18,
      intelligence: 18,
      wisdom: 18,
      charisma: 18,
    },
  });
  const before = await owner.query(api.characterSheet.read, scope);
  const warning = before?.calculated.warnings.find(
    (warning) => warning.check === 'pointBuy',
  );
  expect(warning).toBeDefined();
  if (!warning) throw new Error('Expected point-buy warning');
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    operationId: 'accept',
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
  });
  const accepted = await owner.query(api.characterSheet.read, scope);
  await t.run((ctx) =>
    ctx.db.insert('acceptedWarning', {
      characterId: scope.characterId,
      check: 'retired-warning',
      subject: 'sheet',
      fingerprint: 'old',
      acceptedBy: 'test|owner',
      acceptedAt: 1,
    }),
  );
  await member.mutation(api.character.reassignOwner, command);
  const after = await owner.query(api.characterSheet.read, scope);
  expect(after?.character.ownerId).toBe('test|member');
  expect(after?.acceptedWarnings).toEqual(accepted?.acceptedWarnings);
  expect(after?.entries).toEqual(accepted?.entries);
  expect(after?.calculated).toEqual(accepted?.calculated);
  expect(after?.lastOperationId).toBe('sheet-owner');
  expect(after?.updatedBy).toBe('test|member');
});
