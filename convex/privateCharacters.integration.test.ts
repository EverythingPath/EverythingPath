// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';
import type { Infer } from 'convex/values';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import { api, internal } from './_generated/api';
import schema, { type spellValidator } from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';

const modules = import.meta.glob('./**/*.ts');
preloadCalledConvexModules({ modules, testFile: import.meta.url });

// One row in the legacy spell table, kept until its tables are narrowed.
const legacySpell: Infer<typeof spellValidator> = {
  name: 'Legacy spell',
  spellLevel: '',
  school: '',
  subschool: '',
  descriptor: '',
  castingTime: '',
  components: '',
  hasCostlyComponents: false,
  range: '',
  area: '',
  effect: '',
  targets: '',
  duration: '',
  dismissible: false,
  shapeable: false,
  savingThrow: '',
  spellResistance: '',
  description: '',
  descriptionFormatted: '',
  source: '',
  fullText: '',
  verbal: false,
  somatic: false,
  material: false,
  requiresFocus: false,
  requiresDivineFocus: false,
  sorcerer: null,
  wizard: null,
  cleric: null,
  druid: null,
  ranger: null,
  bard: null,
  paladin: null,
  alchemist: null,
  summoner: null,
  witch: null,
  inquisitor: null,
  oracle: null,
  antipaladin: null,
  magus: null,
  adept: null,
  deity: '',
  SLALevel: null,
  domain: '',
  shortDescription: '',
  acid: false,
  air: false,
  chaotic: false,
  cold: false,
  curse: false,
  darkness: false,
  death: false,
  disease: false,
  earth: false,
  electricity: false,
  emotion: false,
  evil: false,
  fear: false,
  fire: false,
  force: false,
  good: false,
  languageDependent: false,
  lawful: false,
  light: false,
  mindAffecting: false,
  pain: false,
  poison: false,
  shadow: false,
  sonic: false,
  water: false,
  linkText: null,
  id: 1,
  materialCosts: null,
  bloodline: '',
  patron: '',
  mythicText: '',
  augmented: '',
  mythic: false,
  bloodrager: null,
  shaman: null,
  psychic: null,
  medium: null,
  mesmerist: null,
  occultist: null,
  spiritualist: null,
  skald: null,
  investigator: null,
  hunter: null,
  ruse: false,
  draconic: false,
  meditative: false,
  summonerUnchained: null,
};

async function fixture() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (const person of ['owner', 'member', 'outsider']) {
      await ctx.db.insert('user', {
        tokenIdentifier: `test|${person}`,
        orgIds: person === 'outsider' ? [] : [{ orgId: 'org', role: 'member' }],
        ...(person === 'owner' ? { characterSheetDemo: true } : {}),
      });
    }
  });
  return {
    t,
    owner: t.withIdentity({ tokenIdentifier: 'test|owner' }),
    member: t.withIdentity({ tokenIdentifier: 'test|member' }),
    outsider: t.withIdentity({ tokenIdentifier: 'test|outsider' }),
  };
}

const newCharacter = {
  name: 'Private Vessa',
  kind: 'pc' as const,
  operationId: 'create',
};

test('an owner creates and edits a private Full Character without an organization or campaign', async () => {
  const { owner } = await fixture();
  const characterId = await owner.mutation(
    api.characterSheet.create,
    newCharacter,
  );
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(sheet?.character).toMatchObject({
    name: 'Private Vessa',
    ownerId: 'test|owner',
    sheetMode: 'full',
  });
  expect(sheet?.character.campaignId).toBeUndefined();
  expect(sheet?.calculated.level).toBe(1);
  await owner.mutation(api.characterSheet.editBaseScores, {
    characterId,
    operationId: 'scores',
    scores: { strength: 16 },
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    ),
  ).toMatchObject({
    calculated: { abilities: { strength: { score: 16 } } },
    updatedBy: 'test|owner',
  });
});

