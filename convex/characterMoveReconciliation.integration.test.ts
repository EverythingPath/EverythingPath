// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import type { FunctionArgs } from 'convex/server';
import { beforeAll, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
preloadCalledConvexModules({ modules, testFile: import.meta.url });

const scores = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};
const feat = {
  name: 'Strong heart',
  modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
  stacksWithItself: false,
  sources: [],
  detail: { kind: 'feat' },
} satisfies FunctionArgs<typeof api.catalogCopies.createOneOff>['definition'];

async function fixture() {
  const t = convexTest(schema, modules);
  const campaigns = await t.run(async (ctx) => {
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
    const ids: Id<'campaign'>[] = [];
    for (const name of ['A', 'B'])
      ids.push(
        await ctx.db.insert('campaign', {
          name,
          description: '',
          organizationId: 'org',
          ownerId: 'test|owner',
          e2eFixture: {
            namespace: 'move-reconciliation',
            version: 1,
            workerKey: '0',
            caseKey: name,
            campaignKey: name,
          },
        }),
      );
    return ids;
  });
  const [campaignA, campaignB] = campaigns;
  if (!campaignA || !campaignB) throw new Error('Campaigns missing');
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId: campaignA,
    organizationId: 'org',
    name: 'Vessa',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { organizationId: 'org', campaignId: campaignA, characterId };
  return {
    t,
    owner,
    member,
    outsider,
    characterId,
    campaignA,
    campaignB,
    scope,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

/** A campaign feat a player created and saved to the source campaign. */
async function saveCampaignFeat({ t, owner, scope }: Fixture) {
  const entryId = await owner.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'create-feat',
    definition: feat,
  });
  // The one-off's own definition, read without loading the whole sheet.
  const entry = await t.run((ctx) =>
    ctx.db.get('characterSheetEntry', entryId),
  );
  if (!entry || !('catalogEntryId' in entry)) throw new Error('Feat missing');
  await owner.mutation(api.catalogCopies.saveToCatalog, {
    ...scope,
    catalogEntryId: entry.catalogEntryId,
    operationId: 'save-feat',
  });
  return { entryId, catalogEntryId: entry.catalogEntryId };
}

async function readSheet(
  viewer: Fixture['owner'],
  characterId: Id<'character'>,
) {
  return withSheetCatalog(
    await viewer.query(api.characterSheet.read, { characterId }),
  );
}

/** Start a move and prepare it until only publication remains. */
async function prepareMove(
  owner: Fixture['owner'],
  command: {
    characterId: Id<'character'>;
    operationId: string;
    destinationCampaignId?: Id<'campaign'>;
  },
) {
  let progress = await owner.mutation(api.characterMoves.start, command);
  for (let i = 0; i < 50 && progress.state === 'preparing'; i++)
    progress = await owner.mutation(api.characterMoves.resume, {
      characterId: command.characterId,
      operationId: command.operationId,
    });
  expect(progress.state).toBe('ready');
  return progress;
}

test('a second player edit made while a move is ready is published with it instead of restarting preparation', async () => {
  const context = await fixture();
  const { owner, member, characterId, campaignA, campaignB } = context;
  const { entryId, catalogEntryId } = await saveCampaignFeat(context);
  const command = { characterId, operationId: 'to-B' };
  const ready = await prepareMove(owner, {
    ...command,
    destinationCampaignId: campaignB,
  });
  expect(ready.generation).toBe(0);
  await member.mutation(api.characterSheet.editBaseScores, {
    organizationId: 'org',
    campaignId: campaignA,
    characterId,
    operationId: 'second-player',
    scores: { ...scores, strength: 15 },
  });
  // The edited base scores re-stage only their own definition.
  const progress = [await owner.mutation(api.characterMoves.resume, command)];
  progress.push(await owner.mutation(api.characterMoves.resume, command));
  expect(progress).toEqual([
    expect.objectContaining({ state: 'ready', generation: 0 }),
    expect.objectContaining({ state: 'completed', generation: 0 }),
  ]);
  const after = await readSheet(member, characterId);
  expect(after?.campaign?.campaignId).toBe(campaignB);
  expect(after?.calculated.abilities.strength.score).toBe(17);
  const carried = after?.catalogEntries.find(
    (row) => row.copiedFrom === catalogEntryId,
  );
  expect(after?.entries.find((row) => row._id === entryId)).toMatchObject({
    catalogEntryId: carried?._id,
  });
});

async function readUserId(t: Fixture['t'], name: string) {
  const user = await t.run((ctx) =>
    ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', `test|${name}`),
      )
      .unique(),
  );
  if (!user) throw new Error(`${name} missing`);
  return user._id;
}

