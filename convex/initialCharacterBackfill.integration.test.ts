// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';
import { api, internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { initializeCharacterSheet } from './lib/characterSheet';
import { initializationEdits } from '../tests/rules/initialization-edits';
import { formatGrantKeyId } from '../src/lib/character-sheet-grants';
import { maxLegacyCharacterCandidateBytes } from '../src/lib/initial-character-backfill';

afterEach(() => vi.useRealTimers());

const modules = import.meta.glob('./**/*.ts');
const gateArgs = {
  operationId: 'backfill-test',
  expectedEpoch: 0,
  frontendBuild: 'test-build',
  catalogManifest: 'test-catalog',
  maintenanceBudgetMs: 60000,
};

function harness() {
  return convexTest(schema, modules);
}
type Harness = ReturnType<typeof harness>;
type Receipt = {
  runId: Id<'initialMigrationRun'>;
  epoch: number;
  captureId: string;
};
async function capture(t: Harness, receipt: Receipt) {
  let progress = await t.mutation(
    internal.initialCharacterBackfill.start,
    receipt,
  );
  while (!progress.isInventoryDone)
    progress = await t.mutation(internal.initialCharacterBackfill.batch, {
      ...receipt,
      expectedBatch: progress.nextBatch,
    });
  return progress;
}
async function validate(
  t: Harness,
  receipt: Receipt,
  validationId = 'validation-1',
) {
  const status = await t.query(
    internal.initialCharacterBackfill.status,
    receipt,
  );
  let progress: NonNullable<Doc<'initialMigrationRun'>['backfill']> =
    await t.mutation(internal.initialCharacterBackfill.startValidation, {
      ...receipt,
      validationId,
      expectedValidationId: status.progress?.validationId ?? null,
    });
  while (progress.stage === 'validating')
    progress = await t.mutation(internal.initialCharacterBackfill.validate, {
      ...receipt,
      validationId,
      expectedBatch: progress.nextValidationBatch,
    });
  return progress;
}

test('legacy candidates ignore unused shared catalog and browse-only seeds without creating sheet data', async () => {
  const t = harness();
  const { characterId, key } = await t
    .withIdentity({ tokenIdentifier: 'test|gm' })
    .run((ctx) => seedAcceptedCampaign(ctx));
  const before = await t.run(async (ctx) => {
    for (const scope of ['global', 'campaign', 'character'] as const)
      await ctx.db.insert('catalogEntry', {
        scope,
        ...(scope === 'campaign' ? { campaignId: key.campaignId } : {}),
        ...(scope === 'character'
          ? { characterId, browseOnly: true as const }
          : {}),
        name: 'Unselected definition',
        ruleIdentity: `unused-${scope}`,
        stacksWithItself: false,
        sources: [],
        modifiers: [],
        detail: { kind: 'manual' },
      });
    return {
      character: await ctx.db.get('character', characterId),
      catalog: await ctx.db.query('catalogEntry').take(100),
      entries: await ctx.db.query('characterSheetEntry').take(100),
      source: await ctx.db.query('canonicalMilitiaState').first(),
    };
  });
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'legacy-catalog' };
  await capture(t, receipt);
  expect(await validate(t, receipt)).toMatchObject({
    stage: 'complete',
    errors: 0,
  });
  const status = await t.query(
    internal.initialCharacterBackfill.status,
    receipt,
  );
  expect(status.reports).toEqual([]);
  const candidate = await t.run((ctx) =>
    ctx.db.query('initialMigrationCandidate').first(),
  );
  const input = JSON.parse(candidate?.input ?? 'null');
  expect(input.catalogEntries).toMatchObject([{ detail: { kind: 'base' } }]);
  expect(input.catalogEntries).toHaveLength(1);
  expect(input.entries).toHaveLength(13);
  expect(input.entries.slice(1)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'classLevel',
        state: expect.objectContaining({ classEntryId: null }),
      }),
    ]),
  );
  expect(
    await t.run(async (ctx) => ({
      character: await ctx.db.get('character', characterId),
      catalog: await ctx.db.query('catalogEntry').take(100),
      entries: await ctx.db.query('characterSheetEntry').take(100),
      source: await ctx.db.query('canonicalMilitiaState').first(),
    })),
  ).toEqual(before);
});

test('an exact start retry refuses compatibility drift instead of returning an obsolete capture', async () => {
  const t = harness();
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'capture-1' };
  await t.mutation(internal.initialCharacterBackfill.start, receipt);
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationRun', gate.runId, {
      catalogManifest: 'changed-manifest',
    }),
  );
  await expect(
    t.mutation(internal.initialCharacterBackfill.start, receipt),
  ).rejects.toThrow('compatibility changed');
});

test('enumeration refuses an open gate and starts only within the current closed freeze', async () => {
  const t = harness();
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  await t.mutation(internal.initialMigration.abortBeforeActivation, gate);
  await expect(
    t.mutation(internal.initialCharacterBackfill.start, {
      ...gate,
      captureId: 'capture-1',
    }),
  ).rejects.toThrow('closed');
});

test('a missing candidate input fails validation and reports the discrepancy', async () => {
  const t = harness();
  await t
    .withIdentity({ tokenIdentifier: 'test|gm' })
    .run((ctx) => seedAcceptedCampaign(ctx));
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'capture-1' };
  await capture(t, receipt);
  await t.run(async (ctx) => {
    const candidate = await ctx.db.query('initialMigrationCandidate').first();
    if (!candidate) throw new Error('Missing candidate fixture');
    await ctx.db.patch('initialMigrationCandidate', candidate._id, {
      input: null,
    });
  });
  const progress = await validate(t, receipt);
  expect(progress.stage).toBe('failed');
  expect(progress.completion).toBeNull();
  const status = await t.query(
    internal.initialCharacterBackfill.status,
    receipt,
  );
  expect(status.reports).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        message: 'Character candidate has no sheet input',
      }),
    ]),
  );
});

test('compatibility drift still permits abort, reopening legacy edits and fencing the capture', async () => {
  const t = harness();
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'capture-1' };
  await capture(t, receipt);
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationRun', gate.runId, {
      frontendBuild: 'repaired-build',
    }),
  );
  expect(
    await t.mutation(
      internal.initialCharacterBackfill.abortBeforeActivation,
      receipt,
    ),
  ).toEqual({ epoch: 2 });
  expect(
    await t.mutation(
      internal.initialCharacterBackfill.abortBeforeActivation,
      receipt,
    ),
  ).toEqual({ epoch: 2 });
  expect(
    await t.query(internal.initialMigration.status, { now: Date.now() }),
  ).toMatchObject({ epoch: 2, closed: false, authority: 'legacy' });
  expect(
    await t.query(internal.initialCharacterBackfill.status, receipt),
  ).toMatchObject({ isReceiptValid: false });
});

