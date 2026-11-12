/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { makeFunctionReference, type WithoutSystemFields } from 'convex/server';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { z } from 'zod';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  discover,
  impactAdapter,
  prepare,
  releaseFixture,
  setMigrationAuthority,
  type ReleaseTest,
} from '../tests/catalog-release-fixture';
import { releaseRowBoundViolations } from '../tests/catalog/convex-value-bounds';
import { findOutcome, race } from '../tests/catalog/release-scope-fixtures';
import {
  alertness,
  bravery,
  createScopedReleaseBuilder,
  dwarfAbility,
  fighter,
  fighterFeatures,
  fighterIncrements,
  fireball,
  importPinnedBodies,
  keen,
  longsword,
  magicalLineage,
  readCommittedManifest,
  roundTripRows,
  scrying,
  seeking,
  shareSpells,
  spellMastery,
  spellbook,
  unarmedStrike,
  ward,
  wizard,
  wizardFeatures,
  wizardIncrements,
  type ScopedBuild,
} from '../tests/catalog/release-scope-round-trip';
import { computeFingerprint } from '../scripts/catalog/admission';
import { runCatalogReleaseOperator } from '../scripts/catalog/release-operator';
import type { CatalogReleaseCommandAdapter } from '../scripts/catalog/release-command';
import type { CatalogReleaseActivationCommandAdapter } from '../scripts/catalog/release-activation-command';
import type { CatalogIdentityAllocationCommandAdapter } from '../scripts/catalog/release-allocation-command';
import { allocationBatchRows } from './catalogIdentityAllocation';
import {
  isObject,
  canonicalReleaseJson,
  parseReleaseJson,
  type CatalogReleaseArtifact,
  type ReleaseJson,
  type ReleaseRow,
} from '../src/lib/catalog/release-schema';
import type { CatalogReleaseStatus } from '../src/lib/catalog/release-validators';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';
import {
  findReviewedClassCasting,
  type Casting,
} from '../src/lib/character-sheet-casting-tables';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from '../src/lib/character-sheet';
import { candidateDefinition } from './lib/catalogCandidateDefinition';
import { api, internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import schema from './schema';

// #770 slice B: a scoped Catalog Release built by `catalog:release build
// --scope` stages, finalizes, reconciles and activates fixture-only through
// the real `catalogRelease` functions, with real pinned bodies, a reduced
// copy of the committed scope (always FAILED: drift and an incomplete
// inventory) and a test-only attribution that the unchanged gates assess.
// Identities exist only in this test database (#413 owns allocation).

// The committed reviewed attribution data (93 MB of encoded evidence) loads
// only for a build without --attribution; these builds supply their own.
vi.mock('../scripts/catalog/reviewed-data-files', () => ({
  readCommittedReviewedAdmission: () =>
    Promise.reject(new Error('The reviewed attribution data was loaded.')),
}));

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
preloadCalledConvexModules({ modules, testFile: import.meta.url });

// Each scoped build inspects its reduced manifest and imports its tree.
const slow = 120_000;

// B2a: real pinned bodies with checked curated Situational Notes: Mounted
// Combat (CRB p. 131), Hardy (the Dwarf's racial trait, CRB p. 21) and
// Fireball (CRB p. 283). Committed edges reach Mounted Combat from the
// Wizard through Trick Riding (APG); the unchanged gates admit Mounted Combat
// and, since the owner's notice-hold clearance (2026-10-30), Trick Riding.
const mountedCombat = 'pf1/0spsP9ylE3goD3jc';
const trickRiding = 'pf1-content/tcBSikJXg2YhVXPF';
const mountedCombatPath = [
  `rule/core/general-feat/${trickRiding}`,
  trickRiding,
  `rule/core/prerequisite/roleplaying_game/advanced_players_guide/apg_feats.lst:203/${trickRiding}`,
  mountedCombat,
];
const hardy = 'pf1-content/AO5nhhUfI1b4M37H';

type BuildName =
  | 'first'
  | 'resource'
  | 'narrowed'
  | 'withoutSpellMastery'
  | 'notes';
let builder: Awaited<ReturnType<typeof createScopedReleaseBuilder>>;
const manifests: Record<BuildName, string> = {
  first: '',
  resource: '',
  narrowed: '',
  withoutSpellMastery: '',
  notes: '',
};
let pinnedBodies: Awaited<ReturnType<typeof importPinnedBodies>>;
let wardRowKind: string | undefined;
beforeAll(async () => {
  // The committed manifest (about 1 GB parsed) is released after this hook.
  const committed = await readCommittedManifest();
  builder = await createScopedReleaseBuilder({
    committed,
    rows: [...roundTripRows, shareSpells, ...mountedCombatPath],
  });
  manifests.first = await builder.manifest('first', roundTripRows);
  manifests.resource = await builder.manifest('resource', [
    ...roundTripRows,
    shareSpells,
  ]);
  manifests.narrowed = await builder.manifest(
    'narrowed',
    roundTripRows.filter((key) => key !== alertness),
  );
  manifests.withoutSpellMastery = await builder.manifest(
    'without-spell-mastery',
    roundTripRows.filter((key) => key !== spellMastery),
  );
  manifests.notes = await builder.manifest('notes', [
    ...roundTripRows,
    ...mountedCombatPath,
  ]);
  // The Fighter's increments come with it from its reviewed schedule (S3).
  pinnedBodies = await importPinnedBodies(committed, [
    fighter,
    ...fighterFeatures,
    magicalLineage,
    seeking,
    keen,
    longsword,
    unarmedStrike,
    ward,
    mountedCombat,
    hardy,
    race.dwarf,
    fireball,
    wizard,
  ]);
  wardRowKind = committed.rows.find(({ key }) => key === ward)?.kind;
}, slow);
afterAll(() => builder?.dispose());

const builds = new Map<string, Promise<ScopedBuild>>();
/** One operator build per name; the artifact path is immutable. */
function built(name: BuildName): Promise<ScopedBuild> {
  let build = builds.get(name);
  if (!build) {
    build =
      name === 'first' || name === 'resource' || name === 'notes'
        ? builder.build({ name, manifestPath: manifests[name] })
        : built('first').then((first) =>
            builder.build({
              name,
              manifestPath: manifests[name],
              number: 2,
              previous: first.artifactPath,
            }),
          );
    builds.set(name, build);
  }
  return build;
}
async function artifactOf(name: Parameters<typeof built>[0]) {
  const { artifact, message, report } = await built(name);
  // The reduced scope never qualifies, yet the gates pass: the artifact is written.
  expect(message).toContain('Scoped qualification FAILED');
  expect(report.qualification.status).toBe('FAILED');
  if (!artifact) throw new Error(`No ${name} artifact: ${message}`);
  return artifact;
}

const beginBoundary = makeFunctionReference<
  'mutation',
  { manifest: unknown; writeEpoch?: number },
  CatalogReleaseStatus
>('catalogRelease:begin');
const writeBatchBoundary = makeFunctionReference<
  'mutation',
  { releaseNumber: number; batchIndex: number; rows: ReleaseRow[] },
  CatalogReleaseStatus
>('catalogRelease:writeBatch');

function releaseAdapter(t: ReleaseTest): CatalogReleaseCommandAdapter {
  return {
    begin: (args) => t.mutation(beginBoundary, args),
    writeBatch: (args) => t.mutation(writeBatchBoundary, args),
    finalize: (args) => t.mutation(internal.catalogRelease.finalize, args),
    inspect: (args) => t.query(internal.catalogRelease.inspect, args),
    inspectRows: (args) => t.query(internal.catalogRelease.inspectRows, args),
  };
}
async function operatorPrepare(t: ReleaseTest, artifactPath: string) {
  return runCatalogReleaseOperator({
    args: ['prepare', '--artifact', artifactPath],
    adapter: releaseAdapter(t),
  });
}
const reconciled = z.object({
  runId: z.string(),
  status: z.object({
    isReady: z.boolean(),
    isDiscoveryComplete: z.boolean(),
    discoveryError: z.string().optional(),
    missingIdentityCount: z.number().optional(),
    identityCoverageComplete: z.boolean().optional(),
  }),
  stopped: z.string(),
});
async function operatorReconcile(
  t: ReleaseTest,
  releaseNumber: number,
  options: { retryFailed?: boolean } = {},
) {
  return reconciled.parse(
    await runCatalogReleaseOperator({
      args: [
        'reconcile',
        '--number',
        String(releaseNumber),
        ...(options.retryFailed ? ['--retry-failed'] : []),
      ],
      impactAdapter: impactAdapter(t),
    }),
  );
}
async function operatorActivate(
  t: ReleaseTest,
  releaseNumber: number,
  runId: string,
  targetKind: 'preview' | 'production' = 'preview',
) {
  const activationAdapter: CatalogReleaseActivationCommandAdapter = {
    activate: (args) =>
      t.mutation(internal.catalogReleaseActivation.activate, {
        ...args,
        runId: args.runId as Id<'catalogImpactRun'>,
      }),
    status: () => t.query(internal.catalogReleaseActivation.status, {}),
  };
  return runCatalogReleaseOperator({
    args: [
      'activate',
      '--number',
      String(releaseNumber),
      '--run-id',
      runId,
      '--operation-id',
      `scope-${releaseNumber}-${runId}`,
      '--schema',
      catalogRuntimeCompatibility.schema,
      '--calculation',
      catalogRuntimeCompatibility.calculation,
      '--fixture-only',
      '--target-kind',
      targetKind,
    ],
    activationAdapter,
  });
}

// #413 F1: the operator's allocation step over the registered function.
function allocationAdapter(
  t: ReleaseTest,
): CatalogIdentityAllocationCommandAdapter {
  return {
    allocate: (args) =>
      t.mutation(internal.catalogIdentityAllocation.allocate, args),
  };
}
const allocated = z.object({
  releaseNumber: z.number(),
  allocatedCount: z.number(),
  existingCount: z.number(),
  batchCount: z.number(),
  conflicts: z.array(z.record(z.string(), z.unknown())),
  stopped: z.enum(['complete', 'conflicts']),
});
async function operatorAllocate(
  t: ReleaseTest,
  releaseNumber: number,
  adapter: CatalogIdentityAllocationCommandAdapter = allocationAdapter(t),
) {
  return allocated.parse(
    await runCatalogReleaseOperator({
      args: ['allocate', '--number', String(releaseNumber)],
      allocationAdapter: adapter,
    }),
  );
}
/** Every stored global row naming one of `keys`, by key. */
async function storedRows(t: ReleaseTest, keys: string[]) {
  return t.run(async (ctx) => {
    const rows: Record<string, Doc<'catalogEntry'>[]> = {};
    for (const key of keys)
      rows[key] = await ctx.db
        .query('catalogEntry')
        .withIndex('by_scope_and_ruleIdentity', (q) =>
          q.eq('scope', 'global').eq('ruleIdentity', key),
        )
        .take(4);
    return rows;
  });
}
/** The stored identities by key, without their system fields. */
async function storedIdentities(t: ReleaseTest, keys: string[]) {
  const rows = await storedRows(t, keys);
  return Object.fromEntries(
    Object.entries(rows).map(([key, docs]) => [
      key,
      docs.map(({ _id, _creationTime, ...doc }) => doc),
    ]),
  );
}
async function storedIds(t: ReleaseTest, keys: string[]) {
  const rows = await storedRows(t, keys);
  return new Map(
    Object.entries(rows).flatMap(([key, docs]) =>
      docs.length === 1 && docs[0] ? [[key, docs[0]._id] as const] : [],
    ),
  );
}

function rowsOf(artifact: CatalogReleaseArtifact) {
  return artifact.batches.flat();
}
function definitionsOf(artifact: CatalogReleaseArtifact) {
  return rowsOf(artifact).filter((row) => row.kind === 'definition');
}
function detailKind(payload: ReleaseJson) {
  return isObject(payload) &&
    isObject(payload.detail) &&
    typeof payload.detail.kind === 'string'
    ? payload.detail.kind
    : undefined;
}

// What #413 allocates in production: one stored global identity per body,
// with placeholder content the release body replaces.
type StoredIdentity = WithoutSystemFields<Doc<'catalogEntry'>>;
const identity = (name: string, ruleIdentity: string) => ({
  scope: 'global' as const,
  name,
  ruleIdentity,
  sources: [],
  modifiers: [],
  stacksWithItself: false,
});
/** A stored class identity, with the casting #413 would store for a caster. */
function storedClassIdentity(
  name: string,
  key: string,
  casting?: Casting,
): StoredIdentity {
  return {
    ...identity(name, key),
    detail: {
      kind: 'class',
      classKind: 'base',
      hitDie: 6,
      bab: 'half',
      saves: { fort: 'poor', ref: 'poor', will: 'poor' },
      skillRanksPerLevel: 0,
      classSkills: [],
      featuresByLevel: [],
      picksByLevel: [],
      ...(casting ? { casting } : {}),
    },
  };
}
const storedIdentity: Record<
  string,
  (name: string, ruleIdentity: string) => StoredIdentity
> = {
  class: (name, key) => storedClassIdentity(name, key),
  classFeature: (name, key) => ({
    ...identity(name, key),
    detail: { kind: 'classFeature' },
  }),
  feat: (name, key) => ({ ...identity(name, key), detail: { kind: 'feat' } }),
  trait: (name, key) => ({ ...identity(name, key), detail: { kind: 'trait' } }),
  race: (name, key) => ({
    ...identity(name, key),
    detail: { kind: 'race', racialTraits: [] },
  }),
  racialTrait: (name, key) => ({
    ...identity(name, key),
    detail: { kind: 'racialTrait', raceEntryIds: [], replaces: [] },
  }),
  item: (name, key) => ({
    ...identity(name, key),
    detail: { kind: 'item', consumable: false },
  }),
  spell: (name, key) => ({ ...identity(name, key), detail: { kind: 'spell' } }),
  itemAbility: (name, key) => ({
    ...identity(name, key),
    detail: { kind: 'itemAbility', appliesTo: 'weapon', bonusEquivalent: 0 },
  }),
};
async function seedIdentities(
  t: ReleaseTest,
  bodies: { key: string; payload: ReleaseJson }[],
) {
  return new Map(
    await t.run(async (ctx) => {
      const ids: [string, Id<'catalogEntry'>][] = [];
      for (const { key, payload } of bodies) {
        // A caster's stored identity holds its reviewed casting, as #413
        // would store it; the adapter compares the body's casting with it.
        const casting =
          detailKind(payload) === 'class' &&
          isObject(payload) &&
          isObject(payload.detail) &&
          typeof payload.detail.tag === 'string'
            ? findReviewedClassCasting(payload.detail.tag)
            : undefined;
        const stored = casting
          ? (name: string, ruleIdentity: string) =>
              storedClassIdentity(name, ruleIdentity, casting)
          : storedIdentity[detailKind(payload) ?? ''];
        if (!stored || !isObject(payload) || typeof payload.name !== 'string')
          throw new Error(`No stored identity shape for ${key}`);
        ids.push([
          key,
          await ctx.db.insert('catalogEntry', stored(payload.name, key)),
        ]);
      }
      return ids;
    }),
  );
}
/** A real pinned row's importer body, as a release row carries it. */
function pinnedBody(key: string) {
  const entry = pinnedBodies.find(({ externalKey }) => externalKey === key);
  if (!entry) throw new Error(`No pinned body for ${key}`);
  return { key, payload: parseReleaseJson(JSON.parse(JSON.stringify(entry))) };
}
async function releaseDoc(t: ReleaseTest, releaseNumber: number) {
  const release = await t.run((ctx) =>
    ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) =>
        q.eq('releaseNumber', releaseNumber),
      )
      .unique(),
  );
  if (!release) throw new Error(`Missing release ${releaseNumber}`);
  return release;
}
async function candidates(
  t: ReleaseTest,
  releaseNumber: number,
  ids: Map<string, Id<'catalogEntry'>>,
) {
  const release = await releaseDoc(t, releaseNumber);
  return new Map(
    await t.run(async (ctx) => {
      const converted: [string, Doc<'catalogEntry'>][] = [];
      for (const [key, id] of ids) {
        const stored = await ctx.db.get('catalogEntry', id);
        if (!stored) throw new Error(`Missing stored ${key}`);
        converted.push([key, await candidateDefinition(ctx, release, stored)]);
      }
      return converted;
    }),
  );
}

