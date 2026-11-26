// @vitest-environment edge-runtime
import { beforeAll, expect, test } from 'vitest';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  activationArgs,
  allocateReleaseIdentities,
  discover,
  impactAdapter,
  prepare,
  releaseFixture,
} from '../tests/catalog-release-fixture';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { runCatalogReleaseImpactCommand } from '../scripts/catalog/release-impact-command';
import { importedCatalogEntrySchema } from '../src/lib/catalog/imported-entry-schema';
import type { ReleaseJson, ReleaseRow } from '../src/lib/catalog/release-schema';
import { api, internal } from './_generated/api';
import schema from './schema';

// #784: release discovery accepts an imported companion, familiar or
// companion feature resource and refuses every other prepared resource it
// does not know. The sheet reads no such resource, so an accepted one is
// no impact reason and leaves every calculation as it was.

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));

/** A resource row as `catalog:release build` writes an imported one. */
function importedResource(
  externalKey: string,
  detail: Record<string, ReleaseJson>,
): ReleaseRow {
  return {
    kind: 'resource',
    key: externalKey,
    payload: {
      externalKey,
      upstreamKey: externalKey,
      pack: 'class-abilities',
      name: externalKey,
      detail,
      description: '<p>Fixture.</p>',
      sources: [{ book: 'Fixture book', pages: '1' }],
      modifiers: [],
      unsupported: [],
    },
  };
}

const companionFeature = importedResource('pf1/share-spells', {
  kind: 'companionFeature',
  tag: 'shareSpells',
  associations: [],
});
const companion = importedResource('pf1/wolf', {
  kind: 'companion',
  abilities: { str: 13, dex: 15 },
  size: 'med',
  creatureTypes: ['animal'],
});
const familiar = importedResource('pf1/cat', {
  kind: 'familiar',
  abilities: { str: 3, dex: 15 },
  size: 'tiny',
  creatureTypes: ['animal'],
});

const notImported: ReleaseRow = {
  kind: 'resource',
  key: 'pf1/tables',
  payload: { tables: [] },
};
const unknownBuiltin: ReleaseRow = {
  kind: 'resource',
  key: 'builtin:unknown',
  payload: { definitions: [] },
};
/** The `builtin:` namespace holds only the known built-ins, whatever the payload. */
const unknownBuiltinCompanionFeature: ReleaseRow = {
  ...companionFeature,
  key: 'builtin:share-spells',
};

const unsupported =
  'Prepared release resources failed: Unsupported prepared release resources';

test('discovery accepts imported companion resources: the release prepares, allocates, reconciles to ready and activates fixture-only, and its sheet is unchanged', async () => {
  const { t, owner, scope } = await releaseFixture(modules);
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 14 },
    operationId: 'before-release',
  });
  const edited = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(edited).not.toEqual(before);
  const artifact = await prepare(t, [companionFeature, companion, familiar]);
  expect((await allocateReleaseIdentities(t)).at(-1)).toMatchObject({
    isDone: true,
  });
  const run = await runCatalogReleaseImpactCommand({
    releaseNumber: 1,
    adapter: impactAdapter(t),
  });
  expect(run).toMatchObject({
    stopped: 'ready',
    status: { isReady: true, pendingCount: 0, failedCount: 0 },
  });
  expect(run.status.discoveryError).toBeUndefined();
  // No definition has an edge to a resource but the casting tables, so the
  // changed companion resources reach no Character as an impact reason.
  const unaffected = await t.query(internal.catalogReleaseImpact.inspectWork, {
    runId: run.runId,
    state: 'unaffected',
    paginationOpts: {
      cursor: null,
      numItems: 10,
      maximumRowsRead: 10,
      maximumBytesRead: 512000,
    },
  });
  expect(unaffected.page.map((work) => work.characterId)).toEqual([
    scope.characterId,
  ]);
  expect(
    await t.mutation(
      internal.catalogReleaseActivation.activate,
      activationArgs(run.runId),
    ),
  ).toMatchObject({
    releaseNumber: 1,
    artifactFingerprint: artifact.manifest.artifactFingerprint,
  });
  // The selected release's number and legal inputs change; the sheet's
  // entries and its calculation do not.
  const activated = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(activated).toMatchObject({
    catalogView: { releaseNumber: 1 },
  });
  const unchanged = (sheet: typeof edited) => ({
    resources: sheet?.catalogView?.resources,
    entries: sheet?.entries,
    calculated: sheet?.calculated,
  });
  expect(unchanged(activated)).toEqual(unchanged(edited));
});

test.each([
  {
    name: 'an imported creature type',
    row: importedResource('pf1/animal', {
      kind: 'creatureType',
      hitDie: 8,
      bab: 'threeQuarters',
      saves: { fort: 'good', ref: 'good', will: 'poor' },
      classSkills: [],
      tag: 'animal',
      skillRanksPerHitDie: 2,
    }),
    isImportedEntry: true,
  },
  {
    name: 'an imported eidolon form',
    row: importedResource('pf1/biped', {
      kind: 'eidolonForm',
      abilities: { str: 16 },
      creatureTypes: ['outsider'],
    }),
    isImportedEntry: true,
  },
  {
    name: 'an imported eidolon evolution',
    row: importedResource('pf1/claws', {
      kind: 'eidolonEvolution',
      tag: 'claws',
      associations: [],
    }),
    isImportedEntry: true,
  },
  {
    name: 'a resource that is no imported entry',
    row: notImported,
    isImportedEntry: false,
  },
  {
    name: 'an unknown built-in resource',
    row: unknownBuiltin,
    isImportedEntry: false,
  },
  {
    name: 'an unknown built-in key carrying a companion feature',
    row: unknownBuiltinCompanionFeature,
    isImportedEntry: true,
  },
])(
  'discovery refuses $name beside an accepted companion feature',
  async ({ row, isImportedEntry }) => {
    // An imported entry of another kind is refused for its kind alone, and
    // an accepted kind under an unknown `builtin:` key for its key alone.
    expect(importedCatalogEntrySchema.safeParse(row.payload).success).toBe(
      isImportedEntry,
    );
    const { t } = await releaseFixture(modules);
    await prepare(t, [companionFeature, row]);
    const runId = await discover(t);
    expect(
      await t.query(internal.catalogReleaseImpact.status, { runId }),
    ).toMatchObject({
      isDiscoveryComplete: true,
      isReady: false,
      discoveryError: unsupported,
    });
  },
);
