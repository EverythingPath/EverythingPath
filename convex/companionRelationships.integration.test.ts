// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';
import { newMilitiaSetup } from '../src/lib/canonical-setup';

const modules = import.meta.glob('./**/*.ts');
const source = { key: 'bond', label: 'Companion bond', enabled: true };

test('campaign members link independent sheets and discover both directions', async () => {
  const { owner, member, characterId, otherId } = await fixture();
  const relationshipId = await member.mutation(
    api.companionRelationships.link,
    {
      associatedCharacterId: characterId,
      companionCharacterId: otherId,
      kind: 'cohort',
      sources: [source],
      operationId: 'link',
    },
  );
  expect(
    await owner.query(api.companionRelationships.list, { characterId }),
  ).toMatchObject([
    {
      relationshipId,
      role: 'companion',
      status: 'active',
      endpoint: { characterId: otherId, name: 'Bryn' },
    },
  ]);
  expect(
    await member.query(api.companionRelationships.list, {
      characterId: otherId,
    }),
  ).toMatchObject([
    {
      relationshipId,
      role: 'associated',
      status: 'active',
      endpoint: { characterId, name: 'Ada' },
    },
  ]);
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId: otherId }),
    ),
  ).toMatchObject({
    calculated: { level: 1 },
    character: { ownerId: 'test|member' },
  });
});

test('private same-owner relationships confer no access to other accounts', async () => {
  const { owner, member, outsider, characterId, otherId } = await fixture({
    privateSheets: true,
  });
  await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: otherId,
    kind: 'familiar',
    sources: [source],
    operationId: 'private-link',
  });
  expect(
    await owner.query(api.companionRelationships.list, { characterId }),
  ).toMatchObject([{ status: 'active' }]);
  for (const caller of [member, outsider]) {
    await expect(
      caller.query(api.companionRelationships.list, { characterId }),
    ).rejects.toThrow('Character not found');
    await expect(
      caller.mutation(api.companionRelationships.link, {
        associatedCharacterId: characterId,
        companionCharacterId: otherId,
        kind: 'familiar',
        sources: [source],
        operationId: 'denied',
      }),
    ).rejects.toThrow('Character not found');
  }
});

test('a private ownership change redacts link status and operation details without granting access', async () => {
  const { t, owner, member, characterId, otherId } = await fixture({
    privateSheets: true,
  });
  await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: otherId,
    kind: 'familiar',
    sources: [source],
    operationId: 'link',
  });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, { ownerId: 'test|member' }),
  );
  const hiddenAssociated = await owner.query(api.companionRelationships.list, {
    characterId: otherId,
  });
  expect(hiddenAssociated).toMatchObject([
    {
      interruption: null,
      endpoint: null,
      sources: [],
    },
  ]);
  const hiddenCompanion = await member.query(api.companionRelationships.list, {
    characterId,
  });
  expect(hiddenCompanion).toMatchObject([
    {
      interruption: 'access',
      endpoint: null,
    },
  ]);
  for (const row of [...hiddenAssociated, ...hiddenCompanion]) {
    expect(row).not.toHaveProperty('status');
    expect(row).not.toHaveProperty('lastOperationId');
  }
  const [relationship] = hiddenAssociated;
  if (!relationship) throw new Error('Missing relationship');
  await expect(
    owner.mutation(api.companionRelationships.restore, {
      relationshipId: relationship.relationshipId,
      operationId: 'restore',
    }),
  ).rejects.toThrow('Character not found');
});

test('self-links, active cycles and a second active associated Character are rejected', async () => {
  const { owner, characterId, otherId } = await fixture();
  const args = {
    kind: 'cohort',
    sources: [source],
    operationId: 'link',
  } satisfies {
    kind: 'cohort';
    sources: (typeof source)[];
    operationId: string;
  };
  await expect(
    owner.mutation(api.companionRelationships.link, {
      ...args,
      associatedCharacterId: characterId,
      companionCharacterId: characterId,
    }),
  ).rejects.toThrow('own Companion');
  await owner.mutation(api.companionRelationships.link, {
    ...args,
    associatedCharacterId: characterId,
    companionCharacterId: otherId,
  });
  await expect(
    owner.mutation(api.companionRelationships.link, {
      ...args,
      associatedCharacterId: otherId,
      companionCharacterId: characterId,
    }),
  ).rejects.toThrow('active cycle');
  const thirdId = await owner.mutation(api.characterSheet.create, {
    campaignId: withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    )?.character.campaignId,
    organizationId: 'org',
    name: 'Third',
    kind: 'pc',
    operationId: 'third',
  });
  await expect(
    owner.mutation(api.companionRelationships.link, {
      ...args,
      associatedCharacterId: thirdId,
      companionCharacterId: otherId,
    }),
  ).rejects.toThrow('already has an active');
});