test('private links disclose nothing to another owner, campaign member, outsider or signed-out caller, including through legacy writers', async () => {
  const { t, owner, member, outsider } = await fixture();
  const characterId = await owner.mutation(
    api.characterSheet.create,
    newCharacter,
  );
  const missingId = await owner.mutation(api.characterSheet.create, {
    ...newCharacter,
    name: 'Removed',
  });
  await t.run((ctx) => ctx.db.delete('character', missingId));
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  for (const caller of [member, outsider, t]) {
    for (const id of [characterId, missingId, 'malformed']) {
      await expect(
        caller.query(api.characterSheet.read, { characterId: id }),
      ).rejects.toThrow('Character not found');
    }
    await expect(
      caller.mutation(api.characterSheet.editBaseScores, {
        characterId,
        operationId: 'denied',
        scores: { strength: 99 },
      }),
    ).rejects.toThrow('Character not found');
  }
  await expect(
    owner.mutation(api.character.updateCharacter, {
      characterId,
      organizationId: 'org',
      patch: { strength: 99 },
    }),
  ).rejects.toThrow('Character not found');
  await expect(
    owner.mutation(api.character.archiveCharacter, {
      characterId,
      organizationId: 'org',
      isActive: false,
    }),
  ).rejects.toThrow('Character not found');
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    ),
  ).toEqual(before);
  await t.run(async (ctx) => {
    const user = await ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', 'test|owner'),
      )
      .unique();
    await ctx.db.delete('user', user!._id);
  });
  await expect(
    owner.query(api.characterSheet.read, { characterId }),
  ).rejects.toThrow('Character not found');
});

test('unscoped campaign links disclose nothing to outsiders or signed-out callers on reads and writes', async () => {
  const { t, owner, outsider } = await fixture();
  const campaignId = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Shared campaign',
      description: '',
      ownerId: 'test|owner',
      organizationId: 'org',
      e2eFixture: {
        namespace: 'private',
        version: 1,
        workerKey: '0',
        caseKey: 'sheet',
        campaignKey: 'sheet',
      },
    }),
  );
  const characterId = await owner.mutation(api.characterSheet.create, {
    ...newCharacter,
    campaignId,
    organizationId: 'org',
  });
  const missingId = await owner.mutation(
    api.characterSheet.create,
    newCharacter,
  );
  await owner.mutation(api.characterSheet.deletePrivate, {
    characterId: missingId,
    operationId: 'delete',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const unregistered = t.withIdentity({ tokenIdentifier: 'test|unregistered' });
  for (const caller of [outsider, unregistered, t]) {
    for (const id of [characterId, missingId]) {
      await expect(
        caller.query(api.characterSheet.read, { characterId: id }),
      ).rejects.toThrow(/^Character not found$/);
      await expect(
        caller.mutation(api.characterSheet.editBaseScores, {
          characterId: id,
          operationId: 'denied',
          scores: { strength: 99 },
        }),
      ).rejects.toThrow(/^Character not found$/);
    }
  }
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    ),
  ).toEqual(before);
  await t.run((ctx) => ctx.db.delete('campaign', campaignId));
  await expect(
    owner.query(api.characterSheet.read, { characterId }),
  ).rejects.toThrow('Character not found');
  await expect(
    owner.mutation(api.characterSheet.editBaseScores, {
      characterId,
      operationId: 'orphaned',
      scores: { strength: 99 },
    }),
  ).rejects.toThrow('Character not found');
});

test('private sheets reject an asserted organization on reads and writes even for their owner', async () => {
  const { owner } = await fixture();
  const characterId = await owner.mutation(
    api.characterSheet.create,
    newCharacter,
  );
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  for (const organizationId of ['org', '']) {
    await expect(
      owner.mutation(api.characterSheet.create, {
        ...newCharacter,
        organizationId,
      }),
    ).rejects.toThrow('Campaign is required for an organization');
    await expect(
      owner.query(api.characterSheet.read, { characterId, organizationId }),
    ).rejects.toThrow('Character not found');
    await expect(
      owner.mutation(api.characterSheet.editBaseScores, {
        characterId,
        organizationId,
        operationId: 'denied',
        scores: { strength: 99 },
      }),
    ).rejects.toThrow('Character not found');
  }
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    ),
  ).toEqual(before);
});

afterEach(() => vi.useRealTimers());