test('facts discrepancies fail without silently correcting a current mirror or its revision', async () => {
  const t = harness();
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const { key } = await owner.run((ctx) => seedAcceptedCampaign(ctx));
  await t.run(async (ctx) => {
    const source = await ctx.db.query('canonicalMilitiaState').first();
    const fact = source?.snapshot.characters[0];
    if (!source || !fact) throw new Error('Missing fixture Character facts');
    fact.strength = 19;
    await ctx.db.patch('canonicalMilitiaState', source._id, {
      snapshot: source.snapshot,
    });
  });
  const ledgerArgs = { campaignId: key.campaignId, militiaId: key.militiaId };
  const before = await owner.query(api.canonicalLedger.read, ledgerArgs);
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'capture-1' };
  await capture(t, receipt);
  expect(await validate(t, receipt)).toMatchObject({
    stage: 'failed',
    completion: null,
    errors: 1,
  });
  const status = await t.query(
    internal.initialCharacterBackfill.status,
    receipt,
  );
  expect(status.reports).toEqual([
    expect.objectContaining({
      message: expect.stringContaining('expected 19, received 10'),
    }),
  ]);
  expect(await owner.query(api.canonicalLedger.read, ledgerArgs)).toEqual(
    before,
  );
});

test('a current militia source and open draft cannot certify a deleted campaign even with no Character references', async () => {
  const t = harness();
  const { characterId, key } = await t
    .withIdentity({ tokenIdentifier: 'test|gm' })
    .run((ctx) => seedAcceptedCampaign(ctx));
  await t.run(async (ctx) => {
    const source = await ctx.db.query('canonicalMilitiaState').first();
    if (!source) throw new Error('Missing source fixture');
    await ctx.db.patch('canonicalMilitiaState', source._id, {
      snapshot: {
        ...source.snapshot,
        characters: [],
        roster: { people: [], officers: [], teams: [] },
      },
    });
    await ctx.db.delete('character', characterId);
    await ctx.db.delete('campaign', key.campaignId);
  });
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'capture-1' };
  await capture(t, receipt);
  expect(await validate(t, receipt)).toMatchObject({
    stage: 'failed',
    completion: null,
  });
  expect(
    (await t.query(internal.initialCharacterBackfill.status, receipt)).reports,
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        message: 'Militia source campaign or organization scope is missing',
      }),
      expect.objectContaining({
        message: 'Open Weekly Draft campaign or organization scope is missing',
      }),
    ]),
  );
});

test('abort and restart recapture intervening edits and new Characters, refusing every old worker and completion', async () => {
  const t = harness();
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const { characterId, key } = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx),
  );
  const firstGate = await t.mutation(internal.initialMigration.start, gateArgs);
  const first = { ...firstGate, captureId: 'first-capture' };
  await capture(t, first);
  const completed = await validate(t, first);
  expect(completed.stage).toBe('complete');
  const reopened = await t.mutation(
    internal.initialCharacterBackfill.abortBeforeActivation,
    first,
  );
  await owner.mutation(api.character.updateCharacter, {
    characterId,
    organizationId: 'org',
    writeEpoch: reopened.epoch,
    patch: { strength: 17, description: 'Updated between runs' },
  });
  const newId = await owner.mutation(api.character.createCharacter, {
    organizationId: 'org',
    writeEpoch: reopened.epoch,
    character: {
      campaignId: key.campaignId,
      name: 'New recruit',
      description: 'New notes',
      kind: 'npc',
      level: 0,
      strength: 8,
      dexterity: 9,
      constitution: 10,
      intelligence: 11,
      wisdom: 12,
      charisma: 13,
    },
  });
  const secondGate = await t.mutation(internal.initialMigration.start, {
    ...gateArgs,
    operationId: 'second-run',
    expectedEpoch: reopened.epoch,
  });
  const second = { ...secondGate, captureId: 'second-capture' };
  await expect(
    t.mutation(internal.initialCharacterBackfill.start, first),
  ).rejects.toThrow('closed');
  for (const command of [
    internal.initialCharacterBackfill.batch,
    internal.initialCharacterBackfill.resume,
  ]) {
    await expect(
      t.mutation(command, { ...first, expectedBatch: 0 }),
    ).rejects.toThrow('closed');
  }
  await expect(
    t.mutation(internal.initialCharacterBackfill.validate, {
      ...first,
      validationId: 'stale',
      expectedBatch: 0,
    }),
  ).rejects.toThrow('closed');
  await expect(
    t.mutation(internal.initialCharacterBackfill.abortBeforeActivation, first),
  ).rejects.toThrow('no longer current');
  expect(
    await t.query(internal.initialCharacterBackfill.status, first),
  ).toMatchObject({
    isReceiptValid: false,
    progress: { completion: completed.completion },
  });
  const captured = await capture(t, second);
  expect(captured.captured).toBe(2);
  const final = await validate(t, second);
  expect(final).toMatchObject({
    stage: 'complete',
    errors: 0,
    completion: { ...second, validationId: 'validation-1' },
  });
  const rows = await owner.query(api.character.listByCampaign, {
    campaignId: key.campaignId,
    organizationId: 'org',
  });
  expect(rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        _id: characterId,
        strength: 17,
        description: 'Updated between runs',
      }),
      expect.objectContaining({ _id: newId, name: 'New recruit', level: 0 }),
    ]),
  );
});

test('completion receipts certify only the current epoch, capture and validation sweep', async () => {
  const t = harness();
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'capture-1' };
  await capture(t, receipt);
  const completed = await validate(t, receipt);
  expect(
    (await t.query(internal.initialCharacterBackfill.status, receipt))
      .isReceiptValid,
  ).toBe(true);
  if (completed.stage !== 'complete')
    throw new Error('Missing completion fixture');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationRun', gate.runId, {
      backfill: {
        ...completed,
        completion: { ...completed.completion, epoch: 0 },
      },
    }),
  );
  expect(
    (await t.query(internal.initialCharacterBackfill.status, receipt))
      .isReceiptValid,
  ).toBe(false);
  const next = await t.mutation(
    internal.initialCharacterBackfill.startValidation,
    {
      ...receipt,
      validationId: 'validation-2',
      expectedValidationId: 'validation-1',
    },
  );
  expect(next).toMatchObject({
    stage: 'validating',
    completion: null,
    validationId: 'validation-2',
  });
  await expect(
    t.mutation(internal.initialCharacterBackfill.validate, {
      ...receipt,
      validationId: 'validation-3',
      expectedBatch: 1,
    }),
  ).rejects.toThrow('no longer current');
});