// LA3: release body content the stored candidate adapter does not carry,
// by kind; a body is checked for those it has. A newly dropped field fails
// the comparison below. Situational Notes are carried for every kind (B2a),
// and a class's tag since #781.
const notCarriedByKind: Record<string, string[]> = {
  racialTrait: ['detail.standard'],
  spell: ['detail.descriptors', 'detail.grantedLevels', 'detail.subschools'],
};
// Import bookkeeping on a release body, not release content: an
// `everythingpath/` body's field provenance (#716) included.
const bookkeeping = new Set([
  'externalKey',
  'upstreamKey',
  'pack',
  'unsupported',
  'attributionFrom',
  'provenance',
]);
/** A stored document's fields by name. */
function fieldsOf(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value));
}
// A zero the stored form leaves absent: no bonus ranks.
const absentAsZero = new Set(['detail.bonusSkillRanksPerLevel']);
// Stable-key fields the stored form keeps as stable keys: a class feature's
// parent (#716 P5) and rule-identity prerequisites, which the sheet matches
// by rule identity.
const keptAsKey = new Set(['detail.parentFeature', 'prerequisites']);
// A caster's casting: the stored record (#413) carries it, and the body's
// values are an identity check, each equal to the stored one (S3).
const checkedAgainstStored = new Set(['detail.casting']);
// Stable-key fields whose stored form names stored IDs.
const storedName: Record<string, string> = {
  raceKeys: 'raceEntryIds',
  baseItemKey: 'baseItem',
};
/**
 * The release body's content fields the candidate drops, and those it
 * carries with a different value once stable keys are stored IDs.
 */
