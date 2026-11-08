// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { beforeAll, afterEach, beforeEach, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { representativeClassCatalog } from './lib/representativeClassCatalog';
import { representativeWeaponCatalog } from './lib/representativeWeaponCatalog';
import { representativeSpellEffectCatalog } from './lib/representativeSpellEffectCatalog';
import { maxCharacterMoveGroupSize } from './lib/characterMoveGroup';
import { initializeCharacterSheet } from './lib/characterSheet';
import {
  defaultAbilityScores,
  type SheetCatalogEntryDetail,
} from '../src/lib/character-sheet';
import { api, internal } from './_generated/api';
import schema from './schema';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
preloadCalledConvexModules({ modules, testFile: import.meta.url });
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function requireFixture<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined)
    throw new Error(`${label} fixture unavailable`);
  return value;
}

async function fixture({ enforceTransactionLimits = false } = {}) {
  const t = convexTest({
    schema,
    modules,
    transactionLimits: enforceTransactionLimits,
  });
  const campaigns = await t.run(
    async (ctx): Promise<[Id<'campaign'>, Id<'campaign'>]> => {
      for (const name of ['owner', 'member', 'outsider'])
        await ctx.db.insert('user', {
          tokenIdentifier: `test|${name}`,
          orgIds: name === 'outsider' ? [] : [{ orgId: 'org', role: 'member' }],
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
              namespace: 'group-moves',
              version: 1,
              workerKey: '0',
              caseKey: name,
              campaignKey: name,
            },
          }),
        );
      const [source, destination] = ids;
      if (!source || !destination)
        throw new Error('Campaign fixtures unavailable');
      return [source, destination];
    },
  );
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
  async function create(name: string, caller = owner) {
    return t.run(async (ctx) => {
      const campaign = await ctx.db.get('campaign', campaigns[0]);
      if (!campaign) throw new Error('Campaign fixture unavailable');
      // Real production Characters start without unrelated demo catalogs.
      await ctx.db.patch('campaign', campaign._id, { e2eFixture: undefined });
      const characterId = await ctx.db.insert('character', {
        campaignId: campaign._id,
        name,
        kind: 'pc',
        description: '',
        ownerId: caller === member ? 'test|member' : 'test|owner',
        isActive: true,
        level: 1,
        ...defaultAbilityScores,
      });
      await initializeCharacterSheet(ctx, {
        characterId,
        operationId: `create-${name}`,
        updatedBy: caller === member ? 'test|member' : 'test|owner',
      });
      await ctx.db.patch('campaign', campaign._id, {
        e2eFixture: campaign.e2eFixture,
      });
      return characterId;
    });
  }
  async function link(
    associatedCharacterId: Id<'character'>,
    companionCharacterId: Id<'character'>,
  ) {
    return owner.mutation(api.companionRelationships.link, {
      associatedCharacterId,
      companionCharacterId,
      kind: 'cohort',
      sources: [{ key: 'bond', label: 'Companion bond', enabled: true }],
      operationId: `link-${companionCharacterId}`,
    });
  }
  return { t, owner, member, outsider, campaigns, create, link };
}

test('moving an associated Character prepares its recursive active same-owner Companions privately and publishes them together', async () => {
  const { owner, member, campaigns, create, link } = await fixture();
  const associated = await create('Ada');
  const cohort = await create('Bryn');
  const familiar = await create('Cinder');
  await link(associated, cohort);
  await link(cohort, familiar);
  const command = {
    characterId: associated,
    operationId: 'group',
    destinationCampaignId: campaigns[1],
  };
  let progress = await owner.mutation(api.characterMoves.start, command);
  expect(progress.state).toBe('preparing');
  for (let i = 0; i < 120 && progress.state !== 'completed'; i++) {
    const visible = await Promise.all(
      [associated, cohort, familiar].map((characterId) =>
        owner.query(api.characterMoves.destinations, { characterId }),
      ),
    );
    expect(visible.map((result) => result.currentCampaignId)).toEqual([
      campaigns[0],
      campaigns[0],
      campaigns[0],
    ]);
    progress = await owner.mutation(api.characterMoves.resume, {
      characterId: associated,
      operationId: 'group',
    });
  }
  expect(progress.state).toBe('completed');
  const arrived = await Promise.all(
    [associated, cohort, familiar].map((characterId) =>
      member.query(api.characterSheet.read, { characterId }),
    ),
  );
  expect(arrived.map((sheet) => sheet?.character.campaignId)).toEqual([
    campaigns[1],
    campaigns[1],
    campaigns[1],
  ]);
  expect(
    await owner.query(api.companionRelationships.list, { characterId: cohort }),
  ).toMatchObject([{ status: 'active' }, { status: 'active' }]);
  expect(
    await owner.mutation(api.characterMoves.resume, {
      characterId: associated,
      operationId: 'group',
    }),
  ).toEqual(progress);
});

