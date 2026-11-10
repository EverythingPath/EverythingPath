// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { beforeAll, expect, test } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';

import { api, internal } from './_generated/api';
import schema from './schema';
import { buildCatalogRelease } from '../scripts/catalog/release';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';
import type { CatalogReleaseStatus } from '../src/lib/catalog/release-validators';
import resourcesData from '../src/lib/catalog/data/resources.json';
import { buildLegalPageData } from '../src/lib/catalog/legal-page-data';
import { legalResourcesSchema } from '../src/lib/catalog/legal-types';
import { parse } from 'convex-helpers/validators';
import { catalogReleaseRowValidator } from '../src/lib/catalog/release-validators';

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
const writeBatch = makeFunctionReference<
  'mutation',
  { releaseNumber: number; batchIndex: number; rows: unknown },
  CatalogReleaseStatus
>('catalogRelease:writeBatch');

function spell(name: string, level: number, key = 'release-spell') {
  return {
    externalKey: `pf1/${key}`,
    upstreamKey: key,
    pack: 'spells',
    name,
    detail: {
      kind: 'spell' as const,
      levels: { wizard: level },
      grantedLevels: {},
      school: 'evo',
      subschools: [],
      descriptors: [],
    },
    description: `${name} description`,
    sources: [{ book: 'PZO1110', pages: '1' }],
    modifiers: [],
    unsupported: [],
  };
}

