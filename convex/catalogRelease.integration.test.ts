// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { ConvexError } from 'convex/values';
import type { CatalogReleaseStatus } from '../src/lib/catalog/release-validators';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';

import { api, internal } from './_generated/api';
import schema from './schema';
import {
  releaseFingerprint,
  releaseByteCount,
  validateCatalogReleaseManifest,
} from '../src/lib/catalog/release-schema';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';
import resourcesData from '../src/lib/catalog/data/resources.json';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { runCatalogReleaseCommand } from '../scripts/catalog/release-command';
import { buildCatalogRelease } from '../scripts/catalog/release';
import type { ReleaseRow } from '../src/lib/catalog/release-schema';
import { buildLegalPageData } from '../src/lib/catalog/legal-page-data';
import { legalResourcesSchema } from '../src/lib/catalog/legal-types';
import { initializationEdits } from '../tests/rules/initialization-edits';
import { roll } from '../tests/rules/upkeep-fixture';

afterEach(() => vi.useRealTimers());

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));

// Exercise the wire boundary with untrusted input, including rejection cases.
const writeBatchBoundary = makeFunctionReference<
  'mutation',
  {
    releaseNumber: number;
    batchIndex: number;
    rows: unknown;
    writeEpoch?: number;
  },
  CatalogReleaseStatus
>('catalogRelease:writeBatch');
const beginBoundary = makeFunctionReference<
  'mutation',
  { manifest: unknown; writeEpoch?: number },
  CatalogReleaseStatus
>('catalogRelease:begin');

function definitionPayload(name: string, externalKey = 'pf1/Future') {
  return {
    externalKey,
    upstreamKey: externalKey,
    pack: 'feats',
    name,
    detail: { kind: 'feat', featTypes: [], repeatable: 'unreviewed' },
    description: '',
    sources: [],
    modifiers: [],
    unsupported: [],
  };
}

async function artifact(releaseNumber = 1) {
  const permanentNotices = buildLegalPageData({
    registry: {},
    resources: legalResourcesSchema.parse(resourcesData),
    requiredNotices: [],
    permanentNoticeSuperset: [],
  }).permanentNoticeSuperset;
  const rows = [
    {
      kind: 'definition' as const,
      key: 'feat:future',
      payload: definitionPayload('Future feat'),
    },
    ...['content', 'resources', 'holds', 'retirement', 'curation'].map(
      (key) => ({
        kind: 'report' as const,
        key,
        payload: {
          count: 0,
          gatePassed: true,
          coverageComplete: true,
          passed: true,
        },
      }),
    ),
    ...[
      'requiredNotices',
      'permanentNoticeSuperset',
      'registry',
      'resources',
    ].map((key) => ({
      kind: 'legal' as const,
      key,
      payload:
        key === 'resources'
          ? resourcesData
          : key === 'registry'
            ? {}
            : key === 'permanentNoticeSuperset'
              ? permanentNotices
              : [],
    })),
  ];
  const inputs = Object.fromEntries(
    [
      'upstream',
      'remaps',
      'curation',
      'localData',
      'parsers',
      'sanitizers',
      'ruleResources',
      'legal',
      'attribution',
    ].map((key) => [key, 'a'.repeat(64)]),
  );
  const compatibility = catalogRuntimeCompatibility;
  const batches = [
    {
      fingerprint: await releaseFingerprint(rows),
      rowCount: rows.length,
      byteCount: releaseByteCount(rows),
    },
  ];
  const baseRelease = null;
  const manifest = {
    formatVersion: 1 as const,
    releaseNumber,
    baseRelease,
    inputs,
    compatibility,
    inputFingerprint: await releaseFingerprint({
      inputs,
      compatibility,
      baseRelease,
    }),
    outputFingerprint: await releaseFingerprint(batches),
    batches,
  };
  return {
    rows,
    manifest: validateCatalogReleaseManifest({
      ...manifest,
      artifactFingerprint: await releaseFingerprint(manifest),
    }),
  };
}

test('release validation failures preserve operator-readable ConvexError data', async () => {
  const t = convexTest(schema, modules);
  const { manifest, rows } = await artifact();
  const invalidNumber = t.mutation(beginBoundary, {
    manifest: { ...manifest, releaseNumber: 0 },
  });
  await expect(invalidNumber).rejects.toBeInstanceOf(ConvexError);
  await expect(invalidNumber).rejects.toMatchObject({
    data: 'Invalid release number.',
  });
  const invalidFingerprint = t.mutation(beginBoundary, {
    manifest: { ...manifest, artifactFingerprint: 'b'.repeat(64) },
  });
  await expect(invalidFingerprint).rejects.toBeInstanceOf(ConvexError);
  await expect(invalidFingerprint).rejects.toMatchObject({
    data: 'Catalog Release manifest fingerprint mismatch.',
  });
  await t.mutation(beginBoundary, { manifest });
  const emptyBatch = t.mutation(writeBatchBoundary, {
    releaseNumber: 1,
    batchIndex: 0,
    rows: [],
  });
  await expect(emptyBatch).rejects.toBeInstanceOf(ConvexError);
  await expect(emptyBatch).rejects.toMatchObject({
    data: 'Release batch must contain 1–100 rows.',
  });
  const duplicateBatch = t.mutation(writeBatchBoundary, {
    releaseNumber: 1,
    batchIndex: 0,
    rows: [...rows, rows[0]],
  });
  await expect(duplicateBatch).rejects.toBeInstanceOf(ConvexError);
  await expect(duplicateBatch).rejects.toMatchObject({
    data: 'Duplicate release row.',
  });
});

