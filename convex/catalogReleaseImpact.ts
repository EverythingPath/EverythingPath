import {
  candidateDefinition,
  releaseRow,
  readRetiredDefinition,
  retirementKeyPrefix,
  retirementKeyEnd,
  globalDefinition,
  findStableDefinition,
  recordCandidateRead,
  type CandidateReadBudget,
} from './lib/catalogCandidateDefinition';
import { catalogReleaseLimits } from '../src/lib/catalog/release-limits';
import { applyCompanionToSheet } from './lib/characterSheetCompanion';
import { ConvexError, getDocumentSize, v, type Infer } from 'convex/values';
import {
  paginationOptsValidator,
  paginationResultValidator,
  type GenericDocument,
} from 'convex/server';
import { internalQuery, type MutationCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { ReadCtx } from './types';
import schema, {
  catalogImpactEvaluationValidator as evaluationValidator,
} from './schema';
import { generalInternalMutation } from './lib/writeGate';
import { requireCurrentPreparation } from './catalogRelease';
import { markCatalogImpactDirty } from './lib/catalogReleaseImpact';
import {
  readSelectedCharacterFacts,
  readSelectedCampaignFactsGeneration,
  projectSelectedCatalogDefinition,
  readRetiredSheetIdentities,
  listRetainedGrantIds,
} from './lib/catalogReleaseBoundary';
import {
  listCatalogDependencyKeys,
  listCatalogReferences,
} from '../src/lib/catalog-copy-references';
import {
  planReleaseImpact,
  type ReleaseDependencyEdge,
} from '../src/lib/catalog/release-impact';
import {
  releaseFingerprint,
  releaseByteCount,
  isObject,
} from '../src/lib/catalog/release-schema';
import { importedCatalogEntrySchema } from '../src/lib/catalog/imported-entry-schema';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';
import {
  calculateCharacterSheetProjectionsForRelease,
  isSupportedCatalogCalculation,
} from '../src/lib/catalog/calculation-dispatch';
import { calculateMilitiaCharacterFacts } from './lib/militiaCharacterFacts';
import {
  buildCharacterSheetInput,
  readCharacterSheetData,
} from './lib/characterSheetData';
import {
  projectCampaignCopies,
  findPreferredCampaignCopy,
} from './lib/catalogCopies';
import {
  reviewedCastingTablesSchema,
  defaultCastingTables,
} from '../src/lib/character-sheet-casting-tables';

const maxSheetRows = catalogReleaseLimits.sheetRows;
const maxCandidateReadBytes = catalogReleaseLimits.candidateReadBytes;
const maxBatchReadBytes = 512000;
const maxStatusRows = 1024;
const definitionBatchRows = 4;
const characterBatchRows = catalogReleaseLimits.characterBatchRows;
const reverseSpellBatchRows = catalogReleaseLimits.reverseSpellBatchRows;
const maxDependencies = catalogReleaseLimits.dependencies;
const maxResourceRows = catalogReleaseLimits.resourceRows;
const maxInspectionRows = catalogReleaseLimits.inspectionRows;

/**
 * The first page of an index range, read row by row instead of paginated: a
 * deployment runs only one paginated query per function (#755). As a first
 * page with these bounds would, it stops at the row that reaches either bound
 * and is then not done. Bytes are Convex-encoded document sizes, as the
 * deployment counts them.
 */
async function readFirstPage<Row extends GenericDocument>({
  query,
  maximumRowsRead,
  maximumBytesRead = maxCandidateReadBytes,
}: {
  query: AsyncIterable<Row>;
  maximumRowsRead: number;
  maximumBytesRead?: number;
}) {
  const page: Row[] = [];
  let bytesRead = 0;
  for await (const row of query) {
    page.push(row);
    bytesRead += getDocumentSize(row);
    if (page.length >= maximumRowsRead || bytesRead >= maximumBytesRead)
      return { page, isDone: false };
  }
  return { page, isDone: true };
}

async function readRun(ctx: ReadCtx, runId: Id<'catalogImpactRun'>) {
  const run = await ctx.db.get('catalogImpactRun', runId);
  if (!run) throw new ConvexError('Catalog impact run is missing');
  const release = await ctx.db.get('catalogRelease', run.releaseId);
  if (!release) throw new ConvexError('Catalog Release does not exist');
  return { run, release };
}

async function requireCharacterWork(
  ctx: ReadCtx,
  runId: Id<'catalogImpactRun'>,
  characterId: Id<'character'>,
) {
  const work = await ctx.db
    .query('catalogImpactWork')
    .withIndex('by_runId_and_characterId', (q) =>
      q.eq('runId', runId).eq('characterId', characterId),
    )
    .unique();
  if (!work)
    throw new ConvexError(
      `Character ${characterId} has no candidate work in run ${runId}`,
    );
  return work;
}

async function countWorkState(
  ctx: ReadCtx,
  runId: Id<'catalogImpactRun'>,
  state: 'dirty' | 'failed',
) {
  const page = await readFirstPage({
    query: ctx.db
      .query('catalogImpactWork')
      .withIndex('by_runId_and_state', (q) =>
        q.eq('runId', runId).eq('state', state),
      ),
    maximumRowsRead: maxStatusRows,
  });
  return { count: page.page.length, hasMore: !page.isDone };
}

async function clearControl(ctx: MutationCtx, runId: Id<'catalogImpactRun'>) {
  const control = await ctx.db
    .query('catalogImpactControl')
    .withIndex('by_key', (q) => q.eq('key', 'global'))
    .unique();
  if (control?.runId === runId)
    await ctx.db.delete('catalogImpactControl', control._id);
}

async function latestReadyRun(ctx: ReadCtx, releaseId: Id<'catalogRelease'>) {
  return ctx.db
    .query('catalogImpactRun')
    .withIndex('by_releaseId_and_lifecycle', (q) =>
      q.eq('releaseId', releaseId).eq('lifecycle', 'ready'),
    )
    .order('desc')
    .first();
}

async function requirePreparedRelease(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
) {
  await requireCurrentPreparation(ctx, release);
  if (release.state !== 'prepared')
    throw new ConvexError('Catalog Release is not prepared');
}

async function requireActiveRegistration(
  ctx: ReadCtx,
  run: Doc<'catalogImpactRun'>,
) {
  const control = await ctx.db
    .query('catalogImpactControl')
    .withIndex('by_key', (q) => q.eq('key', 'global'))
    .unique();
  if (run.lifecycle === 'ready' && !control) {
    const latest = await ctx.db
      .query('catalogImpactRun')
      .withIndex('by_releaseId', (q) => q.eq('releaseId', run.releaseId))
      .order('desc')
      .first();
    const active = await ctx.db
      .query('catalogReleaseControl')
      .withIndex('by_key', (q) => q.eq('key', 'global'))
      .unique();
    if (latest?._id === run._id && active?.impactRunId !== run._id) return;
  }
  if (
    control?.runId !== run._id ||
    (run.lifecycle && run.lifecycle !== 'active')
  )
    throw new ConvexError('Catalog impact run was superseded');
}

async function requireRun(ctx: ReadCtx, runId: Id<'catalogImpactRun'>) {
  const recorded = await readRun(ctx, runId);
  await requireActiveRegistration(ctx, recorded.run);
  await requirePreparedRelease(ctx, recorded.release);
  return recorded;
}

async function readResources(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
  budget: CandidateReadBudget,
) {
  const nextPage = await readFirstPage({
    query: ctx.db
      .query('catalogReleaseRow')
      .withIndex('by_releaseId_and_kind_and_key', (q) =>
        q.eq('releaseId', release._id).eq('kind', 'resource'),
      ),
    maximumRowsRead: maxResourceRows + 1,
  });
  const next = nextPage.page;
  const base = await baseRelease(ctx, release);
  const oldPage = base
    ? await readFirstPage({
        query: ctx.db
          .query('catalogReleaseRow')
          .withIndex('by_releaseId_and_kind_and_key', (q) =>
            q.eq('releaseId', base._id).eq('kind', 'resource'),
          ),
        maximumRowsRead: maxResourceRows + 1,
      })
    : null;
  const old = oldPage?.page ?? [];
  recordCandidateRead(budget, next);
  recordCandidateRead(budget, old);
  if (
    !nextPage.isDone ||
    (oldPage && !oldPage.isDone) ||
    next.length > maxResourceRows ||
    old.length > maxResourceRows
  )
    throw new ConvexError('Release exceeds representative resource limit');
  const changed: string[] = [];
  for (const key of new Set([...next, ...old].map((row) => row.key))) {
    const candidate: unknown = next.find((row) => row.key === key)?.payload;
    const previous: unknown = old.find((row) => row.key === key)?.payload;
    if (
      (await releaseFingerprint(candidate ?? null)) !==
      (await releaseFingerprint(previous ?? null))
    ) {
      if (
        !base &&
        key === 'builtin:casting-tables' &&
        isObject(candidate) &&
        (await releaseFingerprint(candidate.definitions)) ===
          (await releaseFingerprint(defaultCastingTables))
      )
        continue;
      changed.push(`resource:${key}`);
    }
  }
  const casting: unknown = next.find(
    (row) => row.key === 'builtin:casting-tables',
  )?.payload;
  if (
    casting === undefined &&
    old.some((row) => row.key === 'builtin:casting-tables')
  )
    throw new ConvexError('Candidate casting resource removal is unsupported');
  if (casting !== undefined && !isObject(casting))
    throw new ConvexError('Candidate casting resource is invalid');
  return {
    rows: next,
    oldRows: old,
    changed,
    hasCalculationChanged:
      (base?.manifest.compatibility.calculation ??
        catalogRuntimeCompatibility.calculation) !==
      release.manifest.compatibility.calculation,
    castingTables: isObject(casting)
      ? reviewedCastingTablesSchema.parse(casting.definitions)
      : undefined,
  };
}

function keyedReleaseEdges(
  key: string,
  payload: unknown,
): ReleaseDependencyEdge[] {
  if (!isObject(payload) || !isObject(payload.detail)) return [];
  const detail = payload.detail;
  const edges: ReleaseDependencyEdge[] = [];
  if (typeof detail.spellKey === 'string')
    edges.push({ from: `key:${key}`, to: `key:${detail.spellKey}` });
  if (detail.kind === 'spell') {
    if (isObject(detail.levels))
      for (const tag of Object.keys(detail.levels))
        edges.push({ from: `casting:${tag}`, to: `key:${key}` });
    if (isObject(detail.grantedLevels))
      for (const [kind, lists] of Object.entries(detail.grantedLevels))
        if (isObject(lists))
          for (const list of Object.keys(lists))
            edges.push({ from: `granted:${kind}:${list}`, to: `key:${key}` });
  }
  if (edges.length > maxSheetRows)
    throw new ConvexError(
      'Definition exceeds representative keyed relationship limit',
    );
  return edges;
}

async function readKeyedChanges(
  ctx: ReadCtx,
  runId: Id<'catalogImpactRun'>,
  roots: string[],
  liveSpellKeys: Set<string>,
) {
  const edges: ReleaseDependencyEdge[] = [];
  const changed: string[] = [];
  const seen = new Set<string>();
  const pending = [...roots];
  while (pending.length) {
    const key = pending.pop();
    if (key === undefined) break;
    if (seen.has(key)) continue;
    seen.add(key);
    if (seen.size > maxDependencies)
      throw new ConvexError(
        'Sheet exceeds representative keyed dependency limit',
      );
    const change = await ctx.db
      .query('catalogImpactChange')
      .withIndex('by_runId_and_key', (q) => q.eq('runId', runId).eq('key', key))
      .unique();
    if (change?.hasChanged) changed.push(key);
    const dependencies = await ctx.db
      .query('catalogImpactEdge')
      .withIndex('by_runId_and_from', (q) =>
        q.eq('runId', runId).eq('from', key),
      )
      .take(maxDependencies + 1);
    if (
      dependencies.length > maxDependencies ||
      edges.length + dependencies.length > maxDependencies
    )
      throw new ConvexError(
        'Sheet exceeds representative keyed dependency limit',
      );
    for (const edge of dependencies) {
      if (key.startsWith('character:') && !liveSpellKeys.has(edge.to)) continue;
      edges.push({ from: edge.from, to: edge.to });
      pending.push(edge.to);
    }
  }
  return { edges, changed };
}

/** Recheck current lightweight references, including writes after reverse discovery. */
async function readLiveSpellKeys(
  ctx: ReadCtx,
  runId: Id<'catalogImpactRun'>,
  characterId: Id<'character'>,
  budget: CandidateReadBudget,
) {
  const edges = await readFirstPage({
    query: ctx.db
      .query('catalogImpactEdge')
      .withIndex('by_runId_and_from', (q) =>
        q.eq('runId', runId).eq('from', `character:${characterId}`),
      ),
    maximumRowsRead: maxDependencies,
  });
  recordCandidateRead(budget, edges.page);
  if (!edges.isDone)
    throw new ConvexError(
      `Character exceeds representative ${maxDependencies}-key Spell dependency limit`,
    );
  const liveKeys = new Set<string>();
  for (const edge of edges.page) {
    const ruleIdentity = edge.to.slice('key:'.length);
    const indexed = await ctx.db
      .query('spellCatalogIndex')
      .withIndex('by_characterId_and_ruleIdentity', (q) =>
        q.eq('characterId', characterId).eq('ruleIdentity', ruleIdentity),
      )
      .take(maxSheetRows + 1);
    if (indexed.length > maxSheetRows)
      throw new ConvexError(
        `Spell ${ruleIdentity} exceeds representative casting-reference limit`,
      );
    recordCandidateRead(budget, indexed);
    for (const row of indexed)
      if (await hasLiveSpellDefinition(ctx, row, budget)) {
        liveKeys.add(edge.to);
        break;
      }
    if (liveKeys.has(edge.to)) continue;
    // Older index rows have no identity; look up only this changed local key.
    const definitions = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_ruleIdentity', (q) =>
        q.eq('characterId', characterId).eq('ruleIdentity', ruleIdentity),
      )
      .take(maxSheetRows + 1);
    recordCandidateRead(budget, definitions);
    if (definitions.length > maxSheetRows)
      throw new ConvexError(
        `Spell ${ruleIdentity} exceeds representative local-definition limit`,
      );
    const global = await globalDefinition(ctx, ruleIdentity);
    recordCandidateRead(budget, global);
    const liveDefinitions = global ? [...definitions, global] : definitions;
    for (const definition of liveDefinitions) {
      if (
        definition.copiedFrom ||
        (definition.scope !== 'global' && !definition.importedSpell)
      )
        continue;
      const reference = await ctx.db
        .query('spellCatalogIndex')
        .withIndex('by_characterId_and_catalogEntryId', (q) =>
          q.eq('characterId', characterId).eq('catalogEntryId', definition._id),
        )
        .first();
      if (reference) {
        liveKeys.add(edge.to);
        break;
      }
    }
  }
  return liveKeys;
}

