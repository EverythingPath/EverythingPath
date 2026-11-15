// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { initializationEdits } from '../tests/rules/initialization-edits';

const modules = import.meta.glob('./**/*.ts');
afterEach(() => vi.useRealTimers());

const stats = {
  description: 'Scouting notes',
  level: 4,
  strength: 12,
  dexterity: 13,
  constitution: 14,
  intelligence: 15,
  wisdom: 16,
  charisma: 17,
};

async function fixture() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const seeded = await owner.run((ctx) => seedAcceptedCampaign(ctx));
  await t.run(async (ctx) => {
    await ctx.db.insert('user', {
      tokenIdentifier: 'test|outsider',
      orgIds: [{ orgId: 'other', role: 'admin' }],
    });
    await ctx.db.insert('user', {
      tokenIdentifier: 'test|org-fallback',
      orgIds: [],
    });
  });
  const scope = {
    campaignId: seeded.key.campaignId,
    militiaId: seeded.key.militiaId,
  };
  const characterId = await owner.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: {
      campaignId: scope.campaignId,
      name: 'Vessa',
      kind: 'officer_npc',
      ...stats,
    },
  });
  return {
    t,
    owner,
    member: t.withIdentity({ tokenIdentifier: 'test|player' }),
    outsider: t.withIdentity({ tokenIdentifier: 'test|outsider' }),
    fallback: t.withIdentity({ tokenIdentifier: 'test|org-fallback' }),
    seeded,
    scope,
    characterId,
    listArgs: { campaignId: scope.campaignId, organizationId: 'org' },
  };
}

test('owner and campaign member edit the same Character, normalize kinds and retain archived identity', async () => {
  const { owner, member, listArgs, characterId } = await fixture();
  const before = (
    await member.query(api.character.listByCampaign, listArgs)
  ).find((character) => character._id === characterId);
  expect(before).toMatchObject({
    _id: characterId,
    ownerId: 'test|gm',
    campaignId: listArgs.campaignId,
    kind: 'npc',
    isActive: true,
    ...stats,
  });
  await member.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId,
    patch: { name: 'Vessa Vale', level: 5, charisma: 18 },
  });
  await owner.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId,
    patch: { description: 'Shared notes', kind: 'pc' },
  });
  await expect(
    member.mutation(api.character.deleteCharacter, {
      organizationId: 'org',
      characterId,
    }),
  ).rejects.toThrow('Only archived characters can be hard deleted');
  await member.mutation(api.character.archiveCharacter, {
    organizationId: 'org',
    characterId,
    isActive: false,
  });
  expect(
    (await owner.query(api.character.listByCampaign, listArgs)).some(
      (character) => character._id === characterId,
    ),
  ).toBe(false);
  const archived = (
    await owner.query(api.character.listByCampaign, {
      ...listArgs,
      includeInactive: true,
    })
  ).find((character) => character._id === characterId);
  expect(archived).toEqual({
    ...before,
    owner: before?.owner ? { ...before.owner, isMine: true } : null,
    name: 'Vessa Vale',
    level: 5,
    charisma: 18,
    description: 'Shared notes',
    kind: 'pc',
    isActive: false,
  });
  await expect(
    member.mutation(api.character.deleteCharacter, {
      organizationId: 'org',
      characterId,
    }),
  ).rejects.toThrow('Keep archived characters to preserve militia history.');
  await owner.mutation(api.character.archiveCharacter, {
    organizationId: 'org',
    characterId,
    isActive: true,
  });
  expect(
    (await member.query(api.character.listByCampaign, listArgs)).find(
      (character) => character._id === characterId,
    ),
  ).toEqual({
    ...archived,
    isActive: true,
    owner: archived?.owner ? { ...archived.owner, isMine: false } : null,
  });
});

test('Character reads and writes retain campaign scope and reject outsiders and signed-out callers', async () => {
  const { t, owner, member, outsider, listArgs, characterId } = await fixture();
  const original = await member.query(api.character.listByCampaign, listArgs);
  for (const caller of [outsider, t]) {
    expect(await caller.query(api.character.listByCampaign, listArgs)).toEqual(
      [],
    );
    await expect(
      caller.mutation(api.character.createCharacter, {
        organizationId: 'org',
        character: {
          campaignId: listArgs.campaignId,
          name: 'Denied',
          kind: 'pc',
          ...stats,
        },
      }),
    ).rejects.toThrow('You do not have access to this org');
    await expect(
      caller.mutation(api.character.updateCharacter, {
        organizationId: 'org',
        characterId,
        patch: { level: 99 },
      }),
    ).rejects.toThrow('You do not have access to this org');
    await expect(
      caller.mutation(api.character.archiveCharacter, {
        organizationId: 'org',
        characterId,
        isActive: false,
      }),
    ).rejects.toThrow('You do not have access to this org');
  }
  expect(
    await outsider.query(api.character.listByCampaign, {
      ...listArgs,
      organizationId: 'other',
    }),
  ).toEqual([]);
  await expect(
    outsider.mutation(api.character.updateCharacter, {
      organizationId: 'other',
      characterId,
      patch: { name: 'Foreign' },
    }),
  ).rejects.toThrow('No campaign exists for this organization');
  expect(await member.query(api.character.listByCampaign, {})).toEqual([]);
  expect(await owner.query(api.character.listByCampaign, listArgs)).toEqual(
    original.map((character) => ({
      ...character,
      owner: character.owner
        ? { ...character.owner, isMine: character.ownerId === 'test|gm' }
        : null,
    })),
  );
  await owner.mutation(api.character.archiveCharacter, {
    organizationId: 'org',
    characterId,
    isActive: false,
  });
  await expect(
    outsider.mutation(api.character.deleteCharacter, {
      organizationId: 'org',
      characterId,
    }),
  ).rejects.toThrow('You do not have access to this org');
});