test('private preparation resumes unchanged batches and never publishes candidate definitions', async () => {
  const t = convexTest(schema, modules);
  const { rows, manifest } = await artifact();
  const started = await t.mutation(beginBoundary, { manifest });
  expect(started).toMatchObject({
    state: 'preparing',
    nextBatchIndex: 0,
    stagedRows: 0,
  });
  expect(await t.mutation(beginBoundary, { manifest })).toEqual(started);
  const written = await t.mutation(writeBatchBoundary, {
    releaseNumber: 1,
    batchIndex: 0,
    rows,
  });
  expect(written).toMatchObject({ nextBatchIndex: 1, stagedRows: 10 });
  expect(
    await t.mutation(writeBatchBoundary, {
      releaseNumber: 1,
      batchIndex: 0,
      rows,
    }),
  ).toEqual(written);
  expect(
    await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 1 }),
  ).toMatchObject({ state: 'prepared' });
  expect(
    await t.query(internal.catalogRelease.inspect, { releaseNumber: 1 }),
  ).toMatchObject({ state: 'prepared' });
  expect(await t.run((ctx) => ctx.db.query('catalogEntry').take(1))).toEqual(
    [],
  );
});

test('sheet authority permits private release preparation and ordinary campaign edits while fencing legacy Character writes', async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const seeded = await owner.run((ctx) => seedAcceptedCampaign(ctx));
  const { manifest, rows } = await artifact();
  const run = await t.mutation(internal.initialMigration.start, {
    operationId: 'release-gate',
    expectedEpoch: 0,
    frontendBuild: 'build',
    catalogManifest: 'catalog',
    maintenanceBudgetMs: 60000,
  });
  await t.run(async (ctx) => {
    const control = await ctx.db.query('initialMigrationControl').first();
    if (!control) throw new Error('Write Gate missing');
    await ctx.db.patch('initialMigrationControl', control._id, {
      authority: 'sheet',
      closed: false,
    });
  });
  await expect(
    t.mutation(beginBoundary, {
      manifest,
      writeEpoch: run.epoch,
    }),
  ).resolves.toMatchObject({ state: 'preparing' });
  await t.mutation(writeBatchBoundary, {
    releaseNumber: 1,
    batchIndex: 0,
    rows,
    writeEpoch: run.epoch,
  });
  await expect(
    t.mutation(internal.catalogRelease.finalize, {
      releaseNumber: 1,
      writeEpoch: run.epoch,
    }),
  ).resolves.toMatchObject({ state: 'prepared' });
  await expect(
    owner.mutation(api.campaign.updateCampaignDescription, {
      campaignId: seeded.key.campaignId,
      organizationId: 'org',
      description: 'Ordinary edit',
      writeEpoch: run.epoch,
    }),
  ).resolves.toMatchObject({ description: 'Ordinary edit' });
  await expect(
    owner.mutation(api.character.updateCharacter, {
      characterId: seeded.characterId,
      organizationId: 'org',
      patch: { name: 'Legacy edit' },
      writeEpoch: run.epoch,
    }),
  ).rejects.toThrow('RELOAD_REQUIRED');
  await expect(
    t.mutation(beginBoundary, {
      manifest,
      writeEpoch: 0,
    }),
  ).rejects.toThrow('RELOAD_REQUIRED');
  await t.run(async (ctx) => {
    const control = await ctx.db.query('initialMigrationControl').first();
    if (!control) throw new Error('Write Gate missing');
    await ctx.db.patch('initialMigrationControl', control._id, {
      closed: true,
    });
  });
  for (const command of [
    () => t.mutation(beginBoundary, { manifest, writeEpoch: run.epoch }),
    () =>
      t.mutation(writeBatchBoundary, {
        releaseNumber: 1,
        batchIndex: 0,
        rows,
        writeEpoch: run.epoch,
      }),
    () =>
      t.mutation(internal.catalogRelease.finalize, {
        releaseNumber: 1,
        writeEpoch: run.epoch,
      }),
    () =>
      owner.mutation(api.campaign.updateCampaignDescription, {
        campaignId: seeded.key.campaignId,
        organizationId: 'org',
        description: 'Closed',
        writeEpoch: run.epoch,
      }),
    () =>
      owner.mutation(api.character.updateCharacter, {
        characterId: seeded.characterId,
        organizationId: 'org',
        patch: { name: 'Closed' },
        writeEpoch: run.epoch,
      }),
  ])
    await expect(command()).rejects.toThrow('MAINTENANCE');
});

test('public legal inputs are absent until the selected release exists and is prepared', async () => {
  const t = convexTest(schema, modules);
  await t.run((ctx) =>
    ctx.db.insert('catalogReleaseControl', {
      key: 'global',
      releaseNumber: 1,
      schemaIdentity: catalogRuntimeCompatibility.schema,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
    }),
  );
  await expect(t.query(api.catalogRelease.legalInputs, {})).resolves.toBeNull();
  const { manifest } = await artifact();
  await t.run((ctx) =>
    ctx.db.insert('catalogRelease', {
      releaseNumber: 1,
      state: 'preparing',
      baseReleaseNumber: null,
      manifest,
      nextBatchIndex: 0,
      batchCount: 1,
      stagedRows: 0,
      reportCategories: [],
      legalKeys: [],
    }),
  );
  await expect(t.query(api.catalogRelease.legalInputs, {})).resolves.toBeNull();
});