async function readImpactSheetEntries(
  ctx: ReadCtx,
  characterId: Id<'character'>,
  budget: CandidateReadBudget,
) {
  const entryPage = await readFirstPage({
    query: ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId)),
    maximumRowsRead: maxSheetRows + 1,
  });
  const entries = entryPage.page;
  recordCandidateRead(budget, entries);
  if (!entryPage.isDone || entries.length > maxSheetRows)
    throw new ConvexError('Sheet exceeds representative release impact limit');
  return entries;
}

async function readImpactDefinitions(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
  character: Doc<'character'>,
  roots: string[],
  budget: CandidateReadBudget,
) {
  const oldDefinitions = new Map<string, Doc<'catalogEntry'>>();
  const nextDefinitions = new Map<string, Doc<'catalogEntry'>>();
  const oldEdges: ReleaseDependencyEdge[] = [];
  const newEdges: ReleaseDependencyEdge[] = [];
  const changed: string[] = [];
  const pending = [...roots];
  const seen = new Set<string>();
  while (pending.length) {
    const id = pending.pop();
    if (id === undefined) break;
    if (seen.has(id)) continue;
    seen.add(id);
    if (seen.size > maxDependencies)
      throw new ConvexError('Sheet exceeds representative dependency limit');
    const normalized = ctx.db.normalizeId('catalogEntry', id);
    const active = normalized && (await ctx.db.get('catalogEntry', normalized));
    if (!active) continue;
    if (
      active.scope !== 'global' &&
      !(
        (active.scope === 'character' &&
          active.characterId === character._id) ||
        (active.scope === 'campaign' &&
          active.campaignId === character.campaignId)
      )
    )
      throw new ConvexError(
        'Catalog dependency does not belong to this Character',
      );
    const candidate = await candidateDefinition(ctx, release, active, budget);
    const selected = await projectSelectedCatalogDefinition(ctx, active);
    recordCandidateRead(budget, selected);
    recordCandidateRead(budget, candidate);
    oldDefinitions.set(id, selected);
    nextDefinitions.set(id, candidate);
    if (
      (await releaseFingerprint(selected)) !==
      (await releaseFingerprint(candidate))
    )
      changed.push(id, `key:${active.ruleIdentity}`);
    for (const [definition, edges] of [
      [selected, oldEdges],
      [candidate, newEdges],
    ] as const) {
      if (!definition.copiedFrom)
        edges.push({ from: id, to: `key:${definition.ruleIdentity}` });
      // Keyed joins: a class's own list, an Archetype casting from another
      // class's list, and every other consumer of a list's members.
      for (const key of listCatalogDependencyKeys(definition))
        edges.push({ from: id, to: `casting:${key}` });
      for (const reference of listCatalogReferences(definition)) {
        edges.push({ from: id, to: reference.id });
        pending.push(reference.id);
        if (oldEdges.length + newEdges.length > maxDependencies)
          throw new ConvexError(
            'Sheet exceeds representative relationship limit',
          );
      }
      if (
        definition.detail.kind === 'class' &&
        'casting' in definition.detail &&
        definition.detail.casting
      )
        edges.push({ from: id, to: 'resource:builtin:casting-tables' });
      if (definition.scope === 'global') {
        const copy = await findPreferredCampaignCopy(ctx, {
          campaignId: character.campaignId,
          originalId: definition._id,
        });
        recordCandidateRead(budget, copy);
        if (copy) {
          edges.push({ from: id, to: copy._id });
          pending.push(copy._id);
        }
      }
    }
  }
  const retiredIdentities = await readRetiredSheetIdentities(
    ctx,
    release._id,
    [...nextDefinitions.values()],
    { accountRead: (value) => recordCandidateRead(budget, value) },
  );
  return {
    oldDefinitions,
    nextDefinitions,
    oldEdges,
    newEdges,
    changed,
    retiredIdentities,
  };
}