test.each([
  'animalCompanion',
  'familiar',
  'eidolon',
  'unchainedEidolon',
  'cohort',
] as const)(
  'a new %s owns an independent sheet without invented non-class levels',
  async (kind) => {
    const { owner, member, characterId } = await fixture();
    const created = await member.mutation(api.companionRelationships.create, {
      associatedCharacterId: characterId,
      name: 'New companion',
      kind,
      sources: [source],
      operationId: 'new-companion',
    });
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, {
        characterId: created.companionCharacterId,
      }),
    );
    expect(sheet?.character).toMatchObject({
      ownerId: 'test|member',
      kind: 'npc',
    });
    expect(
      sheet?.entries.filter((entry) => entry.kind === 'classLevel'),
    ).toHaveLength(kind === 'cohort' ? 1 : 0);
    expect(sheet?.calculated.level).toBe(kind === 'cohort' ? 1 : 0);
    expect(
      await member.query(api.companionRelationships.list, { characterId }),
    ).toMatchObject([
      { relationshipId: created.relationshipId, status: 'active' },
    ]);
  },
);

test('new Companions retain the chosen Character kind independently of their relationship kind', async () => {
  const { owner, characterId } = await fixture();
  const created = await owner.mutation(api.companionRelationships.create, {
    associatedCharacterId: characterId,
    kind: 'cohort',
    characterKind: 'pc',
    name: 'Player cohort',
    sources: [source],
    operationId: 'create-pc',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, {
        characterId: created.companionCharacterId,
      }),
    ),
  ).toMatchObject({ character: { kind: 'pc' } });
});

test('a private Character without prepared access cannot create a writable Companion', async () => {
  const { t, owner, characterId } = await fixture({ privateSheets: true });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, { sheetDemo: undefined }),
  );
  const before = await owner.query(api.character.listOwned, {});
  await expect(
    owner.mutation(api.companionRelationships.create, {
      associatedCharacterId: characterId,
      kind: 'familiar',
      name: 'Unavailable',
      sources: [source],
      operationId: 'create-unprepared',
    }),
  ).rejects.toThrow("Editing isn't available");
  expect(await owner.query(api.character.listOwned, {})).toEqual(before);
});

test('creating a Companion does not add it to the militia roster or assign officer roles', async () => {
  const { owner, characterId, campaignId } = await fixture();
  const key = await owner.mutation(api.canonicalSetup.initialize, {
    campaignId,
    initializationId: 'setup',
    setup: newMilitiaSetup('Security'),
  });
  const before = await owner.query(api.canonicalLedger.read, {
    campaignId,
    militiaId: key.militiaId,
  });
  const created = await owner.mutation(api.companionRelationships.create, {
    associatedCharacterId: characterId,
    kind: 'familiar',
    name: 'Companion',
    sources: [source],
    operationId: 'create-companion',
  });
  expect(
    await owner.query(api.character.listCampaignCharacters, {
      campaignId,
      organizationId: 'org',
    }),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        character: expect.objectContaining({
          _id: created.companionCharacterId,
        }),
        isOnRoster: false,
      }),
    ]),
  );
  const after = await owner.query(api.canonicalLedger.read, {
    campaignId,
    militiaId: key.militiaId,
  });
  expect(after.state.militiaSnapshot.roster).toEqual(
    before.state.militiaSnapshot.roster,
  );
});

