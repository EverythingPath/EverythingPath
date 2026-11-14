// @vitest-environment edge-runtime
import { beforeAll, afterEach, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import schema from './schema';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  activationArgs,
  discover,
  prepare,
  releaseFixture,
  type ReleaseTest as Test,
} from '../tests/catalog-release-fixture';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { CatalogReleaseImpactCommandAdapter } from '../scripts/catalog/release-impact-command';
import { runCatalogReleaseOperator } from '../scripts/catalog/release-operator';
import { computeFingerprint } from '../scripts/catalog/admission';
import type {
  ReleaseJson,
  ReleaseRow,
} from '../src/lib/catalog/release-schema';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';
import { formatGrantKeyId } from '../src/lib/character-sheet-grants';
import { installElf } from '../tests/catalog-release-elf';
import { representativeSelectionCatalog } from './lib/representativeSelectionCatalog';
import { representativeSpellCatalog } from './lib/representativeSpellCatalog';
import { representativeClassFeatureSchedules } from './lib/representativeClassCatalog';

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
preloadCalledConvexModules({ modules, testFile: import.meta.url });
const fixture = () => releaseFixture(modules);
afterEach(() => vi.useRealTimers());
// The importer's body for Keen Senses (CRB p. 22), kept as its last usable
// definition when an attribution hold retires it.
const keenSensesBody = {
  externalKey: 'elf-keen-senses',
  upstreamKey: 'elf-keen-senses',
  pack: 'races',
  name: 'Keen Senses',
  detail: { kind: 'racialTrait', bonusSkillRanksPerLevel: 0 },
  description: '',
  sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '22' }],
  modifiers: [{ target: 'skill.per', bonusType: 'racial', value: 2 }],
  unsupported: [],
};

type ReleaseBody = { externalKey: string; [key: string]: ReleaseJson };
function retirement(body: ReleaseBody): ReleaseRow {
  return {
    kind: 'report',
    key: `retirement:${body.externalKey}`,
    payload: {
      externalKey: body.externalKey,
      kind: 'definition',
      state: 'held',
      lastUsableDefinition: body,
      definitionFingerprint: computeFingerprint(body),
    },
  };
}

/** Evaluates every dirty Character once; returns how many completions held. */
async function reconcileDirty(
  t: Test,
  runId: Id<'catalogImpactRun'>,
  beforeComplete?: (characterId: Id<'character'>) => Promise<void>,
) {
  const dirty = await t.query(internal.catalogReleaseImpact.inspectWork, {
    runId,
    state: 'dirty',
    paginationOpts: {
      cursor: null,
      numItems: 32,
      maximumRowsRead: 32,
      maximumBytesRead: 512000,
    },
  });
  let completed = 0;
  for (const { characterId } of dirty.page) {
    const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
      runId,
      characterId,
    });
    await beforeComplete?.(characterId);
    if (
      await t.mutation(internal.catalogReleaseImpact.complete, {
        runId,
        characterId,
        evaluation,
      })
    )
      completed++;
  }
  return { completed, attempted: dirty.page.length };
}

const keenSensesGrant = {
  source: 'elf',
  entry: 'elf-keen-senses',
};
const keenSensesGrantId = formatGrantKeyId(keenSensesGrant);