function compareCarried(
  body: ReleaseJson,
  candidate: Doc<'catalogEntry'>,
  ids: Map<string, Id<'catalogEntry'>>,
) {
  const stored = (value: unknown): unknown => {
    if (typeof value === 'string') return ids.get(value) ?? value;
    if (Array.isArray(value)) return value.map(stored);
    if (isObject(value))
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key === 'externalKey' ? 'catalogEntryId' : key,
          stored(item),
        ]),
      );
    return value;
  };
  const dropped: string[] = [];
  const changed: string[] = [];
  const compare = (
    path: string,
    value: unknown,
    target: Record<string, unknown>,
    name: string,
  ) => {
    const carried = target[name];
    if (
      carried === undefined &&
      value !== '' &&
      value !== undefined &&
      !(value === 0 && absentAsZero.has(path))
    )
      dropped.push(path);
    else if (checkedAgainstStored.has(path)) {
      if (
        !isObject(value) ||
        !isObject(carried) ||
        Object.entries(value).some(
          ([key, item]) =>
            item !== undefined && item !== Reflect.get(carried, key),
        )
      )
        changed.push(path);
    } else if (
      carried !== undefined &&
      canonicalReleaseJson(keptAsKey.has(path) ? value : stored(value)) !==
        canonicalReleaseJson(carried)
    )
      changed.push(path);
  };
  if (!isObject(body)) throw new Error('A release body is an object.');
  const record = fieldsOf(candidate);
  for (const [field, value] of Object.entries(body)) {
    if (bookkeeping.has(field)) continue;
    // #227 slice 4: the stored form carries the label's state.
    if (field === 'verification') {
      compare(field, isObject(value) ? value.state : value, record, field);
      continue;
    }
    if (field !== 'detail') {
      compare(field, value, record, field);
      continue;
    }
    if (!isObject(value)) throw new Error('A release body has a detail.');
    for (const [name, item] of Object.entries(value))
      compare(
        `detail.${name}`,
        item,
        fieldsOf(candidate.detail),
        storedName[name] ?? name,
      );
  }
  return { dropped: dropped.sort(), changed };
}
function expectConverted(
  bodies: { key: string; payload: ReleaseJson }[],
  converted: Map<string, Doc<'catalogEntry'>>,
  ids: Map<string, Id<'catalogEntry'>>,
) {
  for (const { key, payload } of bodies) {
    const kind = detailKind(payload) ?? '';
    const candidate = converted.get(key);
    expect(candidate?.detail.kind, key).toBe(kind);
    if (!candidate) continue;
    const has = (path: string) =>
      isObject(payload) &&
      (path.startsWith('detail.')
        ? isObject(payload.detail) &&
          payload.detail[path.slice('detail.'.length)] !== undefined
        : payload[path] !== undefined);
    expect.soft(compareCarried(payload, candidate, ids), key).toEqual({
      dropped: (notCarriedByKind[kind] ?? []).filter(has),
      changed: [],
    });
  }
}

test(
  'a scoped release stages, finalizes and reads back its content:scope rows through the real catalogRelease functions',
  async () => {
    const { t } = await releaseFixture(modules);
    const { artifactPath, report } = await built('first');
    const artifact = await artifactOf('first');
    expect(report.qualification.findings.map(({ code }) => code)).toEqual([
      'drift',
      'inventory-incomplete',
    ]);
    // Convex value limits convex-test does not enforce (B6).
    expect(rowsOf(artifact).flatMap(releaseRowBoundViolations)).toEqual([]);

    const prepared = await operatorPrepare(t, artifactPath);
    expect(prepared).toMatchObject({ releaseNumber: 1, state: 'prepared' });
    // Preparing the same artifact again changes nothing.
    expect(await operatorPrepare(t, artifactPath)).toEqual(prepared);
    const release = await releaseDoc(t, 1);
    expect([...release.reportCategories].sort()).toEqual([
      'content',
      'curation',
      'holds',
      'resources',
      'retirement',
    ]);

    const page = z.object({
      page: z.array(z.object({ key: z.string(), payload: z.unknown() })),
      isDone: z.boolean(),
      continueCursor: z.string(),
    });
    const staged: { key: string; payload: unknown }[] = [];
    let cursor: string | undefined;
    for (;;) {
      const read = page.parse(
        await runCatalogReleaseOperator({
          args: [
            'inspect',
            '--number',
            '1',
            '--kind',
            'report',
            ...(cursor ? ['--cursor', cursor] : []),
          ],
          adapter: releaseAdapter(t),
        }),
      );
      staged.push(...read.page);
      if (read.isDone) break;
      cursor = read.continueCursor;
    }
    const scopeRows = staged.filter(({ key }) =>
      key.startsWith('content:scope'),
    );
    expect(scopeRows.map(({ key }) => key)).toEqual(
      rowsOf(artifact)
        .filter(({ key }) => key.startsWith('content:scope'))
        .map(({ key }) => key)
        .sort(),
    );
    expect(
      scopeRows.find(({ key }) => key === 'content:scope')?.payload,
    ).toEqual({ binding: report.binding, qualification: report.qualification });
    // Index order is lexicographic (content:scope:10 before :2); a reader sorts.
    const chunkIndex = (key: string) =>
      Number(key.slice('content:scope:'.length));
    expect(
      scopeRows
        .filter(({ key }) => key.startsWith('content:scope:'))
        .sort((a, b) => chunkIndex(a.key) - chunkIndex(b.key))
        .flatMap(({ payload }) => z.array(z.unknown()).parse(payload)),
    ).toEqual(report.rows);
  },
  slow,
);