test('surviving sources preserve support and explicit interruption requires restoration', async () => {
  const { owner, member, characterId, otherId } = await fixture();
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: otherId,
    kind: 'familiar',
    sources: [source],
    operationId: 'link',
  });
  await member.mutation(api.companionRelationships.addSource, {
    relationshipId,
    source: { ...source, key: 'second', label: 'Second source' },
    operationId: 'second-source',
  });
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'bond',
    enabled: false,
    operationId: 'lose-one',
  });
  expect(
    await owner.query(api.companionRelationships.list, { characterId }),
  ).toMatchObject([{ status: 'active' }]);
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'second',
    enabled: false,
    operationId: 'lose-all',
  });
  expect(
    await owner.query(api.companionRelationships.list, { characterId }),
  ).toMatchObject([{ status: 'interrupted', interruption: 'support' }]);
  await member.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'bond',
    enabled: true,
    operationId: 'support-returns',
  });
  expect(
    await owner.query(api.companionRelationships.list, { characterId }),
  ).toMatchObject([{ status: 'active' }]);
  await member.mutation(api.companionRelationships.interrupt, {
    relationshipId,
    operationId: 'interrupt',
  });
  expect(
    await owner.query(api.companionRelationships.list, { characterId }),
  ).toMatchObject([
    {
      status: 'interrupted',
      interruption: 'manual',
      sources: [{ enabled: true }, { enabled: false }],
    },
  ]);
  await owner.mutation(api.companionRelationships.restore, {
    relationshipId,
    operationId: 'restore',
  });
  expect(
    await owner.query(api.companionRelationships.list, { characterId }),
  ).toMatchObject([{ status: 'active' }]);
});

test('Restore refuses a relationship whose supporting sources are unavailable', async () => {
  const { owner, characterId, otherId } = await fixture();
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: otherId,
    kind: 'familiar',
    sources: [source],
    operationId: 'link',
  });
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: source.key,
    enabled: false,
    operationId: 'lose-support',
  });
  await expect(
    owner.mutation(api.companionRelationships.restore, {
      relationshipId,
      operationId: 'restore',
    }),
  ).rejects.toThrow('no available supporting source');
  expect(
    await owner.query(api.companionRelationships.list, { characterId }),
  ).toMatchObject([{ status: 'interrupted', interruption: 'support' }]);
});

test('replacement retains sheets and history while source restoration never reselects the replaced sheet', async () => {
  const { owner, characterId, otherId, campaignId } = await fixture();
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: otherId,
    kind: 'cohort',
    sources: [source],
    operationId: 'old-link',
  });
  const replacement = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Replacement',
    kind: 'npc',
    operationId: 'replacement-sheet',
  });
  const newRelationshipId = await owner.mutation(
    api.companionRelationships.replace,
    {
      relationshipId,
      companionCharacterId: replacement,
      operationId: 'replace',
    },
  );
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'bond',
    enabled: false,
    operationId: 'lost',
  });
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'bond',
    enabled: true,
    operationId: 'returns',
  });
  expect(
    await owner.query(api.companionRelationships.list, { characterId }),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ relationshipId, status: 'replaced' }),
      expect.objectContaining({
        relationshipId: newRelationshipId,
        status: 'active',
      }),
    ]),
  );
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId: otherId }),
    ),
  ).toMatchObject({ calculated: { level: 1 } });
  await owner.mutation(api.companionRelationships.restore, {
    relationshipId,
    operationId: 'reselect',
  });
  expect(
    await owner.query(api.companionRelationships.list, {
      characterId: otherId,
    }),
  ).toMatchObject([{ status: 'active' }]);
});

test('a replaced relationship cannot replace another Companion', async () => {
  const { owner, characterId, otherId, campaignId } = await fixture();
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: otherId,
    kind: 'cohort',
    sources: [source],
    operationId: 'link',
  });
  const replacement = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Replacement',
    kind: 'npc',
    operationId: 'replacement-sheet',
  });
  await owner.mutation(api.companionRelationships.replace, {
    relationshipId,
    companionCharacterId: replacement,
    operationId: 'replace',
  });
  const third = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Third',
    kind: 'npc',
    operationId: 'third-sheet',
  });
  await expect(
    owner.mutation(api.companionRelationships.replace, {
      relationshipId,
      companionCharacterId: third,
      operationId: 'replace-history',
    }),
  ).rejects.toThrow('Reselect this Companion before replacing it');
});