async function finish(
  owner: Awaited<ReturnType<typeof fixture>>['owner'],
  characterId: Id<'character'>,
  operationId: string,
) {
  let progress = await owner.query(api.characterMoves.status, {
    characterId,
    operationId,
  });
  for (
    let i = 0;
    i < 150 &&
    progress?.state !== 'completed' &&
    progress?.state !== 'cancelled';
    i++
  )
    progress = await owner.mutation(api.characterMoves.resume, {
      characterId,
      operationId,
    });
  expect(progress?.state).toBe('completed');
  return progress;
}

test('inactive and different-owner links stop traversal, and moving a Companion does not pull its associated Character', async () => {
  const { owner, member, campaigns, create, link } = await fixture();
  const root = await create('Root');
  const child = await create('Child');
  const inactive = await create('Inactive');
  const otherOwner = await create('Other owner', member);
  await link(root, child);
  const inactiveLink = await link(child, inactive);
  await owner.mutation(api.companionRelationships.interrupt, {
    relationshipId: inactiveLink,
    operationId: 'interrupt',
  });
  await link(child, otherOwner);
  expect(
    await owner.query(api.characterMoves.preview, { characterId: root }),
  ).toMatchObject({
    moving: [{ characterId: root }, { characterId: child }],
    staying: [
      { characterId: inactive, reason: 'inactive' },
      { characterId: otherOwner, reason: 'differentOwner' },
    ],
  });
  await owner.mutation(api.characterMoves.start, {
    characterId: root,
    operationId: 'boundary',
    destinationCampaignId: campaigns[1],
  });
  await finish(owner, root, 'boundary');
  expect(
    (await member.query(api.characterSheet.read, { characterId: inactive }))
      ?.character.campaignId,
  ).toBe(campaigns[0]);
  expect(
    (await member.query(api.characterSheet.read, { characterId: otherOwner }))
      ?.character.campaignId,
  ).toBe(campaigns[0]);
  expect(
    await owner.query(api.companionRelationships.list, { characterId: child }),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        endpoint: { characterId: otherOwner, name: 'Other owner' },
        status: 'interrupted',
      }),
    ]),
  );
  await owner.mutation(api.characterMoves.start, {
    characterId: child,
    operationId: 'child-only',
    destinationCampaignId: campaigns[0],
  });
  await finish(owner, child, 'child-only');
  expect(
    (await owner.query(api.characterMoves.destinations, { characterId: root }))
      .currentCampaignId,
  ).toBe(campaigns[1]);
  expect(
    await owner.query(api.companionRelationships.list, { characterId: child }),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        endpoint: { characterId: otherOwner, name: 'Other owner' },
        status: 'active',
      }),
    ]),
  );
});

test('a newer Companion command fences older lazy group preparation even when every command has the same timestamp', async () => {
  const { owner, campaigns, create, link } = await fixture();
  const root = await create('Root');
  const child = await create('Child');
  await link(root, child);
  await owner.mutation(api.characterMoves.start, {
    characterId: child,
    destinationCampaignId: campaigns[1],
    operationId: 'older-child',
  });
  await owner.mutation(api.characterMoves.start, {
    characterId: root,
    destinationCampaignId: campaigns[1],
    operationId: 'group',
  });
  // Older work does not falsely fence the group when the provider clock is unchanged.
  expect(
    (
      await owner.mutation(api.characterMoves.resume, {
        characterId: root,
        operationId: 'group',
      })
    ).state,
  ).not.toBe('cancelled');
  await owner.mutation(api.characterMoves.start, {
    characterId: child,
    destinationCampaignId: campaigns[1],
    operationId: 'newer-child',
  });
  expect(
    await owner.mutation(api.characterMoves.resume, {
      characterId: root,
      operationId: 'group',
    }),
  ).toMatchObject({ state: 'cancelled', cancelReason: 'replaced' });
  expect(
    (await owner.query(api.characterMoves.destinations, { characterId: root }))
      .currentCampaignId,
  ).toBe(campaigns[0]);
  await finish(owner, child, 'newer-child');
  expect(
    (await owner.query(api.characterMoves.destinations, { characterId: root }))
      .currentCampaignId,
  ).toBe(campaigns[0]);
});

test('a singleton cannot publish alone after a new active Companion joins its group', async () => {
  const { owner, campaigns, create, link } = await fixture();
  const root = await create('Root');
  const child = await create('Child');
  await owner.mutation(api.characterMoves.start, {
    characterId: root,
    destinationCampaignId: campaigns[1],
    operationId: 'singleton',
  });
  await link(root, child);
  expect(
    await owner.mutation(api.characterMoves.resume, {
      characterId: root,
      operationId: 'singleton',
    }),
  ).toMatchObject({ state: 'cancelled', cancelReason: 'groupChanged' });
  expect(
    (await owner.query(api.characterMoves.destinations, { characterId: root }))
      .currentCampaignId,
  ).toBe(campaigns[0]);
  expect(
    (await owner.query(api.characterMoves.destinations, { characterId: child }))
      .currentCampaignId,
  ).toBe(campaigns[0]);
});