test('retiring an automatic Grant target keeps existing Grants, blocks new ones and keeps fact generations', async () => {
  const { t, owner, outsider, create, scope } = await fixture();
  const elf = await installElf(t);
  const vessa = scope.characterId;
  const bren = await create('Bren');
  const read = async (characterId: Id<'character'>) => {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    );
    if (!sheet) throw new Error('Missing sheet');
    return sheet;
  };
  const keenSenses = async (characterId: Id<'character'>) =>
    (await read(characterId)).calculated.resolvedEntries.find(
      ({ entry }) => entry._id === keenSensesGrantId,
    );
  await owner.mutation(api.characterSheet.selectRace, {
    characterId: vessa,
    catalogEntryId: elf.elf,
    operationId: 'vessa-elf',
  });
  // The table customizes the elf for the campaign; the copy keeps its own
  // fields while its racial traits stay global and follow releases.
  const elfCopy = await owner.mutation(api.catalogCopies.customizeForCampaign, {
    characterId: vessa,
    catalogEntryId: elf.elf,
    operationId: 'elf-copy',
  });
  await owner.mutation(api.catalogCopies.editDefinition, {
    characterId: vessa,
    catalogEntryId: elfCopy,
    name: 'Elf of the Ironfang Hills',
    operationId: 'elf-copy-name',
  });
  expect((await read(vessa)).calculated.breakdowns['skill.per'].total).toBe(2);

  await prepare(t, [retirement(keenSensesBody)]);
  const runId = await discover(t, 1);
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({
    isDiscoveryComplete: true,
    pendingCount: 2,
    failedCount: 0,
  });
  // A concurrent edit lands between evaluation and completion.
  const first = await reconcileDirty(t, runId, async (characterId) => {
    if (characterId === vessa)
      await owner.mutation(api.characterSheet.editGrantState, {
        characterId: vessa,
        grantKey: keenSensesGrant,
        state: { notes: 'Spotted the ambush' },
        operationId: 'vessa-notes',
      });
  });
  expect(first).toEqual({ completed: 1, attempted: 2 });
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(false);
  expect(await reconcileDirty(t, runId)).toEqual({
    completed: 1,
    attempted: 1,
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(true);
  const work = await t.run((ctx) =>
    ctx.db
      .query('catalogImpactWork')
      .withIndex('by_runId_and_characterId', (q) =>
        q.eq('runId', runId).eq('characterId', vessa),
      )
      .unique(),
  );
  expect(work).toMatchObject({
    state: 'ready',
    hasFactsChanged: false,
    factGeneration: 0,
    reasons: ['retired:elf-keen-senses'],
    retainedGrantIds: [keenSensesGrantId],
  });
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );

  expect(await keenSenses(vessa)).toMatchObject({
    counting: true,
    entry: { notes: 'Spotted the ambush' },
  });
  expect((await read(vessa)).calculated.breakdowns['skill.per'].total).toBe(2);
  expect(
    (await read(vessa)).entries.find((entry) => entry.kind === 'race'),
  ).toMatchObject({ catalogEntryId: elfCopy });
  expect(
    (await read(vessa)).catalogEntries.find((row) => row._id === elfCopy),
  ).toMatchObject({ name: 'Elf of the Ironfang Hills', copiedFrom: elf.elf });
  // Leaving the race and returning restores the same existing Grant.
  for (const catalogEntryId of [null, elf.elf])
    await owner.mutation(api.characterSheet.selectRace, {
      characterId: vessa,
      catalogEntryId,
      operationId: `vessa-race-${catalogEntryId}`,
    });
  expect((await keenSenses(vessa))?.counting).toBe(true);

  // Bren becomes an elf (the campaign's copy) only after the release: no
  // new Keen Senses Grant.
  await owner.mutation(api.characterSheet.selectRace, {
    characterId: bren,
    catalogEntryId: elf.elf,
    operationId: 'bren-elf',
  });
  const brenSheet = await read(bren);
  expect(brenSheet.calculated.breakdowns['skill.per'].total).toBe(0);
  expect(brenSheet.calculated.abilities.dexterity.score).toBe(12);
  expect(await keenSenses(bren)).toBeUndefined();
  await expect(
    owner.mutation(api.characterSheet.editGrantState, {
      characterId: bren,
      grantKey: keenSensesGrant,
      state: { notes: 'Tried to record it' },
      operationId: 'bren-notes',
    }),
  ).rejects.toThrow('does not belong');
  await expect(
    owner.mutation(api.characterSheet.selectEntry, {
      characterId: bren,
      catalogEntryId: elf.keenSenses,
      operationId: 'bren-select-keen-senses',
    }),
  ).rejects.toThrow('retired');
  await expect(
    outsider.query(api.characterSheet.read, { characterId: vessa }),
  ).rejects.toThrow();
});