test('a fingerprinted definition with no catalog detail cannot be staged', async () => {
  const t = convexTest(schema, modules);
  const initial = await artifact();
  const candidate = await buildCatalogRelease({
    releaseNumber: 1,
    compatibility: catalogRuntimeCompatibility,
    inputs: initial.manifest.inputs,
    rows: [
      {
        kind: 'definition',
        key: 'pf1/Malformed',
        payload: { name: 'Missing detail' },
      },
    ],
  });
  await t.mutation(beginBoundary, { manifest: candidate.manifest });
  await expect(
    t.mutation(writeBatchBoundary, {
      releaseNumber: 1,
      batchIndex: 0,
      rows: candidate.batches[0],
    }),
  ).rejects.toThrow();
  expect(
    await t.query(internal.catalogRelease.inspect, { releaseNumber: 1 }),
  ).toMatchObject({ stagedRows: 0, nextBatchIndex: 0 });
});

test('an applied remap must preserve reviewed identities and a valid review date', async () => {
  const t = convexTest(schema, modules);
  const initial = await artifact();
  const candidate = await buildCatalogRelease({
    releaseNumber: 1,
    compatibility: catalogRuntimeCompatibility,
    inputs: initial.manifest.inputs,
    rows: [
      {
        kind: 'remap',
        key: 'pf1/Old',
        payload: {
          from: 'pf1/Old',
          to: 'pf1/New',
          kind: 'feat',
          reason: 'Moved',
          evidence: 'Review',
          reviewedBy: 'Reviewer',
          reviewedOn: 'not-a-date',
          applied: true,
        },
      },
    ],
  });
  await t.mutation(beginBoundary, { manifest: candidate.manifest });
  await expect(
    t.mutation(writeBatchBoundary, {
      releaseNumber: 1,
      batchIndex: 0,
      rows: candidate.batches[0],
    }),
  ).rejects.toThrow();
  expect(
    await t.query(internal.catalogRelease.inspect, { releaseNumber: 1 }),
  ).toMatchObject({ stagedRows: 0, nextBatchIndex: 0 });
});

// #716: Lore Warden's Scholastic, Pathfinder Society Field Guide p.31, as PCGen
// gives it (campaign_setting/pathfinder_society_field_guide/pfsfg_abilities_class.lst:258).
const scholasticLocator = {
  file: 'campaign_setting/pathfinder_society_field_guide/pfsfg_abilities_class.lst',
  line: 258,
  key: 'Lore Warden ~ Scholastic',
};
const scholasticPayload = {
  externalKey: 'everythingpath/fighter-lore-warden-scholastic',
  upstreamKey: `pcgen:${scholasticLocator.file}#${scholasticLocator.key}`,
  pack: 'campaign_setting/pathfinder_society_field_guide',
  name: 'Scholastic',
  detail: { kind: 'classFeature' },
  description:
    "Lore wardens gain 2 additional skill ranks each level. These ranks must be spent on Intelligence-based skills. All Intelligence-based skills are class skills for lore wardens. This ability replaces the lore warden's proficiency with medium armor, heavy armor, and shields.",
  sources: [{ book: 'Pathfinder Society Field Guide', pages: '31' }],
  modifiers: [],
  unsupported: [],
  provenance: {
    name: { source: 'pcgen', locator: scholasticLocator },
    description: { source: 'pcgen', locator: scholasticLocator },
    sources: { source: 'pcgen', locator: scholasticLocator },
  },
};
const loreWardenRemap = {
  from: 'everythingpath/fighter-lore-warden',
  to: 'everythingpath/fighter-lore-warden-pfsfg',
  kind: 'archetype',
  reason: 'Pin bump changed the locator of the PFSFG Lore Warden.',
  evidence:
    'pcgen:campaign_setting/pathfinder_society_field_guide/pfsfg_abilities_class.lst#Fighter Archetype ~ Lore Warden',
  reviewedBy: 'Reviewer',
  reviewedOn: '2026-10-17',
  applied: true,
};

async function stageRows(t: ReturnType<typeof convexTest>, rows: ReleaseRow[]) {
  const initial = await artifact();
  const candidate = await buildCatalogRelease({
    releaseNumber: 1,
    compatibility: catalogRuntimeCompatibility,
    inputs: initial.manifest.inputs,
    rows,
  });
  await t.mutation(beginBoundary, { manifest: candidate.manifest });
  return candidate;
}
const readRows = async (
  t: ReturnType<typeof convexTest>,
  kind: 'definition' | 'remap',
) =>
  (
    await t.query(internal.catalogRelease.inspectRows, {
      releaseNumber: 1,
      kind,
      paginationOpts: {
        cursor: null,
        numItems: 10,
        maximumRowsRead: 10,
        maximumBytesRead: 512000,
      },
    })
  ).page.map(({ key, payload }) => ({ key, payload }));

test('#716 definitions keep their provenance and everythingpath/ keys and remaps through a batch', async () => {
  const t = convexTest(schema, modules);
  const foundry = definitionPayload('Future feat');
  const candidate = await stageRows(t, [
    {
      kind: 'definition',
      key: scholasticPayload.externalKey,
      payload: scholasticPayload,
    },
    { kind: 'definition', key: foundry.externalKey, payload: foundry },
    { kind: 'remap', key: loreWardenRemap.from, payload: loreWardenRemap },
  ]);
  for (const [batchIndex, rows] of candidate.batches.entries())
    await t.mutation(writeBatchBoundary, {
      releaseNumber: 1,
      batchIndex,
      rows,
    });
  expect(
    await t.query(internal.catalogRelease.inspect, { releaseNumber: 1 }),
  ).toMatchObject({ stagedRows: 3 });
  expect(await readRows(t, 'definition')).toEqual(
    expect.arrayContaining([
      { key: scholasticPayload.externalKey, payload: scholasticPayload },
      // A body without provenance, as every existing release has, still validates.
      { key: foundry.externalKey, payload: foundry },
    ]),
  );
  expect(await readRows(t, 'remap')).toEqual([
    { key: loreWardenRemap.from, payload: loreWardenRemap },
  ]);
});