test.each(['entry', 'grant', 'nestedGrant'] as const)(
  'foreign companion supporting %s references fail without replacing retained unavailable sources',
  async (kind) => {
    const t = harness();
    const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
    const { characterId, key } = await owner.run((ctx) =>
      seedAcceptedCampaign(ctx),
    );
    const otherId = await owner.mutation(api.character.createCharacter, {
      organizationId: 'org',
      character: {
        campaignId: key.campaignId,
        name: 'Companion',
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
    const foreignEntry = await t.run((ctx) =>
      ctx.db.insert('characterSheetEntry', {
        characterId: otherId,
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          classEntryId: null,
          position: 1,
          hpGained: null,
        },
      }),
    );
    const nestedSource =
      kind === 'nestedGrant'
        ? await t.run(async (ctx) => {
            const ownEntry = await ctx.db.insert('characterSheetEntry', {
              characterId,
              kind: 'classLevel',
              active: true,
              state: {
                kind: 'classLevel',
                classEntryId: null,
                position: 1,
                hpGained: null,
              },
            });
            const foreignDefinition = await ctx.db.insert('catalogEntry', {
              scope: 'character',
              characterId: otherId,
              name: 'Foreign grant',
              ruleIdentity: 'foreign',
              stacksWithItself: false,
              sources: [],
              modifiers: [],
              detail: { kind: 'manual' },
            });
            return formatGrantKeyId({
              source: ownEntry,
              entry: foreignDefinition,
            });
          })
        : foreignEntry;
    // The orphan source record deliberately lacks sheet mode and already fails
    // its own capture. The relationship must independently name the foreign ref.
    await t.run((ctx) =>
      ctx.db.insert('companionRelationship', {
        associatedCharacterId: characterId,
        companionCharacterId: otherId,
        kind: 'familiar',
        sources: [
          {
            key: 'foreign',
            label: 'Foreign source',
            enabled: true,
            ...(kind === 'entry'
              ? { sheetEntryId: foreignEntry }
              : {
                  grantKey: { source: nestedSource, entry: 'retained-grant' },
                }),
          },
        ],
        status: 'interrupted',
        manuallyInterrupted: false,
        activatedAt: 1,
        lastOperationId: 'fixture',
      }),
    );
    const gate = await t.mutation(internal.initialMigration.start, gateArgs);
    const receipt = { ...gate, captureId: 'capture-1' };
    await capture(t, receipt);
    expect((await validate(t, receipt)).stage).toBe('failed');
    expect(
      (await t.query(internal.initialCharacterBackfill.status, receipt))
        .reports,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Companion supporting source belongs to another Character',
        }),
      ]),
    );
  },
);

test.each(['global', 'campaign'] as const)(
  'companion supporting Grants accept accessible %s definitions without changing retained sources',
  async (scope) => {
    const t = harness();
    const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
    const { characterId, key } = await owner.run((ctx) =>
      seedAcceptedCampaign(ctx),
    );
    const companionCharacterId = await owner.mutation(
      api.character.createCharacter,
      {
        organizationId: 'org',
        character: {
          campaignId: key.campaignId,
          name: 'Companion',
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
      },
    );
    const relationshipId = await t.run(async (ctx) => {
      const definitionId = await ctx.db.insert('catalogEntry', {
        scope,
        ...(scope === 'campaign' ? { campaignId: key.campaignId } : {}),
        name: 'Shared companion Grant',
        ruleIdentity: 'companion-grant',
        stacksWithItself: false,
        sources: [],
        modifiers: [],
        detail: { kind: 'manual' },
      });
      return ctx.db.insert('companionRelationship', {
        associatedCharacterId: characterId,
        companionCharacterId,
        kind: 'familiar',
        sources: [
          {
            key: 'shared-grant',
            label: 'Shared Grant',
            enabled: true,
            grantKey: { source: 'retained-source', entry: definitionId },
          },
        ],
        status: 'interrupted',
        manuallyInterrupted: false,
        activatedAt: 1,
        lastOperationId: 'fixture',
      });
    });
    const before = await t.run((ctx) =>
      ctx.db.get('companionRelationship', relationshipId),
    );
    const gate = await t.mutation(internal.initialMigration.start, gateArgs);
    const receipt = { ...gate, captureId: 'shared-companion' };
    await capture(t, receipt);
    expect(await validate(t, receipt)).toMatchObject({
      stage: 'complete',
      errors: 0,
    });
    expect(
      (await t.query(internal.initialCharacterBackfill.status, receipt))
        .reports,
    ).toEqual([]);
    expect(
      await t.run((ctx) => ctx.db.get('companionRelationship', relationshipId)),
    ).toEqual(before);
  },
);

test('retained companion supporting sources remain unchanged when their entries and Grants are unavailable', async () => {
  const t = harness();
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const { characterId, key } = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx),
  );
  const otherId = await owner.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: {
      campaignId: key.campaignId,
      name: 'Companion',
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
  const relationshipId = await t.run(async (ctx) => {
    const missingEntryId = await ctx.db.insert('characterSheetEntry', {
      characterId,
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId: null,
        position: 1,
        hpGained: null,
      },
    });
    await ctx.db.delete('characterSheetEntry', missingEntryId);
    return ctx.db.insert('companionRelationship', {
      associatedCharacterId: characterId,
      companionCharacterId: otherId,
      kind: 'familiar',
      sources: [
        {
          key: 'removed',
          label: 'Removed selection',
          enabled: true,
          sheetEntryId: missingEntryId,
        },
        {
          key: 'unavailable',
          label: 'Unavailable Grant',
          enabled: true,
          grantKey: { source: 'lost-feature', entry: 'old-grant' },
        },
      ],
      status: 'interrupted',
      manuallyInterrupted: false,
      activatedAt: 1,
      lastOperationId: 'fixture',
    });
  });
  const before = await t.run((ctx) =>
    ctx.db.get('companionRelationship', relationshipId),
  );
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'capture-1' };
  await capture(t, receipt);
  expect(await validate(t, receipt)).toMatchObject({
    stage: 'complete',
    errors: 0,
  });
  expect(
    await t.run((ctx) => ctx.db.get('companionRelationship', relationshipId)),
  ).toEqual(before);
});