function selectionSeed(ruleIdentity: string) {
  const seed = representativeSelectionCatalog.find(
    (entry) => entry.ruleIdentity === ruleIdentity,
  );
  if (!seed) throw new Error(`Missing ${ruleIdentity}`);
  return seed;
}

// CRB p. 119 Cleave as the importer publishes it.
const cleave = selectionSeed('cleave');
const cleaveBody: ReleaseBody = {
  externalKey: 'cleave',
  upstreamKey: 'cleave',
  pack: 'feats',
  name: 'Cleave',
  detail: { kind: 'feat', featTypes: ['combat'], repeatable: 'no' },
  description: '',
  prerequisiteText: 'Str 13, Power Attack, base attack bonus +1.',
  prerequisites: [
    { ability: 'strength', min: 13 },
    { feat: 'power-attack' },
    { bab: 1 },
  ],
  sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '119' }],
  modifiers: [],
  unsupported: [],
};

/** The operator's reconcile command over this deployment's internal functions. */
function impactAdapter(
  t: Test,
  beforeComplete?: () => Promise<void>,
): CatalogReleaseImpactCommandAdapter {
  return {
    start: (args) => t.mutation(internal.catalogReleaseImpact.start, args),
    discover: (args) =>
      t.mutation(internal.catalogReleaseImpact.discover, args),
    evaluate: (args) => t.query(internal.catalogReleaseImpact.evaluate, args),
    complete: async (args) => {
      await beforeComplete?.();
      return t.mutation(internal.catalogReleaseImpact.complete, args);
    },
    finish: (args) => t.mutation(internal.catalogReleaseImpact.finish, args),
    status: (args) => t.query(internal.catalogReleaseImpact.status, args),
    retry: (args) => t.mutation(internal.catalogReleaseImpact.retry, args),
    retryDiscovery: (args) =>
      t.mutation(internal.catalogReleaseImpact.retryDiscovery, args),
    inspectWork: (args) =>
      t.query(internal.catalogReleaseImpact.inspectWork, args),
  };
}

async function operatorReconcile(
  t: Test,
  releaseNumber: number,
  beforeComplete?: () => Promise<void>,
) {
  const result: unknown = await runCatalogReleaseOperator({
    args: ['reconcile', '--number', String(releaseNumber)],
    impactAdapter: impactAdapter(t, beforeComplete),
  });
  expect(result).toMatchObject({ status: { isReady: true } });
  const runId = await t.run(
    async (ctx) =>
      (
        await ctx.db
          .query('catalogImpactRun')
          .withIndex('by_releaseId')
          .order('desc')
          .first()
      )?._id,
  );
  if (!runId) throw new Error('Missing reconciled run');
  return runId;
}

async function operatorActivate(
  t: Test,
  releaseNumber: number,
  runId: Id<'catalogImpactRun'>,
  targetKind: 'preview' | 'production' = 'preview',
) {
  return runCatalogReleaseOperator({
    args: [
      'activate',
      '--number',
      String(releaseNumber),
      '--run-id',
      runId,
      '--operation-id',
      `release-${releaseNumber}-${runId}`,
      '--schema',
      catalogRuntimeCompatibility.schema,
      '--calculation',
      catalogRuntimeCompatibility.calculation,
      '--fixture-only',
      '--target-kind',
      targetKind,
    ],
    activationAdapter: {
      activate: (args) =>
        t.mutation(internal.catalogReleaseActivation.activate, {
          ...args,
          runId,
        }),
      status: () => t.query(internal.catalogReleaseActivation.status, {}),
    },
  });
}