test.each([
  [
    'a remap to a malformed #716 key',
    {
      kind: 'remap' as const,
      key: loreWardenRemap.from,
      payload: { ...loreWardenRemap, to: 'everythingpath/Fighter_Lore_Warden' },
    },
  ],
  [
    'a remap to a source locator instead of a key',
    {
      kind: 'remap' as const,
      key: loreWardenRemap.from,
      payload: { ...loreWardenRemap, to: scholasticPayload.upstreamKey },
    },
  ],
  [
    'provenance with an unknown source',
    {
      kind: 'definition' as const,
      key: 'everythingpath/fighter-lore-warden-expertise',
      payload: {
        ...scholasticPayload,
        externalKey: 'everythingpath/fighter-lore-warden-expertise',
        provenance: { name: { source: 'aon', locator: scholasticLocator } },
      },
    },
  ],
])('a batch with %s writes nothing', async (_, invalid) => {
  const t = convexTest(schema, modules);
  const candidate = await stageRows(t, [
    {
      kind: 'definition',
      key: scholasticPayload.externalKey,
      payload: scholasticPayload,
    },
    invalid,
  ]);
  await expect(
    t.mutation(writeBatchBoundary, {
      releaseNumber: 1,
      batchIndex: 0,
      rows: candidate.batches[0],
    }),
  ).rejects.toThrow();
  expect(
    await t.query(internal.catalogRelease.inspect, { releaseNumber: 1 }),
  ).toMatchObject({ stagedRows: 0, nextBatchIndex: 0 });
  expect(await readRows(t, 'definition')).toEqual([]);
});

test.each(['outstandingNotices', 'retainedRequiredNotices'])(
  'finalization rejects an explicit null %s in the holds certificate',
  async (field) => {
    const t = convexTest(schema, modules);
    const initial = await artifact();
    const rows: ReleaseRow[] = initial.rows.map((row) =>
      row.kind === 'report' && row.key === 'holds'
        ? { ...row, payload: { gatePassed: true, [field]: null } }
        : row,
    );
    const candidate = await buildCatalogRelease({
      releaseNumber: 1,
      compatibility: catalogRuntimeCompatibility,
      inputs: initial.manifest.inputs,
      rows,
    });
    await t.mutation(beginBoundary, { manifest: candidate.manifest });
    for (const [batchIndex, rows] of candidate.batches.entries())
      await t.mutation(writeBatchBoundary, {
        releaseNumber: 1,
        batchIndex,
        rows,
      });
    await expect(
      t.mutation(internal.catalogRelease.finalize, { releaseNumber: 1 }),
    ).rejects.toThrow();
    expect(
      await t.query(internal.catalogRelease.inspect, { releaseNumber: 1 }),
    ).toMatchObject({ state: 'preparing', stagedRows: 10 });
  },
);

function adapter(t: ReturnType<typeof convexTest>) {
  return {
    begin: (args: { manifest: unknown }) => t.mutation(beginBoundary, args),
    writeBatch: (args: {
      releaseNumber: number;
      batchIndex: number;
      rows: ReleaseRow[];
    }) => t.mutation(writeBatchBoundary, args),
    finalize: (args: { releaseNumber: number }) =>
      t.mutation(internal.catalogRelease.finalize, args),
    inspect: (args: { releaseNumber: number }) =>
      t.query(internal.catalogRelease.inspect, args),
  };
}

async function activeSheetFixture() {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const seeded = await owner.run((ctx) => seedAcceptedCampaign(ctx));
  const campaignId = seeded.key.campaignId;
  for (const [baseRevision, edit] of initializationEdits(
    'patrol',
    seeded.characterId,
  ).entries()) {
    await owner.mutation(api.canonicalDraftPersistence.edit, {
      campaignId,
      militiaId: seeded.key.militiaId,
      operation: {
        draftId: seeded.key.draftId,
        operationId: `history-input:${baseRevision}`,
        baseRevision,
        edit,
      },
    });
  }
  const preview = await owner.query(
    api.canonicalDraftPersistence.preview,
    seeded.key,
  );
  if (preview.status !== 'ready')
    throw new Error('History fixture is not ready');
  await owner.mutation(api.canonicalDraftPersistence.confirm, {
    ...seeded.key,
    operation: { operationId: 'history-confirm', reviewed: preview.reviewed },
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const draft = await owner.query(api.canonicalDraftPersistence.workspace, {
    campaignId,
  });
  if (!draft) throw new Error('New weekly workspace is missing');
  await owner.mutation(api.canonicalDraftPersistence.edit, {
    campaignId,
    militiaId: seeded.key.militiaId,
    operation: {
      draftId: draft.key.draftId,
      operationId: 'saved-next-week-input',
      baseRevision: 0,
      edit: { kind: 'upkeep_roll', field: 'check', roll: roll(20, 17) },
    },
  });
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, {
      e2eFixture: {
        namespace: 'release',
        version: 1,
        workerKey: '0',
        caseKey: 'release',
        campaignKey: 'release',
      },
    }),
  );
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Release witness',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { organizationId: 'org', characterId };
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const fighter = sheet?.catalogEntries.find(
    (entry) => entry.name === 'Fighter',
  );
  const level = sheet?.entries.find((entry) => entry.kind === 'classLevel');
  if (!fighter || !level) throw new Error('Representative class is missing');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: fighter._id,
    hpGained: 10,
    operationId: 'fighter',
  });
  return { t, owner, scope, seeded };
}