test(
  'discovery converts every admitted definition kind through the stored candidate adapter, unused bodies included; the FAILED scope refuses a production activation but not a fixture one',
  async () => {
    const { t } = await releaseFixture(modules);
    const { artifactPath, report } = await built('first');
    const artifact = await artifactOf('first');
    const definitions = definitionsOf(artifact);
    // Every kind the unchanged gates admit at HEAD. Since the notice-hold
    // clearance an item ships too (the Wizard's Spellbook), and (S3) the
    // Wizard itself, a caster, with its schedule's increments; trait and
    // itemAbility are proven at the conversion seam below.
    expect(
      [
        ...new Set(definitions.map(({ payload }) => detailKind(payload))),
      ].sort(),
    ).toEqual([
      'class',
      'classFeature',
      'feat',
      'item',
      'race',
      'racialTrait',
      'spell',
    ]);
    expect(definitions.map(({ key }) => key)).toEqual(
      expect.arrayContaining([
        wizard,
        ...wizardIncrements,
        wizardFeatures.arcaneSchool,
        alertness,
        scrying,
        race.dwarf,
        dwarfAbility,
        spellbook,
      ]),
    );
    // D2: the gate admits these bodies and they ship, though the scope holds
    // each one for its own launch failures.
    for (const { key } of definitions)
      expect(findOutcome(report, key)).toMatchObject({
        outcome: 'held',
        cause: 'requirement',
        gate: 'admitted',
      });

    // No Character uses any of them.
    const ids = await seedIdentities(t, definitions);
    await operatorPrepare(t, artifactPath);
    const run = await operatorReconcile(t, 1);
    expect(run).toMatchObject({
      stopped: 'ready',
      status: {
        isReady: true,
        missingIdentityCount: 0,
        identityCoverageComplete: true,
      },
    });
    expect(run.status.discoveryError).toBeUndefined();
    expectConverted(definitions, await candidates(t, 1, ids), ids);

    // B4: readiness and fixture-only activation.
    expect(
      await t.query(internal.catalogRelease.readiness, {
        releaseNumber: 1,
        schemaIdentity: catalogRuntimeCompatibility.schema,
        calculationIdentity: catalogRuntimeCompatibility.calculation,
      }),
    ).toEqual({
      isPrepared: true,
      isBaseCurrent: true,
      isCandidateCurrent: true,
      isCompatible: true,
      isActivationImplemented: true,
    });
    await expect(
      operatorActivate(t, 1, run.runId, 'production'),
    ).rejects.toThrow('limited to fixture deployments');
    // D1: activation readiness reads content:scope for a production
    // activation (#413 F3). Under sheet authority, the one a production
    // activation reaches readiness under, the FAILED scope refuses it.
    await setMigrationAuthority(t, 'sheet');
    await expect(
      t.mutation(internal.catalogReleaseActivation.activate, {
        releaseNumber: 1,
        runId: run.runId as Id<'catalogImpactRun'>,
        activationId: 'production-1',
        schemaIdentity: catalogRuntimeCompatibility.schema,
        calculationIdentity: catalogRuntimeCompatibility.calculation,
        isFixtureOnly: false,
      }),
    ).rejects.toThrow(
      'Catalog activation is not ready: scope-unqualified: campaign-mvp-v1 FAILED',
    );
    await setMigrationAuthority(t, 'legacy');
    // A fixture activation does not read the scope, so it keeps today's
    // behaviour: the FAILED qualification does not hold it back.
    expect(await operatorActivate(t, 1, run.runId)).toMatchObject({
      releaseNumber: 1,
      artifactFingerprint: artifact.manifest.artifactFingerprint,
      isFixtureOnly: true,
    });
  },
  slow,
);

test(
  'a companionFeature resource refuses discovery explicitly (#733) and activation stays refused',
  async () => {
    const { t } = await releaseFixture(modules);
    const { artifactPath } = await built('resource');
    const artifact = await artifactOf('resource');
    expect(
      rowsOf(artifact).find(({ key }) => key === shareSpells),
    ).toMatchObject({
      kind: 'resource',
      payload: { detail: { kind: 'companionFeature' } },
    });
    await seedIdentities(t, definitionsOf(artifact));
    await operatorPrepare(t, artifactPath);
    const run = await operatorReconcile(t, 1);
    expect(run).toMatchObject({
      stopped: 'failed',
      status: {
        isReady: false,
        discoveryError:
          'Prepared release resources failed: Unsupported prepared release resources',
      },
    });
    await expect(operatorActivate(t, 1, run.runId)).rejects.toThrow(
      'discovery-failed',
    );
  },
  slow,
);

test(
  'a run with a missing identity is not ready; after allocation the same run is, and activates (#413 F1)',
  async () => {
    const { t } = await releaseFixture(modules);
    const { artifactPath } = await built('first');
    const artifact = await artifactOf('first');
    const definitions = definitionsOf(artifact);
    await seedIdentities(
      t,
      definitions.filter(({ key }) => key !== alertness),
    );
    await operatorPrepare(t, artifactPath);
    // A wrong order of steps: reconcile before allocating.
    const missing = await operatorReconcile(t, 1);
    expect(missing).toMatchObject({
      stopped: 'missing-identities',
      status: {
        missingIdentityCount: 1,
        isDiscoveryComplete: true,
        isReady: false,
        identityCoverageComplete: true,
      },
    });
    expect(missing.status.discoveryError).toBeUndefined();
    await expect(operatorActivate(t, 1, missing.runId)).rejects.toThrow(
      'gates-incomplete',
    );
    expect(await operatorAllocate(t, 1)).toMatchObject({
      allocatedCount: 1,
      existingCount: definitions.length - 1,
      conflicts: [],
      stopped: 'complete',
    });
    // Rerunning reconcile rechecks the same run's identities.
    const ready = await operatorReconcile(t, 1);
    expect(ready).toMatchObject({
      runId: missing.runId,
      stopped: 'ready',
      status: {
        isReady: true,
        missingIdentityCount: 0,
        identityCoverageComplete: true,
      },
    });
    expect(await operatorActivate(t, 1, ready.runId)).toMatchObject({
      releaseNumber: 1,
      impactRunId: missing.runId,
      isFixtureOnly: true,
    });
  },
  slow,
);

test(
  'allocation gives every definition of a release a stored identity on a deployment with none, without its body; a rerun changes nothing (#413 F1)',
  async () => {
    const { t, owner, scope } = await releaseFixture(modules);
    const { artifactPath } = await built('first');
    const artifact = await artifactOf('first');
    const definitions = definitionsOf(artifact);
    const keys = definitions.map(({ key }) => key);
    await operatorPrepare(t, artifactPath);
    expect(
      Object.values(await storedRows(t, keys)).every((rows) => !rows.length),
    ).toBe(true);

    expect(await operatorAllocate(t, 1)).toEqual({
      releaseNumber: 1,
      allocatedCount: definitions.length,
      existingCount: 0,
      batchCount: Math.ceil(definitions.length / allocationBatchRows),
      conflicts: [],
      stopped: 'complete',
    });
    const first = await storedRows(t, keys);
    for (const key of keys) expect(first[key], key).toHaveLength(1);
    expect(await operatorAllocate(t, 1)).toMatchObject({
      allocatedCount: 0,
      existingCount: definitions.length,
      conflicts: [],
    });
    expect(await storedRows(t, keys)).toEqual(first);

    // Ordinary reads see each identity's name and kind, and none of the
    // unpublished body: no description, Modifiers, Notes or sources.
    const offered = (await owner.query(api.catalogCopies.list, scope)).filter(
      (row) => row.scope === 'global' && keys.includes(row.ruleIdentity),
    );
    expect(offered).toHaveLength(keys.length);
    for (const row of offered) {
      const { payload } = definitions.find(
        ({ key }) => key === row.ruleIdentity,
      ) ?? { payload: null };
      expect(isObject(payload) && payload.name).toBe(row.name);
      expect(row.detail.kind).toBe(detailKind(payload ?? null));
      expect(row, row.ruleIdentity).toMatchObject({
        scope: 'global',
        sources: [],
        modifiers: [],
      });
      for (const field of [
        'description',
        'guidanceText',
        'prerequisiteText',
        'prerequisites',
        'situationalNotes',
        'grantsSlots',
        'proficiencies',
        'countsAsRaces',
        'sourceKey',
      ])
        expect(row, `${row.ruleIdentity} ${field}`).not.toHaveProperty(field);
    }

    // Every body resolves and converts through the stored adapter.
    const ids = await storedIds(t, keys);
    const run = await operatorReconcile(t, 1);
    expect(run).toMatchObject({
      stopped: 'ready',
      status: {
        isReady: true,
        missingIdentityCount: 0,
        identityCoverageComplete: true,
      },
    });
    expectConverted(definitions, await candidates(t, 1, ids), ids);
    expect(await operatorActivate(t, 1, run.runId)).toMatchObject({
      releaseNumber: 1,
      isFixtureOnly: true,
    });
  },
  slow,
);