test('outsiders cannot learn whether a Character is active by attempting deletion', async () => {
  const { outsider, characterId } = await fixture();
  await expect(
    outsider.mutation(api.character.deleteCharacter, {
      organizationId: 'org',
      characterId,
    }),
  ).rejects.toThrow('You do not have access to this org');
});

test('token-identifier substrings grant neither ledger nor roster access', async () => {
  const { owner, member, outsider, fallback, t, scope, listArgs, characterId } =
    await fixture();
  expect(await fallback.query(api.character.listByCampaign, listArgs)).toEqual(
    [],
  );
  expect(
    await fallback.query(api.user.getOrgAccessStatus, {
      organizationId: 'org',
    }),
  ).toEqual({ state: 'no_access' });
  await expect(
    fallback.mutation(api.character.updateCharacter, {
      organizationId: 'org',
      characterId,
      patch: { description: 'Forged access' },
    }),
  ).rejects.toThrow('You do not have access to this org');
  const before = await owner.query(api.canonicalLedger.read, scope);
  const roster = before.state.militiaSnapshot.roster;
  const snapshot = {
    ...before.state.militiaSnapshot,
    roster: {
      ...roster,
      people: [
        ...roster.people,
        { characterId, kind: 'npc' as const, hitDice: 0 },
      ],
      officers: [
        ...roster.officers,
        { characterId, role: 'commandant' as const },
      ],
      teams: roster.teams.map((team) => ({
        ...team,
        managerCharacterId: characterId,
      })),
    },
  };
  const correction = {
    ...scope,
    expectedRevision: before.revision,
    snapshot,
    reason: 'Assign Vessa',
  };
  for (const caller of [outsider, fallback, t]) {
    await expect(caller.query(api.canonicalLedger.read, scope)).rejects.toThrow(
      'Campaign access required',
    );
    await expect(
      caller.mutation(api.canonicalLedger.save, correction),
    ).rejects.toThrow('Campaign access required');
  }
  expect(await owner.query(api.canonicalLedger.read, scope)).toEqual(before);
  await member.mutation(api.canonicalLedger.save, correction);
  const assigned = await owner.query(api.canonicalLedger.read, scope);
  expect(assigned.state.militiaSnapshot.roster).toEqual(snapshot.roster);
  await owner.mutation(api.canonicalLedger.save, {
    ...scope,
    expectedRevision: assigned.revision,
    snapshot: { ...assigned.state.militiaSnapshot, roster },
    reason: 'Unassign Vessa',
  });
  expect(
    (await member.query(api.canonicalLedger.read, scope)).state.militiaSnapshot
      .roster,
  ).toEqual(roster);
  expect(
    (await member.query(api.character.listByCampaign, listArgs)).find(
      (character) => character._id === characterId,
    ),
  ).toMatchObject({ ownerId: 'test|gm', isActive: true });
});