test('preview and every move refusal authorize first without exposing hidden endpoint names', async () => {
  const { t, owner, member, outsider, campaigns, create, link } =
    await fixture();
  const root = await create('Root');
  const hidden = await create('Private secret', member);
  await link(root, hidden);
  await t.run((ctx) =>
    ctx.db.patch('character', hidden, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  expect(
    await owner.query(api.characterMoves.preview, { characterId: root }),
  ).toEqual({
    moving: [{ characterId: root, name: 'Root' }],
    staying: [{ reason: 'inactive' }],
    maxGroupSize: maxCharacterMoveGroupSize,
  });
  for (const caller of [member, outsider]) {
    const refusal =
      caller === member ? 'Only the current owner' : 'Character not found';
    await expect(
      caller.query(api.characterMoves.preview, { characterId: root }),
    ).rejects.toThrow(refusal);
    await expect(
      caller.query(api.characterMoves.status, {
        characterId: root,
        operationId: 'unknown',
      }),
    ).rejects.toThrow(refusal);
    await expect(
      caller.mutation(api.characterMoves.start, {
        characterId: root,
        destinationCampaignId: campaigns[1],
        operationId: 'refused',
      }),
    ).rejects.toThrow(refusal);
    await expect(
      caller.mutation(api.characterMoves.resume, {
        characterId: root,
        operationId: 'unknown',
      }),
    ).rejects.toThrow(refusal);
    await expect(
      caller.mutation(api.characterMoves.cancel, {
        characterId: root,
        operationId: 'unknown',
      }),
    ).rejects.toThrow(refusal);
  }
});

test('reassigning an unprepared Companion away and back fences its original owner assignment', async () => {
  const { t, owner, member, campaigns, create, link } = await fixture();
  const root = await create('Root');
  const child = await create('Child');
  await link(root, child);
  await owner.mutation(api.characterMoves.start, {
    characterId: root,
    operationId: 'owner-aba',
    destinationCampaignId: campaigns[1],
  });
  const users = await t.run(async (ctx) => ({
    owner: await ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', 'test|owner'),
      )
      .unique(),
    member: await ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', 'test|member'),
      )
      .unique(),
  }));
  await member.mutation(api.character.reassignOwner, {
    characterId: child,
    campaignId: campaigns[0],
    ownerUserId: requireFixture(users.member, 'Member')._id,
    operationId: 'take',
  });
  await member.mutation(api.character.reassignOwner, {
    characterId: child,
    campaignId: campaigns[0],
    ownerUserId: requireFixture(users.owner, 'Owner')._id,
    operationId: 'return',
  });
  expect(
    await owner.mutation(api.characterMoves.resume, {
      characterId: root,
      operationId: 'owner-aba',
    }),
  ).toMatchObject({ state: 'cancelled', cancelReason: 'ownershipChanged' });
  expect(
    (await owner.query(api.characterMoves.destinations, { characterId: child }))
      .currentCampaignId,
  ).toBe(campaigns[0]);
});

test('legacy unfinished single-Character preparation cannot bypass a currently linked group', async () => {
  const { t, owner, campaigns, create, link } = await fixture();
  const root = await create('Root');
  const child = await create('Child');
  await owner.mutation(api.characterMoves.start, {
    characterId: root,
    operationId: 'legacy',
    destinationCampaignId: campaigns[1],
  });
  await t.run(async (ctx) => {
    const move = await ctx.db
      .query('characterMove')
      .withIndex('by_characterId_and_operationId', (q) =>
        q.eq('characterId', root).eq('operationId', 'legacy'),
      )
      .unique();
    await ctx.db.patch('characterMove', requireFixture(move, 'Move')._id, {
      groupCharacterIds: undefined,
      groupFingerprint: undefined,
      groupMoveClaims: undefined,
    });
  });
  await link(root, child);
  expect(
    await owner.mutation(api.characterMoves.resume, {
      characterId: root,
      operationId: 'legacy',
    }),
  ).toMatchObject({ state: 'cancelled', cancelReason: 'groupChanged' });
  expect(
    (await owner.query(api.characterMoves.destinations, { characterId: root }))
      .currentCampaignId,
  ).toBe(campaigns[0]);
});

async function ready(
  owner: Awaited<ReturnType<typeof fixture>>['owner'],
  characterId: Id<'character'>,
  operationId: string,
) {
  let progress = await owner.query(api.characterMoves.status, {
    characterId,
    operationId,
  });
  for (let i = 0; i < 150 && progress?.state !== 'ready'; i++)
    progress = await owner.mutation(api.characterMoves.resume, {
      characterId,
      operationId,
    });
  expect(progress?.state).toBe('ready');
  return progress!;
}