test('a rollback release recalculates current sheets, keeps newer choices and edited copies, and restores selection only through a checked release', async () => {
  const { t, owner, outsider, create, scope } = await fixture();
  const cleaveId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', { ...cleave, scope: 'global' }),
  );
  const vessa = scope.characterId;
  const bren = await create('Bren');
  const first = await prepare(t, [
    { kind: 'definition', key: 'cleave', payload: cleaveBody },
  ]);
  await operatorActivate(t, 1, await operatorReconcile(t, 1));

  // After release 1: Vessa takes Cleave, customizes it for the campaign and
  // edits the copy and her Selection.
  const cleaveEntryId = await owner.mutation(api.characterSheet.selectEntry, {
    characterId: vessa,
    catalogEntryId: cleaveId,
    notes: 'Taken at the bridge',
    operationId: 'vessa-cleave',
  });
  const copyId = await owner.mutation(api.catalogCopies.customizeForCampaign, {
    characterId: vessa,
    catalogEntryId: cleaveId,
    operationId: 'cleave-copy',
  });
  await owner.mutation(api.catalogCopies.editDefinition, {
    characterId: vessa,
    catalogEntryId: copyId,
    name: 'Cleave (Ironfang drill)',
    operationId: 'cleave-copy-name',
  });

  // Release 2 rolls back to before Cleave: its last usable body is retained.
  await prepare(t, [retirement(cleaveBody)], 2, {
    releaseNumber: 1,
    artifactFingerprint: first.manifest.artifactFingerprint,
  });
  // Play continues while the rollback reconciles: a newer Selection lands
  // during the run and is kept, not reverted.
  let edited = false;
  const skillFocus = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId: vessa }),
  )?.catalogEntries.find((row) => row.ruleIdentity === 'skill-focus');
  if (!skillFocus) throw new Error('Missing Skill Focus');
  const rollbackRun = await operatorReconcile(t, 2, async () => {
    if (edited) return;
    edited = true;
    await owner.mutation(api.characterSheet.selectEntry, {
      characterId: vessa,
      catalogEntryId: skillFocus._id,
      choice: 'skill.per',
      operationId: 'vessa-skill-focus',
    });
  });
  // An edit after the run is sealed holds activation back until reconciled.
  await owner.mutation(api.characterSheet.editSelection, {
    characterId: vessa,
    entryId: cleaveEntryId,
    notes: 'Taken at the bridge; used at the gate',
    operationId: 'vessa-cleave-notes',
  });
  await expect(operatorActivate(t, 2, rollbackRun)).rejects.toThrow(
    'pending-work',
  );
  await expect(
    operatorActivate(t, 2, rollbackRun, 'production'),
  ).rejects.toThrow('limited to fixture deployments');
  const resumedRun = await operatorReconcile(t, 2);
  await operatorActivate(t, 2, resumedRun);

  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId: vessa }),
  );
  expect(sheet?.catalogView?.releaseNumber).toBe(2);
  expect(sheet?.entries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        _id: cleaveEntryId,
        catalogEntryId: copyId,
        notes: 'Taken at the bridge; used at the gate',
      }),
      expect.objectContaining({
        kind: 'feat',
        catalogEntryId: skillFocus._id,
        state: expect.objectContaining({ choice: 'skill.per' }),
      }),
    ]),
  );
  expect(sheet?.catalogEntries.find((row) => row._id === copyId)).toMatchObject(
    { name: 'Cleave (Ironfang drill)', copiedFrom: cleaveId },
  );
  expect(
    sheet?.calculated.resolvedEntries.find(
      ({ storedEntryId }) => storedEntryId === cleaveEntryId,
    ),
  ).toMatchObject({ counting: true });
  const factsWork = await t.run((ctx) =>
    ctx.db
      .query('catalogImpactWork')
      .withIndex('by_runId_and_characterId', (q) =>
        q.eq('runId', resumedRun).eq('characterId', vessa),
      )
      .unique(),
  );
  expect(factsWork).toMatchObject({ factGeneration: 0 });

  // Nobody gains the retired content anew: no Selection, copy or re-adding.
  for (const catalogEntryId of [cleaveId, copyId])
    await expect(
      owner.mutation(api.characterSheet.selectEntry, {
        characterId: bren,
        catalogEntryId,
        operationId: `bren-cleave-${catalogEntryId}`,
      }),
    ).rejects.toThrow('retired');
  // Her existing use can be switched off and on; a second Selection is new.
  for (const active of [false, true])
    await owner.mutation(api.characterSheet.editSelection, {
      characterId: vessa,
      entryId: cleaveEntryId,
      active,
      operationId: `vessa-cleave-${active}`,
    });
  await expect(
    owner.mutation(api.characterSheet.selectEntry, {
      characterId: vessa,
      catalogEntryId: copyId,
      operationId: 'vessa-second-cleave',
    }),
  ).rejects.toThrow('retired');
  await expect(
    outsider.query(api.characterSheet.read, { characterId: bren }),
  ).rejects.toThrow();

  // A later checked release admits Cleave again; only then can it be chosen.
  const second = await t.run((ctx) =>
    ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 2))
      .unique(),
  );
  if (!second) throw new Error('Missing release 2');
  await prepare(
    t,
    [{ kind: 'definition', key: 'cleave', payload: cleaveBody }],
    3,
    {
      releaseNumber: 2,
      artifactFingerprint: second.manifest.artifactFingerprint,
    },
  );
  await operatorActivate(t, 3, await operatorReconcile(t, 3));
  await expect(
    owner.mutation(api.characterSheet.selectEntry, {
      characterId: bren,
      catalogEntryId: cleaveId,
      operationId: 'bren-cleave-restored',
    }),
  ).resolves.toBeTruthy();
});