test(
  'an allocation interrupted between batches resumes to the same identities as an uninterrupted one (#413 F1)',
  async () => {
    const { artifactPath } = await built('first');
    const definitions = definitionsOf(await artifactOf('first'));
    const keys = definitions.map(({ key }) => key);
    expect(definitions.length).toBeGreaterThan(2 * allocationBatchRows);

    const whole = await releaseFixture(modules);
    await operatorPrepare(whole.t, artifactPath);
    await operatorAllocate(whole.t, 1);

    const interrupted = await releaseFixture(modules);
    await operatorPrepare(interrupted.t, artifactPath);
    // The second batch commits, then its response is lost.
    let batches = 0;
    const lossy: CatalogIdentityAllocationCommandAdapter = {
      allocate: async (args) => {
        const batch = await interrupted.t.mutation(
          internal.catalogIdentityAllocation.allocate,
          args,
        );
        if (++batches === 2) throw new Error('Response lost');
        return batch;
      },
    };
    await expect(operatorAllocate(interrupted.t, 1, lossy)).rejects.toThrow(
      'Response lost',
    );
    // The partial state is not read as complete: a body allocated in an
    // early batch names one the lost batches haven't allocated yet.
    const partial = await operatorReconcile(interrupted.t, 1);
    expect(partial).toMatchObject({
      stopped: 'failed',
      status: { isReady: false },
    });
    expect(partial.status.discoveryError).toMatch(
      /^Discovery failed for .*: Candidate .* is unavailable/,
    );
    expect(await operatorAllocate(interrupted.t, 1)).toMatchObject({
      allocatedCount: definitions.length - 2 * allocationBatchRows,
      existingCount: 2 * allocationBatchRows,
      conflicts: [],
      stopped: 'complete',
    });
    expect(await storedIdentities(interrupted.t, keys)).toEqual(
      await storedIdentities(whole.t, keys),
    );
    // The recorded failure is retried explicitly, in the same run.
    expect(
      await operatorReconcile(interrupted.t, 1, { retryFailed: true }),
    ).toMatchObject({
      runId: partial.runId,
      stopped: 'ready',
      status: { isReady: true, missingIdentityCount: 0 },
    });
  },
  slow,
);

test(
  'a key stored as another kind is reported with both identities and allocates nothing for it, nor for a body that references it (#413 F1)',
  async () => {
    const { t } = await releaseFixture(modules);
    const { artifactPath } = await built('first');
    const definitions = definitionsOf(await artifactOf('first'));
    const keys = definitions.map(({ key }) => key);
    // A racial trait the release ships for the Dwarf names it by key.
    const dwarfTrait = definitions.find(
      ({ payload }) =>
        isObject(payload) &&
        isObject(payload.detail) &&
        payload.detail.kind === 'racialTrait' &&
        Array.isArray(payload.detail.raceKeys) &&
        payload.detail.raceKeys.includes(race.dwarf),
    );
    if (!dwarfTrait) throw new Error('No Dwarf racial trait in the release');
    // Mistakes in earlier seeding: Alertness stored as a trait and the
    // Dwarf as a feat.
    const wrong = await t.run(async (ctx) => ({
      alertness: await ctx.db.insert('catalogEntry', {
        ...identity('Alertness', alertness),
        detail: { kind: 'trait' },
      }),
      dwarf: await ctx.db.insert('catalogEntry', {
        ...identity('Dwarf', race.dwarf),
        detail: { kind: 'feat' },
      }),
    }));
    await operatorPrepare(t, artifactPath);
    const result = await operatorAllocate(t, 1);
    expect(result).toMatchObject({
      allocatedCount: definitions.length - 3,
      existingCount: 0,
      stopped: 'conflicts',
    });
    expect(result.conflicts).toEqual(
      expect.arrayContaining([
        {
          kind: 'identityKind',
          key: alertness,
          releaseKind: 'feat',
          stored: { catalogEntryId: wrong.alertness, kind: 'trait' },
        },
        {
          kind: 'identityKind',
          key: race.dwarf,
          releaseKind: 'race',
          stored: { catalogEntryId: wrong.dwarf, kind: 'feat' },
        },
        {
          kind: 'referenceKind',
          key: dwarfTrait.key,
          reference: race.dwarf,
          expectedKind: 'race',
          found: {
            source: 'stored',
            catalogEntryId: wrong.dwarf,
            kind: 'feat',
          },
        },
      ]),
    );
    expect(result.conflicts).toHaveLength(3);
    const rows = await storedRows(t, keys);
    expect(rows[alertness]?.map(({ _id }) => _id)).toEqual([wrong.alertness]);
    expect(rows[race.dwarf]?.map(({ _id }) => _id)).toEqual([wrong.dwarf]);
    expect(rows[dwarfTrait.key]).toEqual([]);
    // Reconciliation refuses the wrong kind rather than guessing.
    const run = await operatorReconcile(t, 1);
    expect(run.status.isReady).toBe(false);
    expect(run.status.discoveryError).toContain(
      'changes its stable identity kind',
    );
  },
  slow,
);