test('real operator commands isolate halfway batch failures and retries from active sheets and ordinary edits', async () => {
  const { t, owner, scope, seeded } = await activeSheetFixture();
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const historyBefore = await owner.query(api.canonicalHistory.read, {
    campaignId: seeded.key.campaignId,
    week: 9,
  });
  expect(historyBefore).not.toBeNull();
  const workspaceBefore = await owner.query(
    api.canonicalDraftPersistence.workspace,
    { campaignId: seeded.key.campaignId },
  );
  if (!workspaceBefore) throw new Error('Saved weekly workspace is missing');
  const draftBefore = await owner.query(
    api.canonicalDraftPersistence.observe,
    workspaceBefore.key,
  );
  expect(draftBefore.draft?.upkeep.rolls.check?.diceTotal).toBe(17);
  const initial = await artifact();
  const inputs = initial.manifest.inputs;
  const rows: ReleaseRow[] = [
    ...initial.rows,
    ...Array.from({ length: 201 }, (_, index) => ({
      kind: 'definition' as const,
      key: `candidate:${index}`,
      payload: {
        ...definitionPayload('Candidate', `candidate:${index}`),
        modifiers: [
          { target: 'ability.str', bonusType: 'untyped', value: 100 },
        ],
      },
    })),
  ];
  const candidate = await buildCatalogRelease({
    releaseNumber: 1,
    compatibility: catalogRuntimeCompatibility,
    inputs,
    rows,
  });
  const commands = adapter(t);
  let injected = false;
  await expect(
    runCatalogReleaseCommand({
      command: { kind: 'prepare', artifact: candidate },
      adapter: {
        ...commands,
        writeBatch: async (args) => {
          if (args.batchIndex === 1 && !injected) {
            injected = true;
            return commands.writeBatch({
              ...args,
              rows: [
                ...args.rows.slice(0, -1),
                {
                  kind: 'definition',
                  key: 'uncommitted',
                  payload: definitionPayload('Uncommitted'),
                },
              ],
            });
          }
          return commands.writeBatch(args);
        },
      },
    }),
  ).rejects.toThrow('immutable output');
  expect(await commands.inspect({ releaseNumber: 1 })).toMatchObject({
    state: 'preparing',
    nextBatchIndex: 1,
    stagedRows: 100,
  });
  await expect(commands.finalize({ releaseNumber: 1 })).rejects.toThrow(
    'incomplete',
  );
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
  expect(
    await owner.query(api.canonicalDraftPersistence.workspace, {
      campaignId: seeded.key.campaignId,
    }),
  ).toEqual(workspaceBefore);
  expect(
    await owner.query(
      api.canonicalDraftPersistence.observe,
      workspaceBefore.key,
    ),
  ).toEqual(draftBefore);
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 14 },
    operationId: 'during-prepare',
  });
  const edited = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(edited?.calculated.abilities.strength.score).toBe(14);
  const workspaceEdited = await owner.query(
    api.canonicalDraftPersistence.workspace,
    { campaignId: seeded.key.campaignId },
  );
  expect(
    await runCatalogReleaseCommand({
      command: { kind: 'prepare', artifact: candidate },
      adapter: commands,
    }),
  ).toMatchObject({ state: 'prepared', stagedRows: 211 });
  expect(
    await runCatalogReleaseCommand({
      command: { kind: 'prepare', artifact: candidate },
      adapter: commands,
    }),
  ).toMatchObject({ state: 'prepared', stagedRows: 211 });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(edited);
  expect(
    await owner.query(api.canonicalDraftPersistence.workspace, {
      campaignId: seeded.key.campaignId,
    }),
  ).toEqual(workspaceEdited);
  expect(
    await owner.query(api.canonicalHistory.read, {
      campaignId: seeded.key.campaignId,
      week: 9,
    }),
  ).toEqual(historyBefore);
  expect(
    await owner.query(
      api.canonicalDraftPersistence.observe,
      workspaceBefore.key,
    ),
  ).toEqual(draftBefore);
  const report = await t.query(internal.catalogRelease.inspectRows, {
    releaseNumber: 1,
    kind: 'report',
    paginationOpts: {
      cursor: null,
      numItems: 10,
      maximumRowsRead: 10,
      maximumBytesRead: 512000,
    },
  });
  expect(report.page.map((row) => row.key).sort()).toEqual([
    'content',
    'curation',
    'holds',
    'resources',
    'retirement',
  ]);
  expect(
    edited?.catalogEntries.some((row) =>
      row.ruleIdentity.startsWith('candidate:'),
    ),
  ).toBe(false);
});

test('a release must name the authoritative immutable comparison base', async () => {
  const t = convexTest(schema, modules);
  const first = await artifact();
  await runCatalogReleaseCommand({
    command: {
      kind: 'prepare',
      artifact: { manifest: first.manifest, batches: [first.rows] },
    },
    adapter: adapter(t),
  });
  // Simulates the boundary a later activation command will select; this ticket has no activation writer.
  await t.run((ctx) =>
    ctx.db.insert('catalogReleaseControl', {
      key: 'global',
      releaseNumber: 1,
      schemaIdentity: catalogRuntimeCompatibility.schema,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
    }),
  );
  const second = await artifact(2);
  await expect(
    t.mutation(beginBoundary, { manifest: second.manifest }),
  ).rejects.toThrow('comparison base');
});