test('moving a Character carries only its own held use, which stays unavailable for new choices', async () => {
  vi.useFakeTimers();
  const { t, owner, campaignId, scope } = await fixture();
  const destinationId = await t.run(async (ctx) => {
    const user = await ctx.db.query('user').first();
    if (user)
      await ctx.db.patch('user', user._id, { characterSheetDemo: true });
    return ctx.db.insert('campaign', {
      name: 'Rollback destination',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'rollback',
        version: 1,
        workerKey: '0',
        caseKey: 'rollback',
        campaignKey: 'destination',
      },
    });
  });
  const cleaveId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', { ...cleave, scope: 'global' }),
  );
  const vessa = scope.characterId;
  const first = await prepare(t, [
    { kind: 'definition', key: 'cleave', payload: cleaveBody },
  ]);
  await operatorActivate(t, 1, await operatorReconcile(t, 1));
  const cleaveEntryId = await owner.mutation(api.characterSheet.selectEntry, {
    characterId: vessa,
    catalogEntryId: cleaveId,
    operationId: 'vessa-cleave',
  });
  const copyId = await owner.mutation(api.catalogCopies.customizeForCampaign, {
    characterId: vessa,
    catalogEntryId: cleaveId,
    operationId: 'cleave-copy',
  });
  await prepare(t, [retirement(cleaveBody)], 2, {
    releaseNumber: 1,
    artifactFingerprint: first.manifest.artifactFingerprint,
  });
  await operatorActivate(t, 2, await operatorReconcile(t, 2));

  const command = {
    characterId: vessa,
    destinationCampaignId: destinationId,
    operationId: 'join-destination',
  };
  let progress = await owner.mutation(api.characterMoves.start, command);
  for (let i = 0; i < 20 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, {
      characterId: vessa,
      operationId: command.operationId,
    });
  expect(progress.state).toBe('completed');
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId: vessa }),
  );
  expect(sheet?.campaign?.campaignId).toBe(destinationId);
  const carried = sheet?.entries.find((entry) => entry._id === cleaveEntryId);
  if (!carried || !('catalogEntryId' in carried))
    throw new Error('Missing carried Cleave');
  // The same Character keeps its use through a Character-only copy.
  expect(carried.catalogEntryId).not.toBe(copyId);
  expect(
    sheet?.catalogEntries.find((row) => row._id === carried.catalogEntryId),
  ).toMatchObject({
    scope: 'character',
    characterId: vessa,
    ruleIdentity: 'cleave',
    copiedFrom: copyId,
  });
  expect(
    sheet?.calculated.resolvedEntries.find(
      ({ storedEntryId }) => storedEntryId === cleaveEntryId,
    ),
  ).toMatchObject({ counting: true });
  // Moving made nothing selectable: not the carried copy, not the global.
  for (const catalogEntryId of [carried.catalogEntryId, cleaveId])
    await expect(
      owner.mutation(api.characterSheet.selectEntry, {
        characterId: vessa,
        catalogEntryId,
        operationId: `vessa-second-cleave-${catalogEntryId}`,
      }),
    ).rejects.toThrow('retired');
  const newcomer = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId: destinationId,
    name: 'Bren',
    kind: 'pc',
    operationId: 'create-destination-bren',
  });
  await expect(
    owner.mutation(api.characterSheet.selectEntry, {
      characterId: newcomer,
      catalogEntryId: cleaveId,
      operationId: 'bren-cleave',
    }),
  ).rejects.toThrow('retired');
  expect(
    await t.run(async (ctx) =>
      (
        await ctx.db
          .query('catalogEntry')
          .withIndex('by_scope_and_ruleIdentity', (q) =>
            q.eq('scope', 'campaign').eq('ruleIdentity', 'cleave'),
          )
          .collect()
      ).map((row) => row.campaignId),
    ),
  ).toEqual([campaignId]);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