async function finishMove(
  owner: Fixture['owner'],
  command: { characterId: Id<'character'>; operationId: string },
) {
  let progress = await owner.mutation(api.characterMoves.resume, command);
  for (let i = 0; i < 50 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('completed');
  return progress;
}

test('a dependency added on a second device during preparation restarts it and both dependencies arrive together', async () => {
  const context = await fixture();
  const { owner, characterId, campaignB, scope } = context;
  const first = await saveCampaignFeat(context);
  const command = { characterId, operationId: 'to-B' };
  await prepareMove(owner, { ...command, destinationCampaignId: campaignB });
  const secondEntryId = await owner.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'second-device',
    definition: { ...feat, name: 'Quick hands' },
  });
  const progress = await finishMove(owner, command);
  expect(progress.generation).toBe(1);
  const after = await readSheet(owner, characterId);
  const carried = after?.catalogEntries.find(
    (row) => row.copiedFrom === first.catalogEntryId,
  );
  expect(after?.entries.find((row) => row._id === first.entryId)).toMatchObject(
    { catalogEntryId: carried?._id },
  );
  const second = after?.entries.find((row) => row._id === secondEntryId);
  expect(
    after?.catalogEntries.find(
      (row) =>
        second &&
        'catalogEntryId' in second &&
        row._id === second.catalogEntryId,
    ),
  ).toMatchObject({ name: 'Quick hands', scope: 'character', characterId });
  expect(after?.calculated.abilities.strength.score).toBe(14);
});

test('a campaign homebrew edit during preparation reaches the carried copy and the source stays in its campaign', async () => {
  const context = await fixture();
  const { t, owner, member, characterId, campaignA, campaignB, scope } =
    context;
  const { catalogEntryId } = await saveCampaignFeat(context);
  const command = { characterId, operationId: 'to-B' };
  await prepareMove(owner, { ...command, destinationCampaignId: campaignB });
  const memberCharacterId = await member.mutation(api.characterSheet.create, {
    campaignId: campaignA,
    organizationId: 'org',
    name: 'Orrin',
    kind: 'pc',
    operationId: 'create-member',
  });
  await member.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId,
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 4 }],
    operationId: 'stronger',
  });
  expect(
    (await owner.query(api.catalogCopies.list, { characterId })).filter(
      (row) => row.copiedFrom === catalogEntryId,
    ),
  ).toEqual([]);
  const progress = await finishMove(owner, command);
  expect(progress.generation).toBe(0);
  const after = await readSheet(owner, characterId);
  expect(after?.calculated.abilities.strength.score).toBe(14);
  expect(
    after?.catalogEntries.find((row) => row.copiedFrom === catalogEntryId),
  ).toMatchObject({
    scope: 'character',
    characterId,
    modifiers: [expect.objectContaining({ value: 4 })],
  });
  expect(
    (
      await member.query(api.catalogCopies.list, {
        characterId: memberCharacterId,
      })
    ).find((row) => row._id === catalogEntryId),
  ).toMatchObject({ scope: 'campaign', campaignId: campaignA });
  expect(
    await t.run((ctx) => ctx.db.get('catalogEntry', catalogEntryId)),
  ).toMatchObject({ scope: 'campaign', campaignId: campaignA });
});

test('an ownership change during preparation fences the move even after ownership returns', async () => {
  const context = await fixture();
  const { t, owner, member, characterId, campaignA, campaignB } = context;
  await saveCampaignFeat(context);
  const command = { characterId, operationId: 'to-B' };
  await prepareMove(owner, { ...command, destinationCampaignId: campaignB });
  const before = await readSheet(owner, characterId);
  const reassign = {
    characterId,
    campaignId: campaignA,
    organizationId: 'org',
  };
  await member.mutation(api.character.reassignOwner, {
    ...reassign,
    ownerUserId: await readUserId(t, 'member'),
    operationId: 'take',
  });
  await expect(
    owner.mutation(api.characterMoves.resume, command),
  ).rejects.toThrow('Only the current owner');
  await member.mutation(api.character.reassignOwner, {
    ...reassign,
    ownerUserId: await readUserId(t, 'owner'),
    operationId: 'give-back',
  });
  const fenced = { state: 'cancelled', cancelReason: 'ownershipChanged' };
  expect(await owner.query(api.characterMoves.status, command)).toMatchObject(
    fenced,
  );
  expect(
    await owner.mutation(api.characterMoves.resume, command),
  ).toMatchObject(fenced);
  expect(
    await owner.mutation(api.characterMoves.resume, command),
  ).toMatchObject(fenced);
  const after = await readSheet(owner, characterId);
  expect(after?.campaign?.campaignId).toBe(campaignA);
  expect(after?.entries).toEqual(before?.entries);
  expect(after?.catalogEntries).toEqual(before?.catalogEntries);
  await prepareMove(owner, {
    characterId,
    operationId: 'again',
    destinationCampaignId: campaignB,
  });
  await finishMove(owner, { characterId, operationId: 'again' });
  expect((await readSheet(owner, characterId))?.campaign?.campaignId).toBe(
    campaignB,
  );
});