test('lifecycle separation redacts inaccessible endpoints in both directions and resumes eligible relationships', async () => {
  const { t, owner, member, characterId, otherId, campaignId } =
    await fixture();
  await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: otherId,
    kind: 'cohort',
    sources: [source],
    operationId: 'link',
  });
  await t.run((ctx) =>
    ctx.db.patch('character', otherId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  expect(
    await owner.query(api.companionRelationships.list, { characterId }),
  ).toMatchObject([{ interruption: 'access', endpoint: null }]);
  expect(
    JSON.stringify(
      await owner.query(api.companionRelationships.list, { characterId }),
    ),
  ).not.toContain(otherId);
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  const hiddenAssociated = await member.query(api.companionRelationships.list, {
    characterId: otherId,
  });
  expect(hiddenAssociated).toMatchObject([
    { endpoint: null, sources: [], interruption: null },
  ]);
  expect(JSON.stringify(hiddenAssociated)).not.toContain(characterId);
  await t.run(async (ctx) => {
    await ctx.db.patch('character', characterId, { campaignId });
    await ctx.db.patch('character', otherId, { campaignId });
  });
  expect(
    await member.query(api.companionRelationships.list, { characterId }),
  ).toMatchObject([{ status: 'active' }]);
});

test('a deleted or inaccessible former Companion can be replaced without exposing its sheet', async () => {
  const { t, owner, characterId, otherId, campaignId } = await fixture();
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: otherId,
    kind: 'cohort',
    sources: [source],
    operationId: 'link',
  });
  await t.run((ctx) =>
    ctx.db.patch('character', otherId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  const replacement = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Replacement',
    kind: 'npc',
    operationId: 'new-sheet',
  });
  await owner.mutation(api.companionRelationships.replace, {
    relationshipId,
    companionCharacterId: replacement,
    operationId: 'replace',
  });
  expect(
    await owner.query(api.companionRelationships.list, { characterId }),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        relationshipId,
        endpoint: null,
      }),
      expect.objectContaining({
        status: 'active',
        endpoint: { characterId: replacement, name: 'Replacement' },
      }),
    ]),
  );
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  await owner.mutation(api.characterSheet.deletePrivate, {
    characterId,
    operationId: 'delete',
  });
  expect(
    await owner.query(api.companionRelationships.list, {
      characterId: replacement,
    }),
  ).toMatchObject([{ endpoint: null, sources: [] }]);
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId: replacement }),
    ),
  ).toMatchObject({ calculated: { level: 1 } });
});

test('actual Grant loss and Keep restore support automatically without displacing an active path with a cycle', async () => {
  const { t, owner, characterId: a, otherId: b, campaignId } = await fixture();
  const c = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'C',
    kind: 'pc',
    operationId: 'create-c',
  });
  const { fighterId, levelId, grantKey } = await grantSource(t, owner, c);
  await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: a,
    companionCharacterId: b,
    kind: 'cohort',
    sources: [source],
    operationId: 'a-b',
  });
  const interruptedId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: c,
    companionCharacterId: a,
    kind: 'cohort',
    sources: [{ ...source, grantKey }],
    operationId: 'c-a',
  });
  await owner.mutation(api.characterSheet.editGrantState, {
    characterId: c,
    grantKey,
    state: { notes: 'Retained companion support' },
    operationId: 'record-grant',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId: c,
    entryId: levelId,
    classEntryId: null,
    operationId: 'lose-grant',
  });
  expect(
    await owner.query(api.companionRelationships.list, { characterId: c }),
  ).toMatchObject([
    {
      status: 'interrupted',
      interruption: 'support',
      sources: [{ available: false }],
    },
  ]);
  await owner.mutation(api.characterSheet.setDormantEntryKept, {
    characterId: c,
    target: { grantKey },
    kept: true,
    operationId: 'keep',
  });
  expect(
    await owner.query(api.companionRelationships.list, { characterId: c }),
  ).toMatchObject([{ status: 'active', sources: [{ available: true }] }]);
  await owner.mutation(api.characterSheet.setDormantEntryKept, {
    characterId: c,
    target: { grantKey },
    kept: false,
    operationId: 'unkeep',
  });
  await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: b,
    companionCharacterId: c,
    kind: 'cohort',
    sources: [source],
    operationId: 'b-c',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId: c,
    entryId: levelId,
    classEntryId: fighterId,
    operationId: 'restore-grant',
  });
  const cRows = await owner.query(api.companionRelationships.list, {
    characterId: c,
  });
  expect(cRows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        relationshipId: interruptedId,
        status: 'interrupted',
        interruption: 'cycle',
      }),
      expect.objectContaining({ role: 'associated', status: 'active' }),
    ]),
  );
  expect(
    await owner.query(api.companionRelationships.list, { characterId: b }),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ role: 'associated', status: 'active' }),
      expect.objectContaining({ role: 'companion', status: 'active' }),
    ]),
  );
});