test('only the owner can delete a private sheet and its owned definitions and Accepted Warnings, with campaign deletion refused', async () => {
  vi.useFakeTimers();
  const { t, owner, member } = await fixture();
  const characterId = await owner.mutation(
    api.characterSheet.create,
    newCharacter,
  );
  async function acceptPointBuy(id: typeof characterId) {
    await owner.mutation(api.characterSheet.editBaseScores, {
      characterId: id,
      operationId: 'scores',
      scores: { strength: 18 },
    });
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, {
        characterId: id,
      }),
    );
    const warning = sheet?.calculated.warnings.find(
      (warning) => warning.check === 'pointBuy',
    );
    if (!warning) throw new Error('Missing point-buy warning');
    await owner.mutation(api.characterSheet.acceptWarning, {
      characterId: id,
      operationId: 'accept',
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
    });
  }
  await acceptPointBuy(characterId);
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    )?.acceptedWarnings,
  ).toHaveLength(1);
  await expect(
    member.mutation(api.characterSheet.deletePrivate, {
      characterId,
      operationId: 'denied',
    }),
  ).rejects.toThrow('Character not found');
  const unrelatedId = await owner.mutation(api.characterSheet.create, {
    ...newCharacter,
    name: 'Keep me',
  });
  await acceptPointBuy(unrelatedId);
  const unrelated = withSheetCatalog(
    await owner.query(api.characterSheet.read, {
      characterId: unrelatedId,
    }),
  );
  const spellId = await t.run(async (ctx) => {
    const spellId = await ctx.db.insert('spell', legacySpell);
    await ctx.db.insert('characterSpell', { characterId, spellId });
    await ctx.db.insert('characterSpell', {
      characterId: unrelatedId,
      spellId,
    });
    return spellId;
  });
  await owner.mutation(api.characterSheet.deletePrivate, {
    characterId,
    operationId: 'delete',
  });
  // Hundreds of browse-only seeds leave in scheduled batches.
  expect(
    await t.run(async (ctx) =>
      ctx.db
        .query('catalogEntry')
        .withIndex('by_characterId_and_browseOnly', (q) =>
          q.eq('characterId', characterId).eq('browseOnly', true),
        )
        .take(33),
    ),
  ).toHaveLength(33);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  // Deletion storage invariant: no unreachable Character-owned children remain.
  expect(
    await t.run(async (ctx) => ({
      entries: await ctx.db
        .query('characterSheetEntry')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .collect(),
      definitions: await ctx.db
        .query('catalogEntry')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .collect(),
      spells: await ctx.db
        .query('characterSpell')
        .withIndex('characterId', (q) => q.eq('characterId', characterId))
        .collect(),
      acceptedWarnings: await ctx.db
        .query('acceptedWarning')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .collect(),
    })),
  ).toEqual({
    entries: [],
    definitions: [],
    spells: [],
    acceptedWarnings: [],
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId: unrelatedId }),
    ),
  ).toEqual(unrelated);
  expect(await t.run((ctx) => ctx.db.get('spell', spellId))).not.toBeNull();
  expect(
    await t.run((ctx) =>
      ctx.db
        .query('characterSpell')
        .withIndex('characterId', (q) => q.eq('characterId', unrelatedId))
        .collect(),
    ),
  ).toHaveLength(1);
  await expect(
    owner.query(api.characterSheet.read, { characterId }),
  ).rejects.toThrow('Character not found');
  const campaignId = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'No militia',
      description: '',
      ownerId: 'test|owner',
      organizationId: 'org',
      e2eFixture: {
        namespace: 'private',
        version: 1,
        workerKey: '0',
        caseKey: 'sheet',
        campaignKey: 'sheet',
      },
    }),
  );
  const sharedId = await owner.mutation(api.characterSheet.create, {
    ...newCharacter,
    campaignId,
    organizationId: 'org',
  });
  await acceptPointBuy(sharedId);
  const shared = withSheetCatalog(
    await owner.query(api.characterSheet.read, {
      characterId: sharedId,
    }),
  );
  await expect(
    owner.mutation(api.characterSheet.deletePrivate, {
      characterId: sharedId,
      operationId: 'delete',
    }),
  ).rejects.toThrow('Archive campaign Characters instead');
  await member.mutation(api.characterSheet.archive, {
    characterId: sharedId,
    isActive: false,
    operationId: 'archive',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId: sharedId }),
    ),
  ).toMatchObject({
    character: { isActive: false, campaignId },
    calculated: { level: 1 },
    acceptedWarnings: shared?.acceptedWarnings,
    lastOperationId: 'archive',
    revision: shared!.revision + 1,
  });
  expect(
    await owner.query(api.character.listByCampaign, {
      campaignId,
      organizationId: 'org',
    }),
  ).toEqual([]);
  await owner.mutation(api.characterSheet.archive, {
    characterId: sharedId,
    isActive: true,
    operationId: 'restore',
  });
  expect(
    withSheetCatalog(
      await member.query(api.characterSheet.read, { characterId: sharedId }),
    ),
  ).toMatchObject({
    character: { isActive: true, campaignId },
    acceptedWarnings: shared?.acceptedWarnings,
    lastOperationId: 'restore',
    revision: shared!.revision + 2,
  });
});