test('a move started on a second device replaces the first, which stays stopped', async () => {
  const context = await fixture();
  const { owner, characterId, campaignB } = context;
  await saveCampaignFeat(context);
  const first = { characterId, operationId: 'tablet' };
  await prepareMove(owner, { ...first, destinationCampaignId: campaignB });
  const second = { characterId, operationId: 'phone' };
  await prepareMove(owner, second);
  const replaced = { state: 'cancelled', cancelReason: 'replaced' };
  expect(await owner.mutation(api.characterMoves.resume, first)).toMatchObject(
    replaced,
  );
  await finishMove(owner, second);
  expect(await owner.query(api.characterMoves.status, first)).toMatchObject(
    replaced,
  );
  expect(await owner.mutation(api.characterMoves.resume, first)).toMatchObject(
    replaced,
  );
  expect((await readSheet(owner, characterId))?.campaign).toBeNull();
});

test('retrying after lost responses repeats no preparation or publication effects', async () => {
  const context = await fixture();
  const { owner, characterId, campaignB } = context;
  const { catalogEntryId } = await saveCampaignFeat(context);
  const command = { characterId, operationId: 'to-B' };
  const started = await owner.mutation(api.characterMoves.start, {
    ...command,
    destinationCampaignId: campaignB,
  });
  expect(
    await owner.mutation(api.characterMoves.start, {
      ...command,
      destinationCampaignId: campaignB,
    }),
  ).toEqual(started);
  await expect(
    owner.mutation(api.characterMoves.start, command),
  ).rejects.toThrow('Move operation already used');
  const completed = await finishMove(owner, command);
  const published = await readSheet(owner, characterId);
  const copies = await owner.query(api.catalogCopies.list, { characterId });
  expect(
    copies.filter((row) => row.copiedFrom === catalogEntryId),
  ).toHaveLength(1);
  expect(await owner.query(api.characterMoves.status, command)).toEqual(
    completed,
  );
  expect(await owner.mutation(api.characterMoves.resume, command)).toEqual(
    completed,
  );
  expect(
    await owner.mutation(api.characterMoves.start, {
      ...command,
      destinationCampaignId: campaignB,
    }),
  ).toEqual(completed);
  expect(await owner.mutation(api.characterMoves.cancel, command)).toEqual(
    completed,
  );
  expect(await readSheet(owner, characterId)).toEqual(published);
  expect(await owner.query(api.catalogCopies.list, { characterId })).toEqual(
    copies,
  );
});

async function refusal(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('Expected a refusal');
}

test('every refused move command is authorized first and leaves the Character and its preparation unchanged', async () => {
  const context = await fixture();
  const { t, owner, member, outsider, characterId, campaignB } = context;
  await saveCampaignFeat(context);
  const command = { characterId, operationId: 'to-B' };
  const ready = await prepareMove(owner, {
    ...command,
    destinationCampaignId: campaignB,
  });
  const before = await readSheet(owner, characterId);
  const foreignCampaignId = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Elsewhere',
      description: '',
      organizationId: 'other',
      ownerId: 'test|outsider',
      e2eFixture: {
        namespace: 'move-reconciliation',
        version: 1,
        workerKey: '0',
        caseKey: 'elsewhere',
        campaignKey: 'elsewhere',
      },
    }),
  );
  const refusals = [
    [
      member.mutation(api.characterMoves.start, {
        ...command,
        operationId: 'member',
      }),
      'Only the current owner',
    ],
    [
      member.mutation(api.characterMoves.resume, command),
      'Only the current owner',
    ],
    [
      member.mutation(api.characterMoves.cancel, command),
      'Only the current owner',
    ],
    [
      member.query(api.characterMoves.status, command),
      'Only the current owner',
    ],
    [
      outsider.mutation(api.characterMoves.start, {
        ...command,
        operationId: 'outsider',
      }),
      'Character not found',
    ],
    [
      outsider.mutation(api.characterMoves.resume, command),
      'Character not found',
    ],
    [
      outsider.mutation(api.characterMoves.cancel, command),
      'Character not found',
    ],
    [outsider.query(api.characterMoves.status, command), 'Character not found'],
    [
      owner.mutation(api.characterMoves.start, {
        characterId,
        operationId: 'foreign',
        destinationCampaignId: foreignCampaignId,
      }),
      'access',
    ],
    [
      owner.mutation(api.characterMoves.start, command),
      'Move operation already used',
    ],
  ] as const;
  for (const [promise, message] of refusals)
    expect(await refusal(promise)).toContain(message);
  expect(await readSheet(owner, characterId)).toEqual(before);
  expect(await owner.query(api.characterMoves.status, command)).toEqual(ready);
});