test('Character edits refresh Militia Character Facts without changing assignments or frozen weekly records', async () => {
  vi.useFakeTimers();
  const { t, owner, member, seeded, scope, characterId } = await fixture();
  const initial = await member.query(api.canonicalLedger.read, scope);
  const roster = initial.state.militiaSnapshot.roster;
  await member.mutation(api.canonicalLedger.save, {
    ...scope,
    expectedRevision: initial.revision,
    reason: 'Assign Vessa',
    snapshot: {
      ...initial.state.militiaSnapshot,
      roster: {
        ...roster,
        people: [...roster.people, { characterId, kind: 'npc', hitDice: 0 }],
        officers: [...roster.officers, { characterId, role: 'commandant' }],
        teams: roster.teams.map((team) => ({
          ...team,
          managerCharacterId: characterId,
        })),
      },
    },
  });
  for (const [baseRevision, edit] of initializationEdits(
    'patrol',
    seeded.characterId,
  ).entries()) {
    await member.mutation(api.canonicalDraftPersistence.edit, {
      ...scope,
      operation: {
        draftId: seeded.key.draftId,
        operationId: `edit-${baseRevision}`,
        baseRevision,
        edit,
      },
    });
  }
  const preview = await member.query(
    api.canonicalDraftPersistence.preview,
    seeded.key,
  );
  expect(preview.status).toBe('ready');
  await member.mutation(api.canonicalDraftPersistence.confirm, {
    ...seeded.key,
    operation: { operationId: 'confirm', reviewed: preview.reviewed },
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const history = await member.query(api.canonicalHistory.read, {
    campaignId: scope.campaignId,
    week: 9,
  });
  expect(history).not.toBeNull();
  const before = await member.query(api.canonicalLedger.read, scope);
  await owner.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId,
    patch: {
      level: 6,
      strength: 14,
      dexterity: 15,
      constitution: 16,
      intelligence: 17,
      wisdom: 18,
      charisma: 19,
    },
  });
  const updated = await member.query(api.canonicalLedger.read, scope);
  expect(updated.revision).toBe(before.revision + 1);
  expect(
    updated.state.militiaSnapshot.characters.find(
      (character) => character.characterId === characterId,
    ),
  ).toEqual({
    characterId,
    level: 6,
    strength: 14,
    dexterity: 15,
    constitution: 16,
    intelligence: 17,
    wisdom: 18,
    charisma: 19,
    isActive: true,
  });
  expect(updated.state.militiaSnapshot.roster).toEqual(
    before.state.militiaSnapshot.roster,
  );
  for (const patch of [{ description: 'Notes only' }, { level: 6 }]) {
    await member.mutation(api.character.updateCharacter, {
      organizationId: 'org',
      characterId,
      patch,
    });
  }
  const unchangedFacts = await owner.query(api.canonicalLedger.read, scope);
  expect(unchangedFacts.revision).toBe(updated.revision);
  expect(unchangedFacts.state.militiaSnapshot).toEqual(
    updated.state.militiaSnapshot,
  );
  await member.mutation(api.character.archiveCharacter, {
    organizationId: 'org',
    characterId,
    isActive: false,
  });
  const archived = await owner.query(api.canonicalLedger.read, scope);
  expect(archived.revision).toBe(unchangedFacts.revision + 1);
  expect(
    archived.state.militiaSnapshot.characters.find(
      (character) => character.characterId === characterId,
    )?.isActive,
  ).toBe(false);
  expect(archived.state.militiaSnapshot.roster).toEqual(
    before.state.militiaSnapshot.roster,
  );
  expect(
    await owner.query(api.canonicalHistory.read, {
      campaignId: scope.campaignId,
      week: 9,
    }),
  ).toEqual(history);
});

test('creating a Character appends Militia Character Facts without enrolling it and later edits replace only its facts', async () => {
  const { owner, member, scope } = await fixture();
  const before = await member.query(api.canonicalLedger.read, scope);
  const characterId = await owner.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: {
      campaignId: scope.campaignId,
      name: 'Rook',
      kind: 'pc',
      ...stats,
    },
  });
  const created = await member.query(api.canonicalLedger.read, scope);
  const { description: _notes, ...factStats } = stats;
  expect(created.revision).toBe(before.revision + 1);
  expect(created.state.militiaSnapshot.characters).toEqual([
    ...before.state.militiaSnapshot.characters,
    { characterId, ...factStats, isActive: true },
  ]);
  expect(created.state.militiaSnapshot.roster).toEqual(
    before.state.militiaSnapshot.roster,
  );
  await member.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId,
    patch: { level: 7 },
  });
  const edited = await owner.query(api.canonicalLedger.read, scope);
  expect(edited.state.militiaSnapshot.characters).toEqual([
    ...before.state.militiaSnapshot.characters,
    { characterId, ...factStats, level: 7, isActive: true },
  ]);
  expect(edited.state.militiaSnapshot.roster).toEqual(
    before.state.militiaSnapshot.roster,
  );
});

test('the ledger remains editable when a campaign has no militia or no canonical source yet', async () => {
  const { t, owner, member } = await fixture();
  for (const hasMilitia of [false, true]) {
    const campaignId = await owner.mutation(api.campaign.createCampaign, {
      organizationId: 'org',
      name: 'Uninitialized',
      description: '',
    });
    if (hasMilitia) {
      await t.run((ctx) =>
        ctx.db.insert('militia', { campaignId, name: 'Pending setup' }),
      );
    }
    const characterId = await member.mutation(api.character.createCharacter, {
      organizationId: 'org',
      character: { campaignId, name: 'Scout', kind: 'pc', ...stats },
    });
    await owner.mutation(api.character.updateCharacter, {
      organizationId: 'org',
      characterId,
      patch: { level: 8 },
    });
    await member.mutation(api.character.archiveCharacter, {
      organizationId: 'org',
      characterId,
      isActive: false,
    });
    const characters = await owner.query(api.character.listByCampaign, {
      campaignId,
      organizationId: 'org',
      includeInactive: true,
    });
    expect(characters).toHaveLength(1);
    expect(characters[0]).toMatchObject({
      _id: characterId,
      campaignId,
      ownerId: 'test|player',
      name: 'Scout',
      ...stats,
      level: 8,
      isActive: false,
    });
  }
});