test.each([
  'missingCandidate',
  'changedCharacter',
  'privateOwner',
  'foreignRoster',
] as const)(
  'validation reports %s instead of certifying incomplete coverage or access',
  async (failure) => {
    const t = harness();
    const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
    const { characterId } = await owner.run((ctx) => seedAcceptedCampaign(ctx));
    if (failure === 'privateOwner')
      await t.run((ctx) =>
        ctx.db.patch('character', characterId, {
          campaignId: undefined,
          ownerId: 'deleted-owner',
        }),
      );
    if (failure === 'foreignRoster')
      await t.run(async (ctx) => {
        const otherCampaignId = await ctx.db.insert('campaign', {
          name: 'Other',
          organizationId: 'org',
          description: '',
          ownerId: 'test|gm',
        });
        await ctx.db.patch('character', characterId, {
          campaignId: otherCampaignId,
        });
      });
    const gate = await t.mutation(internal.initialMigration.start, gateArgs);
    const receipt = { ...gate, captureId: 'capture-1' };
    await capture(t, receipt);
    if (failure === 'missingCandidate')
      await t.run(async (ctx) => {
        const candidate = await ctx.db
          .query('initialMigrationCandidate')
          .first();
        if (!candidate) throw new Error('Missing candidate fixture');
        await ctx.db.delete('initialMigrationCandidate', candidate._id);
      });
    if (failure === 'changedCharacter')
      await t.run((ctx) =>
        ctx.db.patch('character', characterId, { name: 'Uncaptured name' }),
      );
    expect(await validate(t, receipt)).toMatchObject({
      stage: 'failed',
      completion: null,
    });
    const message = {
      missingCandidate: 'Character has no candidate for this input capture',
      changedCharacter: 'Recorded Character changed after input capture',
      privateOwner: 'Private Character has no surviving owner access',
      foreignRoster: 'belongs to another campaign',
    }[failure];
    expect(
      (await t.query(internal.initialCharacterBackfill.status, receipt))
        .reports,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining(message) }),
      ]),
    );
  },
);

test('oversized source reference sets are reported without truncating long Notes', async () => {
  const t = harness();
  const { characterId } = await t
    .withIdentity({ tokenIdentifier: 'test|gm' })
    .run((ctx) => seedAcceptedCampaign(ctx));
  await t.run(async (ctx) => {
    await ctx.db.patch('character', characterId, {
      description: 'x'.repeat(128 * 1024),
    });
    const source = await ctx.db.query('canonicalMilitiaState').first();
    const prototype = source?.snapshot.characters[0];
    if (!source || !prototype)
      throw new Error('Missing fixture Character facts');
    await ctx.db.patch('canonicalMilitiaState', source._id, {
      snapshot: {
        ...source.snapshot,
        characters: Array.from({ length: 1025 }, (_, index) => ({
          ...prototype,
          characterId: `missing-${index}`,
        })),
      },
    });
  });
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'capture-1' };
  await capture(t, receipt);
  expect(await validate(t, receipt)).toMatchObject({
    stage: 'failed',
    completion: null,
  });
  expect(
    (await t.query(internal.initialCharacterBackfill.status, receipt)).reports,
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        message:
          'Character references exceed the 1024-reference resource limit',
      }),
    ]),
  );
  expect(
    (await t.run((ctx) => ctx.db.get('character', characterId)))?.description,
  ).toHaveLength(128 * 1024);
});

test('prepared sheets preserve recorded entries while oversized reads fail explicitly', async () => {
  const t = harness();
  const { characterId } = await t
    .withIdentity({ tokenIdentifier: 'test|gm' })
    .run((ctx) => seedAcceptedCampaign(ctx));
  await t.run(async (ctx) => {
    const character = await ctx.db.get('character', characterId);
    if (!character) throw new Error('Missing Character fixture');
    await initializeCharacterSheet(ctx, {
      characterId,
      updatedBy: 'test|gm',
      operationId: 'prepared',
      sheetMode: 'full',
      level: 12,
      scores: character,
    });
  });
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'capture-1' };
  await capture(t, receipt);
  expect(await validate(t, receipt)).toMatchObject({
    stage: 'complete',
    errors: 0,
  });
  await t.mutation(
    internal.initialCharacterBackfill.abortBeforeActivation,
    receipt,
  );
  await t.run(async (ctx) => {
    for (let index = 0; index < 2; index++)
      await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        name: 'x'.repeat(500 * 1024),
        ruleIdentity: `large-${index}`,
        stacksWithItself: false,
        sources: [],
        modifiers: [],
        detail: { kind: 'manual' },
      });
  });
  const nextGate = await t.mutation(internal.initialMigration.start, {
    ...gateArgs,
    operationId: 'oversized',
    expectedEpoch: 2,
  });
  const next = { ...nextGate, captureId: 'capture-2' };
  await capture(t, next);
  expect(await validate(t, next)).toMatchObject({
    stage: 'failed',
    completion: null,
  });
  expect(
    (await t.query(internal.initialCharacterBackfill.status, next)).reports,
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        message: expect.stringContaining('resource limit'),
      }),
    ]),
  );
});