test('a departure leaves behind held campaign Spells the Character never used', async () => {
  vi.useFakeTimers();
  const { t, owner, create, scope } = await fixture();
  await t.run(async (ctx) => {
    const user = await ctx.db.query('user').first();
    if (user)
      await ctx.db.patch('user', user._id, { characterSheetDemo: true });
  });
  // CRB p. 293 Haste, as the importer publishes it.
  const haste = representativeSpellCatalog.find(
    (spell) => spell.name === 'Haste',
  );
  if (!haste) throw new Error('Missing Haste');
  const hasteId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: haste.name,
      ruleIdentity: haste.externalKey,
      sources: haste.sources,
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'spell',
        levels: haste.detail.levels,
        school: haste.detail.school,
        description: haste.description,
      },
    }),
  );
  const wizardLevel = async (characterId: Id<'character'>) => {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    );
    const wizard = sheet?.catalogEntries.find((row) => row.name === 'Wizard');
    const level = sheet?.entries.find((row) => row.kind === 'classLevel');
    if (!wizard || !level) throw new Error('Missing Wizard');
    await owner.mutation(api.characterSheet.editClassLevel, {
      characterId,
      entryId: level._id,
      classEntryId: wizard._id,
      operationId: `wizard-${characterId}`,
    });
    return wizard._id;
  };
  const vessa = scope.characterId;
  const bren = await create('Bren');
  await wizardLevel(vessa);
  const brenWizard = await wizardLevel(bren);
  // Bren customizes Haste for the campaign, then drops it from his sheet.
  const recorded = await owner.mutation(api.characterSheetSpells.record, {
    characterId: bren,
    castingClassId: brenWizard,
    catalogEntryId: hasteId,
    operationId: 'bren-haste',
  });
  const copyId = await owner.mutation(api.catalogCopies.customizeForCampaign, {
    characterId: bren,
    catalogEntryId: hasteId,
    operationId: 'haste-copy',
  });
  await owner.mutation(api.characterSheetSpells.remove, {
    characterId: bren,
    entryId: recorded,
    operationId: 'bren-drop-haste',
  });
  await prepare(t, [retirement(haste)]);
  await operatorActivate(t, 1, await operatorReconcile(t, 1));

  const browserRows = () =>
    t.run((ctx) =>
      ctx.db
        .query('spellCatalogIndex')
        .withIndex('by_characterId_and_catalogEntryId', (q) =>
          q.eq('characterId', vessa).eq('catalogEntryId', copyId),
        )
        .collect(),
    );
  const listed = await browserRows();
  expect(listed.length).toBeGreaterThan(0);
  expect(listed.every(({ recorded }) => !recorded)).toBe(true);
  const command = { characterId: vessa, operationId: 'leave' };
  let progress = await owner.mutation(api.characterMoves.start, command);
  for (let i = 0; i < 20 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('completed');
  expect(
    await t.run(async (ctx) =>
      (
        await ctx.db
          .query('catalogEntry')
          .withIndex('by_characterId_and_ruleIdentity', (q) =>
            q.eq('characterId', vessa).eq('ruleIdentity', haste.externalKey),
          )
          .collect()
      ).map((row) => row.copiedFrom ?? null),
    ),
  ).not.toContain(copyId);
  expect(await browserRows()).toEqual([]);
  expect(
    (await owner.query(api.characterSheet.read, { characterId: vessa }))
      ?.campaign,
  ).toBeNull();
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

test('a Character returns to its own retired race, which no other Character can choose', async () => {
  const { t, owner, create, scope } = await fixture();
  const elf = await installElf(t);
  const vessa = scope.characterId;
  const bren = await create('Bren');
  await owner.mutation(api.characterSheet.selectRace, {
    characterId: vessa,
    catalogEntryId: elf.elf,
    operationId: 'vessa-elf',
  });
  // CRB p. 22: the elf race body the importer published.
  await prepare(t, [
    retirement({
      externalKey: 'elf',
      upstreamKey: 'elf',
      pack: 'races',
      name: 'Elf',
      detail: {
        kind: 'race',
        racialHitDice: 0,
        creatureTypes: ['humanoid'],
        creatureSubtypes: ['elf'],
      },
      description: '',
      sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '22' }],
      modifiers: [],
      unsupported: [],
    }),
  ]);
  await operatorActivate(t, 1, await operatorReconcile(t, 1));
  const human = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId: vessa }),
  )?.catalogEntries.find((row) => row.ruleIdentity === 'human');
  if (!human) throw new Error('Missing human');
  for (const catalogEntryId of [human._id, elf.elf])
    await owner.mutation(api.characterSheet.selectRace, {
      characterId: vessa,
      catalogEntryId,
      operationId: `vessa-race-${catalogEntryId}`,
    });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId: vessa }),
  );
  expect(
    sheet?.entries.filter((entry) => entry.kind === 'race' && entry.active),
  ).toEqual([expect.objectContaining({ catalogEntryId: elf.elf })]);
  expect(sheet?.calculated.abilities.dexterity.score).toBe(12);
  await expect(
    owner.mutation(api.characterSheet.selectRace, {
      characterId: bren,
      catalogEntryId: elf.elf,
      operationId: 'bren-elf',
    }),
  ).rejects.toThrow('retired');
});