async function seedLargeSpellOverlay(count: number, hasLegacyIndexes = false) {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    await ctx.db.insert('user', {
      tokenIdentifier: 'owner',
      orgIds: [{ orgId: 'org', role: 'member' }],
    });
    return ctx.db.insert('campaign', {
      name: 'Bounded browser',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
      e2eFixture: {
        namespace: 'browser-budget',
        version: 1,
        workerKey: '0',
        caseKey: 'budget',
        campaignKey: 'budget',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'owner' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Wizard',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const wizard = initial?.catalogEntries.find((row) => row.name === 'Wizard');
  const level = initial?.entries.find((row) => row.kind === 'classLevel');
  if (!wizard || !level) throw new Error('Missing Wizard');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: wizard._id,
    operationId: 'wizard',
  });
  const definitions = Array.from({ length: count }, (_, index) =>
    spell(`Large original ${index}`, 9, `budget-spell-${index}`),
  );
  const artifact = await buildCatalogRelease({
    releaseNumber: 1,
    baseRelease: null,
    compatibility: catalogRuntimeCompatibility,
    inputs: {
      upstream: {},
      remaps: {},
      curation: {},
      localData: {},
      parsers: {},
      sanitizers: {},
      ruleResources: {},
      legal: {},
      attribution: {},
    },
    rows: definitions.map((definition) => ({
      kind: 'definition',
      key: definition.externalKey,
      payload: definition,
    })),
  });
  // Seed the selected reader state; activation is covered independently above.
  await t.run(async (ctx) => {
    const releaseId = await ctx.db.insert('catalogRelease', {
      releaseNumber: 1,
      baseReleaseNumber: null,
      state: 'prepared',
      manifest: artifact.manifest,
      nextBatchIndex: artifact.batches.length,
      batchCount: artifact.batches.length,
      stagedRows: count,
      reportCategories: [],
      legalKeys: [],
    });
    await ctx.db.insert('catalogReleaseControl', {
      key: 'global',
      releaseNumber: 1,
      releaseId,
      schemaIdentity: catalogRuntimeCompatibility.schema,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
      isFixtureOnly: true,
    });
    for (const [batchIndex, batch] of artifact.batches.entries())
      for (const row of batch)
        await ctx.db.insert('catalogReleaseRow', {
          ...parse(catalogReleaseRowValidator, row),
          releaseId,
          batchIndex,
        });
    for (const definition of definitions) {
      const catalogEntryId = await ctx.db.insert('catalogEntry', {
        scope: 'global',
        name: definition.name,
        ruleIdentity: definition.externalKey,
        sources: definition.sources,
        modifiers: [],
        stacksWithItself: false,
        detail: {
          kind: 'spell',
          levels: { wizard: 9 },
          school: 'evo',
          description: 'x'.repeat(64_000),
        },
      });
      await ctx.db.insert('spellCatalogIndex', {
        characterId,
        castingClassId: wizard._id,
        catalogEntryId,
        ...(hasLegacyIndexes ? {} : { ruleIdentity: definition.externalKey }),
        name: definition.name,
        level: 9,
        school: 'evo',
        levels: { wizard: 9 },
        available: true,
        recorded: false,
      });
      await ctx.db.insert('catalogReleaseSpellIndex', {
        releaseId,
        ruleIdentity: definition.externalKey,
        classTag: '*',
        level: null,
        name: definition.name,
        school: 'evo',
        levels: { wizard: 9 },
        isSelectable: true,
      });
    }
  });
  return { owner, filters: { ...scope, castingClassId: wizard._id } };
}

test.each([false, true])(
  'an empty one-item browse page accounts every overlay original before hydration (legacy indexes: %s)',
  async (hasLegacyIndexes) => {
    const { owner, filters } = await seedLargeSpellOverlay(8, hasLegacyIndexes);
    await expect(
      owner.query(api.characterSheetSpells.browse, {
        ...filters,
        spellLevel: 1,
        paginationOpts: { cursor: null, numItems: 1 },
      }),
    ).rejects.toThrow('Spell browser page exceeds its read resource limit');
  },
);

test('browser metadata bounds all overlay original bodies even when each changed Spell metadata row is small', async () => {
  const { owner, filters } = await seedLargeSpellOverlay(17);
  await expect(
    owner.query(api.characterSheetSpells.browserInfo, filters),
  ).rejects.toThrow(
    'Selected Spell browser metadata exceeds its read resource limit',
  );
});

test('activation moves a Spell between browser levels and names while preserving a local copy and access checks', async () => {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const person of ['owner', 'outsider'])
      await ctx.db.insert('user', {
        tokenIdentifier: person,
        orgIds: [
          { orgId: person === 'owner' ? 'org' : 'other', role: 'member' },
        ],
      });
    return ctx.db.insert('campaign', {
      name: 'Browser release',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
      e2eFixture: {
        namespace: 'browser',
        version: 1,
        workerKey: '0',
        caseKey: 'browser',
        campaignKey: 'browser',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'owner' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Wizard',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const wizard = initial?.catalogEntries.find((row) => row.name === 'Wizard');
  const level = initial?.entries.find((row) => row.kind === 'classLevel');
  if (!wizard || !level) throw new Error('Missing Wizard');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: wizard._id,
    operationId: 'wizard',
  });
  const [spellId, copySourceId] = await owner.mutation(
    internal.characterSheetSpells.installPreparedCatalog,
    {
      ...scope,
      spells: [
        spell('Old release spell', 1),
        spell('Independent copy', 1, 'copy-spell'),
      ],
      operationId: 'install',
    },
  );
  if (!spellId || !copySourceId) throw new Error('Missing Spell');
  const filters = { ...scope, castingClassId: wizard._id };
  const copyEntryId = await owner.mutation(api.characterSheetSpells.record, {
    ...filters,
    catalogEntryId: copySourceId,
    operationId: 'record-copy',
  });
  await owner.mutation(api.catalogCopies.saveToCatalog, {
    ...scope,
    catalogEntryId: copySourceId,
    operationId: 'share-copy',
  });
  const copyId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId: copyEntryId },
    operationId: 'detach-copy',
  });
  await t.run(async (ctx) => {
    const rows = await ctx.db
      .query('spellCatalogIndex')
      .withIndex('by_characterId_and_catalogEntryId', (q) =>
        q.eq('characterId', characterId).eq('catalogEntryId', spellId),
      )
      .take(65);
    for (const row of rows)
      await ctx.db.patch('spellCatalogIndex', row._id, {
        ruleIdentity: undefined,
      });
  });
  const notices = buildLegalPageData({
    registry: {},
    resources: legalResourcesSchema.parse(resourcesData),
    requiredNotices: [],
    permanentNoticeSuperset: [],
  }).permanentNoticeSuperset;
  const artifact = await buildCatalogRelease({
    releaseNumber: 1,
    baseRelease: null,
    compatibility: catalogRuntimeCompatibility,
    inputs: {
      upstream: {},
      remaps: {},
      curation: {},
      localData: {},
      parsers: {},
      sanitizers: {},
      ruleResources: {},
      legal: {},
      attribution: {},
    },
    rows: [
      {
        kind: 'definition',
        key: 'pf1/release-spell',
        payload: spell('New release spell', 4),
      },
      {
        kind: 'definition',
        key: 'pf1/copy-spell',
        payload: spell('Changed origin', 4, 'copy-spell'),
      },
      ...['content', 'resources', 'holds', 'retirement', 'curation'].map(
        (key) => ({
          kind: 'report' as const,
          key,
          payload: { gatePassed: true, coverageComplete: true, passed: true },
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
                ? notices
                : [],
      })),
    ],
  });
  await t.mutation(internal.catalogRelease.begin, {
    manifest: artifact.manifest,
  });
  for (const [batchIndex, rows] of artifact.batches.entries())
    await t.mutation(writeBatch, { releaseNumber: 1, batchIndex, rows });
  await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 1 });
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...filters,
        spellLevel: 1,
        paginationOpts: { cursor: null, numItems: 25 },
      })
    ).page,
  ).toContainEqual(expect.objectContaining({ name: 'Old release spell' }));
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  for (let step = 0; step < 100; step++)
    if (await t.mutation(internal.catalogReleaseImpact.discover, { runId }))
      break;
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId,
  });
  await t.mutation(internal.catalogReleaseImpact.complete, {
    runId,
    characterId,
    evaluation,
  });
  await t.mutation(internal.catalogReleaseImpact.finish, { runId });
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...filters,
        spellLevel: 1,
        paginationOpts: { cursor: null, numItems: 25 },
      })
    ).page,
  ).toContainEqual(expect.objectContaining({ name: 'Old release spell' }));
  await t.mutation(internal.catalogReleaseActivation.activate, {
    releaseNumber: 1,
    runId,
    activationId: 'browser-activation',
    schemaIdentity: catalogRuntimeCompatibility.schema,
    calculationIdentity: catalogRuntimeCompatibility.calculation,
    isFixtureOnly: true,
  });
  expect(
    await owner.query(api.characterSheetSpells.browserInfo, filters),
  ).toMatchObject({ levels: expect.arrayContaining([4]) });
  const page = await owner.query(api.characterSheetSpells.browse, {
    ...filters,
    spellLevel: 4,
    paginationOpts: { cursor: null, numItems: 25 },
  });
  expect(page.page).toContainEqual(
    expect.objectContaining({
      catalogEntryId: spellId,
      name: 'New release spell',
      spellLevel: 4,
    }),
  );
  expect(
    await owner.query(api.characterSheetSpells.browse, {
      ...filters,
      spellLevel: 4,
      paginationOpts: { cursor: null, numItems: 25 },
    }),
  ).toEqual(page);
  // A later release keeps the selected Spell metadata even when its body is unchanged.
  const laterArtifact = await buildCatalogRelease({
    releaseNumber: 2,
    baseRelease: {
      releaseNumber: 1,
      artifactFingerprint: artifact.manifest.artifactFingerprint,
    },
    compatibility: catalogRuntimeCompatibility,
    inputs: artifact.manifest.inputs,
    rows: artifact.batches.flat(),
  });
  await t.mutation(internal.catalogRelease.begin, {
    manifest: laterArtifact.manifest,
  });
  for (const [batchIndex, rows] of laterArtifact.batches.entries())
    await t.mutation(writeBatch, { releaseNumber: 2, batchIndex, rows });
  await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 2 });
  const laterRun = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 2,
  });
  for (let step = 0; step < 100; step++)
    if (
      await t.mutation(internal.catalogReleaseImpact.discover, {
        runId: laterRun,
      })
    )
      break;
  const laterEvaluation = await t.query(
    internal.catalogReleaseImpact.evaluate,
    { runId: laterRun, characterId },
  );
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId: laterRun,
      characterId,
      evaluation: laterEvaluation,
    }),
  ).toBe(true);
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId: laterRun }),
  ).toBe(true);
  await t.mutation(internal.catalogReleaseActivation.activate, {
    releaseNumber: 2,
    runId: laterRun,
    activationId: 'browser-later',
    schemaIdentity: catalogRuntimeCompatibility.schema,
    calculationIdentity: catalogRuntimeCompatibility.calculation,
    isFixtureOnly: true,
  });
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...filters,
        spellLevel: 4,
        paginationOpts: { cursor: null, numItems: 25 },
      })
    ).page,
  ).toContainEqual(
    expect.objectContaining({
      catalogEntryId: spellId,
      name: 'New release spell',
      spellLevel: 4,
    }),
  );
  const recordedId = await owner.mutation(api.characterSheetSpells.record, {
    ...filters,
    catalogEntryId: spellId,
    operationId: 'record-after-activation',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.find((entry) => entry._id === recordedId),
  ).toMatchObject({ state: { kind: 'spell', level: 4 } });
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...filters,
        search: 'New release',
        paginationOpts: { cursor: null, numItems: 25 },
      })
    ).page,
  ).toContainEqual(expect.objectContaining({ name: 'New release spell' }));
  const oldLevel = await owner.query(api.characterSheetSpells.browse, {
    ...filters,
    spellLevel: 1,
    paginationOpts: { cursor: null, numItems: 25 },
  });
  expect(oldLevel.page).toContainEqual(
    expect.objectContaining({
      catalogEntryId: copyId,
      name: 'Independent copy',
      spellLevel: 1,
    }),
  );
  expect(oldLevel.page.some((row) => row.catalogEntryId === spellId)).toBe(
    false,
  );
  expect(
    await owner.query(api.characterSheetSpells.browserInfo, {
      ...filters,
      catalogReleaseNumber: null,
    }),
  ).toEqual({
    levels: [],
    schools: [],
    defaultLevel: 0,
    catalogReleaseNumber: 2,
  });
  await expect(
    t
      .withIdentity({ tokenIdentifier: 'outsider' })
      .query(api.characterSheetSpells.browserInfo, filters),
  ).rejects.toThrow();
  await expect(
    t
      .withIdentity({ tokenIdentifier: 'outsider' })
      .query(api.characterSheetSpells.browse, {
        ...filters,
        paginationOpts: { cursor: null, numItems: 25 },
      }),
  ).rejects.toThrow();
  const largeArtifact = await buildCatalogRelease({
    releaseNumber: 3,
    baseRelease: {
      releaseNumber: 2,
      artifactFingerprint: laterArtifact.manifest.artifactFingerprint,
    },
    compatibility: catalogRuntimeCompatibility,
    inputs: laterArtifact.manifest.inputs,
    rows: laterArtifact.batches.flat().map((row) =>
      row.kind === 'definition' && row.key === 'pf1/release-spell'
        ? {
            ...row,
            payload: {
              ...spell('Large release spell', 4),
              description: 'x'.repeat(300_000),
            },
          }
        : row,
    ),
  });
  await t.mutation(internal.catalogRelease.begin, {
    manifest: largeArtifact.manifest,
  });
  for (const [batchIndex, rows] of largeArtifact.batches.entries())
    await t.mutation(writeBatch, { releaseNumber: 3, batchIndex, rows });
  await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 3 });
  const largeRun = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 3,
  });
  for (let step = 0; step < 100; step++)
    if (
      await t.mutation(internal.catalogReleaseImpact.discover, {
        runId: largeRun,
      })
    )
      break;
  const largeEvaluation = await t.query(
    internal.catalogReleaseImpact.evaluate,
    { runId: largeRun, characterId },
  );
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId: largeRun,
      characterId,
      evaluation: largeEvaluation,
    }),
  ).toBe(true);
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId: largeRun }),
  ).toBe(true);
  await t.mutation(internal.catalogReleaseActivation.activate, {
    releaseNumber: 3,
    runId: largeRun,
    activationId: 'browser-large',
    schemaIdentity: catalogRuntimeCompatibility.schema,
    calculationIdentity: catalogRuntimeCompatibility.calculation,
    isFixtureOnly: true,
  });
  await expect(
    owner.query(api.characterSheetSpells.browse, {
      ...filters,
      spellLevel: 4,
      paginationOpts: { cursor: null, numItems: 25 },
    }),
  ).rejects.toThrow('Spell browser page exceeds its read resource limit');
});