async function readOwnImpactInputs(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
  character: Doc<'character'>,
  runId: Id<'catalogImpactRun'>,
  budget: CandidateReadBudget,
) {
  const entries = await readImpactSheetEntries(ctx, character._id, budget);
  const liveSpellKeys = await readLiveSpellKeys(
    ctx,
    runId,
    character._id,
    budget,
  );
  const roots = [
    ...listCatalogReferences(entries).map((ref) => ref.id),
    `character:${character._id}`,
    ...liveSpellKeys,
  ];
  const {
    oldDefinitions,
    nextDefinitions,
    oldEdges,
    newEdges,
    changed,
    retiredIdentities,
  } = await readImpactDefinitions(ctx, release, character, roots, budget);
  const resources = await readResources(ctx, release, budget);
  // Unknown built-in resources remain visible failures, never certified defaults.
  // Seed catalog resources initialize recorded defaults; they are not live dependencies.
  const keyedChanges = await readKeyedChanges(
    ctx,
    runId,
    [
      ...roots,
      ...oldEdges.map((edge) => edge.to),
      ...newEdges.map((edge) => edge.to),
    ],
    liveSpellKeys,
  );
  const planned = planReleaseImpact({
    roots,
    oldEdges,
    newEdges: [...newEdges, ...keyedChanges.edges],
    changed: [...changed, ...resources.changed, ...keyedChanges.changed],
    hasCalculationChanged: resources.hasCalculationChanged,
  });
  // A retired Grant target or class records which Grants this Character keeps.
  const reasons = [
    ...planned.reasons,
    ...retiredIdentities.map((identity) => `retired:${identity}`),
  ];
  const catalogEntries = projectCampaignCopies([...nextDefinitions.values()]);
  return {
    character,
    entries,
    catalogEntries,
    oldDefinitions: [...oldDefinitions.values()],
    resources,
    retiredIdentities,
    impact: { isAffected: reasons.length > 0, reasons },
  };
}

async function readImpactInputs(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
  character: Doc<'character'>,
  runId: Id<'catalogImpactRun'>,
) {
  const budget: CandidateReadBudget = { bytes: 0 };
  const own = await readOwnImpactInputs(ctx, release, character, runId, budget);
  const masters: Awaited<ReturnType<typeof readOwnImpactInputs>>[] = [];
  const relationships: Doc<'companionRelationship'>[] = [];
  const pending = [character._id];
  const visited = new Set<Id<'character'>>();
  for (const characterId of pending) {
    if (visited.has(characterId)) continue;
    visited.add(characterId);
    if (visited.size > maxDependencies)
      throw new ConvexError(
        'Companion exceeds representative dependency limit',
      );
    const incoming = await ctx.db
      .query('companionRelationship')
      .withIndex('by_companionCharacterId', (q) =>
        q.eq('companionCharacterId', characterId),
      )
      .take(maxDependencies + 1);
    recordCandidateRead(budget, incoming);
    if (incoming.length + relationships.length > maxDependencies)
      throw new ConvexError(
        'Companion exceeds representative relationship dependency limit',
      );
    for (const relationship of incoming) {
      relationships.push(relationship);
      if (
        relationship.status === 'replaced' ||
        visited.has(relationship.associatedCharacterId)
      )
        continue;
      pending.push(relationship.associatedCharacterId);
      const master = await ctx.db.get(
        'character',
        relationship.associatedCharacterId,
      );
      recordCandidateRead(budget, master);
      if (master?.sheetMode)
        masters.push(
          await readOwnImpactInputs(ctx, release, master, runId, budget),
        );
    }
  }
  const reasons = [
    ...new Set([own, ...masters].flatMap(({ impact }) => impact.reasons)),
  ].sort();
  return {
    ...own,
    impact: { isAffected: reasons.length > 0, reasons },
    companionDependencies: { relationships, masters },
  };
}

type OwnImpactInputs = Awaited<ReturnType<typeof readOwnImpactInputs>>;
type ActiveSheet = Awaited<ReturnType<typeof readCharacterSheetData>>;

/**
 * A Character's recorded sheet under the candidate release: its candidate
 * definitions, resources and retirements, calculated without linked inputs,
 * as the ordinary reader returns it before companion projection.
 */
function buildCandidateSheet(
  identity: string,
  own: OwnImpactInputs,
  active: ActiveSheet,
): ActiveSheet {
  const resources = { castingTables: own.resources.castingTables };
  // Grants the Character has now are the existing uses a retirement keeps.
  const retired = own.retiredIdentities.length
    ? {
        ruleIdentities: own.retiredIdentities,
        retainedGrantIds: listRetainedGrantIds(active, own.retiredIdentities),
      }
    : undefined;
  const sheet = {
    ...active,
    catalogEntries: own.catalogEntries,
    resources,
    retired,
    calculationIdentity: identity,
  };
  const { current, permanent } = calculateCharacterSheetProjectionsForRelease(
    identity,
    buildCharacterSheetInput(sheet),
  );
  const { resolvedEntries, ...permanentCalculated } = permanent;
  return {
    ...sheet,
    calculated: current,
    permanentCalculated,
    permanentResolvedEntries: resolvedEntries,
  };
}

type ImpactInputs = Awaited<ReturnType<typeof readImpactInputs>>;
type CandidateArgs = {
  ctx: ReadCtx;
  release: Doc<'catalogRelease'>;
  inputs: ImpactInputs;
  runId: Id<'catalogImpactRun'>;
};