test(
  'a narrower scope retires a dropped feat with its last usable body; existing uses and copies stay while new ones are refused',
  async () => {
    const { t, owner, create, scope } = await releaseFixture(modules);
    const vessa = scope.characterId;
    const bren = await create('Bren');
    // Cora plays in a second fixture campaign that never customizes
    // Alertness, so her Selection keeps naming the global identity.
    const otherCampaign = await t.run((ctx) =>
      ctx.db.insert('campaign', {
        name: 'Second fixture campaign',
        description: '',
        organizationId: 'org',
        ownerId: 'test|owner',
        e2eFixture: {
          namespace: 'activation',
          version: 1,
          workerKey: '0',
          caseKey: 'activation',
          campaignKey: 'second',
        },
      }),
    );
    const cora = await owner.mutation(api.characterSheet.create, {
      organizationId: 'org',
      campaignId: otherCampaign,
      name: 'Cora',
      kind: 'pc',
      operationId: 'create-Cora',
    });
    const first = await built('first');
    const firstArtifact = await artifactOf('first');
    const ids = await seedIdentities(t, definitionsOf(firstArtifact));
    const alertnessId = ids.get(alertness);
    if (!alertnessId) throw new Error('Missing stored Alertness');
    await operatorPrepare(t, first.artifactPath);
    await operatorActivate(t, 1, (await operatorReconcile(t, 1)).runId);

    // Under release 1 Cora takes the global Alertness; Vessa takes it and
    // customizes it for her campaign.
    const coraSelectionId = await owner.mutation(
      api.characterSheet.selectEntry,
      {
        characterId: cora,
        catalogEntryId: alertnessId,
        operationId: 'cora-alertness',
      },
    );
    const selectionId = await owner.mutation(api.characterSheet.selectEntry, {
      characterId: vessa,
      catalogEntryId: alertnessId,
      operationId: 'vessa-alertness',
    });
    const copyId = await owner.mutation(
      api.catalogCopies.customizeForCampaign,
      {
        characterId: vessa,
        catalogEntryId: alertnessId,
        operationId: 'alertness-copy',
      },
    );
    await owner.mutation(api.catalogCopies.editDefinition, {
      characterId: vessa,
      catalogEntryId: copyId,
      name: 'Alertness (watch drill)',
      operationId: 'alertness-copy-name',
    });

    // Release 2 drops Alertness: the scope identity changes (previous-drift),
    // the gates pass and the retirement report keeps its last usable body.
    const second = await built('narrowed');
    const secondArtifact = await artifactOf('narrowed');
    expect(
      second.report.qualification.findings.map(({ code }) => code),
    ).toContain('previous-drift');
    const firstBody = definitionsOf(firstArtifact).find(
      ({ key }) => key === alertness,
    )?.payload;
    expect(
      definitionsOf(secondArtifact).some(({ key }) => key === alertness),
    ).toBe(false);
    expect(
      rowsOf(secondArtifact).find(
        ({ key }) => key === `retirement:${alertness}`,
      )?.payload,
    ).toEqual({
      externalKey: alertness,
      kind: 'definition',
      state: 'retired',
      lastUsableDefinition: firstBody,
      // #227 slice 4: a retained body is bound without its label.
      definitionFingerprint: computeFingerprint(
        isObject(firstBody)
          ? Object.fromEntries(
              Object.entries(firstBody).filter(
                ([field]) => field !== 'verification',
              ),
            )
          : firstBody,
      ),
    });
    const notices = (artifact: CatalogReleaseArtifact) => {
      const payload = rowsOf(artifact).find(
        ({ kind, key }) =>
          kind === 'legal' && key === 'permanentNoticeSuperset',
      )?.payload;
      return (Array.isArray(payload) ? payload : []).map((notice) =>
        JSON.stringify(notice),
      );
    };
    expect(notices(secondArtifact)).toEqual(
      expect.arrayContaining(notices(firstArtifact)),
    );

    await operatorPrepare(t, second.artifactPath);
    await operatorActivate(t, 2, (await operatorReconcile(t, 2)).runId);
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId: vessa }),
    );
    expect(sheet?.catalogView?.releaseNumber).toBe(2);
    expect(sheet?.entries).toContainEqual(
      expect.objectContaining({ _id: selectionId, catalogEntryId: copyId }),
    );
    expect(
      sheet?.calculated.resolvedEntries.find(
        ({ storedEntryId }) => storedEntryId === selectionId,
      ),
    ).toMatchObject({ counting: true });
    expect(
      sheet?.catalogEntries.find(({ _id }) => _id === copyId),
    ).toMatchObject({
      name: 'Alertness (watch drill)',
      copiedFrom: alertnessId,
    });
    // Cora's Selection still names the retired global identity and reads
    // its last usable released body, not the stored placeholder (which has
    // no sources or description), and it still counts.
    if (!isObject(firstBody)) throw new Error('Missing released Alertness');
    expect(firstBody.sources).not.toEqual([]);
    expect(firstBody.description).toBeTruthy();
    const coraSheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId: cora }),
    );
    expect(coraSheet?.catalogView?.releaseNumber).toBe(2);
    expect(coraSheet?.entries).toContainEqual(
      expect.objectContaining({
        _id: coraSelectionId,
        catalogEntryId: alertnessId,
      }),
    );
    expect(
      coraSheet?.catalogEntries.find(({ _id }) => _id === alertnessId),
    ).toMatchObject({
      ruleIdentity: alertness,
      name: firstBody.name,
      sources: firstBody.sources,
      description: firstBody.description,
    });
    expect(
      coraSheet?.calculated.resolvedEntries.find(
        ({ storedEntryId }) => storedEntryId === coraSelectionId,
      ),
    ).toMatchObject({ counting: true });
    for (const catalogEntryId of [alertnessId, copyId])
      await expect(
        owner.mutation(api.characterSheet.selectEntry, {
          characterId: bren,
          catalogEntryId,
          operationId: `bren-alertness-${catalogEntryId}`,
        }),
      ).rejects.toThrow('retired');
    await expect(
      owner.mutation(api.catalogCopies.customizeForCampaign, {
        characterId: bren,
        catalogEntryId: alertnessId,
        operationId: 'bren-alertness-copy',
      }),
    ).rejects.toThrow('kept for existing Characters');
  },
  slow,
);

test(
  'dropping a row an included definition depends on fails the gate and writes no artifact',
  async () => {
    const { message, report, artifact } = await built('withoutSpellMastery');
    expect(artifact).toBeUndefined();
    expect(message).toContain('Catalog Release gates failed');
    expect(report.release).toMatchObject({
      refused: expect.stringContaining('Catalog Release gates failed'),
    });
    // Bonus Feats (WIZ) names Spell Mastery, which is no longer imported.
    expect(findOutcome(report, wizardFeatures.bonusFeats)).toMatchObject({
      outcome: 'held',
      cause: 'failed',
      gate: 'failed',
      reason: expect.stringContaining(spellMastery),
    });
  },
  slow,
);

/**
 * S3 criterion 6: a Fighter 20 on the sheet from the stored candidate
 * adapter's converted definitions (stored IDs, converted rows and slots):
 * one Combat bonus feat slot per bonus feat row, a warning for a feat of
 * another type, and no slot for a row an archetype replaces as a part.
 */
function expectFighterBonusFeatSlots(
  converted: Map<string, Doc<'catalogEntry'>>,
  ids: Map<string, Id<'catalogEntry'>>,
) {
  const id = (key: string) => {
    const stored = ids.get(key);
    if (!stored) throw new Error(`Missing stored ${key}`);
    return stored;
  };
  const feat = (name: string, featTypes: string[]) => ({
    _id: `feat/${name}`,
    name,
    ruleIdentity: `feat/${name}`,
    modifiers: [],
    detail: { kind: 'feat' as const, featTypes },
  });
  const combatFeat = feat('Power Attack', ['Combat']);
  const generalFeat = feat('Skill Focus', ['General']);
  const fourthRow = id('everythingpath/fighter-bonus-feats-4');
  const archetype: CharacterSheetCatalogEntry = {
    _id: 'archetype/fourth-level',
    name: 'Test archetype',
    ruleIdentity: 'archetype/fourth-level',
    modifiers: [],
    detail: {
      kind: 'archetype',
      classEntryIds: [id(fighter)],
      replaces: [{ classLevel: 4, catalogEntryId: fourthRow, scope: 'part' }],
      adds: [],
    },
  };
  const sheet = (extra: SheetEntry[] = []): CharacterSheetInput => ({
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      ...Array.from(
        { length: 20 },
        (_, index): SheetEntry => ({
          _id: `level-${index + 1}`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            position: index + 1,
            classEntryId: id(fighter),
            hpGained: 10,
          },
        }),
      ),
      ...extra,
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: 10,
        })),
      },
      ...converted.values(),
      combatFeat,
      generalFeat,
      archetype,
    ],
  });
  const bonusFeatSlots = (input: CharacterSheetInput) =>
    calculateCharacterSheet(input).selectionRules.slots.filter(
      ({ kind, grantedBy }) => kind === 'feat' && grantedBy,
    );
  const levels = [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
  const slots = bonusFeatSlots(sheet());
  expect(slots.map(({ label }) => label)).toEqual(
    // The acquisition's Foundry name, then the table's row label.
    levels.map((level) =>
      level === 1
        ? 'Bonus Feats (FGT) (level 1)'
        : `Bonus Feat (level ${level})`,
    ),
  );
  for (const slot of slots)
    expect(slot, slot.label).toMatchObject({ count: 1, featTypes: ['Combat'] });
  // A feat in the 4th-level row's slot: a Combat feat fits; another warns.
  const fourth = slots.find(({ label }) => label === 'Bonus Feat (level 4)');
  if (!fourth?.grantedBy) throw new Error('No 4th-level bonus feat slot');
  const grantedBy = fourth.grantedBy;
  const featSlotType = (pick: CharacterSheetCatalogEntry) =>
    calculateCharacterSheet(
      sheet([
        {
          _id: 'pick',
          kind: 'feat',
          active: true,
          catalogEntryId: pick._id,
          selectionSource: { kind: 'slot', grantedBy },
          state: { kind: 'feat' },
        },
      ]),
    ).warnings.filter(({ check }) => check === 'featSlotType');
  expect(featSlotType(combatFeat)).toEqual([]);
  expect(featSlotType(generalFeat)).toEqual([
    expect.objectContaining({
      message: 'Skill Focus does not match this bonus feat slot.',
    }),
  ]);
  // An archetype replacing the 4th-level row as a part removes its slot.
  const replaced = bonusFeatSlots(
    sheet([
      {
        _id: 'archetype-row',
        kind: 'archetype',
        active: true,
        catalogEntryId: archetype._id,
        state: { kind: 'archetype' },
      },
    ]),
  );
  expect(replaced.map(({ label }) => label)).toEqual(
    slots
      .map(({ label }) => label)
      .filter((label) => label !== 'Bonus Feat (level 4)'),
  );
}