test('numbers bind every input, output, compatibility and comparison identity while newer preparations fence old workers', async () => {
  const t = convexTest(schema, modules);
  const first = await artifact();
  await t.mutation(beginBoundary, { manifest: first.manifest });
  for (const category of Object.keys(first.manifest.inputs)) {
    const inputs = { ...first.manifest.inputs, [category]: 'b'.repeat(64) };
    const { artifactFingerprint: _, ...body } = first.manifest;
    const changed = {
      ...body,
      inputs,
      inputFingerprint: await releaseFingerprint({
        inputs,
        compatibility: body.compatibility,
        baseRelease: null,
      }),
    };
    await expect(
      t.mutation(beginBoundary, {
        manifest: {
          ...changed,
          artifactFingerprint: await releaseFingerprint(changed),
        },
      }),
    ).rejects.toThrow('different inputs or output');
  }
  await expect(
    t.mutation(writeBatchBoundary, {
      releaseNumber: 1,
      batchIndex: 0,
      rows: [
        ...first.rows,
        {
          kind: 'remap',
          key: 'not-committed',
          payload: {
            from: 'pf1/Old',
            to: 'pf1/New',
            kind: 'feat',
            reason: 'Move',
            evidence: 'Reviewed',
            reviewedBy: 'Reviewer',
            reviewedOn: '2026-10-03',
            applied: true,
          },
        },
      ],
    }),
  ).rejects.toThrow('immutable output');
  const second = await artifact(2);
  await t.mutation(beginBoundary, {
    manifest: second.manifest,
  });
  await expect(
    t.mutation(writeBatchBoundary, {
      releaseNumber: 1,
      batchIndex: 0,
      rows: first.rows,
    }),
  ).rejects.toThrow('superseded');
  await expect(
    t.mutation(internal.catalogRelease.finalize, { releaseNumber: 1 }),
  ).rejects.toThrow('superseded');
  expect(
    await t.query(internal.catalogRelease.readiness, {
      releaseNumber: 1,
      schemaIdentity: catalogRuntimeCompatibility.schema,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
    }),
  ).toMatchObject({
    isCandidateCurrent: false,
    isPrepared: false,
    isActivationImplemented: true,
  });
});

test('invalid batches and incomplete finalization commit nothing; corrected immutable batches resume', async () => {
  const t = convexTest(schema, modules);
  const first = await artifact();
  await t.mutation(beginBoundary, { manifest: first.manifest });
  for (const rows of [
    Array.from({ length: 101 }, (_, index) => ({
      kind: 'definition',
      key: `${index}`,
      payload: {},
    })),
    [{ kind: 'definition', key: 'large', payload: 'x'.repeat(512001) }],
  ])
    await expect(
      t.mutation(writeBatchBoundary, {
        releaseNumber: 1,
        batchIndex: 0,
        rows,
      }),
    ).rejects.toThrow();
  await expect(
    t.mutation(internal.catalogRelease.finalize, { releaseNumber: 1 }),
  ).rejects.toThrow('incomplete');
  expect(
    await t.query(internal.catalogRelease.inspect, { releaseNumber: 1 }),
  ).toMatchObject({ nextBatchIndex: 0, stagedRows: 0 });
  await runCatalogReleaseCommand({
    command: {
      kind: 'prepare',
      artifact: { manifest: first.manifest, batches: [first.rows] },
    },
    adapter: adapter(t),
  });
  await expect(
    t.mutation(writeBatchBoundary, {
      releaseNumber: 1,
      batchIndex: 0,
      rows: first.rows.slice(1),
    }),
  ).rejects.toThrow('immutable output');
  expect(
    await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 1 }),
  ).toMatchObject({ state: 'prepared' });
});

test('failed report gates and missing summaries cannot certify a release', async () => {
  const t = convexTest(schema, modules);
  const first = await artifact();
  const failed = await buildCatalogRelease({
    releaseNumber: 1,
    compatibility: catalogRuntimeCompatibility,
    inputs: first.manifest.inputs,
    rows: first.rows.map((row) =>
      row.kind === 'report' && row.key === 'content'
        ? { ...row, payload: { gatePassed: false, coverageComplete: true } }
        : row,
    ),
  });
  await t.mutation(beginBoundary, {
    manifest: failed.manifest,
  });
  await expect(
    t.mutation(writeBatchBoundary, {
      releaseNumber: 1,
      batchIndex: 0,
      rows: failed.batches[0],
    }),
  ).rejects.toThrow('gate did not pass');
  expect(
    await t.query(internal.catalogRelease.inspect, { releaseNumber: 1 }),
  ).toMatchObject({ nextBatchIndex: 0, stagedRows: 0 });
  const incomplete = await buildCatalogRelease({
    releaseNumber: 2,
    compatibility: catalogRuntimeCompatibility,
    inputs: first.manifest.inputs,
    rows: first.rows.filter((row) => row.key !== 'curation'),
  });
  await t.mutation(beginBoundary, {
    manifest: incomplete.manifest,
  });
  await t.mutation(writeBatchBoundary, {
    releaseNumber: 2,
    batchIndex: 0,
    rows: incomplete.batches[0],
  });
  await expect(
    t.mutation(internal.catalogRelease.finalize, { releaseNumber: 2 }),
  ).rejects.toThrow('reports or legal inputs');
  const corrected = await artifact(3);
  expect(
    await runCatalogReleaseCommand({
      command: {
        kind: 'prepare',
        artifact: { manifest: corrected.manifest, batches: [corrected.rows] },
      },
      adapter: adapter(t),
    }),
  ).toMatchObject({ state: 'prepared' });
});