test('private creation settings and warning commands belong only to the unscoped owner', async () => {
  const { t, owner, member, outsider } = await fixture();
  const characterId = await owner.mutation(
    api.characterSheet.create,
    newCharacter,
  );
  await owner.mutation(api.characterSheet.editCreationSettings, {
    characterId,
    operationId: 'settings',
    settings: { traitCount: 0, campaignTraitRequired: true },
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    characterId,
    operationId: 'scores',
    scores: { strength: 18 },
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(sheet?.calculated.creationSettings).toEqual({
    abilityMethod: { kind: 'pointBuy', budget: 15 },
    traitCount: 0,
    campaignTraitRequired: true,
  });
  const warning = sheet?.calculated.warnings.find(
    (warning) => warning.check === 'pointBuy',
  );
  if (!warning) throw new Error('Missing point-buy warning');
  const key = { check: warning.check, subject: warning.subject };
  function commands(caller: typeof owner, organizationId?: string) {
    const scope = {
      characterId,
      ...(organizationId ? { organizationId } : {}),
      operationId: 'command',
    };
    return [
      () =>
        caller.mutation(api.characterSheet.editCreationSettings, {
          ...scope,
          settings: { traitCount: 3 },
        }),
      () =>
        caller.mutation(api.characterSheet.acceptWarning, {
          ...scope,
          ...key,
          fingerprint: warning!.fingerprint,
        }),
      () =>
        caller.mutation(api.characterSheet.reopenWarning, { ...scope, ...key }),
    ];
  }
  for (const caller of [t, member, outsider])
    for (const organizationId of [undefined, 'org'])
      for (const command of commands(caller, organizationId))
        await expect(command()).rejects.toThrow('Character not found');
  for (const command of commands(owner, 'org'))
    await expect(command()).rejects.toThrow('Character not found');
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    ),
  ).toEqual(sheet);
  await owner.mutation(api.characterSheet.acceptWarning, {
    characterId,
    operationId: 'accept',
    ...key,
    fingerprint: warning.fingerprint,
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    )?.acceptedWarnings,
  ).toHaveLength(1);
  await owner.mutation(api.characterSheet.reopenWarning, {
    characterId,
    operationId: 'reopen',
    ...key,
  });
  const reopened = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(reopened?.acceptedWarnings).toEqual([]);
  expect(reopened?.calculated).toEqual(sheet?.calculated);
});

test('private deletion removes Accepted Warnings up to the sheet’s full acceptance capacity', async () => {
  const { t, owner } = await fixture();
  const characterId = await owner.mutation(
    api.characterSheet.create,
    newCharacter,
  );
  // Stored acceptance capacity is independent of the smaller entry-row limit.
  await t.run(async (ctx) => {
    for (let index = 0; index < 8192; index++)
      await ctx.db.insert('acceptedWarning', {
        characterId,
        check: 'futureCheck',
        subject: `subject:${index}`,
        fingerprint: 'recorded-facts',
        acceptedBy: 'test|owner',
        acceptedAt: 0,
      });
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    )?.acceptedWarnings,
  ).toHaveLength(8192);
  await owner.mutation(api.characterSheet.deletePrivate, {
    characterId,
    operationId: 'delete',
  });
  await expect(
    owner.query(api.characterSheet.read, { characterId }),
  ).rejects.toThrow('Character not found');
  expect(
    await t.run((ctx) =>
      ctx.db
        .query('acceptedWarning')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .take(1),
    ),
  ).toEqual([]);
});