test('automatic source restoration never displaces a newer associated Character', async () => {
  const { owner, characterId, otherId, campaignId } = await fixture();
  const oldRelationship = await owner.mutation(
    api.companionRelationships.link,
    {
      associatedCharacterId: characterId,
      companionCharacterId: otherId,
      kind: 'cohort',
      sources: [source],
      operationId: 'old',
    },
  );
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId: oldRelationship,
    sourceKey: 'bond',
    enabled: false,
    operationId: 'lost',
  });
  const third = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Third',
    kind: 'pc',
    operationId: 'third',
  });
  const newer = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: third,
    companionCharacterId: otherId,
    kind: 'cohort',
    sources: [source],
    operationId: 'newer',
  });
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId: oldRelationship,
    sourceKey: 'bond',
    enabled: true,
    operationId: 'returns',
  });
  expect(
    await owner.query(api.companionRelationships.list, {
      characterId: otherId,
    }),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        relationshipId: oldRelationship,
        status: 'interrupted',
        interruption: 'conflict',
      }),
      expect.objectContaining({ relationshipId: newer, status: 'active' }),
    ]),
  );
  await expect(
    owner.mutation(api.companionRelationships.restore, {
      relationshipId: oldRelationship,
      operationId: 'reselect',
    }),
  ).rejects.toThrow('already has an active');
});

test('interrupting a newer association attributes automatic restoration to the same operation', async () => {
  const { owner, characterId, otherId, campaignId } = await fixture();
  const oldRelationship = await owner.mutation(
    api.companionRelationships.link,
    {
      associatedCharacterId: characterId,
      companionCharacterId: otherId,
      kind: 'cohort',
      sources: [source],
      operationId: 'old-link',
    },
  );
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId: oldRelationship,
    sourceKey: source.key,
    enabled: false,
    operationId: 'lost',
  });
  const third = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Third',
    kind: 'pc',
    operationId: 'third',
  });
  const newer = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: third,
    companionCharacterId: otherId,
    kind: 'cohort',
    sources: [source],
    operationId: 'new-link',
  });
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId: oldRelationship,
    sourceKey: source.key,
    enabled: true,
    operationId: 'returns',
  });
  await owner.mutation(api.companionRelationships.interrupt, {
    relationshipId: newer,
    operationId: 'interrupt-newer',
  });
  expect(
    await owner.query(api.companionRelationships.list, { characterId }),
  ).toMatchObject([
    {
      relationshipId: oldRelationship,
      status: 'active',
      lastOperationId: 'interrupt-newer',
    },
  ]);
});

test('a sheet support edit attributes availability changes while surviving support remains active', async () => {
  const { t, owner, characterId, otherId } = await fixture();
  const { levelId, grantKey } = await grantSource(t, owner, characterId);
  await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: otherId,
    kind: 'familiar',
    sources: [source, { ...source, key: 'feature', grantKey }],
    operationId: 'link',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: levelId,
    classEntryId: null,
    operationId: 'lose-feature',
  });
  expect(
    await owner.query(api.companionRelationships.list, { characterId }),
  ).toMatchObject([
    {
      status: 'active',
      sources: [
        { key: 'bond', available: true },
        { key: 'feature', available: false },
      ],
      lastOperationId: 'lose-feature',
    },
  ]);
});