test.each(['schema', 'calculation'] as const)(
  'candidate %s incompatibility does not reinterpret active sheets, and unavailable active behavior fails closed',
  async (identity) => {
    const { t, owner, scope } = await activeSheetFixture();
    const before = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const first = await artifact();
    const future = await buildCatalogRelease({
      releaseNumber: 1,
      compatibility: { ...catalogRuntimeCompatibility, [identity]: 'future' },
      inputs: first.manifest.inputs,
      rows: first.rows,
    });
    await runCatalogReleaseCommand({
      command: { kind: 'prepare', artifact: future },
      adapter: adapter(t),
    });
    expect(
      await t.query(internal.catalogRelease.readiness, {
        releaseNumber: 1,
        schemaIdentity: catalogRuntimeCompatibility.schema,
        calculationIdentity: catalogRuntimeCompatibility.calculation,
      }),
    ).toMatchObject({
      isPrepared: true,
      isCompatible: false,
      isActivationImplemented: true,
    });
    expect(
      withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
    ).toEqual(before);
    const control = await t.run((ctx) =>
      ctx.db.insert('catalogReleaseControl', {
        key: 'global',
        releaseNumber: 1,
        schemaIdentity:
          identity === 'schema' ? 'future' : catalogRuntimeCompatibility.schema,
        calculationIdentity:
          identity === 'calculation'
            ? 'future'
            : catalogRuntimeCompatibility.calculation,
      }),
    );
    await expect(owner.query(api.characterSheet.read, scope)).rejects.toThrow(
      'unavailable schema or calculation',
    );
    await expect(
      owner.mutation(api.characterSheet.editBaseScores, {
        ...scope,
        scores: { strength: 30 },
        operationId: 'incompatible',
      }),
    ).rejects.toThrow('unavailable schema or calculation');
    await t.run((ctx) => ctx.db.delete('catalogReleaseControl', control));
    expect(
      withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
    ).toEqual(before);
  },
);

test('every release writer participates in maintenance and stale Write Epoch fencing', async () => {
  const t = convexTest(schema, modules);
  const first = await artifact();
  await t.mutation(beginBoundary, { manifest: first.manifest });
  const run = await t.mutation(internal.initialMigration.start, {
    operationId: 'release-gate',
    expectedEpoch: 0,
    frontendBuild: 'build',
    catalogManifest: 'manifest',
    maintenanceBudgetMs: 60000,
  });
  await expect(
    t.mutation(beginBoundary, { manifest: first.manifest }),
  ).rejects.toThrow('MAINTENANCE');
  await expect(
    t.mutation(writeBatchBoundary, {
      releaseNumber: 1,
      batchIndex: 0,
      rows: first.rows,
    }),
  ).rejects.toThrow('MAINTENANCE');
  await expect(
    t.mutation(internal.catalogRelease.finalize, { releaseNumber: 1 }),
  ).rejects.toThrow('MAINTENANCE');
  expect(
    await t.query(internal.catalogRelease.inspect, { releaseNumber: 1 }),
  ).toMatchObject({ nextBatchIndex: 0 });
  await t.mutation(internal.initialMigration.abortBeforeActivation, {
    runId: run.runId,
    epoch: run.epoch,
  });
  await expect(
    t.mutation(writeBatchBoundary, {
      releaseNumber: 1,
      batchIndex: 0,
      rows: first.rows,
    }),
  ).rejects.toThrow('RELOAD_REQUIRED');
  await t.mutation(writeBatchBoundary, {
    releaseNumber: 1,
    batchIndex: 0,
    rows: first.rows,
    writeEpoch: 2,
  });
  expect(
    await t.mutation(internal.catalogRelease.finalize, {
      releaseNumber: 1,
      writeEpoch: 2,
    }),
  ).toMatchObject({ state: 'prepared' });
});

test('finalization rejects truncated published notices and missing notices unrelated to a retained exception', async () => {
  const t = convexTest(schema, modules);
  const first = await artifact();
  const truncated = await buildCatalogRelease({
    releaseNumber: 1,
    compatibility: catalogRuntimeCompatibility,
    inputs: first.manifest.inputs,
    rows: first.rows.map((row) =>
      row.kind === 'legal' && row.key === 'permanentNoticeSuperset'
        ? { ...row, payload: [] }
        : row,
    ),
  });
  const commands = adapter(t);
  await commands.begin({ manifest: truncated.manifest });
  await commands.writeBatch({
    releaseNumber: 1,
    batchIndex: 0,
    rows: truncated.batches.flat(),
  });
  await expect(commands.finalize({ releaseNumber: 1 })).rejects.toThrow(
    'omits required published notices',
  );
  const outstanding = [
    { code: 'MISSING', title: 'MISSING', reason: 'missing' },
  ];
  const missingRows: ReleaseRow[] = first.rows.map((row) =>
    row.kind === 'legal' && row.key === 'requiredNotices'
      ? { ...row, payload: ['MISSING'] }
      : row.kind === 'report' && row.key === 'holds'
        ? {
            ...row,
            payload: {
              gatePassed: true,
              retainedExceptions: 1,
              retainedRequiredNotices: ['OTHER'],
              outstandingNotices: outstanding,
            },
          }
        : row,
  );
  const unrelated = await buildCatalogRelease({
    releaseNumber: 2,
    compatibility: catalogRuntimeCompatibility,
    inputs: first.manifest.inputs,
    rows: missingRows,
  });
  await commands.begin({ manifest: unrelated.manifest });
  await commands.writeBatch({
    releaseNumber: 2,
    batchIndex: 0,
    rows: unrelated.batches.flat(),
  });
  await expect(commands.finalize({ releaseNumber: 2 })).rejects.toThrow(
    'not reported retained exceptions',
  );
  const retained = await buildCatalogRelease({
    releaseNumber: 3,
    compatibility: catalogRuntimeCompatibility,
    inputs: first.manifest.inputs,
    rows: missingRows.map((row) =>
      row.kind === 'report' && row.key === 'holds'
        ? {
            ...row,
            payload: {
              gatePassed: true,
              retainedExceptions: 1,
              retainedRequiredNotices: ['MISSING'],
              outstandingNotices: outstanding,
            },
          }
        : row,
    ),
  });
  expect(
    await runCatalogReleaseCommand({
      command: { kind: 'prepare', artifact: retained },
      adapter: commands,
    }),
  ).toMatchObject({ state: 'prepared' });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});