test('backfill keeps saved choices, roster overrides and assignments, and effective and superseded frozen records unchanged', async () => {
  vi.useFakeTimers();
  const t = harness();
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const { characterId, key } = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx),
  );
  for (const [baseRevision, edit] of initializationEdits(
    'patrol',
    characterId,
  ).entries()) {
    await owner.mutation(api.canonicalDraftPersistence.edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: {
        draftId: key.draftId,
        operationId: `saved-${baseRevision}`,
        baseRevision,
        edit,
      },
    });
  }
  const preview = await owner.query(api.canonicalDraftPersistence.preview, key);
  expect(preview.status).toBe('ready');
  await owner.mutation(api.canonicalDraftPersistence.confirm, {
    ...key,
    operation: { operationId: 'confirm', reviewed: preview.reviewed },
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  await t.run(async (ctx) => {
    const stored = await ctx.db.query('canonicalResolutionRecord').first();
    if (!stored) throw new Error('Missing record fixture');
    await ctx.db.insert('canonicalResolutionRecord', {
      campaignId: stored.campaignId,
      militiaId: stored.militiaId,
      recordId: 'superseding-fixture',
      week: stored.week,
      sequence: 1,
      record: {
        ...stored.record,
        recordId: 'superseding-fixture',
        provenance: 'historical_correction',
        supersedesRecordId: stored.recordId,
      },
    });
  });
  const workspace = await owner.query(api.canonicalDraftPersistence.workspace, {
    campaignId: key.campaignId,
  });
  if (!workspace) throw new Error('Missing current draft');
  const current = await owner.query(
    api.canonicalDraftPersistence.observe,
    workspace.key,
  );
  await owner.mutation(api.canonicalDraftPersistence.edit, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: current.draftId,
      baseRevision: current.revision,
      operationId: 'add-saved-slot',
      edit: { kind: 'add_slot', slotId: 'saved-slot' },
    },
  });
  await owner.mutation(api.canonicalDraftPersistence.edit, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: current.draftId,
      baseRevision: current.revision + 1,
      operationId: 'next-choice',
      edit: {
        kind: 'stage',
        slotId: 'saved-slot',
        choice: { choiceId: 'saved-choice', actionId: 'earn_gold' },
      },
    },
  });
  const historyArgs = { campaignId: key.campaignId, week: 9 };
  const ledgerArgs = { campaignId: key.campaignId, militiaId: key.militiaId };
  const before = {
    history: await owner.query(api.canonicalHistory.read, historyArgs),
    ledger: await owner.query(api.canonicalLedger.read, ledgerArgs),
    draft: await owner.query(api.canonicalDraftPersistence.workspace, {
      campaignId: key.campaignId,
    }),
    frozen: await t.run((ctx) =>
      ctx.db.query('canonicalResolutionRecord').take(3),
    ),
  };
  expect(before.frozen).toHaveLength(2);
  expect(before.ledger.state.militiaSnapshot.roster).toMatchObject({
    people: [{ characterId, hitDice: 8 }],
    officers: [expect.objectContaining({ characterId })],
    teams: [expect.objectContaining({ managerCharacterId: characterId })],
  });
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'capture-1' };
  await capture(t, receipt);
  expect(await validate(t, receipt)).toMatchObject({
    stage: 'complete',
    errors: 0,
  });
  expect({
    history: await owner.query(api.canonicalHistory.read, historyArgs),
    ledger: await owner.query(api.canonicalLedger.read, ledgerArgs),
    draft: await owner.query(api.canonicalDraftPersistence.workspace, {
      campaignId: key.campaignId,
    }),
    frozen: await t.run((ctx) =>
      ctx.db.query('canonicalResolutionRecord').take(3),
    ),
  }).toEqual(before);
});

test('bounded retries preserve every legacy input and equal militia facts without changing revisions', async () => {
  const t = harness();
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const { characterId, key } = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx),
  );
  const before = await t.run(async (ctx) => ({
    character: await ctx.db.get('character', characterId),
    source: await ctx.db.query('canonicalMilitiaState').first(),
    draft: await ctx.db.query('canonicalWeeklyDraft').first(),
  }));
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'capture-1' };
  await t.mutation(internal.initialCharacterBackfill.start, receipt);
  const first = await t.mutation(internal.initialCharacterBackfill.batch, {
    ...receipt,
    expectedBatch: 0,
  });
  const retry = await t.mutation(internal.initialCharacterBackfill.batch, {
    ...receipt,
    expectedBatch: 0,
  });
  expect(retry).toEqual(first);
  expect(first.captured).toBe(1);
  let progress = first;
  while (!progress.isInventoryDone)
    progress = await t.mutation(internal.initialCharacterBackfill.resume, {
      ...receipt,
      expectedBatch: progress.nextBatch,
    });
  progress = await t.mutation(
    internal.initialCharacterBackfill.startValidation,
    {
      ...receipt,
      validationId: 'validation-1',
      expectedValidationId: null,
    },
  );
  do {
    progress = await t.mutation(internal.initialCharacterBackfill.validate, {
      ...receipt,
      validationId: 'validation-1',
      expectedBatch: progress.nextValidationBatch,
    });
  } while (progress.stage === 'validating');
  expect(progress.stage).toBe('complete');
  expect(progress.errors).toBe(0);
  expect(progress.completion).toMatchObject({
    ...gate,
    captureId: 'capture-1',
    validationId: 'validation-1',
  });
  expect(
    await t.run(async (ctx) => ({
      character: await ctx.db.get('character', characterId),
      source: await ctx.db.query('canonicalMilitiaState').first(),
      draft: await ctx.db.query('canonicalWeeklyDraft').first(),
    })),
  ).toEqual(before);
  expect(key.campaignId).toBe(before.character?.campaignId);
});

test('long Notes remain exact without exhausting the private capture document', async () => {
  const t = harness();
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const { characterId } = await owner.run((ctx) => seedAcceptedCampaign(ctx));
  const notes = '雪 Notes with whitespace  \n'.repeat(12000);
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      description: notes,
    }),
  );
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'long-notes' };
  await capture(t, receipt);
  expect(await validate(t, receipt)).toMatchObject({
    stage: 'complete',
    errors: 0,
  });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, { description: `${notes} ` }),
  );
  expect(await validate(t, receipt, 'changed-notes')).toMatchObject({
    stage: 'failed',
    completion: null,
  });
  expect(
    (await t.query(internal.initialCharacterBackfill.status, receipt)).reports,
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        message: 'Recorded Character changed after input capture',
      }),
    ]),
  );
});

test('an old validation retry cannot replace a newer sweep or clear its receipt', async () => {
  const t = harness();
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'capture' };
  await capture(t, receipt);
  await validate(t, receipt, 'first');
  await validate(t, receipt, 'second');
  const before = await t.query(
    internal.initialCharacterBackfill.status,
    receipt,
  );
  await expect(
    t.mutation(internal.initialCharacterBackfill.validate, {
      ...receipt,
      validationId: 'first',
      expectedBatch: 0,
    }),
  ).rejects.toThrow('no longer current');
  expect(
    await t.query(internal.initialCharacterBackfill.status, receipt),
  ).toEqual(before);
});