test('structural integrity rejects incompatible private owners, duplicate sources and foreign or unsupported references', async () => {
  const { t, owner, characterId, otherId } = await fixture({
    privateSheets: true,
  });
  const foreignId = await t.run((ctx) =>
    ctx.db.insert('character', {
      name: 'Other owner',
      ownerId: 'test|member',
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
    }),
  );
  const args = {
    associatedCharacterId: characterId,
    companionCharacterId: otherId,
    kind: 'familiar',
    sources: [source],
    operationId: 'link',
  } satisfies Parameters<
    typeof owner.mutation<typeof api.companionRelationships.link>
  >[1];
  await expect(
    owner.mutation(api.companionRelationships.link, {
      ...args,
      companionCharacterId: foreignId,
    }),
  ).rejects.toThrow('Character not found');
  await expect(
    owner.mutation(api.companionRelationships.link, {
      ...args,
      sources: [source, source],
    }),
  ).rejects.toThrow('unique keys');
  const own = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const foreign = withSheetCatalog(
    await owner.query(api.characterSheet.read, {
      characterId: otherId,
    }),
  );
  const base = own?.entries.find((entry) => entry.kind === 'base');
  const otherLevel = foreign?.entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!base || !otherLevel) throw new Error('Missing fixture entries');
  await expect(
    owner.mutation(api.companionRelationships.link, {
      ...args,
      sources: [{ ...source, sheetEntryId: base._id }],
    }),
  ).rejects.toThrow('Class Level, Grant or Selection');
  await expect(
    owner.mutation(api.companionRelationships.link, {
      ...args,
      sources: [{ ...source, sheetEntryId: otherLevel._id }],
    }),
  ).rejects.toThrow('does not belong');
  const ownLevel = own?.entries.find((entry) => entry.kind === 'classLevel');
  if (!ownLevel) throw new Error('Missing Class Level');
  await owner.mutation(api.companionRelationships.link, {
    ...args,
    sources: [{ ...source, sheetEntryId: ownLevel._id }],
  });
  expect(
    await owner.query(api.companionRelationships.list, { characterId }),
  ).toMatchObject([{ status: 'active', sources: [{ available: true }] }]);
});

test('every relationship writer honors maintenance, epoch and legacy Character authority while reads remain available', async () => {
  const { t, owner, characterId, otherId } = await fixture();
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: otherId,
    kind: 'cohort',
    sources: [source],
    operationId: 'link',
  });
  const commands = (writeEpoch: number) => [
    () =>
      owner.mutation(api.companionRelationships.link, {
        associatedCharacterId: characterId,
        companionCharacterId: otherId,
        kind: 'cohort',
        sources: [source],
        operationId: 'link',
        writeEpoch,
      }),
    () =>
      owner.mutation(api.companionRelationships.create, {
        associatedCharacterId: characterId,
        name: 'Blocked',
        kind: 'familiar',
        sources: [source],
        operationId: 'create',
        writeEpoch,
      }),
    () =>
      owner.mutation(api.companionRelationships.replace, {
        relationshipId,
        companionCharacterId: characterId,
        operationId: 'replace',
        writeEpoch,
      }),
    () =>
      owner.mutation(api.companionRelationships.interrupt, {
        relationshipId,
        operationId: 'interrupt',
        writeEpoch,
      }),
    () =>
      owner.mutation(api.companionRelationships.restore, {
        relationshipId,
        operationId: 'restore',
        writeEpoch,
      }),
    () =>
      owner.mutation(api.companionRelationships.setSourceEnabled, {
        relationshipId,
        sourceKey: 'bond',
        enabled: false,
        operationId: 'disable',
        writeEpoch,
      }),
    () =>
      owner.mutation(api.companionRelationships.addSource, {
        relationshipId,
        source: { ...source, key: 'second' },
        operationId: 'add',
        writeEpoch,
      }),
  ];
  const controlId = await t.run(async (ctx) => {
    const runId = await ctx.db.insert('initialMigrationRun', {
      operationId: 'gate',
      epoch: 0,
      state: 'maintenance',
      frontendBuild: 'build',
      catalogManifest: 'catalog',
      startedAt: 0,
      deadline: 60000,
    });
    return ctx.db.insert('initialMigrationControl', {
      key: 'character-sheet',
      closed: true,
      epoch: 0,
      authority: 'legacy',
      runId,
    });
  });
  for (const command of commands(0))
    await expect(command()).rejects.toThrow('MAINTENANCE');
  expect(
    await owner.query(api.companionRelationships.list, { characterId }),
  ).toMatchObject([{ status: 'active' }]);
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, {
      closed: false,
      epoch: 1,
    }),
  );
  for (const command of commands(0))
    await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { authority: 'sheet' }),
  );
  for (const command of commands(1))
    await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { authority: 'legacy' }),
  );
  await owner.mutation(api.companionRelationships.interrupt, {
    relationshipId,
    operationId: 'fresh',
    writeEpoch: 1,
  });
  expect(
    await owner.query(api.companionRelationships.list, { characterId }),
  ).toMatchObject([{ status: 'interrupted' }]);
});