test('private demos never activate ordinary users or unmarked sheets, and maintenance closes every new writer', async () => {
  const { t, owner, outsider } = await fixture();
  await expect(
    outsider.mutation(api.characterSheet.create, newCharacter),
  ).rejects.toThrow(
    "Private character sheets aren't available for your account yet.",
  );
  await expect(
    t.mutation(api.characterSheet.create, newCharacter),
  ).rejects.toThrow('Authentication required');
  const characterId = await owner.mutation(
    api.characterSheet.create,
    newCharacter,
  );
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, { sheetDemo: undefined }),
  );
  await expect(
    owner.mutation(api.characterSheet.editBaseScores, {
      characterId,
      operationId: 'edit',
      scores: { strength: 12 },
    }),
  ).rejects.toThrow("Editing isn't available for this character sheet yet.");
  await expect(
    owner.mutation(api.characterSheet.deletePrivate, {
      characterId,
      operationId: 'delete',
    }),
  ).rejects.toThrow("Editing isn't available for this character sheet yet.");
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, { sheetDemo: true }),
  );
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const run = await t.mutation(internal.initialMigration.start, {
    operationId: 'maintenance',
    expectedEpoch: 0,
    frontendBuild: '260',
    catalogManifest: 'test',
    maintenanceBudgetMs: 60000,
  });
  try {
    await expect(
      owner.mutation(api.characterSheet.create, newCharacter),
    ).rejects.toThrow('MAINTENANCE');
    await expect(
      owner.mutation(api.characterSheet.editBaseScores, {
        characterId,
        operationId: 'edit',
        scores: { strength: 12 },
      }),
    ).rejects.toThrow('MAINTENANCE');
    await expect(
      owner.mutation(api.characterSheet.deletePrivate, {
        characterId,
        operationId: 'delete',
      }),
    ).rejects.toThrow('MAINTENANCE');
    await expect(
      owner.mutation(api.characterSheet.archive, {
        characterId,
        operationId: 'archive',
        isActive: false,
      }),
    ).rejects.toThrow('MAINTENANCE');
    expect(
      withSheetCatalog(
        await owner.query(api.characterSheet.read, { characterId }),
      ),
    ).toEqual(before);
    await expect(
      owner.mutation(api.characterSheet.addClassLevel, {
        characterId,
        operationId: 'level',
      }),
    ).rejects.toThrow('MAINTENANCE');
  } finally {
    await t.mutation(internal.initialMigration.abortBeforeActivation, run);
  }
  await expect(
    owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      operationId: 'stale',
    }),
  ).rejects.toThrow('RELOAD_REQUIRED');
  await owner.mutation(api.characterSheet.addClassLevel, {
    characterId,
    operationId: 'fresh',
    writeEpoch: 2,
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    ),
  ).toMatchObject({ calculated: { level: 2 } });
});

test('ownership follows the current persisted owner, while ownerless campaign Characters remain shared', async () => {
  const { t, owner, member } = await fixture();
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|other-owner',
      orgIds: [],
      characterSheetDemo: true,
    }),
  );
  const otherOwner = t.withIdentity({ tokenIdentifier: 'test|other-owner' });
  const characterId = await owner.mutation(
    api.characterSheet.create,
    newCharacter,
  );
  const otherId = await otherOwner.mutation(api.characterSheet.create, {
    ...newCharacter,
    name: 'Other private',
  });
  await expect(
    otherOwner.query(api.characterSheet.read, { characterId }),
  ).rejects.toThrow('Character not found');
  await expect(
    owner.query(api.characterSheet.read, { characterId: otherId }),
  ).rejects.toThrow('Character not found');
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, { ownerId: 'test|other-owner' }),
  );
  await expect(
    owner.query(api.characterSheet.read, { characterId }),
  ).rejects.toThrow('Character not found');
  expect(
    withSheetCatalog(
      await otherOwner.query(api.characterSheet.read, { characterId }),
    ),
  ).toMatchObject({ character: { ownerId: 'test|other-owner' } });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, { ownerId: undefined }),
  );
  await expect(
    otherOwner.query(api.characterSheet.read, { characterId }),
  ).rejects.toThrow('Character not found');
  const campaignId = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'No militia',
      description: '',
      ownerId: 'test|owner',
      organizationId: 'org',
      e2eFixture: {
        namespace: 'private',
        version: 1,
        workerKey: '0',
        caseKey: 'sheet',
        campaignKey: 'sheet',
      },
    }),
  );
  const sharedId = await owner.mutation(api.characterSheet.create, {
    ...newCharacter,
    campaignId,
    organizationId: 'org',
  });
  await t.run((ctx) =>
    ctx.db.patch('character', sharedId, { ownerId: undefined }),
  );
  await member.mutation(api.characterSheet.editBaseScores, {
    characterId: sharedId,
    operationId: 'shared',
    scores: { wisdom: 14 },
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId: sharedId }),
    ),
  ).toMatchObject({ calculated: { abilities: { wisdom: { score: 14 } } } });
  await expect(
    member.query(api.characterSheet.read, {
      characterId: sharedId,
      organizationId: 'other',
    }),
  ).rejects.toThrow();
  await expect(
    owner.mutation(api.characterSheet.create, { ...newCharacter, campaignId }),
  ).rejects.toThrow('Organization is required');
  await expect(
    owner.mutation(api.characterSheet.create, {
      ...newCharacter,
      organizationId: 'org',
    }),
  ).rejects.toThrow('Campaign is required');
});