test('the complete group carries homebrew and incorporates a second session sheet and dependency edit after preparation', async () => {
  const { t, owner, member, campaigns, create, link } = await fixture();
  const root = await create('Root');
  const child = await create('Child');
  await link(root, child);
  const grantedFeature = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: campaigns[0],
      name: 'Quick bond',
      ruleIdentity: 'quick-bond',
      stacksWithItself: false,
      sources: [],
      modifiers: [{ target: 'ability.dex', bonusType: 'untyped', value: 2 }],
      detail: { kind: 'classFeature' },
    }),
  );
  const homebrew = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: campaigns[0],
      name: 'Strong bond',
      grants: [{ catalogEntryId: grantedFeature }],
      ruleIdentity: 'strong-bond',
      stacksWithItself: false,
      sources: [],
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
      detail: { kind: 'feat' },
    }),
  );
  for (const characterId of [root, child])
    await owner.mutation(api.characterSheet.selectEntry, {
      characterId,
      catalogEntryId: homebrew,
      operationId: `select-${characterId}`,
    });
  await owner.mutation(api.characterMoves.start, {
    characterId: root,
    operationId: 'edited-group',
    destinationCampaignId: campaigns[1],
  });
  const prepared = await ready(owner, root, 'edited-group');
  await member.mutation(api.characterSheet.editBaseScores, {
    characterId: child,
    operationId: 'second-session-scores',
    scores: {
      strength: 15,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
  });
  await member.mutation(api.catalogCopies.editDefinition, {
    characterId: child,
    catalogEntryId: homebrew,
    name: 'Stronger bond',
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 4 }],
    operationId: 'second-session-definition',
  });
  await member.mutation(api.catalogCopies.editDefinition, {
    characterId: child,
    catalogEntryId: grantedFeature,
    name: 'Quicker bond',
    modifiers: [{ target: 'ability.dex', bonusType: 'untyped', value: 3 }],
    operationId: 'second-session-transitive-dependency',
  });
  const refreshed = await owner.mutation(api.characterMoves.resume, {
    characterId: root,
    operationId: 'edited-group',
  });
  expect(refreshed.state).not.toBe('completed');
  expect(refreshed.prepared).toBe(prepared.prepared);
  await finish(owner, root, 'edited-group');
  const sheets = await Promise.all(
    [root, child].map((characterId) =>
      member.query(api.characterSheet.read, { characterId }),
    ),
  );
  expect(
    sheets.map((sheet) => sheet?.calculated.abilities.strength.score),
  ).toEqual([14, 19]);
  const carried = sheets.map((sheet) =>
    sheet?.catalogEntries.find((row) => row.copiedFrom === homebrew),
  );
  expect(carried.map((row) => row?.characterId)).toEqual([root, child]);
  expect(carried[0]?._id).not.toBe(carried[1]?._id);
  expect(carried.map((row) => row?.name)).toEqual([
    'Stronger bond',
    'Stronger bond',
  ]);
  expect(
    sheets.map((sheet) => sheet?.calculated.abilities.dexterity.score),
  ).toEqual([13, 13]);
  const leaves = sheets.map((sheet) =>
    sheet?.catalogEntries.find((row) => row.copiedFrom === grantedFeature),
  );
  expect(leaves.map((row) => row?.characterId)).toEqual([root, child]);
  expect(leaves[0]?._id).not.toBe(leaves[1]?._id);
  expect(carried.map((row) => row?.grants?.[0]?.catalogEntryId)).toEqual(
    leaves.map((row) => row?._id),
  );
});

test('destination access loss holds a ready group and retry publishes all members only after access returns', async () => {
  const { t, owner, campaigns, create, link } = await fixture();
  const root = await create('Root');
  const child = await create('Child');
  await link(root, child);
  await t.run(async (ctx) => {
    await ctx.db.patch('campaign', campaigns[1], {
      organizationId: 'destination-org',
    });
    const user = await ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', 'test|owner'),
      )
      .unique();
    await ctx.db.patch('user', requireFixture(user, 'User')._id, {
      orgIds: [
        { orgId: 'org', role: 'member' },
        { orgId: 'destination-org', role: 'member' },
      ],
    });
  });
  await owner.mutation(api.characterMoves.start, {
    characterId: root,
    operationId: 'waiting-group',
    destinationCampaignId: campaigns[1],
  });
  await ready(owner, root, 'waiting-group');
  const user = await t.run((ctx) =>
    ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', 'test|owner'),
      )
      .unique(),
  );
  await t.run((ctx) =>
    ctx.db.patch('user', requireFixture(user, 'User')._id, {
      orgIds: [{ orgId: 'org', role: 'member' }],
    }),
  );
  expect(
    await owner.mutation(api.characterMoves.resume, {
      characterId: root,
      operationId: 'waiting-group',
    }),
  ).toMatchObject({ state: 'waiting', groupSize: 2, completedMembers: 0 });
  expect(
    (await owner.query(api.characterMoves.destinations, { characterId: child }))
      .currentCampaignId,
  ).toBe(campaigns[0]);
  await t.run((ctx) =>
    ctx.db.patch('user', requireFixture(user, 'User')._id, {
      orgIds: [
        { orgId: 'org', role: 'member' },
        { orgId: 'destination-org', role: 'member' },
      ],
    }),
  );
  await finish(owner, root, 'waiting-group');
  expect(
    (await owner.query(api.characterMoves.destinations, { characterId: child }))
      .currentCampaignId,
  ).toBe(campaigns[1]);
});