test('production campaigns retain legacy authority and outsiders cannot mutate existing relationships', async () => {
  const { t, owner, outsider, characterId, otherId, campaignId } =
    await fixture();
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: otherId,
    kind: 'cohort',
    sources: [source],
    operationId: 'link',
  });
  await expect(
    outsider.mutation(api.companionRelationships.interrupt, {
      relationshipId,
      operationId: 'outsider',
    }),
  ).rejects.toThrow('Character not found');
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, { e2eFixture: undefined }),
  );
  await expect(
    owner.mutation(api.companionRelationships.interrupt, {
      relationshipId,
      operationId: 'production',
    }),
  ).rejects.toThrow("aren't available");
  expect(
    await owner.query(api.companionRelationships.list, { characterId }),
  ).toMatchObject([{ status: 'active' }]);
});

async function grantSource(
  t: Awaited<ReturnType<typeof fixture>>['t'],
  owner: Awaited<ReturnType<typeof fixture>>['owner'],
  characterId: Id<'character'>,
) {
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const fighter = sheet?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'fighter',
  );
  const level = sheet?.entries.find((entry) => entry.kind === 'classLevel');
  if (
    fighter?.detail.kind !== 'class' ||
    !('featuresByLevel' in fighter.detail) ||
    !level
  )
    throw new Error('Missing fixture class');
  const detail = fighter.detail;
  await t.run(async (ctx) => {
    const featureId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Companion support',
      ruleIdentity: 'companion-support',
      stacksWithItself: false,
      sources: [],
      detail: { kind: 'classFeature' },
      modifiers: [],
    });
    await ctx.db.patch('catalogEntry', fighter._id, {
      detail: {
        ...detail,
        featuresByLevel: [{ classLevel: 1, catalogEntryId: featureId }],
      },
    });
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: level._id,
    classEntryId: fighter._id,
    operationId: 'fighter',
  });
  return {
    fighterId: fighter._id,
    levelId: level._id,
    grantKey: { source: 'fighter', classLevel: 1, entry: 'companion-support' },
  };
}

async function fixture({ privateSheets = false } = {}) {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (const [tokenIdentifier, orgIds] of [
      ['test|owner', [{ orgId: 'org', role: 'member' }]],
      ['test|member', [{ orgId: 'org', role: 'member' }]],
      ['test|outsider', []],
    ] satisfies [string, { orgId: string; role: 'member' }[]][])
      await ctx.db.insert('user', {
        tokenIdentifier,
        orgIds,
        characterSheetDemo: true,
      });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
  const campaignId = await owner.mutation(api.campaign.createCampaign, {
    name: 'Ironfang',
    description: '',
    organizationId: 'org',
  });
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, {
      e2eFixture: {
        namespace: 'companions',
        version: 1,
        workerKey: '0',
        caseKey: 'companions',
        campaignKey: 'companions',
      },
    }),
  );
  const scope = privateSheets ? {} : { campaignId, organizationId: 'org' };
  const characterId = await owner.mutation(api.characterSheet.create, {
    ...scope,
    name: 'Ada',
    kind: 'pc',
    operationId: 'create-ada',
  });
  const otherId = await (privateSheets ? owner : member).mutation(
    api.characterSheet.create,
    {
      ...scope,
      name: 'Bryn',
      kind: 'npc',
      operationId: 'create-bryn',
    },
  );
  return { t, owner, member, outsider, characterId, otherId, campaignId };
}