/**
 * Memoised readers for each linked Character's sheet under the active and
 * candidate releases. Each sheet is read once and calculated under both.
 */
function createLinkedSheetReaders({
  ctx,
  release,
  inputs,
  runId,
}: CandidateArgs) {
  const budget: CandidateReadBudget = { bytes: 0 };
  const ownInputs = new Map<Id<'character'>, OwnImpactInputs>(
    [inputs, ...inputs.companionDependencies.masters].map((own) => [
      own.character._id,
      own,
    ]),
  );
  const activeSheets = new Map<Id<'character'>, ActiveSheet>();
  const candidateSheets = new Map<Id<'character'>, ActiveSheet>();
  async function readActive(character: Doc<'character'>) {
    const known = activeSheets.get(character._id);
    if (known) return known;
    const sheet = await readCharacterSheetData(ctx, character, {
      includeAcceptedWarnings: false,
    });
    activeSheets.set(character._id, sheet);
    return sheet;
  }
  async function readCandidate(character: Doc<'character'>) {
    const known = candidateSheets.get(character._id);
    if (known) return known;
    const own =
      ownInputs.get(character._id) ??
      (await readOwnImpactInputs(ctx, release, character, runId, budget));
    const sheet = buildCandidateSheet(
      release.manifest.compatibility.calculation,
      own,
      await readActive(character),
    );
    candidateSheets.set(character._id, sheet);
    return sheet;
  }
  const readBudget = {
    accountRead: (value: unknown) => recordCandidateRead(budget, value),
    accountReference: () => undefined,
  };
  return { readActive, readCandidate, readBudget };
}

/**
 * The candidate and selected sheets with their linked inputs. Every linked
 * endpoint, such as a familiar's master, is read under the same release as
 * the Character itself, so a Companion's facts never mix the candidate with
 * the active release.
 */
async function calculateLinkedSheets(args: CandidateArgs) {
  const { ctx, release, inputs } = args;
  const { readActive, readCandidate, readBudget } =
    createLinkedSheetReaders(args);
  const candidate = await applyCompanionToSheet(
    ctx,
    await readCandidate(inputs.character),
    {
      trustedLinkedInputs: true,
      recalculate: true,
      calculationIdentity: release.manifest.compatibility.calculation,
      readSheet: readCandidate,
      readBudget,
    },
  );
  // The active facts read the selected release, as the ordinary loader does.
  const selected = await applyCompanionToSheet(
    ctx,
    await readActive(inputs.character),
    { trustedLinkedInputs: true, readSheet: readActive },
  );
  return { candidate, selected };
}

async function calculateCandidateOutcome(
  args: CandidateArgs & { character: Doc<'character'> },
) {
  const { ctx, release, inputs, character } = args;
  if (
    release.manifest.compatibility.schema !==
      catalogRuntimeCompatibility.schema ||
    !isSupportedCatalogCalculation(release.manifest.compatibility.calculation)
  )
    throw new ConvexError('Candidate calculation behavior is unavailable');
  if (
    inputs.impact.reasons.some(
      (key) =>
        key.startsWith('resource:') &&
        key !== 'resource:builtin:casting-tables',
    )
  )
    throw new ConvexError(
      'Candidate resource is unsupported by the prepared resolver',
    );
  const { candidate, selected } = await calculateLinkedSheets(args);
  const retainedGrantIds = candidate.retired?.retainedGrantIds ?? [];
  const calculatedFacts = await calculateMilitiaCharacterFacts(
    ctx,
    character,
    candidate,
    { trustedLinkedInputs: true },
  );
  const facts = { ...calculatedFacts, characterId: character._id };
  const activeFacts = await calculateMilitiaCharacterFacts(
    ctx,
    character,
    selected,
    { trustedLinkedInputs: true },
  );
  return {
    kind: 'ready' as const,
    facts,
    hasFactsChanged:
      (await releaseFingerprint(facts)) !==
      (await releaseFingerprint(activeFacts)),
    reasons: inputs.impact.reasons,
    ...(inputs.retiredIdentities.length ? { retainedGrantIds } : {}),
    ...(inputs.impact.reasons.includes('resource:builtin:casting-tables')
      ? {
          castingEvidence: candidate.permanentCalculated.spellcastings.flatMap(
            (casting) =>
              casting.slots.map((slot) => ({
                classTag: casting.classTag,
                spellLevel: slot.spellLevel,
                base: slot.base,
                total: slot.total,
              })),
          ),
        }
      : {}),
  };
}

async function evaluateWork(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
  work: Doc<'catalogImpactWork'>,
): Promise<Infer<typeof evaluationValidator>> {
  const runId = work.runId;
  const characterId = work.characterId;
  const character = await ctx.db.get('character', characterId);
  if (!character?.sheetMode)
    return {
      revision: work.revision,
      inputFingerprint: await releaseFingerprint(character),
      result: { kind: character ? 'notPrepared' : 'deleted' },
    };
  try {
    const inputs = await readImpactInputs(ctx, release, character, runId);
    const inputFingerprint = await releaseFingerprint({
      ...inputs,
      release: release.manifest.artifactFingerprint,
    });
    if (!inputs.impact.isAffected)
      return {
        revision: work.revision,
        inputFingerprint,
        result: { kind: 'unaffected' as const },
      };
    return {
      revision: work.revision,
      inputFingerprint,
      result: await calculateCandidateOutcome({
        ctx,
        release,
        character,
        inputs,
        runId,
      }),
    };
  } catch (error) {
    return {
      revision: work.revision,
      inputFingerprint: await releaseFingerprint({
        character,
        revision: work.revision,
      }),
      result: {
        kind: 'failed' as const,
        error:
          error instanceof Error
            ? error.message
            : 'Candidate calculation failed',
      },
    };
  }
}

export const start = generalInternalMutation({
  args: { releaseNumber: v.number() },
  returns: v.id('catalogImpactRun'),
  handler: async (ctx, args) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) =>
        q.eq('releaseNumber', args.releaseNumber),
      )
      .unique();
    if (!release) throw new ConvexError('Catalog Release does not exist');
    await requirePreparedRelease(ctx, release);
    const existing = await ctx.db
      .query('catalogImpactRun')
      .withIndex('by_releaseId', (q) => q.eq('releaseId', release._id))
      .order('desc')
      .first();
    if (existing && (!existing.lifecycle || existing.lifecycle === 'active')) {
      await requireActiveRegistration(ctx, existing);
      return existing._id;
    }
    const runId = await ctx.db.insert('catalogImpactRun', {
      releaseId: release._id,
      cursor: null,
      isDiscoveryComplete: false,
      baseReleaseNumber: release.baseReleaseNumber,
      discoveryStage: 'next',
      lifecycle: 'active',
      missingIdentityCount: 0,
      identityCoverageComplete: false,
      resourceCoverageComplete: false,
    });
    const control = await ctx.db
      .query('catalogImpactControl')
      .withIndex('by_key', (q) => q.eq('key', 'global'))
      .unique();
    if (control) {
      const previous = await ctx.db.get('catalogImpactRun', control.runId);
      if (previous)
        await ctx.db.patch('catalogImpactRun', previous._id, {
          lifecycle: 'superseded',
        });
      await ctx.db.delete('catalogImpactControl', control._id);
    }
    await ctx.db.insert('catalogImpactControl', { key: 'global', runId });

    return runId;
  },
});

async function baseRelease(ctx: ReadCtx, release: Doc<'catalogRelease'>) {
  const baseNumber = release.baseReleaseNumber;
  if (baseNumber === null) return null;
  return ctx.db
    .query('catalogRelease')
    .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', baseNumber))
    .unique();
}

function boundedPage(
  numItems: number,
  cursor: string | null,
  maximumBytesRead: number = maxCandidateReadBytes,
) {
  return { numItems, cursor, maximumRowsRead: numItems, maximumBytesRead };
}