test('one operator command continues bounded capture and validation until ready', async () => {
  vi.useFakeTimers();
  const t = harness();
  await t
    .withIdentity({ tokenIdentifier: 'test|gm' })
    .run((ctx) => seedAcceptedCampaign(ctx));
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'scheduled' };
  await t.mutation(internal.initialCharacterBackfill.start, receipt);
  await t.mutation(internal.initialCharacterBackfill.startDriver, {
    ...receipt,
    driverId: 'driver',
    validationId: 'validation',
    expectedValidationId: null,
    expectedDriverGeneration: 0,
  });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const status = await t.query(internal.initialCharacterBackfill.status, {
    ...receipt,
    now: Date.now(),
  });
  expect(status).toMatchObject({
    isReceiptValid: true,
    isActivationReady: true,
    estimate: { rowsRemaining: 0, batchesRemaining: 0 },
    progress: { stage: 'complete', driver: { isRunning: false } },
  });
});

test('stopping a driver fences queued ticks and a restarted driver from old deliveries', async () => {
  vi.useFakeTimers();
  const t = harness();
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'scheduled' };
  await t.mutation(internal.initialCharacterBackfill.start, receipt);
  const started = await t.mutation(
    internal.initialCharacterBackfill.startDriver,
    {
      ...receipt,
      driverId: 'first',
      validationId: 'validation',
      expectedValidationId: null,
      expectedDriverGeneration: 0,
    },
  );
  const stopped = await t.mutation(
    internal.initialCharacterBackfill.stopDriver,
    {
      ...receipt,
      driverId: 'first',
      generation: started.driverGeneration,
    },
  );
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(
    (await t.query(internal.initialCharacterBackfill.status, receipt)).progress,
  ).toEqual(stopped);
  await t.mutation(internal.initialCharacterBackfill.startDriver, {
    ...receipt,
    driverId: 'second',
    validationId: 'validation',
    expectedValidationId: null,
    expectedDriverGeneration: stopped.driverGeneration,
  });
  const before = await t.query(
    internal.initialCharacterBackfill.status,
    receipt,
  );
  await t.mutation(internal.initialCharacterBackfill.drive, {
    ...receipt,
    driverId: 'first',
    generation: started.driverGeneration,
    tick: 0,
    expectedCaptureBatch: 0,
    expectedValidationBatch: 0,
    validationId: 'validation',
  });
  expect(
    await t.query(internal.initialCharacterBackfill.status, receipt),
  ).toEqual(before);
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(
    await t.query(internal.initialCharacterBackfill.status, receipt),
  ).toMatchObject({ isActivationReady: true });
});

test('scheduled ticks cannot change an aborted run or continue beyond its maintenance budget', async () => {
  vi.useFakeTimers();
  const t = harness();
  const gate = await t.mutation(internal.initialMigration.start, {
    ...gateArgs,
    maintenanceBudgetMs: 10,
  });
  const receipt = { ...gate, captureId: 'scheduled' };
  await t.mutation(internal.initialCharacterBackfill.start, receipt);
  await t.mutation(internal.initialCharacterBackfill.startDriver, {
    ...receipt,
    driverId: 'driver',
    validationId: 'validation',
    expectedValidationId: null,
    expectedDriverGeneration: 0,
  });
  vi.setSystemTime(Date.now() + 20);
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const stopped = await t.query(internal.initialCharacterBackfill.status, {
    ...receipt,
    now: Date.now(),
  });
  expect(stopped).toMatchObject({
    isActivationReady: false,
    progress: {
      captured: 0,
      completion: null,
      driver: { isRunning: false, stoppedBecause: 'budget' },
    },
  });
  await t.mutation(
    internal.initialCharacterBackfill.abortBeforeActivation,
    receipt,
  );
  const aborted = await t.query(
    internal.initialCharacterBackfill.status,
    receipt,
  );
  await t.mutation(internal.initialCharacterBackfill.drive, {
    ...receipt,
    driverId: 'driver',
    generation: 1,
    tick: 0,
    expectedCaptureBatch: 0,
    expectedValidationBatch: 0,
    validationId: 'validation',
  });
  expect(
    await t.query(internal.initialCharacterBackfill.status, receipt),
  ).toEqual(aborted);
  expect(
    await t.query(internal.initialMigration.status, { now: Date.now() }),
  ).toMatchObject({ closed: false, authority: 'legacy' });
});

test.each([
  'militiaOnlyOutsideMilitia',
  'multipleMilitias',
  'rosterKind',
  'crossScopeCompanion',
] as const)(
  'eligibility and access discrepancies report %s without correction',
  async (failure) => {
    const t = harness();
    const { characterId, key } = await t
      .withIdentity({ tokenIdentifier: 'test|gm' })
      .run((ctx) => seedAcceptedCampaign(ctx));
    await t.run(async (ctx) => {
      const character = await ctx.db.get('character', characterId);
      if (!character) throw new Error('Missing Character fixture');
      if (failure === 'militiaOnlyOutsideMilitia') {
        await initializeCharacterSheet(ctx, {
          characterId,
          updatedBy: 'test|gm',
          operationId: 'prepared',
          sheetMode: 'militiaOnly',
          level: character.level,
          scores: character,
        });
        await ctx.db.delete('militia', key.militiaId);
      }
      if (failure === 'multipleMilitias')
        await ctx.db.insert('militia', {
          campaignId: key.campaignId,
          name: 'Second militia',
        });
      if (failure === 'rosterKind') {
        const source = await ctx.db.query('canonicalMilitiaState').first();
        if (!source) throw new Error('Missing source fixture');
        await ctx.db.patch('canonicalMilitiaState', source._id, {
          snapshot: {
            ...source.snapshot,
            roster: {
              ...source.snapshot.roster,
              people: source.snapshot.roster.people.map((person) => ({
                ...person,
                kind: 'npc' as const,
              })),
            },
          },
        });
      }
      if (failure === 'crossScopeCompanion') {
        const campaignId = await ctx.db.insert('campaign', {
          name: 'Other',
          description: '',
          ownerId: 'test|gm',
          organizationId: 'other',
        });
        const companionCharacterId = await ctx.db.insert('character', {
          campaignId,
          name: 'Other companion',
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
        await ctx.db.insert('companionRelationship', {
          associatedCharacterId: characterId,
          companionCharacterId,
          kind: 'familiar',
          sources: [
            {
              key: 'retained',
              label: 'Lost source',
              enabled: true,
              grantKey: { source: 'lost-source', entry: 'retained-grant' },
            },
          ],
          status: 'active',
          manuallyInterrupted: false,
          activatedAt: 1,
          lastOperationId: 'fixture',
        });
      }
    });
    const before = await t.run(async (ctx) => ({
      character: await ctx.db.get('character', characterId),
      source: await ctx.db.query('canonicalMilitiaState').first(),
      relationship: await ctx.db.query('companionRelationship').first(),
    }));
    const gate = await t.mutation(internal.initialMigration.start, gateArgs);
    const receipt = { ...gate, captureId: 'eligibility' };
    await capture(t, receipt);
    expect(await validate(t, receipt)).toMatchObject({
      stage: 'failed',
      completion: null,
    });
    const message = {
      militiaOnlyOutsideMilitia:
        'Militia-only presentation requires a campaign militia',
      multipleMilitias: 'Campaign has multiple militias',
      rosterKind: 'differs from the Character',
      crossScopeCompanion:
        'Active Companion Relationship crosses campaign or owner access scope',
    }[failure];
    expect(
      (await t.query(internal.initialCharacterBackfill.status, receipt))
        .reports,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining(message) }),
      ]),
    );
    expect(
      await t.run(async (ctx) => ({
        character: await ctx.db.get('character', characterId),
        source: await ctx.db.query('canonicalMilitiaState').first(),
        relationship: await ctx.db.query('companionRelationship').first(),
      })),
    ).toEqual(before);
  },
);