test('a failure in the last member publication rolls back earlier arrivals and retries without duplicating effects', async () => {
  const { t, owner, campaigns, create, link } = await fixture();
  const root = await create('Root');
  const child = await create('Child');
  await link(root, child);
  const homebrew = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: campaigns[0],
      name: 'Carried courage',
      ruleIdentity: 'carried-courage',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'feat' },
    }),
  );
  await owner.mutation(api.characterSheet.selectEntry, {
    characterId: child,
    catalogEntryId: homebrew,
    operationId: 'existing-use',
  });
  await owner.mutation(api.characterMoves.start, {
    characterId: root,
    operationId: 'failed-group',
    destinationCampaignId: campaigns[1],
  });
  await ready(owner, root, 'failed-group');
  // This is a source-backed fixture definition used as a retained dependency.
  const definition = await t.run((ctx) =>
    ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', child))
      .first(),
  );
  const origins = await t.run(async (ctx) => {
    const ids = [];
    for (let index = 0; index < 1024; index++)
      ids.push(
        await ctx.db.insert('catalogEntry', {
          scope: 'campaign',
          campaignId: campaigns[0],
          name: `Retained homebrew ${index}`,
          ruleIdentity: `retained-homebrew-${index}`,
          stacksWithItself: false,
          sources: [],
          modifiers: [],
          detail: { kind: 'manual' },
        }),
      );
    return ids;
  });
  const references = Object.fromEntries(
    origins.map((id) => [id, requireFixture(definition, 'Definition')._id]),
  );
  await t.run((ctx) =>
    ctx.db.patch('character', child, { carriedCatalogReferences: references }),
  );
  // Boundary fingerprint changes force a fresh member preparation first.
  await owner.mutation(api.characterMoves.resume, {
    characterId: root,
    operationId: 'failed-group',
  });
  await ready(owner, root, 'failed-group');
  const before = await owner.query(api.characterSheet.read, {
    characterId: root,
  });
  await expect(
    owner.mutation(api.characterMoves.resume, {
      characterId: root,
      operationId: 'failed-group',
    }),
  ).rejects.toThrow(
    'This Character has too many carried catalog selections to move. Remove unused selections, then try again.',
  );
  expect(
    await owner.query(api.characterSheet.read, { characterId: root }),
  ).toEqual(before);
  expect(
    (await owner.query(api.characterMoves.destinations, { characterId: child }))
      .currentCampaignId,
  ).toBe(campaigns[0]);
  await t.run((ctx) =>
    ctx.db.patch('character', child, { carriedCatalogReferences: {} }),
  );
  const completed = await finish(owner, root, 'failed-group');
  expect(
    await owner.mutation(api.characterMoves.resume, {
      characterId: root,
      operationId: 'failed-group',
    }),
  ).toEqual(completed);
});

test('an accessible Companion retains terminal move status after its private associated Character and root move are deleted', async () => {
  const { t, owner, campaigns, create, link } = await fixture();
  const root = await create('Root');
  const child = await create('Child');
  const relationshipId = await link(root, child);
  await owner.mutation(api.characterMoves.start, {
    characterId: root,
    operationId: 'finished-group',
    destinationCampaignId: campaigns[1],
  });
  await finish(owner, root, 'finished-group');
  await owner.mutation(api.companionRelationships.interrupt, {
    relationshipId,
    operationId: 'separate',
  });
  await owner.mutation(api.characterMoves.start, {
    characterId: root,
    operationId: 'root-private',
  });
  await finish(owner, root, 'root-private');
  await owner.mutation(api.characterSheet.deletePrivate, {
    characterId: root,
    operationId: 'delete-private',
  });
  // Drive the real cleanup seam; no direct mutation of the surviving child operation.
  await t.mutation(internal.characterMoves.cleanup, { characterId: root });
  expect(
    await owner.query(api.characterMoves.status, {
      characterId: child,
      operationId: 'finished-group',
    }),
  ).toMatchObject({ state: 'completed' });
});