async function stageSpellMetadata(
  ctx: MutationCtx,
  release: Doc<'catalogRelease'>,
  key: string,
  value: unknown,
  isSelectable: boolean,
) {
  if (
    !isObject(value) ||
    !isObject(value.detail) ||
    value.detail.kind !== 'spell'
  )
    return;
  const parsed = importedCatalogEntrySchema.parse(value);
  if (parsed.detail.kind !== 'spell') return;
  if (
    Object.keys(parsed.detail.levels).length >
    catalogReleaseLimits.spellClassLists
  )
    throw new ConvexError(
      'Prepared release Spell metadata exceeds 32 class lists',
    );
  const existing = await ctx.db
    .query('catalogReleaseSpellIndex')
    .withIndex('by_releaseId_and_ruleIdentity', (q) =>
      q.eq('releaseId', release._id).eq('ruleIdentity', key),
    )
    .first();
  if (existing) return;
  const shared = {
    releaseId: release._id,
    ruleIdentity: key,
    name: parsed.name,
    school: parsed.detail.school,
    levels: parsed.detail.levels,
    isSelectable,
  };
  await ctx.db.insert('catalogReleaseSpellIndex', {
    ...shared,
    classTag: '*',
    level: Object.values(parsed.detail.levels).length
      ? Math.min(...Object.values(parsed.detail.levels))
      : null,
  });
  for (const [classTag, level] of Object.entries(parsed.detail.levels))
    await ctx.db.insert('catalogReleaseSpellIndex', {
      ...shared,
      classTag,
      level,
    });
}

async function discoverDefinition(
  ctx: MutationCtx,
  run: Doc<'catalogImpactRun'>,
  release: Doc<'catalogRelease'>,
  base: Doc<'catalogRelease'> | null,
  row: Doc<'catalogReleaseRow'>,
) {
  const existing = await ctx.db
    .query('catalogImpactChange')
    .withIndex('by_runId_and_key', (q) =>
      q.eq('runId', run._id).eq('key', `key:${row.key}`),
    )
    .unique();
  if (existing) return 0;
  const next = await releaseRow(ctx, release._id, 'definition', row.key);
  const old = base
    ? await releaseRow(ctx, base._id, 'definition', row.key)
    : null;
  let hasChanged =
    (await releaseFingerprint(next?.payload ?? null)) !==
    (await releaseFingerprint(old?.payload ?? null));
  if (!base && next) {
    const active = await findStableDefinition(
      ctx,
      row.key,
      isObject(next.payload) &&
        isObject(next.payload.detail) &&
        next.payload.detail.kind === 'spell',
    );
    if (active) {
      try {
        hasChanged =
          (await releaseFingerprint(active)) !==
          (await releaseFingerprint(
            await candidateDefinition(ctx, release, active),
          ));
      } catch {
        hasChanged = true;
      }
    }
  }
  let missingIdentityCount = 0;
  if (run.discoveryStage === 'next' && next) {
    const stable = await findStableDefinition(
      ctx,
      row.key,
      isObject(next.payload) &&
        isObject(next.payload.detail) &&
        next.payload.detail.kind === 'spell',
    );
    if (!stable) missingIdentityCount++;
    else await candidateDefinition(ctx, release, stable);
  }
  const retirement = !next
    ? await readRetiredDefinition(ctx, release._id, row.key)
    : null;
  const retirementPayload: unknown = retirement?.payload;
  const inheritedMetadata =
    !hasChanged &&
    base &&
    isObject(next?.payload) &&
    isObject(next.payload.detail) &&
    next.payload.detail.kind === 'spell'
      ? await ctx.db
          .query('catalogReleaseSpellIndex')
          .withIndex('by_releaseId_and_ruleIdentity', (q) =>
            q.eq('releaseId', base._id).eq('ruleIdentity', row.key),
          )
          .first()
      : null;
  if (hasChanged || inheritedMetadata)
    await stageSpellMetadata(
      ctx,
      release,
      row.key,
      next?.payload ??
        (isObject(retirementPayload)
          ? retirementPayload.lastUsableDefinition
          : old?.payload),
      Boolean(next),
    );
  const edgesByPair = new Map<string, ReleaseDependencyEdge>();
  for (const payload of [next?.payload, old?.payload]) {
    // Only changed Spell lists enter the forward graph. The index handles
    // off-list and recorded references without enumerating a caster's corpus.
    if (
      !hasChanged &&
      isObject(payload) &&
      isObject(payload.detail) &&
      payload.detail.kind === 'spell'
    )
      continue;
    // Old and new bodies usually share relationships; each edge counts once.
    for (const edge of keyedReleaseEdges(row.key, payload))
      edgesByPair.set(JSON.stringify([edge.from, edge.to]), edge);
  }
  const edges = [...edgesByPair.values()];
  if (edges.length > maxSheetRows)
    throw new ConvexError(
      `Keyed relationships exceed ${maxSheetRows} for ${row.key}`,
    );
  await ctx.db.insert('catalogImpactChange', {
    runId: run._id,
    key: `key:${row.key}`,
    hasChanged,
    hasSpellDependencies:
      hasChanged &&
      [next?.payload, old?.payload].some(
        (payload) =>
          isObject(payload) &&
          isObject(payload.detail) &&
          payload.detail.kind === 'spell',
      ),
  });
  for (const edge of edges)
    await ctx.db.insert('catalogImpactEdge', { runId: run._id, ...edge });

  return missingIdentityCount;
}

async function discoverDefinitions(
  ctx: MutationCtx,
  run: Doc<'catalogImpactRun'>,
  release: Doc<'catalogRelease'>,
) {
  const base = await baseRelease(ctx, release);
  const selected = run.discoveryStage === 'next' ? release : base;
  if (!selected) {
    await ctx.db.patch('catalogImpactRun', run._id, {
      discoveryStage: 'retained',
      cursor: null,
    });
    return false;
  }
  const page = await ctx.db
    .query('catalogReleaseRow')
    .withIndex('by_releaseId_and_kind_and_key', (q) =>
      q.eq('releaseId', selected._id).eq('kind', 'definition'),
    )
    .paginate(boundedPage(definitionBatchRows, run.cursor, maxBatchReadBytes));
  let missingIdentityCount = run.missingIdentityCount ?? 0;
  for (const row of page.page) {
    try {
      missingIdentityCount += await discoverDefinition(
        ctx,
        run,
        release,
        base,
        row,
      );
    } catch (error) {
      await ctx.db.patch('catalogImpactRun', run._id, {
        isDiscoveryComplete: true,
        missingIdentityCount,
        discoveryError: `Discovery failed for ${row.key}: ${error instanceof Error ? error.message : 'unsupported definition'}`,
      });
      return true;
    }
  }
  await ctx.db.patch('catalogImpactRun', run._id, {
    missingIdentityCount,
    ...(run.discoveryStage === 'next' && page.isDone
      ? { identityCoverageComplete: true }
      : {}),
    cursor: page.isDone ? null : page.continueCursor,
    discoveryStage: page.isDone
      ? run.discoveryStage === 'next'
        ? 'base'
        : 'retained'
      : run.discoveryStage,
  });
  return false;
}

async function spellMetadataCoverageError(
  ctx: ReadCtx,
  run: Doc<'catalogImpactRun'>,
) {
  const metadata = await readFirstPage({
    query: ctx.db
      .query('catalogReleaseSpellIndex')
      .withIndex('by_releaseId_and_classTag_and_name', (q) =>
        q.eq('releaseId', run.releaseId).eq('classTag', '*'),
      ),
    maximumRowsRead: catalogReleaseLimits.spellMetadataRows + 1,
  });
  return !metadata.isDone ||
    metadata.page.length > catalogReleaseLimits.spellMetadataRows ||
    releaseByteCount(metadata.page) > catalogReleaseLimits.spellMetadataBytes
    ? 'Prepared release Spell browser metadata exceeds 256 entries or 1 MiB'
    : null;
}