// Trait and itemAbility are proven at the conversion seam, not end to end;
// the Wizard, a caster, converts end to end above (S3). Fighter, whose
// closure is fully pinned, is dependently omitted on Weapon Training and
// its 9/13/17 increments, held on owner-owed evidence (#625); its 27 rows are its seven features (Armor Mastery at 19) and the 20
// increments of its reviewed schedule. Traits, item abilities (curated
// Seeking, uncurated Keen) and the Longsword are outside the reduced
// scope's rows; Unarmed Strike is reachable only through the Fighter. Ward,
// the scope's one spellEffect row, imports as a class feature, so no
// spellEffect body exists. Real pinned bodies are staged in an isolated
// fixture without admission.
test(
  'held kinds convert at the stored candidate seam, and an uncurated item ability refuses discovery (#764)',
  async () => {
    const { t } = await releaseFixture(modules);
    expect(wardRowKind).toBe('spellEffect');
    expect(detailKind(pinnedBody(ward).payload)).toBe('classFeature');
    expect(pinnedBody(bravery).payload).toMatchObject({ name: 'Bravery' });

    const bodies = [
      fighter,
      ...fighterFeatures,
      ...fighterIncrements,
      magicalLineage,
      longsword,
      seeking,
    ].map(pinnedBody);
    expect(bodies.map(({ payload }) => detailKind(payload))).toEqual([
      'class',
      ...fighterFeatures.map(() => 'classFeature'),
      ...fighterIncrements.map(() => 'classFeature'),
      'trait',
      'item',
      'itemAbility',
    ]);
    const ids = await seedIdentities(t, bodies);
    await prepare(
      t,
      bodies.map(({ key, payload }) => ({ kind: 'definition', key, payload })),
    );
    const converted = await candidates(t, 1, ids);
    expectConverted(bodies, converted, ids);
    // S3: the Fighter's 27 rows resolve to the staged features and increments.
    const fighterDetail = converted.get(fighter)?.detail;
    const fighterRows =
      fighterDetail && 'featuresByLevel' in fighterDetail
        ? fighterDetail.featuresByLevel
        : [];
    expect(
      fighterRows.map(({ catalogEntryId }) => catalogEntryId).sort(),
    ).toEqual(
      [...fighterFeatures, ...fighterIncrements]
        .map((key) => ids.get(key))
        .sort(),
    );
    // Each increment keeps its parent and part; a bonus feat row its slot.
    expect(converted.get('everythingpath/fighter-bravery-6')?.detail).toEqual({
      kind: 'classFeature',
      parentFeature: bravery,
      part: `6:${bravery}`,
    });
    for (const key of [
      'pf1/CV8BsY3ciUb9TA1Y',
      'everythingpath/fighter-bonus-feats-4',
    ])
      expect(converted.get(key)?.grantsSlots, key).toEqual([
        { kind: 'feat', count: 1, featTypes: ['Combat'] },
      ]);
    expectFighterBonusFeatSlots(converted, ids);
    // The adapter treats a class's casting as stored identity. The Wizard's
    // imported casting names its ability as stored casting does (S3), so it
    // converts against the reviewed record and refuses against none; an
    // unknown Foundry code, which the importer keeps and reports, refuses.
    // Its features are set aside so the casting check is the one reached.
    const wizardPayload = pinnedBody(wizard).payload;
    const wizardDetail = isObject(wizardPayload)
      ? wizardPayload.detail
      : undefined;
    if (!isObject(wizardPayload) || !isObject(wizardDetail))
      throw new Error('The Wizard has a class detail');
    const castingWizard = (casting = wizardDetail.casting) => ({
      key: wizard,
      payload: parseReleaseJson(
        JSON.parse(
          JSON.stringify({
            ...wizardPayload,
            detail: { ...wizardDetail, featuresByLevel: [], casting },
          }),
        ),
      ),
    });
    expect(castingWizard().payload).toMatchObject({
      detail: {
        kind: 'class',
        tag: 'wizard',
        casting: { ability: 'intelligence' },
      },
    });
    const reviewedCasting = findReviewedClassCasting('wizard');
    expect(reviewedCasting).toMatchObject({ ability: 'intelligence' });
    const convertCaster = async (
      body: ReturnType<typeof castingWizard>,
      casting?: Casting,
    ) => {
      const caster = await releaseFixture(modules);
      const casterIds = new Map(
        await caster.t.run(async (ctx) => {
          const entry = storedClassIdentity('Wizard', wizard, casting);
          return [
            [wizard, await ctx.db.insert('catalogEntry', entry)] as [
              string,
              Id<'catalogEntry'>,
            ],
          ];
        }),
      );
      await prepare(caster.t, [{ kind: 'definition', ...body }]);
      return candidates(caster.t, 1, casterIds);
    };
    const refusal = `Candidate casting metadata is unsupported for ${wizard}`;
    expect(
      (await convertCaster(castingWizard(), reviewedCasting)).get(wizard)
        ?.detail,
    ).toMatchObject({ kind: 'class', casting: reviewedCasting });
    await expect(convertCaster(castingWizard())).rejects.toThrow(refusal);
    // An unknown Foundry code (the importer keeps `int2` and reports it).
    await expect(
      convertCaster(
        castingWizard(
          isObject(wizardDetail.casting)
            ? { ...wizardDetail.casting, ability: 'int2' }
            : null,
        ),
        reviewedCasting,
      ),
    ).rejects.toThrow(refusal);
    expect(converted.get(longsword)?.detail).toMatchObject({
      kind: 'item',
      weapon: expect.objectContaining({ baseType: expect.any(String) }),
    });
    // The importer gives Unarmed Strike (a monster ability record) a legacy
    // weapon shape, which the adapter refuses explicitly (#761).
    const unarmed = pinnedBody(unarmedStrike);
    const weaponless = await releaseFixture(modules);
    const unarmedIds = await seedIdentities(weaponless.t, [unarmed]);
    await prepare(weaponless.t, [{ kind: 'definition', ...unarmed }]);
    await expect(candidates(weaponless.t, 1, unarmedIds)).rejects.toThrow(
      `Unsupported candidate weapon ${unarmedStrike}: unsupported or incomplete imported profile (legacy weapon shape)`,
    );

    // Keen has no curation record: its body lacks the stored bonus equivalent.
    const ability = pinnedBody(keen);
    const other = await releaseFixture(modules);
    await seedIdentities(other.t, [ability]);
    await prepare(other.t, [{ kind: 'definition', ...ability }]);
    const runId = await discover(other.t);
    expect(
      await other.t.query(internal.catalogReleaseImpact.status, { runId }),
    ).toMatchObject({
      isReady: false,
      discoveryError: `Discovery failed for ${keen}: Candidate definition ${keen} is not supported by the prepared sheet resolver`,
    });
  },
  slow,
);

// B2a: released Situational Notes replace the stored row's for every kind.
function notesOf(payload: ReleaseJson) {
  return isObject(payload) ? payload.situationalNotes : undefined;
}
const staleNote = { text: 'A stale stored Note the release does not have.' };