test.each(['ready', 'completed', 'cancelled'] as const)(
  'an unrelated %s Companion operation with the same identifier cannot masquerade as group preparation',
  async (state) => {
    const { owner, campaigns, create, link } = await fixture();
    const root = await create('Root');
    const child = await create('Child');
    if (state === 'completed') {
      await owner.mutation(api.characterMoves.start, {
        characterId: child,
        operationId: 'collision',
        destinationCampaignId: campaigns[1],
      });
      await finish(owner, child, 'collision');
      await owner.mutation(api.characterMoves.start, {
        characterId: child,
        operationId: 'return-child',
        destinationCampaignId: campaigns[0],
      });
      await finish(owner, child, 'return-child');
      await link(root, child);
    } else {
      await link(root, child);
      await owner.mutation(api.characterMoves.start, {
        characterId: child,
        operationId: 'collision',
        destinationCampaignId: campaigns[1],
      });
      await ready(owner, child, 'collision');
    }
    await owner.mutation(api.characterMoves.start, {
      characterId: root,
      operationId: 'collision',
      destinationCampaignId: campaigns[1],
    });
    expect(
      await owner.mutation(api.characterMoves.resume, {
        characterId: root,
        operationId: 'collision',
      }),
    ).toMatchObject({ state: 'cancelled', cancelReason: 'replaced' });
    expect(
      (
        await owner.query(api.characterMoves.destinations, {
          characterId: root,
        })
      ).currentCampaignId,
    ).toBe(campaigns[0]);
    expect(
      (
        await owner.query(api.characterMoves.destinations, {
          characterId: child,
        })
      ).currentCampaignId,
    ).toBe(campaigns[0]);
  },
);

test('preview lists only the active associated Character and excludes replaced and interrupted history', async () => {
  const { owner, create, link } = await fixture();
  const child = await create('Companion');
  const former = await create('Former associated');
  const interrupted = await create('Interrupted associated');
  const current = await create('Current associated');
  const formerRelationship = await link(former, child);
  await owner.mutation(api.companionRelationships.replace, {
    relationshipId: formerRelationship,
    companionCharacterId: await create('Replacement Companion'),
    operationId: 'replace-former-companion',
  });
  const interruptedRelationship = await link(interrupted, child);
  await owner.mutation(api.companionRelationships.interrupt, {
    relationshipId: interruptedRelationship,
    operationId: 'interrupt-former-master',
  });
  await link(current, child);
  expect(
    await owner.query(api.characterMoves.preview, { characterId: child }),
  ).toMatchObject({
    moving: [{ characterId: child, name: 'Companion' }],
    staying: [
      {
        characterId: current,
        name: 'Current associated',
        reason: 'associated',
      },
    ],
  });
  expect(
    (await owner.query(api.characterMoves.preview, { characterId: child }))
      .staying,
  ).toHaveLength(1);
});

test('a deleted Companion is unavailable in preview without its previous name or identifier', async () => {
  const { t, owner, create, link } = await fixture();
  const root = await create('Root');
  const child = await create('Deleted secret');
  await link(root, child);
  await t.run((ctx) => ctx.db.delete('character', child));
  expect(
    await owner.query(api.characterMoves.preview, { characterId: root }),
  ).toEqual({
    moving: [{ characterId: root, name: 'Root' }],
    staying: [{ reason: 'unavailable' }],
    maxGroupSize: maxCharacterMoveGroupSize,
  });
});

test('cancelling a completed Companion move acknowledges the whole completed group', async () => {
  const { owner, campaigns, create, link } = await fixture();
  const root = await create('Root');
  const child = await create('Child');
  await link(root, child);
  await owner.mutation(api.characterMoves.start, {
    characterId: root,
    operationId: 'completed-cancel',
    destinationCampaignId: campaigns[1],
  });
  const completed = await finish(owner, root, 'completed-cancel');
  expect(completed).toMatchObject({ groupSize: 2, completedMembers: 2 });
  expect(
    await owner.mutation(api.characterMoves.cancel, {
      characterId: child,
      operationId: 'completed-cancel',
    }),
  ).toEqual(completed);
});

test('the public move seam returns the group-size refusal before preparing or changing access', async () => {
  const { owner, campaigns, create, link } = await fixture();
  const root = await create('Root');
  for (let index = 0; index < maxCharacterMoveGroupSize - 1; index++)
    await link(root, await create(`Companion ${index}`));
  expect(
    (await owner.query(api.characterMoves.preview, { characterId: root }))
      .moving,
  ).toHaveLength(maxCharacterMoveGroupSize);
  await link(root, await create('Over the cap'));
  expect(
    await owner.query(api.characterMoves.preview, { characterId: root }),
  ).toMatchObject({
    refusal: {
      reason: 'groupTooLarge',
      groupSize: maxCharacterMoveGroupSize + 1,
      maxGroupSize: maxCharacterMoveGroupSize,
    },
  });
  await expect(
    owner.mutation(api.characterMoves.start, {
      characterId: root,
      destinationCampaignId: campaigns[1],
      operationId: 'too-many',
    }),
  ).rejects.toThrow(`at most ${maxCharacterMoveGroupSize}`);
  expect(
    await owner.query(api.characterMoves.status, { characterId: root }),
  ).toBeNull();
  expect(
    (await owner.query(api.characterMoves.destinations, { characterId: root }))
      .currentCampaignId,
  ).toBe(campaigns[0]);
});