async function discoverRetainedDefinition(
  ctx: MutationCtx,
  release: Doc<'catalogRelease'>,
  row: Doc<'catalogReleaseRow'>,
) {
  const value: unknown = row.payload;
  if (isObject(value) && value.kind !== 'resource') {
    const payload = importedCatalogEntrySchema.parse(
      value.lastUsableDefinition,
    );
    const key = row.key.slice(retirementKeyPrefix.length);
    if (payload.externalKey !== key)
      throw new ConvexError(
        'Retained definition identity does not match its report',
      );
    const stable = await findStableDefinition(ctx, key);
    if (stable) await candidateDefinition(ctx, release, stable);
  }
  if (isObject(value))
    await stageSpellMetadata(
      ctx,
      release,
      row.key.slice(retirementKeyPrefix.length),
      value.lastUsableDefinition,
      false,
    );
}

async function discoverRetainedMetadata(
  ctx: MutationCtx,
  run: Doc<'catalogImpactRun'>,
  release: Doc<'catalogRelease'>,
) {
  const page = await ctx.db
    .query('catalogReleaseRow')
    .withIndex('by_releaseId_and_kind_and_key', (q) =>
      q
        .eq('releaseId', release._id)
        .eq('kind', 'report')
        .gte('key', retirementKeyPrefix)
        .lt('key', retirementKeyEnd),
    )
    .paginate(boundedPage(definitionBatchRows, run.cursor, maxBatchReadBytes));
  try {
    for (const row of page.page) {
      await discoverRetainedDefinition(ctx, release, row);
    }
  } catch (error) {
    await ctx.db.patch('catalogImpactRun', run._id, {
      isDiscoveryComplete: true,
      discoveryError: `Retained definition discovery failed: ${error instanceof Error ? error.message : 'unsupported definition'}`,
    });
    return true;
  }
  if (page.isDone) {
    try {
      const resources = await readResources(ctx, release, { bytes: 0 });
      // `catalog:release build` captures every representative seed catalog
      // (#321, #415). Like the class, race and archetype seeds they
      // initialize prepared sheets and are no live calculation input.
      const supported = new Set([
        'builtin:casting-tables',
        'builtin:representative-class-catalog',
        'builtin:representative-race-catalog',
        'builtin:representative-archetype-catalog',
        'builtin:representative-selection-catalog',
        'builtin:representative-spellcasting-catalog',
      ]);
      if (resources.rows.some((row) => !supported.has(row.key)))
        throw new ConvexError('Unsupported prepared release resources');
      for (const row of resources.rows) {
        const value: unknown = row.payload;
        if (isObject(value) && 'compatibility' in value) {
          const compatibility = value.compatibility;
          if (
            !isObject(compatibility) ||
            compatibility.schema !== release.manifest.compatibility.schema ||
            typeof compatibility.calculation !== 'string' ||
            !isSupportedCatalogCalculation(compatibility.calculation)
          )
            throw new ConvexError(
              'Prepared release resources require unavailable compatibility',
            );
        }
      }
      await ctx.db.patch('catalogImpactRun', run._id, {
        resourceCoverageComplete: true,
      });
    } catch (error) {
      await ctx.db.patch('catalogImpactRun', run._id, {
        isDiscoveryComplete: true,
        discoveryError: `Prepared release resources failed: ${error instanceof Error ? error.message : 'unsupported resources'}`,
      });
      return true;
    }
  }
  const coverageError = page.isDone
    ? await spellMetadataCoverageError(ctx, run)
    : null;
  if (coverageError) {
    await ctx.db.patch('catalogImpactRun', run._id, {
      isDiscoveryComplete: true,
      discoveryError: coverageError,
    });
    return true;
  }
  await ctx.db.patch('catalogImpactRun', run._id, {
    cursor: page.isDone ? null : page.continueCursor,
    ...(page.isDone ? { discoveryStage: 'reverse' as const } : {}),
  });
  return false;
}

async function hasLiveSpellDefinition(
  ctx: ReadCtx,
  indexed: Doc<'spellCatalogIndex'>,
  budget?: CandidateReadBudget,
) {
  const definition = await ctx.db.get('catalogEntry', indexed.catalogEntryId);
  if (budget) recordCandidateRead(budget, definition);
  return Boolean(
    definition &&
    !definition.copiedFrom &&
    (definition.scope === 'global' || definition.importedSpell),
  );
}

async function advanceReverseChange(
  ctx: MutationCtx,
  run: Doc<'catalogImpactRun'>,
) {
  await ctx.db.patch('catalogImpactRun', run._id, {
    reverseKey: undefined,
    reverseCursor: undefined,
    reverseLookup: undefined,
    reverseDefinitionIds: undefined,
    reverseDefinitionCursor: undefined,
    isReverseDefinitionsComplete: undefined,
    ...(run.isReverseDiscoveryComplete
      ? { discoveryStage: 'sheets', cursor: null }
      : {}),
  });
}

async function discoverReverseSpells(
  ctx: MutationCtx,
  run: Doc<'catalogImpactRun'>,
) {
  const reverseKey = run.reverseKey;
  if (!reverseKey) {
    const page = await ctx.db
      .query('catalogImpactChange')
      .withIndex('by_runId_and_hasSpellDependencies', (q) =>
        q.eq('runId', run._id).eq('hasSpellDependencies', true),
      )
      .paginate(boundedPage(1, run.cursor, maxBatchReadBytes));
    const change = page.page[0];
    if (!change) {
      await ctx.db.patch('catalogImpactRun', run._id, {
        discoveryStage: 'sheets',
        cursor: null,
      });
      return false;
    }
    await ctx.db.patch('catalogImpactRun', run._id, {
      reverseKey: change.key,
      reverseCursor: null,
      reverseLookup: 'identity',
      isReverseDiscoveryComplete: page.isDone,
      cursor: page.continueCursor,
    });
    return false;
  }
  const key = reverseKey.slice('key:'.length);
  if (run.reverseLookup === 'definitions') {
    const definitions = await ctx.db
      .query('catalogEntry')
      .withIndex('by_ruleIdentity', (q) => q.eq('ruleIdentity', key))
      .paginate(
        boundedPage(
          definitionBatchRows,
          run.reverseDefinitionCursor ?? null,
          maxBatchReadBytes,
        ),
      );
    const ids = definitions.page
      .filter(
        (row) =>
          !row.copiedFrom && (row.scope === 'global' || row.importedSpell),
      )
      .map((row) => row._id);
    if (ids.length === 0 && definitions.isDone)
      await advanceReverseChange(ctx, run);
    else
      await ctx.db.patch('catalogImpactRun', run._id, {
        reverseDefinitionIds: ids,
        reverseDefinitionCursor: definitions.continueCursor,
        isReverseDefinitionsComplete: definitions.isDone,
        reverseLookup: ids.length ? 'catalogEntry' : 'definitions',
      });
    return false;
  }
  const definitionId = run.reverseDefinitionIds?.[0];
  const query =
    run.reverseLookup === 'catalogEntry' && definitionId
      ? ctx.db
          .query('spellCatalogIndex')
          .withIndex('by_catalogEntryId', (q) =>
            q.eq('catalogEntryId', definitionId),
          )
      : ctx.db
          .query('spellCatalogIndex')
          .withIndex('by_ruleIdentity', (q) => q.eq('ruleIdentity', key));
  const page = await query.paginate(
    boundedPage(
      reverseSpellBatchRows,
      run.reverseCursor ?? null,
      maxBatchReadBytes,
    ),
  );
  for (const indexed of page.page) {
    if (!(await hasLiveSpellDefinition(ctx, indexed))) continue;
    const from = `character:${indexed.characterId}`;
    const edge = await ctx.db
      .query('catalogImpactEdge')
      .withIndex('by_runId_and_from_and_to', (q) =>
        q.eq('runId', run._id).eq('from', from).eq('to', reverseKey),
      )
      .unique();
    if (!edge)
      await ctx.db.insert('catalogImpactEdge', {
        runId: run._id,
        from,
        to: reverseKey,
      });
  }
  if (!page.isDone)
    await ctx.db.patch('catalogImpactRun', run._id, {
      reverseCursor: page.continueCursor,
    });
  else if (run.reverseLookup === 'identity')
    await ctx.db.patch('catalogImpactRun', run._id, {
      reverseLookup: 'definitions',
      reverseCursor: null,
    });
  else {
    const remainingIds = run.reverseDefinitionIds?.slice(1) ?? [];
    if (!remainingIds.length && run.isReverseDefinitionsComplete)
      await advanceReverseChange(ctx, run);
    else
      await ctx.db.patch('catalogImpactRun', run._id, {
        reverseDefinitionIds: remainingIds,
        reverseCursor: null,
        reverseLookup: remainingIds.length ? 'catalogEntry' : 'definitions',
      });
  }
  return false;
}