test('private sheet commands reject another Character’s rows and asserted campaign scope without changing either sheet', async () => {
  const { t, owner } = await fixture();
  const characterId = await owner.mutation(
    api.characterSheet.create,
    newCharacter,
  );
  const otherId = await owner.mutation(api.characterSheet.create, {
    ...newCharacter,
    name: 'Other',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const other = withSheetCatalog(
    await owner.query(api.characterSheet.read, {
      characterId: otherId,
    }),
  );
  const entry = other?.entries.find((row) => row.kind === 'classLevel');
  if (!entry) throw new Error('Missing Class Level');
  const campaignId = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Wrong context',
      description: '',
      ownerId: 'test|owner',
      organizationId: 'org',
    }),
  );
  await expect(
    owner.query(api.characterSheet.read, { characterId, campaignId }),
  ).rejects.toThrow('Character not found');
  await expect(
    owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      campaignId,
      operationId: 'wrong-context',
    }),
  ).rejects.toThrow('Character not found');
  await expect(
    owner.mutation(api.characterSheet.editClassLevel, {
      characterId,
      entryId: entry._id,
      operationId: 'edit',
      hpGained: 99,
    }),
  ).rejects.toThrow('does not belong');
  await expect(
    owner.mutation(api.characterSheet.moveClassLevel, {
      characterId,
      entryId: entry._id,
      operationId: 'move',
      position: 1,
    }),
  ).rejects.toThrow('does not belong');
  await expect(
    owner.mutation(api.characterSheet.deleteClassLevel, {
      characterId,
      entryId: entry._id,
      operationId: 'remove',
    }),
  ).rejects.toThrow('does not belong');
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    ),
  ).toEqual(before);
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId: otherId }),
    ),
  ).toEqual(other);
});

test('an accessible campaign cannot supply context for another campaign sheet, and stale roster references hide private names', async () => {
  const t = convexTest(schema, modules);
  const member = t.withIdentity({ tokenIdentifier: 'test|player' });
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const seeded = await owner.run((ctx) => seedAcceptedCampaign(ctx));
  const otherCampaignId = await owner.mutation(api.campaign.createCampaign, {
    organizationId: 'org',
    name: 'Other campaign',
    description: '',
  });
  await expect(
    member.query(api.characterSheet.read, {
      characterId: seeded.characterId,
      campaignId: otherCampaignId,
    }),
  ).rejects.toThrow('Character not found');
  await expect(
    member.mutation(api.characterSheet.addClassLevel, {
      characterId: seeded.characterId,
      campaignId: otherCampaignId,
      operationId: 'wrong-campaign',
    }),
  ).rejects.toThrow('Character not found');
  await t.run((ctx) =>
    ctx.db.patch('character', seeded.characterId, {
      campaignId: undefined,
      ownerId: 'test|gm',
      name: 'Secret name',
    }),
  );
  const workspace = await member.query(
    api.canonicalDraftPersistence.workspace,
    { campaignId: seeded.key.campaignId },
  );
  expect(workspace?.people).toContainEqual({
    characterId: seeded.characterId,
    name: null,
  });
  await expect(
    member.query(api.characterSheet.read, { characterId: seeded.characterId }),
  ).rejects.toThrow('Character not found');
});