test('an outsider learns nothing about a move, not even that the Character exists', async () => {
  const context = await fixture();
  const { t, owner, outsider, characterId, campaignB } = context;
  const command = { characterId, operationId: 'to-B' };
  await prepareMove(owner, { ...command, destinationCampaignId: campaignB });
  const missingId = await t.run(async (ctx) => {
    const id = await ctx.db.insert('character', {
      name: 'Gone',
      description: '',
      kind: 'pc',
      isActive: true,
      level: 1,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    });
    await ctx.db.delete('character', id);
    return id;
  });
  const refusals = (commands: typeof command) =>
    Promise.all([
      refusal(outsider.query(api.characterMoves.status, commands)),
      refusal(outsider.mutation(api.characterMoves.resume, commands)),
      refusal(outsider.mutation(api.characterMoves.cancel, commands)),
      refusal(
        outsider.query(api.characterMoves.destinations, {
          characterId: commands.characterId,
        }),
      ),
      refusal(
        outsider.query(api.catalogCopies.list, {
          characterId: commands.characterId,
        }),
      ),
    ]);
  const seen = await refusals(command);
  expect(seen).toEqual(Array(5).fill('Character not found'));
  expect(seen).toEqual(
    await refusals({ characterId: missingId, operationId: 'to-B' }),
  );
});

test('a move waits while destination access is missing, continues when it returns, and can be cancelled while waiting', async () => {
  const context = await fixture();
  const { t, owner, characterId, campaignB } = context;
  await saveCampaignFeat(context);
  const command = { characterId, operationId: 'to-B' };
  const ready = await prepareMove(owner, {
    ...command,
    destinationCampaignId: campaignB,
  });
  const before = await readSheet(owner, characterId);
  const setDestinationOrganization = (organizationId: string) =>
    t.run((ctx) => ctx.db.patch('campaign', campaignB, { organizationId }));
  await setDestinationOrganization('other');
  const waiting = {
    ...ready,
    state: 'waiting',
    waitingReason: 'destinationUnavailable',
  };
  expect(await owner.query(api.characterMoves.status, command)).toEqual(
    waiting,
  );
  expect(await owner.mutation(api.characterMoves.resume, command)).toEqual(
    waiting,
  );
  expect(await readSheet(owner, characterId)).toEqual(before);
  await setDestinationOrganization('org');
  expect(await owner.query(api.characterMoves.status, command)).toEqual(ready);
  await finishMove(owner, command);
  expect((await readSheet(owner, characterId))?.campaign?.campaignId).toBe(
    campaignB,
  );

  const back = { characterId, operationId: 'to-A' };
  const returning = await prepareMove(owner, {
    ...back,
    destinationCampaignId: context.campaignA,
  });
  const arrived = await readSheet(owner, characterId);
  await t.run((ctx) =>
    ctx.db.patch('campaign', context.campaignA, { organizationId: 'other' }),
  );
  expect(await owner.mutation(api.characterMoves.cancel, back)).toEqual({
    ...returning,
    state: 'cancelled',
  });
  expect(await owner.query(api.characterMoves.status, back)).toEqual({
    ...returning,
    state: 'cancelled',
  });
  expect(await readSheet(owner, characterId)).toEqual(arrived);
});

test('a campaign change during preparation fences the move and leaves the Character where it now is', async () => {
  const context = await fixture();
  const { t, owner, characterId, campaignB } = context;
  const command = { characterId, operationId: 'to-B' };
  await prepareMove(owner, { ...command, destinationCampaignId: campaignB });
  // Stands in for the trusted return to no campaign after membership loss
  // (#706); no public writer changes a campaign outside a move. Without
  // campaign homebrew, nothing needs preserving.
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  const before = await readSheet(owner, characterId);
  const fenced = { state: 'cancelled', cancelReason: 'campaignChanged' };
  expect(await owner.query(api.characterMoves.status, command)).toMatchObject(
    fenced,
  );
  expect(
    await owner.mutation(api.characterMoves.resume, command),
  ).toMatchObject(fenced);
  expect(
    await owner.mutation(api.characterMoves.resume, command),
  ).toMatchObject(fenced);
  expect(await readSheet(owner, characterId)).toEqual(before);
  expect(before?.campaign).toBeNull();
});