async function discoverSheets(ctx: MutationCtx, run: Doc<'catalogImpactRun'>) {
  const page = await ctx.db
    .query('character')
    .withIndex('by_sheetMode', (q) => q.gt('sheetMode', undefined))
    .paginate(boundedPage(characterBatchRows, run.cursor, maxBatchReadBytes));
  for (const character of page.page)
    await markCatalogImpactDirty(ctx, character._id);
  await ctx.db.patch('catalogImpactRun', run._id, {
    cursor: page.isDone ? null : page.continueCursor,
    ...(page.isDone ? { discoveryStage: 'campaigns' as const } : {}),
  });
  return false;
}

async function discoverCampaigns(
  ctx: MutationCtx,
  run: Doc<'catalogImpactRun'>,
) {
  const page = await ctx.db
    .query('canonicalMilitiaState')
    .withIndex('by_militiaId')
    .paginate(boundedPage(characterBatchRows, run.cursor, maxBatchReadBytes));
  for (const state of page.page) {
    const existing = await ctx.db
      .query('catalogCampaignFacts')
      .withIndex('by_runId_and_campaignId', (q) =>
        q.eq('runId', run._id).eq('campaignId', state.campaignId),
      )
      .unique();
    if (!existing) {
      const baseGeneration = await readSelectedCampaignFactsGeneration(
        ctx,
        state.campaignId,
      );
      await ctx.db.insert('catalogCampaignFacts', {
        runId: run._id,
        campaignId: state.campaignId,
        baseGeneration,
        generation: baseGeneration,
        changedCount: 0,
      });
    }
  }
  const coverageError = page.isDone
    ? await spellMetadataCoverageError(ctx, run)
    : null;
  if (coverageError) {
    await ctx.db.patch('catalogImpactRun', run._id, {
      isDiscoveryComplete: true,
      discoveryError: coverageError,
    });
    return true;
  }
  await ctx.db.patch('catalogImpactRun', run._id, {
    cursor: page.continueCursor,
    isDiscoveryComplete: page.isDone,
  });
  return page.isDone;
}

export const discover = generalInternalMutation({
  args: { runId: v.id('catalogImpactRun') },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { run, release } = await requireRun(ctx, args.runId);
    if (run.isDiscoveryComplete) return true;
    if (run.discoveryStage === 'sheets') return discoverSheets(ctx, run);
    if (run.discoveryStage === 'campaigns') return discoverCampaigns(ctx, run);
    if (run.discoveryStage === 'retained')
      return discoverRetainedMetadata(ctx, run, release);
    // #411 retired the refusing Grant-source stage; earlier runs move on.
    if (run.discoveryStage === 'grantSources') {
      await ctx.db.patch('catalogImpactRun', run._id, {
        discoveryStage: 'reverse',
        cursor: null,
      });
      return false;
    }
    if (run.discoveryStage === 'reverse')
      return discoverReverseSpells(ctx, run);
    return discoverDefinitions(ctx, run, release);
  },
});

export const evaluate = internalQuery({
  args: { runId: v.id('catalogImpactRun'), characterId: v.id('character') },
  returns: evaluationValidator,
  handler: async (ctx, args) => {
    const { release } = await requireRun(ctx, args.runId);
    const work = await requireCharacterWork(ctx, args.runId, args.characterId);
    return evaluateWork(ctx, release, work);
  },
});

async function reconcileCampaignGeneration({
  ctx,
  runId,
  work,
  campaignId,
  hasFactsChanged,
}: {
  ctx: MutationCtx;
  runId: Id<'catalogImpactRun'>;
  work: Doc<'catalogImpactWork'>;
  campaignId: Id<'campaign'> | undefined;
  hasFactsChanged: boolean;
}) {
  const campaigns = new Set([work.factCampaignId, campaignId]);
  for (const id of campaigns) {
    if (!id) continue;
    const existing = await ctx.db
      .query('catalogCampaignFacts')
      .withIndex('by_runId_and_campaignId', (q) =>
        q.eq('runId', runId).eq('campaignId', id),
      )
      .unique();
    const baseGeneration =
      existing?.baseGeneration ??
      (await readSelectedCampaignFactsGeneration(ctx, id));
    const previous =
      work.factCampaignId === id && work.hasFactsChanged === true ? 1 : 0;
    const next = campaignId === id && hasFactsChanged ? 1 : 0;
    const changedCount = Math.max(
      0,
      (existing?.changedCount ?? 0) - previous + next,
    );
    const fields = {
      runId,
      campaignId: id,
      baseGeneration,
      changedCount,
      generation: baseGeneration + (changedCount > 0 ? 1 : 0),
    };
    if (existing)
      await ctx.db.patch('catalogCampaignFacts', existing._id, fields);
    else await ctx.db.insert('catalogCampaignFacts', fields);
  }
}

export const complete = generalInternalMutation({
  args: {
    runId: v.id('catalogImpactRun'),
    characterId: v.id('character'),
    evaluation: evaluationValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { run, release } = await requireRun(ctx, args.runId);
    const work = await ctx.db
      .query('catalogImpactWork')
      .withIndex('by_runId_and_characterId', (q) =>
        q.eq('runId', run._id).eq('characterId', args.characterId),
      )
      .unique();
    if (work?.revision !== args.evaluation.revision || work.state !== 'dirty')
      return false;
    const current = await evaluateWork(ctx, release, work);
    if (
      current.inputFingerprint !== args.evaluation.inputFingerprint ||
      (await releaseFingerprint(current.result)) !==
        (await releaseFingerprint(args.evaluation.result))
    )
      return false;
    const result = args.evaluation.result;
    const character = await ctx.db.get('character', args.characterId);
    const selectedFacts = await readSelectedCharacterFacts(
      ctx,
      args.characterId,
    );
    const facts =
      result.kind === 'ready'
        ? result.facts
        : result.kind === 'unaffected' && character
          ? (selectedFacts?.facts ?? {
              ...(await calculateMilitiaCharacterFacts(ctx, character)),
              characterId: character._id,
            })
          : undefined;
    const hasFactsChanged = result.kind === 'ready' && result.hasFactsChanged;
    const generation = facts
      ? (selectedFacts?.generation ?? 0) + (hasFactsChanged ? 1 : 0)
      : undefined;
    await reconcileCampaignGeneration({
      ctx,
      runId: run._id,
      work,
      campaignId: facts ? character?.campaignId : undefined,
      hasFactsChanged,
    });
    await ctx.db.patch('catalogImpactWork', work._id, {
      factGeneration: generation,
      factCampaignId: facts ? character?.campaignId : undefined,
      state: result.kind,
      inputFingerprint: args.evaluation.inputFingerprint,
      ...(result.kind === 'ready'
        ? {
            facts: result.facts,
            hasFactsChanged: result.hasFactsChanged,
            reasons: result.reasons,
            retainedGrantIds: result.retainedGrantIds,
            error: undefined,
          }
        : {
            facts,
            hasFactsChanged: undefined,
            reasons: undefined,
            retainedGrantIds: undefined,
            error: result.kind === 'failed' ? result.error : undefined,
          }),
    });
    return true;
  },
});

export const retryDiscovery = generalInternalMutation({
  args: { runId: v.id('catalogImpactRun') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { run } = await requireRun(ctx, args.runId);
    if (run.discoveryError)
      await ctx.db.patch('catalogImpactRun', run._id, {
        isDiscoveryComplete: false,
        discoveryError: undefined,
      });
    return null;
  },
});

export const retry = generalInternalMutation({
  args: { runId: v.id('catalogImpactRun'), characterId: v.id('character') },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRun(ctx, args.runId);
    const work = await ctx.db
      .query('catalogImpactWork')
      .withIndex('by_runId_and_characterId', (q) =>
        q.eq('runId', args.runId).eq('characterId', args.characterId),
      )
      .unique();
    if (!work) throw new ConvexError('Character has no candidate work');
    await markCatalogImpactDirty(ctx, args.characterId);
    return null;
  },
});