test('a full capped group of third-level sheets publishes atomically within enforced Convex transaction limits and preserves its content', async () => {
  const { owner, campaigns, create, link, t } = await fixture({
    enforceTransactionLimits: true,
  });
  const characters: Id<'character'>[] = [];
  const fighterDefinition = requireFixture(
    representativeClassCatalog.find((row) => row.ruleIdentity === 'fighter'),
    'Fighter',
  );
  const weaponDefinition = requireFixture(
    representativeWeaponCatalog.find((row) => row.ruleIdentity === 'longsword'),
    'Longsword',
  );
  if (!('weapon' in weaponDefinition.detail) || !weaponDefinition.detail.weapon)
    throw new Error('Longsword weapon fixture unavailable');
  const weapon: NonNullable<
    Extract<SheetCatalogEntryDetail, { kind: 'item' }>['weapon']
  > = weaponDefinition.detail.weapon;
  const mutableWeapon = {
    ...weapon,
    groups: weapon.groups ? [...weapon.groups] : undefined,
    damageTypes: weapon.damageTypes ? [...weapon.damageTypes] : undefined,
    otherEnd: weapon.otherEnd
      ? {
          ...weapon.otherEnd,
          damageTypes: weapon.otherEnd.damageTypes
            ? [...weapon.otherEnd.damageTypes]
            : undefined,
        }
      : undefined,
  };
  for (let index = 0; index < maxCharacterMoveGroupSize; index++) {
    const characterId = await create(`Fighter ${index}`);
    characters.push(characterId);
    const fighter = await t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        ...fighterDefinition,
        scope: 'character',
        characterId,
      }),
    );
    const sheet = requireFixture(
      await owner.query(api.characterSheet.read, { characterId }),
      'Sheet',
    );
    const level = requireFixture(
      sheet.entries.find((row) => row.kind === 'classLevel'),
      'Class Level',
    );
    await owner.mutation(api.characterSheet.editClassLevel, {
      characterId,
      entryId: level._id,
      classEntryId: fighter,
      hpGained: 10,
      operationId: `fighter-one-${index}`,
    });
    for (let levelNumber = 2; levelNumber <= 3; levelNumber++) {
      const entryId = await owner.mutation(api.characterSheet.addClassLevel, {
        characterId,
        classEntryId: fighter,
        operationId: `fighter-level-${index}-${levelNumber}`,
      });
      await owner.mutation(api.characterSheet.editClassLevel, {
        characterId,
        entryId,
        hpGained: 6,
        operationId: `fighter-hp-${index}-${levelNumber}`,
      });
    }
    await owner.mutation(api.catalogCopies.createOneOff, {
      characterId,
      definition: {
        name: 'Campaign battle training',
        description: 'Homebrew campaign training grants +2 Strength.',
        sources: [],
        stacksWithItself: false,
        modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
        detail: { kind: 'feat' },
      },
      operationId: `homebrew-${index}`,
    });
    await owner.mutation(api.catalogCopies.createOneOff, {
      characterId,
      definition: {
        name: weaponDefinition.name,
        sources: [...weaponDefinition.sources],
        modifiers: [...weaponDefinition.modifiers],
        detail: {
          ...weaponDefinition.detail,
          weapon: mutableWeapon,
        },
        stacksWithItself: false,
      },
      operationId: `longsword-${index}`,
    });
  }
  const root = requireFixture(characters[0], 'Root');
  for (const characterId of characters.slice(1)) await link(root, characterId);
  const before = await Promise.all(
    characters.map(async (characterId) =>
      requireFixture(
        await owner.query(api.characterSheet.read, { characterId }),
        'Before sheet',
      ),
    ),
  );
  expect(before.map((sheet) => sheet.calculated.level)).toEqual(
    characters.map(() => 3),
  );
  await owner.mutation(api.characterMoves.start, {
    characterId: root,
    destinationCampaignId: campaigns[1],
    operationId: 'full-cap',
  });
  let progress = await owner.query(api.characterMoves.status, {
    characterId: root,
    operationId: 'full-cap',
  });
  for (let step = 0; step < 600 && progress?.state !== 'completed'; step++) {
    progress = await owner.mutation(api.characterMoves.resume, {
      characterId: root,
      operationId: 'full-cap',
    });
    expect(progress.state).not.toBe('cancelled');
    const campaignIds = await Promise.all(
      characters.map(
        async (characterId) =>
          (await owner.query(api.characterMoves.destinations, { characterId }))
            .currentCampaignId,
      ),
    );
    expect(campaignIds).toEqual(
      characters.map(() =>
        progress?.state === 'completed' ? campaigns[1] : campaigns[0],
      ),
    );
  }
  expect(progress).toMatchObject({
    state: 'completed',
    groupSize: maxCharacterMoveGroupSize,
    completedMembers: maxCharacterMoveGroupSize,
  });
  for (const [index, characterId] of characters.entries()) {
    const original = requireFixture(before[index], 'Original sheet');
    const arrived = requireFixture(
      await owner.query(api.characterSheet.read, { characterId }),
      'Arrived sheet',
    );
    expect(arrived.character.campaignId).toBe(campaigns[1]);
    expect(arrived.calculated).toEqual(original.calculated);
    expect(arrived.permanentCalculated).toEqual(original.permanentCalculated);
    expect(arrived.entries).toEqual(original.entries);
    expect(arrived.catalogEntries).toEqual(original.catalogEntries);
  }
}, 60_000);