test('current facts outside fixture campaigns retain flat authority for initialized sheets', async () => {
  const t = harness();
  const { characterId, key } = await t
    .withIdentity({ tokenIdentifier: 'test|gm' })
    .run((ctx) => seedAcceptedCampaign(ctx));
  await t.run(async (ctx) => {
    const character = await ctx.db.get('character', characterId);
    if (!character) throw new Error('Missing Character fixture');
    await initializeCharacterSheet(ctx, {
      characterId,
      updatedBy: 'test|gm',
      operationId: 'prepared',
      sheetMode: 'full',
      level: character.level,
      scores: { ...character, strength: 12 },
    });
    await ctx.db.patch('campaign', key.campaignId, { e2eFixture: undefined });
  });
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'facts' };
  await capture(t, receipt);
  expect(await validate(t, receipt)).toMatchObject({
    stage: 'failed',
    completion: null,
  });
  expect(
    (await t.query(internal.initialCharacterBackfill.status, receipt)).reports,
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        message: 'facts.facts[0].strength: expected 10, received 12',
      }),
    ]),
  );
});

// Few, large rows reach the byte boundaries: each candidate approaches its
// 768 KiB budget through a large local definition instead of thousands of
// Class Levels, and every sheet- and catalog-entry batch still reads eight
// large referenced Characters under the real transaction limits.
test('large private candidates and referenced Characters stay within real transaction limits', async () => {
  const t = convexTest({ schema, modules, transactionLimits: true });
  const { key } = await t
    .withIdentity({ tokenIdentifier: 'test|gm' })
    .run((ctx) => seedAcceptedCampaign(ctx));
  const largeIds: Id<'character'>[] = [];
  for (let index = 0; index < 4; index++)
    await t.run(async (ctx) => {
      const id = await ctx.db.insert('character', {
        campaignId: key.campaignId,
        name: `Large ${index}`,
        description: '雪'.repeat(100000),
        kind: 'npc',
        isActive: true,
        level: 20,
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      });
      largeIds.push(id);
      await initializeCharacterSheet(ctx, {
        characterId: id,
        updatedBy: 'test|gm',
        operationId: 'large-fixture',
        sheetMode: 'full',
        level: 20,
        scores: {
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
        },
      });
      const base = (
        await ctx.db
          .query('catalogEntry')
          .withIndex('by_characterId_and_browseOnly', (q) =>
            q.eq('characterId', id).eq('browseOnly', undefined),
          )
          .collect()
      ).find((definition) => definition.detail.kind === 'base');
      if (!base) throw new Error('Missing Base scores fixture');
      await ctx.db.patch('catalogEntry', base._id, {
        description: '雪'.repeat(220000),
      });
    });
  const gate = await t.mutation(internal.initialMigration.start, {
    ...gateArgs,
    maintenanceBudgetMs: 120000,
  });
  const receipt = { ...gate, captureId: 'large' };
  const progress = await capture(t, receipt);
  expect(progress).toMatchObject({ captured: 5, isInventoryDone: true });
  const inputBytes = await t.run(async (ctx) =>
    Promise.all(
      largeIds.map(async (characterId) => {
        const candidate = await ctx.db
          .query('initialMigrationCandidate')
          .withIndex('by_runId_and_characterId', (q) =>
            q.eq('runId', gate.runId).eq('characterId', characterId),
          )
          .unique();
        return new TextEncoder().encode(candidate?.input ?? '').byteLength;
      }),
    ),
  );
  for (const bytes of inputBytes) {
    expect(bytes).toBeGreaterThan(0.8 * maxLegacyCharacterCandidateBytes);
    expect(bytes).toBeLessThanOrEqual(maxLegacyCharacterCandidateBytes);
  }
  const result = await validate(t, receipt);
  expect(
    (await t.query(internal.initialCharacterBackfill.status, receipt)).reports,
  ).toEqual([]);
  expect(result).toMatchObject({ stage: 'complete', errors: 0 });
});

test('manual continuations refuse an active driver rather than stranding its scheduled chain', async () => {
  vi.useFakeTimers();
  const t = harness();
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'scheduled' };
  await t.mutation(internal.initialCharacterBackfill.startDriver, {
    ...receipt,
    driverId: 'driver',
    validationId: 'validation',
    expectedValidationId: null,
    expectedDriverGeneration: 0,
  });
  for (const command of [
    internal.initialCharacterBackfill.batch,
    internal.initialCharacterBackfill.resume,
  ])
    await expect(
      t.mutation(command, { ...receipt, expectedBatch: 0 }),
    ).rejects.toThrow('Stop the driver');
  await expect(
    t.mutation(internal.initialCharacterBackfill.validate, {
      ...receipt,
      validationId: 'validation',
      expectedBatch: 0,
    }),
  ).rejects.toThrow('Stop the driver');
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(
    await t.query(internal.initialCharacterBackfill.status, receipt),
  ).toMatchObject({ isActivationReady: true });
});