test('active notice versions remain public and cannot be dropped by a privately prepared successor', async () => {
  const t = convexTest(schema, modules);
  const first = await artifact();
  const archivedNotice = {
    id: 'previous-book',
    title: 'Previous book',
    text: 'Retained copyright version',
    provenance: ['reviewed record'],
  };
  const withPrior = await buildCatalogRelease({
    releaseNumber: 1,
    compatibility: catalogRuntimeCompatibility,
    inputs: first.manifest.inputs,
    rows: first.rows.map((row) =>
      row.kind === 'legal' &&
      row.key === 'permanentNoticeSuperset' &&
      Array.isArray(row.payload)
        ? { ...row, payload: [...row.payload, archivedNotice] }
        : row,
    ),
  });
  await runCatalogReleaseCommand({
    command: { kind: 'prepare', artifact: withPrior },
    adapter: adapter(t),
  });
  await t.run((ctx) =>
    ctx.db.insert('catalogReleaseControl', {
      key: 'global',
      releaseNumber: 1,
      schemaIdentity: catalogRuntimeCompatibility.schema,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
    }),
  );
  const published = await t.query(api.catalogRelease.legalInputs, {});
  expect(published?.permanentNoticeSuperset).toContainEqual(archivedNotice);
  const dropped = await buildCatalogRelease({
    releaseNumber: 2,
    baseRelease: {
      releaseNumber: 1,
      artifactFingerprint: withPrior.manifest.artifactFingerprint,
    },
    compatibility: catalogRuntimeCompatibility,
    inputs: first.manifest.inputs,
    rows: first.rows,
  });
  await t.mutation(beginBoundary, {
    manifest: dropped.manifest,
  });
  await t.mutation(writeBatchBoundary, {
    releaseNumber: 2,
    batchIndex: 0,
    rows: dropped.batches[0],
  });
  await expect(
    t.mutation(internal.catalogRelease.finalize, { releaseNumber: 2 }),
  ).rejects.toThrow('cannot shrink');
  expect(await t.query(api.catalogRelease.legalInputs, {})).toEqual(published);
  await t.run(async (ctx) => {
    const base = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    if (!base) throw new Error('Missing comparison base');
    await ctx.db.patch('catalogRelease', base._id, {
      manifest: { ...withPrior.manifest, artifactFingerprint: 'b'.repeat(64) },
    });
  });
  expect(
    await t.query(internal.catalogRelease.readiness, {
      releaseNumber: 2,
      schemaIdentity: catalogRuntimeCompatibility.schema,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
    }),
  ).toMatchObject({ isBaseCurrent: false });
  await expect(
    t.mutation(internal.catalogRelease.finalize, { releaseNumber: 2 }),
  ).rejects.toThrow('comparison base');
});

test('a resource cannot reuse a definition identity from an earlier committed batch', async () => {
  const t = convexTest(schema, modules);
  const first = await artifact();
  const collisionRows: ReleaseRow[] = [
    {
      kind: 'resource',
      key: 'resource:new',
      payload: { name: 'Valid preceding row' },
    },
    {
      kind: 'resource',
      key: 'feat:future',
      payload: { name: 'Colliding resource' },
    },
  ];
  const batches = [
    ...first.manifest.batches,
    {
      fingerprint: await releaseFingerprint(collisionRows),
      rowCount: collisionRows.length,
      byteCount: releaseByteCount(collisionRows),
    },
  ];
  const { artifactFingerprint: _, ...original } = first.manifest;
  const body = {
    ...original,
    batches,
    outputFingerprint: await releaseFingerprint(batches),
  };
  const manifest = {
    ...body,
    artifactFingerprint: await releaseFingerprint(body),
  };
  await t.mutation(beginBoundary, { manifest });
  await t.mutation(writeBatchBoundary, {
    releaseNumber: 1,
    batchIndex: 0,
    rows: first.rows,
  });
  await expect(
    t.mutation(writeBatchBoundary, {
      releaseNumber: 1,
      batchIndex: 1,
      rows: collisionRows,
    }),
  ).rejects.toThrow('Catalog Release identity');
  expect(
    await t.query(internal.catalogRelease.inspect, { releaseNumber: 1 }),
  ).toMatchObject({ nextBatchIndex: 1, stagedRows: 10 });
  const resources = await t.query(internal.catalogRelease.inspectRows, {
    releaseNumber: 1,
    kind: 'resource',
    paginationOpts: {
      cursor: null,
      numItems: 10,
      maximumRowsRead: 10,
      maximumBytesRead: 512000,
    },
  });
  expect(resources.page).toEqual([]);
});