/**
 * The Character's own seeded fighter (CRB p. 55), its features and the Archer
 * Archetype (APG p. 104) as global content, as an imported catalog would hold
 * them.
 */
async function installFighter(t: Test, characterId: Id<'character'>) {
  return t.run(async (ctx) => {
    const seeds = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .collect();
    const find = (ruleIdentity: string) => {
      const row = seeds.find((seed) => seed.ruleIdentity === ruleIdentity);
      if (!row) throw new Error(`Missing ${ruleIdentity}`);
      return row;
    };
    const fighter = find('fighter');
    const archer = find('fighter-archer');
    const ids = new Set<Id<'catalogEntry'>>([fighter._id, archer._id]);
    const references: { catalogEntryId: Id<'catalogEntry'> }[] = [];
    if (fighter.detail.kind === 'class' && 'featuresByLevel' in fighter.detail)
      references.push(...fighter.detail.featuresByLevel);
    if (archer.detail.kind === 'archetype')
      references.push(...archer.detail.replaces, ...archer.detail.adds);
    for (const reference of references) ids.add(reference.catalogEntryId);
    for (const id of ids)
      await ctx.db.patch('catalogEntry', id, {
        scope: 'global',
        characterId: undefined,
        browseOnly: undefined,
      });
    return { fighter: fighter._id, archer: archer._id };
  });
}