test('linked familiar HP and permanent facts move together and include a second session upstream edit', async () => {
  // CRB familiar HP: half master maximum rounded down, current and permanent
  // projections separately. Wizard 6+4 HP becomes 8+4; Bear's Endurance adds 4.
  const { t, owner, member, campaigns, create } = await fixture();
  const root = await create('Wizard');
  const familiar = await create('Cat');
  const definition = representativeClassCatalog.find(
    (row) => row.ruleIdentity === 'wizard',
  );
  if (!definition)
    throw new Error('Published representative Wizard unavailable');
  const wizard = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'character',
      characterId: root,
    }),
  );
  const rootSheet = await owner.query(api.characterSheet.read, {
    characterId: root,
  });
  const familiarSheet = await owner.query(api.characterSheet.read, {
    characterId: familiar,
  });
  const level = rootSheet?.entries.find((row) => row.kind === 'classLevel');
  const creatureLevel = familiarSheet?.entries.find(
    (row) => row.kind === 'classLevel',
  );
  if (!level || !creatureLevel)
    throw new Error('Prepared Class Levels unavailable');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId: root,
    entryId: level._id,
    classEntryId: wizard,
    hpGained: 6,
    operationId: 'wizard-one',
  });
  const second = await owner.mutation(api.characterSheet.addClassLevel, {
    characterId: root,
    classEntryId: wizard,
    operationId: 'wizard-two',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId: root,
    entryId: second,
    hpGained: 4,
    operationId: 'hp-two',
  });
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    characterId: familiar,
    entryId: creatureLevel._id,
    operationId: 'creature-hd',
  });
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: root,
    companionCharacterId: familiar,
    kind: 'familiar',
    sources: [
      {
        key: 'wizard',
        label: 'Arcane bond',
        enabled: true,
        sheetEntryId: level._id,
      },
    ],
    operationId: 'familiar-link',
  });
  await owner.mutation(api.characterSheetFamiliars.selectBaseCreature, {
    characterId: familiar,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'cat',
  });
  expect(
    (await owner.query(api.characterSheet.read, { characterId: familiar }))
      ?.permanentCalculated.hp,
  ).toBe(5);
  await owner.mutation(api.characterMoves.start, {
    characterId: root,
    operationId: 'familiar-group',
    destinationCampaignId: campaigns[1],
  });
  await ready(owner, root, 'familiar-group');
  await member.mutation(api.characterSheet.editClassLevel, {
    characterId: root,
    entryId: level._id,
    hpGained: 8,
    operationId: 'other-session-hp',
  });
  const endurance = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      ...requireFixture(
        representativeSpellEffectCatalog.find(
          (row) =>
            row.ruleIdentity === 'representative-spell-effect-bears-endurance',
        ),
        "Bear's Endurance",
      ),
      scope: 'character',
      characterId: root,
    }),
  );
  await member.mutation(api.characterSheet.selectEntry, {
    characterId: root,
    catalogEntryId: endurance,
    operationId: 'other-session-bears-endurance',
  });
  const before = await owner.query(api.characterSheet.read, {
    characterId: familiar,
  });
  expect(before?.calculated.hp).toBe(8);
  expect(before?.permanentCalculated.hp).toBe(6);
  await finish(owner, root, 'familiar-group');
  const arrived = await member.query(api.characterSheet.read, {
    characterId: familiar,
  });
  expect(arrived?.character.campaignId).toBe(campaigns[1]);
  expect(arrived?.calculated.hp).toBe(8);
  expect(arrived?.permanentCalculated.hp).toBe(6);
  expect(arrived?.character.sheetPermanentFacts).toEqual(
    before?.character.sheetPermanentFacts,
  );
  expect(arrived?.character.sheetPermanentFacts).toMatchObject({
    level: 0,
    racialHitDice: 1,
    intelligence: 6,
  });
  expect(
    await member.query(api.companionRelationships.list, {
      characterId: familiar,
    }),
  ).toMatchObject([{ status: 'active' }]);
});