export const finish = generalInternalMutation({
  args: { runId: v.id('catalogImpactRun') },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const recorded = await readRun(ctx, args.runId);
    const { run } = recorded;
    if (run.lifecycle === 'ready' && recorded.release.state === 'prepared')
      return true;
    await requirePreparedRelease(ctx, recorded.release);
    await requireActiveRegistration(ctx, run);
    if (!run.isDiscoveryComplete || run.discoveryError) return false;
    const dirty = await countWorkState(ctx, run._id, 'dirty');
    const failed = await countWorkState(ctx, run._id, 'failed');
    if (dirty.count || failed.count) return false;
    await ctx.db.patch('catalogImpactRun', run._id, { lifecycle: 'ready' });
    await clearControl(ctx, run._id);
    return true;
  },
});

export const abandon = generalInternalMutation({
  args: { runId: v.id('catalogImpactRun') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { run } = await readRun(ctx, args.runId);
    // Ready evidence is retained for its Catalog Release; never make it deletable.
    if (run.lifecycle === 'ready')
      throw new ConvexError(
        'Ready Catalog impact evidence cannot be abandoned',
      );
    await ctx.db.patch('catalogImpactRun', run._id, { lifecycle: 'abandoned' });
    await clearControl(ctx, run._id);
    return null;
  },
});

/** Repeated calls remove one bounded batch; retained ready evidence is historical. */
export const cleanup = generalInternalMutation({
  args: { runId: v.id('catalogImpactRun') },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get('catalogImpactRun', args.runId);
    if (!run) {
      await clearControl(ctx, args.runId);
      return true;
    }
    const selected = await ctx.db
      .query('catalogReleaseControl')
      .withIndex('by_key', (q) => q.eq('key', 'global'))
      .unique();
    if (selected?.impactRunId === run._id) return true;
    if (!run.lifecycle || run.lifecycle === 'active') {
      let isCurrent = true;
      try {
        await requireRun(ctx, args.runId);
      } catch {
        isCurrent = false;
      }
      // `false` means more batches remain, so a current run must fail loudly.
      if (isCurrent)
        throw new ConvexError(
          'Catalog impact run is still active; finish or abandon it before cleanup',
        );
      await ctx.db.patch('catalogImpactRun', run._id, {
        lifecycle: 'superseded',
      });
    }
    await clearControl(ctx, run._id);
    if (
      run.lifecycle === 'ready' &&
      (await latestReadyRun(ctx, run.releaseId))?._id === run._id
    )
      return true;
    const workRows = await readFirstPage({
      query: ctx.db
        .query('catalogImpactWork')
        .withIndex('by_runId_and_characterId', (q) => q.eq('runId', run._id)),
      maximumRowsRead: characterBatchRows,
      maximumBytesRead: maxBatchReadBytes,
    });
    if (workRows.page.length) {
      for (const row of workRows.page)
        await ctx.db.delete('catalogImpactWork', row._id);
      return false;
    }
    const campaignRows = await readFirstPage({
      query: ctx.db
        .query('catalogCampaignFacts')
        .withIndex('by_runId_and_campaignId', (q) => q.eq('runId', run._id)),
      maximumRowsRead: characterBatchRows,
      maximumBytesRead: maxBatchReadBytes,
    });
    if (campaignRows.page.length) {
      for (const row of campaignRows.page)
        await ctx.db.delete('catalogCampaignFacts', row._id);
      return false;
    }
    const edgeRows = await readFirstPage({
      query: ctx.db
        .query('catalogImpactEdge')
        .withIndex('by_runId_and_from', (q) => q.eq('runId', run._id)),
      maximumRowsRead: characterBatchRows,
      maximumBytesRead: maxBatchReadBytes,
    });
    if (edgeRows.page.length) {
      for (const row of edgeRows.page)
        await ctx.db.delete('catalogImpactEdge', row._id);
      return false;
    }
    const changeRows = await readFirstPage({
      query: ctx.db
        .query('catalogImpactChange')
        .withIndex('by_runId_and_key', (q) => q.eq('runId', run._id)),
      maximumRowsRead: characterBatchRows,
      maximumBytesRead: maxBatchReadBytes,
    });
    if (changeRows.page.length) {
      for (const row of changeRows.page)
        await ctx.db.delete('catalogImpactChange', row._id);
      return false;
    }
    await ctx.db.delete('catalogImpactRun', run._id);
    return true;
  },
});

const impactStatusValidator = v.object({
  isDiscoveryComplete: v.boolean(),
  pendingCount: v.number(),
  failedCount: v.number(),
  isReady: v.boolean(),
  discoveryError: v.optional(v.string()),
  hasTruncatedCounts: v.optional(v.boolean()),
  missingIdentityCount: v.optional(v.number()),
  identityCoverageComplete: v.optional(v.boolean()),
});

export const status = internalQuery({
  args: { runId: v.id('catalogImpactRun') },
  returns: impactStatusValidator,
  handler: async (ctx, args): Promise<Infer<typeof impactStatusValidator>> => {
    const run = await ctx.db.get('catalogImpactRun', args.runId);
    if (!run)
      return {
        isDiscoveryComplete: false,
        pendingCount: 0,
        failedCount: 1,
        isReady: false,
        discoveryError: 'Catalog impact run is missing',
      };
    const controls = await ctx.db
      .query('catalogImpactControl')
      .withIndex('by_key', (q) => q.eq('key', 'global'))
      .take(2);
    const control = controls.length === 1 ? controls[0] : null;
    const release = await ctx.db.get('catalogRelease', run.releaseId);
    let preparationError: string | undefined;
    try {
      if (!release) throw new ConvexError('Catalog Release is missing');
      await requireCurrentPreparation(ctx, release);
    } catch (error) {
      preparationError =
        error instanceof Error
          ? error.message
          : 'Catalog preparation is inconsistent';
    }
    const inconsistency =
      run.lifecycle !== 'ready' && control?.runId !== run._id
        ? 'Catalog impact control is missing or the run was superseded'
        : undefined;
    const pending = await countWorkState(ctx, run._id, 'dirty');
    const failed = await countWorkState(ctx, run._id, 'failed');
    const discoveryError =
      run.discoveryError ?? preparationError ?? inconsistency;
    return {
      isDiscoveryComplete: run.isDiscoveryComplete,
      missingIdentityCount: run.missingIdentityCount ?? 0,
      identityCoverageComplete: run.identityCoverageComplete ?? false,
      ...(discoveryError ? { discoveryError } : {}),
      pendingCount: pending.count,
      failedCount: failed.count + (discoveryError ? 1 : 0),
      ...(pending.hasMore || failed.hasMore
        ? { hasTruncatedCounts: true }
        : {}),
      isReady:
        run.isDiscoveryComplete &&
        !discoveryError &&
        pending.count === 0 &&
        failed.count === 0,
    };
  },
});

export const inspectWork = internalQuery({
  args: {
    runId: v.id('catalogImpactRun'),
    state: schema.tables.catalogImpactWork.validator.fields.state,
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(schema.doc('catalogImpactWork')),
  handler: async (ctx, args) => {
    await readRun(ctx, args.runId);
    if (
      [
        args.paginationOpts.numItems,
        args.paginationOpts.maximumRowsRead,
        args.paginationOpts.maximumBytesRead,
      ].some(
        (value) =>
          value === undefined || !Number.isSafeInteger(value) || value < 1,
      ) ||
      args.paginationOpts.numItems > maxInspectionRows ||
      (args.paginationOpts.maximumRowsRead ?? 0) > maxInspectionRows ||
      (args.paginationOpts.maximumBytesRead ?? 0) > maxBatchReadBytes
    )
      throw new ConvexError('Bound candidate work inspection');
    return ctx.db
      .query('catalogImpactWork')
      .withIndex('by_runId_and_state', (q) =>
        q.eq('runId', args.runId).eq('state', args.state),
      )
      .paginate(args.paginationOpts);
  },
});