// The importer's fighter body (CRB pp. 55-57), retired by a later release.
const fighterBody: ReleaseBody = {
  externalKey: 'fighter',
  upstreamKey: 'fighter',
  pack: 'classes',
  name: 'Fighter',
  detail: {
    kind: 'class',
    tag: 'fighter',
    classKind: 'base',
    hitDie: 10,
    bab: 'full',
    saves: { fort: 'good', ref: 'poor', will: 'poor' },
    skillRanksPerLevel: 2,
    classSkills: [
      'skill.clm',
      'skill.crf',
      'skill.han',
      'skill.int',
      'skill.kdu',
      'skill.ken',
      'skill.pro',
      'skill.rid',
      'skill.sur',
      'skill.swm',
    ],
    featuresByLevel: (representativeClassFeatureSchedules.fighter ?? []).map(
      ({ classLevel, catalogEntryId }) => ({
        classLevel,
        externalKey: catalogEntryId,
      }),
    ),
  },
  description: '',
  sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '55' }],
  modifiers: [],
  unsupported: [],
};

test('a Character keeps adding levels and Archetypes to its own retired class with an advisory, while no one starts it', async () => {
  const { t, owner, create, scope } = await fixture();
  const vessa = scope.characterId;
  const bren = await create('Bren');
  const fighter = await installFighter(t, vessa);
  const firstLevel = async (characterId: Id<'character'>) => {
    const level = (
      await owner.query(api.characterSheet.read, { characterId })
    )?.entries.find((row) => row.kind === 'classLevel');
    if (!level) throw new Error('Missing Class Level');
    return level._id;
  };
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId: vessa,
    entryId: await firstLevel(vessa),
    classEntryId: fighter.fighter,
    operationId: 'vessa-fighter',
  });
  await prepare(t, [retirement(fighterBody)]);
  await operatorActivate(t, 1, await operatorReconcile(t, 1));

  const secondLevel = await owner.mutation(api.characterSheet.addClassLevel, {
    characterId: vessa,
    classEntryId: fighter.fighter,
    operationId: 'vessa-fighter-2',
  });
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    characterId: vessa,
    classEntryId: fighter.fighter,
    catalogEntryId: fighter.archer,
    selected: true,
    operationId: 'vessa-archer',
  });
  for (const selected of [false, true])
    await owner.mutation(api.characterSheet.setArchetypeSelected, {
      characterId: vessa,
      classEntryId: fighter.fighter,
      catalogEntryId: fighter.archer,
      selected,
      operationId: `vessa-archer-${selected}`,
    });
  const sheet = await owner.query(api.characterSheet.read, {
    characterId: vessa,
  });
  expect(
    sheet?.entries.filter(
      (row) =>
        row.kind === 'classLevel' && row.state.classEntryId === fighter.fighter,
    ),
  ).toHaveLength(2);
  expect(sheet?.entries).toContainEqual(
    expect.objectContaining({ _id: secondLevel }),
  );
  expect(sheet?.entries).toContainEqual(
    expect.objectContaining({
      kind: 'archetype',
      active: true,
      catalogEntryId: fighter.archer,
    }),
  );
  const advisory = sheet?.calculated.warnings.find(
    (warning) => warning.check === 'retiredClassInUse',
  );
  expect(advisory).toMatchObject({
    kind: 'rules',
    subject: 'class:fighter',
    message: expect.stringContaining('Fighter'),
  });
  if (!advisory) throw new Error('Missing advisory');
  await owner.mutation(api.characterSheet.acceptWarning, {
    characterId: vessa,
    check: advisory.check,
    subject: advisory.subject,
    fingerprint: advisory.fingerprint,
    operationId: 'accept-retired-fighter',
  });
  expect(
    (await owner.query(api.characterSheet.read, { characterId: vessa }))
      ?.acceptedWarnings,
  ).toContainEqual(expect.objectContaining({ check: 'retiredClassInUse' }));

  // Starting the retired class, or its Archetype, stays refused.
  await expect(
    owner.mutation(api.characterSheet.editClassLevel, {
      characterId: bren,
      entryId: await firstLevel(bren),
      classEntryId: fighter.fighter,
      operationId: 'bren-fighter',
    }),
  ).rejects.toThrow('retired');
  await expect(
    owner.mutation(api.characterSheet.addClassLevel, {
      characterId: bren,
      classEntryId: fighter.fighter,
      operationId: 'bren-fighter-2',
    }),
  ).rejects.toThrow('retired');
});