test('duplicate current ticks enqueue one continuation and old start requests cannot replace a sweep', async () => {
  vi.useFakeTimers();
  const t = harness();
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'scheduled' };
  await t.mutation(internal.initialCharacterBackfill.startDriver, {
    ...receipt,
    driverId: 'driver',
    validationId: 'validation',
    expectedValidationId: null,
    expectedDriverGeneration: 0,
  });
  const tick = {
    ...receipt,
    driverId: 'driver',
    generation: 1,
    tick: 0,
    expectedCaptureBatch: 0,
    expectedValidationBatch: 0,
    validationId: 'validation',
  };
  await t.mutation(internal.initialCharacterBackfill.drive, tick);
  const after = await t.query(
    internal.initialCharacterBackfill.status,
    receipt,
  );
  await t.mutation(internal.initialCharacterBackfill.drive, tick);
  expect(
    await t.query(internal.initialCharacterBackfill.status, receipt),
  ).toEqual(after);
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  await t.mutation(internal.initialCharacterBackfill.startValidation, {
    ...receipt,
    validationId: 'next',
    expectedValidationId: 'validation',
  });
  const next = await t.query(internal.initialCharacterBackfill.status, receipt);
  await expect(
    t.mutation(internal.initialCharacterBackfill.startValidation, {
      ...receipt,
      validationId: 'obsolete',
      expectedValidationId: null,
    }),
  ).rejects.toThrow('Validation identity changed');
  expect(
    await t.query(internal.initialCharacterBackfill.status, receipt),
  ).toEqual(next);
});

test('budget estimates use observed work tick intervals and ignore census and polling idle time', async () => {
  vi.useFakeTimers();
  const t = harness();
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'timed' };
  await t.mutation(internal.initialCharacterBackfill.startDriver, {
    ...receipt,
    driverId: 'driver',
    validationId: 'validation',
    expectedValidationId: null,
    expectedDriverGeneration: 0,
  });
  async function nextTick() {
    const { progress } = await t.query(
      internal.initialCharacterBackfill.status,
      receipt,
    );
    const driver = progress?.driver;
    if (!progress || !driver) throw new Error('Missing driver fixture');
    await t.mutation(internal.initialCharacterBackfill.drive, {
      ...receipt,
      driverId: driver.id,
      generation: driver.generation,
      tick: driver.nextTick,
      expectedCaptureBatch: progress.nextBatch,
      expectedValidationBatch: progress.nextValidationBatch,
      validationId: driver.validationId,
    });
  }
  while (
    !(await t.query(internal.initialCharacterBackfill.status, receipt)).progress
      ?.isCensusDone
  ) {
    vi.setSystemTime(Date.now() + 500);
    await nextTick();
  }
  expect(
    (await t.query(internal.initialCharacterBackfill.status, receipt)).progress
      ?.driver,
  ).toMatchObject({ workDurationMs: 0, workSampleCount: 0 });
  await nextTick();
  vi.setSystemTime(Date.now() + 1000);
  await nextTick();
  const status = await t.query(internal.initialCharacterBackfill.status, {
    ...receipt,
    now: Date.now(),
  });
  expect(status.progress?.driver).toMatchObject({
    workDurationMs: 1000,
    workSampleCount: 1,
  });
  expect(status.estimate?.estimatedRemainingMs).toBeGreaterThanOrEqual(9000);
  const later = await t.query(internal.initialCharacterBackfill.status, {
    ...receipt,
    now: Date.now() + 5000,
  });
  expect(later.estimate?.estimatedRemainingMs).toBe(
    status.estimate?.estimatedRemainingMs,
  );
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
});

test('initial backfill refuses initialized familiar-linked candidates without certifying baseline facts', async () => {
  const t = harness();
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const { characterId } = await owner.run((ctx) => seedAcceptedCampaign(ctx));
  await t.run(async (ctx) => {
    const character = await ctx.db.get('character', characterId);
    if (!character) throw new Error('Missing initialized master');
    if (!character.campaignId) throw new Error('Missing master campaign');
    await ctx.db.patch('campaign', character.campaignId, {
      e2eFixture: {
        namespace: 'backfill-familiar',
        version: 1,
        workerKey: '0',
        caseKey: 'linked',
        campaignKey: 'linked',
      },
    });
    await initializeCharacterSheet(ctx, {
      characterId,
      updatedBy: 'test|gm',
      operationId: 'prepared-master',
      level: 12,
      scores: character,
    });
  });
  const familiar = await owner.mutation(api.companionRelationships.create, {
    associatedCharacterId: characterId,
    kind: 'familiar',
    name: 'Backfill familiar',
    sources: [{ key: 'bond', label: 'Familiar bond', enabled: true }],
    operationId: 'backfill-familiar',
  });
  await owner.mutation(api.characterSheetFamiliars.selectBaseCreature, {
    characterId: familiar.companionCharacterId,
    relationshipId: familiar.relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'backfill-species',
  });
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'unsupported-linked-capture' };
  await capture(t, receipt);
  expect(await validate(t, receipt)).toMatchObject({
    stage: 'failed',
    completion: null,
  });
  const status = await t.query(
    internal.initialCharacterBackfill.status,
    receipt,
  );
  for (const id of [characterId, familiar.companionCharacterId])
    expect(status.reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: id,
          message: expect.stringContaining('linked Companion'),
        }),
      ]),
    );
});
test('initial backfill refuses retained animal progression without any relationship', async () => {
  const t = harness();
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const { characterId } = await owner.run((ctx) => seedAcceptedCampaign(ctx));
  await t.run(async (ctx) => {
    const character = await ctx.db.get('character', characterId);
    if (!character) throw new Error('Missing initialized master');
    if (!character.campaignId) throw new Error('Missing master campaign');
    await ctx.db.patch('campaign', character.campaignId, {
      e2eFixture: {
        namespace: 'backfill-familiar',
        version: 1,
        workerKey: '0',
        caseKey: 'linked',
        campaignKey: 'linked',
      },
    });
    await initializeCharacterSheet(ctx, {
      characterId,
      updatedBy: 'test|gm',
      operationId: 'prepared-master',
      level: 12,
      scores: character,
    });
  });
  await owner.mutation(api.characterSheet.setCompanionProgression, {
    characterId,
    operationId: 'retained-animal',
    progression: {
      species: 'wolf',
      hpGained: 12,
      skillRanks: {},
      abilityIncreases: [],
      advancementChoice: 'species',
      keep: false,
    },
  });
  const gate = await t.mutation(internal.initialMigration.start, gateArgs);
  const receipt = { ...gate, captureId: 'unsupported-retained-animal' };
  await capture(t, receipt);
  expect(await validate(t, receipt)).toMatchObject({
    stage: 'failed',
    completion: null,
  });
  const status = await t.query(
    internal.initialCharacterBackfill.status,
    receipt,
  );
  expect(status.reports).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        scope: characterId,
        message: expect.stringContaining('linked Companion'),
      }),
    ]),
  );
});