test(
  "released Situational Notes replace the stored row's for every kind, while scoped entries and Catalog Copies keep theirs",
  async () => {
    const { t, campaignId, scope } = await releaseFixture(modules);
    // (a) A feat, a racialTrait, a spell and an itemAbility with Notes.
    const noted = [mountedCombat, hardy, fireball, seeking].map(pinnedBody);
    expect(noted.map(({ payload }) => detailKind(payload))).toEqual([
      'feat',
      'racialTrait',
      'spell',
      'itemAbility',
    ]);
    for (const { key, payload } of noted)
      expect(notesOf(payload), key).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ text: expect.any(String) }),
        ]),
      );
    // (b) A body without Notes whose stored row has some.
    const plain = fighterFeatures
      .map(pinnedBody)
      .find(({ payload }) => notesOf(payload) === undefined);
    if (!plain) throw new Error('Every Fighter feature has Notes');
    const dwarf = pinnedBody(race.dwarf);
    const ids = await seedIdentities(t, [...noted, plain, dwarf]);
    const id = (key: string) => {
      const stored = ids.get(key);
      if (!stored) throw new Error(`Missing stored ${key}`);
      return stored;
    };
    await t.run(async (ctx) => {
      for (const key of [plain.key, mountedCombat])
        await ctx.db.patch('catalogEntry', id(key), {
          situationalNotes: [staleNote],
        });
    });
    // (e) Scoped entries, a Catalog Copy and an imported Spell of released
    // identities, each with stale Notes.
    const stored = await t.run(async (ctx) => {
      const fieldsOf = async (key: string) => {
        const entry = await ctx.db.get('catalogEntry', id(key));
        if (!entry) throw new Error(`Missing stored ${key}`);
        const { _id, _creationTime, ...fields } = entry;
        return { ...fields, situationalNotes: [staleNote] };
      };
      const scoped = {
        ...(await fieldsOf(mountedCombat)),
        name: 'Mounted Combat (house rule)',
      };
      return {
        campaign: await ctx.db.insert('catalogEntry', {
          ...scoped,
          scope: 'campaign',
          campaignId,
        }),
        character: await ctx.db.insert('catalogEntry', {
          ...scoped,
          scope: 'character',
          characterId: scope.characterId,
        }),
        copy: await ctx.db.insert('catalogEntry', {
          ...scoped,
          scope: 'campaign',
          campaignId,
          copiedFrom: id(mountedCombat),
        }),
        importedSpell: await ctx.db.insert('catalogEntry', {
          ...(await fieldsOf(fireball)),
          scope: 'character',
          characterId: scope.characterId,
          importedSpell: true,
        }),
      };
    });
    await prepare(
      t,
      [...noted, plain, dwarf].map(({ key, payload }) => ({
        kind: 'definition' as const,
        key,
        payload,
      })),
    );
    // The Dwarf only resolves Hardy's race; it is not converted here.
    const converted = await candidates(
      t,
      1,
      new Map([...ids].filter(([key]) => key !== race.dwarf)),
    );
    expectConverted([...noted, plain], converted, ids);
    for (const { key, payload } of noted)
      expect(converted.get(key)?.situationalNotes, key).toEqual(
        notesOf(payload),
      );
    expect(converted.get(plain.key)).not.toHaveProperty('situationalNotes');

    const release = await releaseDoc(t, 1);
    await t.run(async (ctx) => {
      for (const entryId of [stored.campaign, stored.character, stored.copy]) {
        const entry = await ctx.db.get('catalogEntry', entryId);
        if (!entry) throw new Error('Missing scoped entry');
        expect(await candidateDefinition(ctx, release, entry)).toEqual(entry);
      }
      const spell = await ctx.db.get('catalogEntry', stored.importedSpell);
      if (!spell) throw new Error('Missing imported Spell');
      expect(
        (await candidateDefinition(ctx, release, spell)).situationalNotes,
      ).toEqual(notesOf(pinnedBody(fireball).payload));
    });
  },
  slow,
);

test(
  "a retired body's released Notes reach its retained use",
  async () => {
    const { t } = await releaseFixture(modules);
    const feat = pinnedBody(mountedCombat);
    const ids = await seedIdentities(t, [feat]);
    await prepare(t, [
      {
        kind: 'report',
        key: `retirement:${mountedCombat}`,
        payload: {
          externalKey: mountedCombat,
          kind: 'definition',
          state: 'retired',
          lastUsableDefinition: feat.payload,
          definitionFingerprint: computeFingerprint(feat.payload),
        },
      },
    ]);
    const converted = await candidates(t, 1, ids);
    expectConverted([feat], converted, ids);
    expect(converted.get(mountedCombat)?.situationalNotes).toEqual(
      notesOf(feat.payload),
    );
  },
  slow,
);

test(
  'a released Note the stored validator rejects refuses the whole candidate; no Note is filtered out',
  async () => {
    const feat = pinnedBody(mountedCombat);
    const notes = notesOf(feat.payload);
    if (!Array.isArray(notes)) throw new Error('Mounted Combat has Notes');
    // A stable key where the stored Note names a stored ID (#305): the
    // release body is valid, but the prepared sheet resolver cannot read it.
    for (const unsupported of [
      {
        text: 'Applies while Alertness is active.',
        condition: { whileActive: alertness },
      },
      {
        text: 'Applies to the Alertness option.',
        situation: { option: alertness },
      },
    ]) {
      const { t } = await releaseFixture(modules);
      const payload = parseReleaseJson(
        JSON.parse(
          JSON.stringify({
            ...(isObject(feat.payload) ? feat.payload : {}),
            situationalNotes: [...notes, unsupported],
          }),
        ),
      );
      const ids = await seedIdentities(t, [{ key: mountedCombat, payload }]);
      await prepare(t, [{ kind: 'definition', key: mountedCombat, payload }]);
      const message = `Candidate definition ${mountedCombat} is not supported by the prepared sheet resolver`;
      await expect(candidates(t, 1, ids)).rejects.toThrow(message);
      const runId = await discover(t);
      expect(
        await t.query(internal.catalogReleaseImpact.status, { runId }),
      ).toMatchObject({
        isReady: false,
        discoveryError: `Discovery failed for ${mountedCombat}: ${message}`,
      });
    }
  },
  slow,
);

test(
  "a Character reads a released feat's Situational Note through the public sheet after fixture-only activation",
  async () => {
    const { t, owner, scope } = await releaseFixture(modules);
    const { artifactPath, report } = await built('notes');
    const artifact = await artifactOf('notes');
    const definitions = definitionsOf(artifact);
    const released = definitions.find(({ key }) => key === mountedCombat);
    if (!released)
      throw new Error(
        `Mounted Combat was not released: ${JSON.stringify(findOutcome(report, mountedCombat))}`,
      );
    expect(findOutcome(report, mountedCombat)).toMatchObject({
      outcome: 'held',
      cause: 'requirement',
      gate: 'admitted',
    });
    const notes = notesOf(released.payload);
    expect(notes).toEqual([
      expect.objectContaining({
        text: expect.stringContaining('Ride check'),
      }),
    ]);

    // The stored identity is a placeholder without Notes.
    const ids = await seedIdentities(t, definitions);
    const mountedCombatId = ids.get(mountedCombat);
    if (!mountedCombatId) throw new Error('Missing stored Mounted Combat');
    await operatorPrepare(t, artifactPath);
    const run = await operatorReconcile(t, 1);
    expect(run.stopped).toBe('ready');
    await operatorActivate(t, 1, run.runId);
    await owner.mutation(api.characterSheet.selectEntry, {
      characterId: scope.characterId,
      catalogEntryId: mountedCombatId,
      operationId: 'vessa-mounted-combat',
    });
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, {
        characterId: scope.characterId,
      }),
    );
    expect(sheet?.catalogView?.releaseNumber).toBe(1);
    const sheetNotes = sheet?.catalogEntries.find(
      ({ _id }) => _id === mountedCombatId,
    )?.situationalNotes;
    expect(sheetNotes).toEqual(notes);
    expect(sheet?.calculated.entryNotes.map(({ text }) => text)).toEqual(
      sheetNotes?.map(({ text }) => text),
    );
  },
  slow,
);
