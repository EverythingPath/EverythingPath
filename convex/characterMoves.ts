import { loadPreparedCharacterSheet } from './lib/preparedCharacterSheet';
import { isCatalogFixtureCampaign } from './lib/catalogFixturePolicy';
import { readSelectedCanonicalMilitiaState } from './lib/selectedCanonicalMilitiaState';
import { ConvexError, v, compareValues, type Infer } from 'convex/values';
import { query, internalMutation, type MutationCtx } from './_generated/server';
import { legacyCharacterMutation } from './lib/campaignRuntime';
import {
  requireCharacterAccess,
  requireCharacterCampaignAccess,
} from './lib/characterAccess';
import {
  loadCharacterSheetFromAccess,
  requireFixtureCampaign,
} from './lib/characterSheet';
import type { ReadCtx } from './types';
import type { WithoutSystemFields } from 'convex/server';
import type { Doc, Id } from './_generated/dataModel';
import { characterMoveCancelReasonValidator } from './schema';

import { internal } from './_generated/api';
import { publishCharacterMoveSpellIndex } from './lib/characterMoveSpells';
import { updateSpellCatalogSummary } from './lib/spellCatalogSummary';
import {
  indexSpellcastingClasses,
  reconcileSpellIdentity,
  takeSpellListRows,
} from './lib/spellCatalog';
import {
  readSelectedCatalogBoundary,
  readSelectedHeldCopyIds,
} from './lib/catalogReleaseBoundary';
import {
  releaseFingerprint,
  releaseByteCount,
} from '../src/lib/catalog/release-schema';
import {
  listCatalogDependencyKeys,
  listCatalogReferences,
  isCatalogKeyedListMember,
  remapCatalogReferences,
  remapCatalogDependencyKeys,
} from '../src/lib/catalog-copy-references';
import {
  characterCopyDefinition,
  planCharacterMove,
} from './lib/characterMovePlan';
import {
  writeCatalogDefinition,
  readReferencedCatalogDefinitions,
  calculateDefinitionFingerprint,
  readCampaignSpellMembershipStamp,
} from './lib/catalogCopies';
import { updateCanonicalCharacter } from './lib/canonicalCharacters';
import { removeCharacterDepartureAssignments } from './lib/canonicalCharacterDeparture';
import { reconcileCompanionRelationships } from './lib/companionRelationships';
import { organizationDepartureActor } from './lib/organizationDeparture';
import {
  campaignDeletionActor,
  readCampaignDeletion,
} from './lib/campaignDeletion';
import { isOrganizationDeleted } from './lib/organizationDeletion';
import {
  maxCharacterMoveGroupSize,
  maxMoveGroupRelationships,
  moveGroupDocumentReserve,
  characterMoveCapacityRefusal,
  mapCharacterMoveReadError,
  readCharacterMoveGroup,
  createCharacterMoveReadBudget,
  readCharacterMoveResourceLimits,
} from './lib/characterMoveGroup';

/**
 * Whose authority a move step runs under: the current owner's own command, or
 * the trusted return after they left the organization (#706), which reads the
 * same records without their credentials.
 */
type MoveAuthority = Awaited<ReturnType<typeof requireCharacterAccess>>;

type CharacterMoveRootTable =
  | 'characterSheetEntry'
  | 'spellCatalogIndex'
  | 'spellCatalogSummary'
  | 'characterLinkedInput'
  | 'acceptedWarning';
type RootDocument = Doc<CharacterMoveRootTable>;
function stripDocument<Row extends { _id: string; _creationTime: number }>(
  row: Row,
): WithoutSystemFields<Row>;
function stripDocument(row: { _id: string; _creationTime: number }) {
  const { _id, _creationTime, ...body } = row;
  return body;
}
type MoveReadBudget = ReturnType<typeof createCharacterMoveReadBudget>;
async function readMoveRows<Row>(
  query: AsyncIterable<Row> & { take(count: number): Promise<Row[]> },
  maximum: number,
  budget?: MoveReadBudget,
) {
  if (!budget) return query.take(maximum + 1);
  const rows: Row[] = [];
  for await (const row of query) {
    budget.accountRead(row);
    rows.push(row);
    if (rows.length > maximum) break;
  }
  return rows;
}
async function readMoveDefinitions(
  ctx: ReadCtx,
  ids: readonly Id<'catalogEntry'>[],
  budget: MoveReadBudget,
) {
  const rows = [];
  for (const id of ids) {
    const row = await ctx.db.get('catalogEntry', id);
    budget.accountRead(row);
    budget.accountReference(id);
    rows.push(row);
  }
  return rows;
}
function isSpellIndexRow(row: RootDocument): row is Doc<'spellCatalogIndex'> {
  return 'castingClassId' in row && 'catalogEntryId' in row;
}
/** Browser rows whose definition was deleted before deletions repaired them. */
async function readStaleSpellRows({
  ctx,
  rows,
  loaded,
  budget,
}: {
  ctx: ReadCtx;
  rows: readonly Doc<'spellCatalogIndex'>[];
  loaded: readonly Doc<'catalogEntry'>[];
  budget: MoveReadBudget;
}) {
  const known = new Set<string>(loaded.map((row) => row._id));
  const stale: Doc<'spellCatalogIndex'>[] = [];
  for (const row of rows) {
    if (known.has(row.catalogEntryId)) continue;
    budget.accountReference(row.catalogEntryId);
    const definition = await ctx.db.get('catalogEntry', row.catalogEntryId);
    budget.accountRead(definition);
    if (definition) known.add(definition._id);
    else stale.push(row);
  }
  return stale;
}
function defineCharacterMoveRoot<Row extends RootDocument>(
  table: CharacterMoveRootTable,
  read: (
    ctx: ReadCtx,
    characterId: Id<'character'>,
  ) => AsyncIterable<Row> & { take(count: number): Promise<Row[]> },
  write: (ctx: MutationCtx, row: Row) => Promise<void>,
  inputSignature: (rows: readonly Row[]) => unknown = (rows) => rows,
) {
  return {
    table,
    read: async (
      ctx: ReadCtx,
      characterId: Id<'character'>,
      readBudget?: MoveReadBudget,
    ) => {
      const rows = await readMoveRows(read(ctx, characterId), 8192, readBudget);
      if (rows.length > 8192)
        throw new ConvexError(
          'This Character has too many sheet selections to move. Remove unused selections, then try again.',
        );
      return {
        rows,
        inputSignature: inputSignature(rows),
        changes: (remapping: Readonly<Record<string, Id<'catalogEntry'>>>) => {
          const changes: Row[] = [];
          for (const row of rows) {
            let next = row;
            for (const [source, id] of Object.entries(remapping)) {
              next = remapCatalogReferences(next, source, id);
              next = remapCatalogDependencyKeys(next, source, id);
            }
            if (compareValues(row, next) !== 0) changes.push(next);
          }
          return {
            rows: changes,
            publish: async (ctx: MutationCtx) => {
              for (const row of changes) await write(ctx, row);
            },
          };
        },
      };
    },
  };
}
// One typed list includes every per-Character sheet table. Entry unions include
// archetypes, selections and Attack Routines; durable warning/linked-input keys stay intact.
// Familiar species, pending seeded scores and permanent facts are Character fields
// that the in-place arrival patch retains; Companion Relationships stay keyed by Character.
const characterMoveSheetRoots = [
  defineCharacterMoveRoot(
    'characterSheetEntry',
    (ctx, id) =>
      ctx.db
        .query('characterSheetEntry')
        .withIndex('by_characterId', (q) => q.eq('characterId', id)),
    (ctx, row) =>
      ctx.db.replace('characterSheetEntry', row._id, stripDocument(row)),
  ),
  defineCharacterMoveRoot(
    'spellCatalogIndex',
    (ctx, id) =>
      ctx.db
        .query('spellCatalogIndex')
        .withIndex('by_characterId_and_catalogEntryId', (q) =>
          q.eq('characterId', id),
        ),
    (ctx, row) =>
      ctx.db.replace('spellCatalogIndex', row._id, stripDocument(row)),
    (rows) =>
      rows
        .map((row) => ({
          catalogEntryId: row.catalogEntryId,
          castingClassId: row.castingClassId,
          ruleIdentity: row.ruleIdentity,
        }))
        .sort(
          (left, right) =>
            left.castingClassId.localeCompare(right.castingClassId) ||
            left.catalogEntryId.localeCompare(right.catalogEntryId) ||
            (left.ruleIdentity ?? '').localeCompare(right.ruleIdentity ?? ''),
        ),
  ),
  defineCharacterMoveRoot(
    'spellCatalogSummary',
    (ctx, id) =>
      ctx.db
        .query('spellCatalogSummary')
        .withIndex(
          'by_characterId_and_castingClassId_and_kind_and_value',
          (q) => q.eq('characterId', id),
        ),
    (ctx, row) =>
      ctx.db.replace('spellCatalogSummary', row._id, stripDocument(row)),
    () => null,
  ),
  defineCharacterMoveRoot(
    'characterLinkedInput',
    (ctx, id) =>
      ctx.db
        .query('characterLinkedInput')
        .withIndex('by_characterId', (q) => q.eq('characterId', id)),
    (ctx, row) =>
      ctx.db.replace('characterLinkedInput', row._id, stripDocument(row)),
  ),
  defineCharacterMoveRoot(
    'acceptedWarning',
    (ctx, id) =>
      ctx.db
        .query('acceptedWarning')
        .withIndex('by_characterId', (q) => q.eq('characterId', id)),
    (ctx, row) =>
      ctx.db.replace('acceptedWarning', row._id, stripDocument(row)),
    () => null,
  ),
];

const progressValidator = v.object({
  groupSize: v.optional(v.number()),
  completedMembers: v.optional(v.number()),
  generation: v.number(),
  operationId: v.string(),
  state: v.union(
    v.literal('preparing'),
    v.literal('ready'),
    // Not stored: an unfinished move whose destination the owner can't reach.
    v.literal('waiting'),
    v.literal('completed'),
    v.literal('cancelled'),
  ),
  prepared: v.number(),
  total: v.number(),
  destinationCampaignId: v.optional(v.id('campaign')),
  destinationCampaignName: v.optional(v.string()),
  cancelReason: v.optional(characterMoveCancelReasonValidator),
  waitingReason: v.optional(v.literal('destinationUnavailable')),
  // A trusted return: after the owner left the source organization (#706),
  // or before the source campaign is deleted (#710).
  origin: v.optional(
    v.union(v.literal('organizationDeparture'), v.literal('campaignDeletion')),
  ),
});
type CancelReason = Infer<typeof characterMoveCancelReasonValidator>;
type MoveProgress = Infer<typeof progressValidator>;
function moveProgress(move: Doc<'characterMove'>): MoveProgress {
  return {
    generation: move.generation,
    operationId: move.operationId,
    state: move.state,
    prepared: move.prepared,
    total: move.total,
    destinationCampaignId: move.destinationCampaignId,
    destinationCampaignName: move.destinationCampaignName,
    cancelReason: move.cancelReason,
    ...(move.departureId ? { origin: 'organizationDeparture' as const } : {}),
    ...(move.campaignDeletionId ? { origin: 'campaignDeletion' as const } : {}),
  };
}

/** Whether the move is a trusted return rather than the owner's own command. */
function isTrustedReturn(move: Doc<'characterMove'>) {
  return Boolean(move.departureId ?? move.campaignDeletionId);
}

/** Who a move's writes are attributed to. */
function moveActor(move: Doc<'characterMove'>) {
  if (move.departureId) return organizationDepartureActor;
  if (move.campaignDeletionId) return campaignDeletionActor;
  return move.actor;
}
function cancelledProgress(
  progress: MoveProgress,
  cancelReason?: CancelReason,
) {
  return { ...progress, state: 'cancelled' as const, cancelReason };
}
/** An unfinished move that continues once its destination is reachable. */
function waitingProgress(move: Doc<'characterMove'>) {
  return {
    ...moveProgress(move),
    state: 'waiting' as const,
    waitingReason: 'destinationUnavailable' as const,
  };
}
async function isDestinationReachable(
  ctx: ReadCtx,
  user: Doc<'user'>,
  destinationCampaignId: Id<'campaign'>,
) {
  const destination = await ctx.db.get('campaign', destinationCampaignId);
  return Boolean(
    destination?.e2eFixture &&
    user.orgIds.some((row) => row.orgId === destination.organizationId) &&
    !(await isOrganizationDeleted(ctx, destination.organizationId)) &&
    !(await readCampaignDeletion(ctx, destinationCampaignId)),
  );
}
/** Stop a move that no longer matches the Character, leaving it unchanged. */
async function fenceMove(
  ctx: MutationCtx,
  move: Doc<'characterMove'>,
  cancelReason: CancelReason,
) {
  const root = await readCharacterMoveRoot(ctx, move);
  for (const member of await readGroupMoves(ctx, root)) {
    await ctx.db.patch('characterMove', member._id, {
      state: 'cancelled',
      cancelReason,
    });
    await ctx.scheduler.runAfter(0, internal.characterMoves.cleanup, {
      characterId: member.characterId,
    });
  }
  return {
    ...(await groupProgress(ctx, root)),
    state: 'cancelled' as const,
    cancelReason,
  };
}
async function findMove(
  ctx: ReadCtx,
  characterId: Id<'character'>,
  operationId: string,
) {
  return ctx.db
    .query('characterMove')
    .withIndex('by_characterId_and_operationId', (q) =>
      q.eq('characterId', characterId).eq('operationId', operationId),
    )
    .unique();
}
type MoveCollections = {
  candidateIds: Id<'catalogEntry'>[];
  destinationCandidateIds: Id<'catalogEntry'>[];
  definitionIds: Id<'catalogEntry'>[];
  requiredKeys: string[];
};
type PreparedMove = Doc<'characterMove'> & MoveCollections;
const maxMoveMetadataBytes = 900 * 1024;
function prepareMoveMetadata<Value extends MoveCollections>(value: Value) {
  const {
    candidateIds: _candidateIds,
    destinationCandidateIds: _destinationCandidateIds,
    definitionIds: _definitionIds,
    requiredKeys: _requiredKeys,
    ...metadata
  } = value;
  if (releaseByteCount(metadata) > maxMoveMetadataBytes)
    throw new ConvexError(
      'This Character has too much move preparation to carry. Remove unused selections, then try again.',
    );
  return metadata;
}
function listMoveReferences(
  value: MoveCollections,
): Doc<'characterMoveReference'>['reference'][] {
  return [
    ...value.candidateIds.map((catalogEntryId) => ({
      kind: 'candidate' as const,
      catalogEntryId,
    })),
    ...value.destinationCandidateIds.map((catalogEntryId) => ({
      kind: 'destination' as const,
      catalogEntryId,
    })),
    ...value.definitionIds.map((catalogEntryId) => ({
      kind: 'definition' as const,
      catalogEntryId,
    })),
    ...value.requiredKeys.map((key) => ({ kind: 'key' as const, key })),
  ];
}
function moveReferenceKey(
  reference: Doc<'characterMoveReference'>['reference'],
) {
  return `${reference.kind}:${reference.kind === 'key' ? reference.key : reference.catalogEntryId}`;
}
async function persistMoveReferences(
  ctx: MutationCtx,
  move: PreparedMove,
  previous?: PreparedMove,
) {
  const existing = new Set(
    previous?.generation === move.generation
      ? listMoveReferences(previous).map(moveReferenceKey)
      : [],
  );
  const added = listMoveReferences(move).filter(
    (reference) => !existing.has(moveReferenceKey(reference)),
  );
  const metrics = await ctx.meta.getTransactionMetrics();
  const referenceBytes = added.reduce(
    (total, reference) =>
      total +
      releaseByteCount({
        moveId: move._id,
        characterId: move.characterId,
        generation: move.generation,
        reference,
      }) +
      128,
    0,
  );
  if (
    added.length + 128 > metrics.documentsWritten.remaining ||
    referenceBytes + 1024 * 1024 > metrics.bytesWritten.remaining
  )
    throw new ConvexError(characterMoveCapacityRefusal);
  for (const reference of added)
    await ctx.db.insert('characterMoveReference', {
      moveId: move._id,
      characterId: move.characterId,
      generation: move.generation,
      reference,
    });
}
async function readPreparedMove(
  ctx: ReadCtx,
  move: Doc<'characterMove'>,
): Promise<PreparedMove> {
  const limits = await readCharacterMoveResourceLimits(ctx);
  const rows = await readMoveRows(
    ctx.db
      .query('characterMoveReference')
      .withIndex('by_moveId_and_generation', (q) =>
        q.eq('moveId', move._id).eq('generation', move.generation),
      ),
    32768,
    createCharacterMoveReadBudget(limits),
  );
  if (rows.length > 32768)
    throw new ConvexError('Character has too many catalog dependencies');
  const collections: MoveCollections = {
    candidateIds: [],
    destinationCandidateIds: [],
    definitionIds: [],
    requiredKeys: [],
  };
  for (const { reference } of rows) {
    if (reference.kind === 'key') collections.requiredKeys.push(reference.key);
    else if (reference.kind === 'candidate')
      collections.candidateIds.push(reference.catalogEntryId);
    else if (reference.kind === 'destination')
      collections.destinationCandidateIds.push(reference.catalogEntryId);
    else collections.definitionIds.push(reference.catalogEntryId);
  }
  collections.definitionIds.sort((a, b) => a.localeCompare(b));
  return { ...move, ...collections };
}
async function patchPreparation(
  ctx: MutationCtx,
  previous: PreparedMove,
  next: PreparedMove,
) {
  await persistMoveReferences(ctx, next, previous);
  const { _id, _creationTime, ...metadata } = prepareMoveMetadata(next);
  await ctx.db.patch('characterMove', next._id, metadata);
}
async function resetPreparation(
  ctx: MutationCtx,
  move: PreparedMove,
  inputs: Awaited<ReturnType<typeof readInputs>>,
  authority: MoveAuthority,
): Promise<ReturnType<typeof moveProgress>> {
  const next = {
    ...move,
    ...buildPreparation(inputs),
    generation: move.generation + 1,
    prepared: 0,
    state: 'preparing' as const,
  };
  await patchPreparation(ctx, move, next);
  await ctx.scheduler.runAfter(0, internal.characterMoves.cleanup, {
    characterId: move.characterId,
  });
  return discover(ctx, next, authority);
}
async function readInputs(
  ctx: ReadCtx,
  authority: MoveAuthority,
  {
    candidateIds = [],
    destinationCampaignId,
    destinationCandidateIds = [],
  }: {
    candidateIds?: readonly Id<'catalogEntry'>[];
    destinationCampaignId?: Id<'campaign'>;
    destinationCandidateIds?: readonly Id<'catalogEntry'>[];
  },
) {
  const characterId = authority.character._id;
  const resourceLimits = await readCharacterMoveResourceLimits(ctx);
  const readBudget = createCharacterMoveReadBudget(resourceLimits);
  const sheet = await loadCharacterSheetFromAccess(ctx, authority, {
    isWritable: true,
    resourceLimits,
    readBudget,
  }).catch(mapCharacterMoveReadError);
  if (!sheet) throw new ConvexError('Character has no sheet');
  const roots = [];
  for (const root of characterMoveSheetRoots)
    roots.push(await root.read(ctx, characterId, readBudget));
  const boundary = await readSelectedCatalogBoundary(ctx, readBudget);
  const associated = await readMoveRows(
    ctx.db
      .query('companionRelationship')
      .withIndex('by_associatedCharacterId', (q) =>
        q.eq('associatedCharacterId', characterId),
      ),
    maxMoveGroupRelationships,
    readBudget,
  );
  const companion = await readMoveRows(
    ctx.db
      .query('companionRelationship')
      .withIndex('by_companionCharacterId', (q) =>
        q.eq('companionCharacterId', characterId),
      ),
    maxMoveGroupRelationships,
    readBudget,
  );
  if (
    associated.length > maxMoveGroupRelationships ||
    companion.length > maxMoveGroupRelationships
  )
    throw new ConvexError(
      'This Character has too many Companion Relationships to move. Interrupt a Companion Relationship first, then try again.',
    );
  const ownDefinitions = await readMoveRows(
    ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId)),
    8192,
    readBudget,
  );
  if (ownDefinitions.length > 8192)
    throw new ConvexError(
      'This Character has too many catalog definitions to move. Remove unused definitions, then try again.',
    );
  const candidates = await readMoveDefinitions(ctx, candidateIds, readBudget);
  if (candidates.some((row) => !row))
    throw new ConvexError(
      'A catalog dependency disappeared; cancel and start a new move',
    );
  const definitions = await readReferencedCatalogDefinitions(
    ctx,
    sheet.character,
    [
      ...sheet.catalogEntries,
      ...ownDefinitions,
      ...candidates.filter((row) => row !== null),
    ],
    // A spell-index row naming a deleted definition is repaired at
    // publication (#728), never a dependency.
    roots.flatMap((root) =>
      root.rows.flatMap((row) =>
        listCatalogReferences(row).map((reference) =>
          isSpellIndexRow(row)
            ? { ...reference, optional: true as const }
            : reference,
        ),
      ),
    ),
    readBudget,
    boundary,
  );
  const staleSpellRows = await readStaleSpellRows({
    ctx,
    rows: roots.flatMap((root) => root.rows.filter(isSpellIndexRow)),
    loaded: [...sheet.catalogEntries, ...ownDefinitions, ...definitions],
    budget: readBudget,
  });
  const staleSpellRowIds = new Set(staleSpellRows.map((row) => row._id));
  const destinationDefinitions = await readMoveDefinitions(
    ctx,
    destinationCandidateIds,
    readBudget,
  );
  if (
    destinationDefinitions.some(
      (row) =>
        row?.scope !== 'campaign' || row.campaignId !== destinationCampaignId,
    )
  )
    throw new ConvexError(
      'Destination catalog changed; cancel and start a new move',
    );
  const heldDefinitionIds = await readSelectedHeldCopyIds(
    ctx,
    definitions,
    readBudget,
    boundary,
  );
  // #411: an unrecorded browser row of held content is no existing use.
  const planSheet = roots.map((root) =>
    root.rows.filter(
      (row) =>
        !(isSpellIndexRow(row) && staleSpellRowIds.has(row._id)) &&
        !(
          'castingClassId' in row &&
          'catalogEntryId' in row &&
          row.recorded !== true &&
          heldDefinitionIds.has(row.catalogEntryId)
        ),
    ),
  );
  const plan = await planCharacterMove({
    characterId,
    sourceCampaignId: sheet.character.campaignId,
    retainedDefinitionIds: Object.values(
      sheet.character.carriedCatalogReferences ?? {},
    ),
    sheet: planSheet,
    definitions,
    heldDefinitionIds,
  });
  const needed = new Set(plan.requiredDefinitionIds);
  // Held content the Character doesn't use stays behind with its list rows.
  const leftHeldDefinitionIds = [...heldDefinitionIds].filter(
    (id) => !needed.has(id),
  );
  const requiredDefinitions = definitions
    .filter((row) => needed.has(row._id))
    .sort((a, b) => a._id.localeCompare(b._id));
  const sourceFingerprints: Record<string, string> = {};
  for (const row of requiredDefinitions.filter(
    (row) => row.scope === 'campaign',
  )) {
    const raw = await ctx.db.get('catalogEntry', row._id);
    readBudget.accountRead(raw);
    if (!raw) throw new ConvexError('Catalog dependency disappeared');
    sourceFingerprints[row._id] = await calculateDefinitionFingerprint(raw);
  }
  // The boundary: a change here restarts discovery. Sheet edits are compared
  // by the closure they need instead (shouldRestartPreparation).
  const fingerprint = await releaseFingerprint({
    character: {
      characterId: sheet.character._id,
      campaignId: sheet.character.campaignId,
      ownerId: sheet.character.ownerId,
      carriedCatalogReferences: sheet.character.carriedCatalogReferences,
    },
    release: boundary.control,
    associated,
    companion,
  });
  return {
    sheet,
    roots,
    sourceSpellMembershipStamp: await readCampaignSpellMembershipStamp(
      ctx,
      sheet.character.campaignId,
    ),
    destinationSpellMembershipStamp: await readCampaignSpellMembershipStamp(
      ctx,
      destinationCampaignId,
    ),
    fingerprint,
    sourceFingerprints,
    planSheet,
    leftHeldDefinitionIds,
    staleSpellRows,
    destinationDefinitions: destinationDefinitions.filter(
      (row) => row !== null,
    ),
    definitions: requiredDefinitions,
  };
}
async function reconcileStagedDefinitions(
  ctx: MutationCtx,
  move: PreparedMove,
  inputs: Awaited<ReturnType<typeof readInputs>>,
) {
  const limits = await readCharacterMoveResourceLimits(ctx);
  const staged = await readMoveRows(
    ctx.db
      .query('characterMoveDefinition')
      .withIndex('by_moveId_and_generation', (q) =>
        q.eq('moveId', move._id).eq('generation', move.generation),
      ),
    8192,
    createCharacterMoveReadBudget(limits),
  );
  if (staged.length > 8192)
    throw new ConvexError(
      'This Character has too many catalog definitions to move. Remove unused definitions, then try again.',
    );
  if (
    staged.length !== inputs.definitions.length ||
    staged.some(
      (row) =>
        !inputs.definitions.some(
          (definition) => definition._id === row.sourceId,
        ),
    )
  )
    return { kind: 'closure_changed' as const };
  const staleStaging = staged.some((row) => {
    const current = inputs.definitions.find(
      (definition) => definition._id === row.sourceId,
    );
    if (!current) return true;
    const { _id: _id, _creationTime: _time, ...body } = current;
    return compareValues(body, row.definition) !== 0;
  });
  if (staleStaging) {
    let changed = 0;
    for (const row of staged) {
      const current = inputs.definitions.find(
        (definition) => definition._id === row.sourceId,
      );
      if (!current) return { kind: 'closure_changed' as const };
      const { _id: _id, _creationTime: _time, ...definition } = current;
      if (compareValues(definition, row.definition) === 0) continue;
      await ctx.db.patch('characterMoveDefinition', row._id, { definition });
      changed += 1;
      if (changed === 32) break;
    }
    return { kind: 'refreshed' as const };
  }
  const definitions: Doc<'catalogEntry'>[] = staged.map((row) => ({
    ...row.definition,
    _id: row.sourceId,
    _creationTime: row.sourceCreatedAt,
  }));
  return { kind: 'current' as const, definitions };
}

async function publish(
  ctx: MutationCtx,
  move: PreparedMove,
  inputs: Awaited<ReturnType<typeof readInputs>>,
  authority: MoveAuthority,
) {
  if (shouldRestartPreparation(move, inputs))
    return resetPreparation(ctx, move, inputs, authority);
  const staging = await reconcileStagedDefinitions(ctx, move, inputs);
  if (staging.kind === 'closure_changed')
    return resetPreparation(ctx, move, inputs, authority);
  if (staging.kind === 'refreshed') return moveProgress(move);
  const publication = await preparePublication(
    ctx,
    move,
    inputs,
    staging.definitions,
  );
  return applyPublication(ctx, move, inputs, authority, publication);
}
async function preparePublication(
  ctx: MutationCtx,
  move: PreparedMove,
  inputs: Awaited<ReturnType<typeof readInputs>>,
  definitions: readonly Doc<'catalogEntry'>[],
) {
  const { sheet } = inputs;
  const plan = await planCharacterMove({
    characterId: move.characterId,
    sourceCampaignId: move.sourceCampaignId,
    retainedDefinitionIds: Object.values(
      sheet.character.carriedCatalogReferences ?? {},
    ),
    sourceFingerprints: inputs.sourceFingerprints,
    sheet: inputs.planSheet,
    definitions,
    allocateId: async (source) =>
      writeCatalogDefinition(
        ctx,
        await characterCopyDefinition(
          source,
          move.characterId,
          inputs.sourceFingerprints[source._id],
        ),
      ),
  });
  if (!plan.complete) throw new ConvexError('Move preparation is incomplete');
  const changedRoots = inputs.roots.map((root) => root.changes(plan.remapping));
  const plannedWrites =
    plan.copies.length +
    plan.updates.length +
    changedRoots.reduce((total, root) => total + root.rows.length, 0) +
    256;
  const plannedBytes = releaseByteCount({
    copies: plan.copies,
    updates: plan.updates,
    roots: changedRoots.map((root) => root.rows),
  });
  const publicationMetrics = await ctx.meta.getTransactionMetrics();
  if (
    plannedWrites > publicationMetrics.documentsWritten.remaining ||
    plannedBytes + 1024 * 1024 > publicationMetrics.bytesWritten.remaining
  )
    throw new ConvexError(characterMoveCapacityRefusal);
  return { plan, changedRoots, definitions, plannedWrites, plannedBytes };
}
async function applyPublication(
  ctx: MutationCtx,
  move: PreparedMove,
  inputs: Awaited<ReturnType<typeof readInputs>>,
  authority: MoveAuthority,
  publication: Awaited<ReturnType<typeof preparePublication>>,
  { deferFacts = false }: { deferFacts?: boolean } = {},
) {
  const { plan, changedRoots, definitions } = publication;
  for (const copy of plan.copies)
    await writeCatalogDefinition(ctx, copy.definition, copy.id);
  for (const update of plan.updates)
    await writeCatalogDefinition(ctx, update.definition, update.id);
  for (const root of changedRoots) await root.publish(ctx);
  await removeLeftHeldSpellRows(ctx, move.characterId, inputs);
  for (const row of inputs.staleSpellRows) {
    await ctx.db.delete('spellCatalogIndex', row._id);
    await updateSpellCatalogSummary({ ctx, row, delta: -1 });
  }
  return publishCharacterArrival(
    ctx,
    move,
    inputs,
    definitions,
    plan,
    authority,
    { deferFacts },
  );
}

async function removeLeftHeldSpellRows(
  ctx: MutationCtx,
  characterId: Id<'character'>,
  inputs: Awaited<ReturnType<typeof readInputs>>,
) {
  for (const catalogEntryId of inputs.leftHeldDefinitionIds) {
    const rows = await takeSpellListRows(
      ctx.db
        .query('spellCatalogIndex')
        .withIndex('by_characterId_and_catalogEntryId', (q) =>
          q.eq('characterId', characterId).eq('catalogEntryId', catalogEntryId),
        ),
    );
    for (const row of rows) {
      await ctx.db.delete('spellCatalogIndex', row._id);
      await updateSpellCatalogSummary({ ctx, row, delta: -1 });
    }
  }
}
async function publishCharacterArrival(
  ctx: MutationCtx,
  move: PreparedMove,
  inputs: Awaited<ReturnType<typeof readInputs>>,
  definitions: readonly Doc<'catalogEntry'>[],
  plan: {
    remapping: Record<string, Id<'catalogEntry'>>;
    copies: readonly { id: Id<'catalogEntry'> }[];
  },
  authority: MoveAuthority,
  { deferFacts = false }: { deferFacts?: boolean } = {},
) {
  const { sheet } = inputs;
  const carriedCatalogReferences = {
    ...Object.fromEntries(
      Object.entries(sheet.character.carriedCatalogReferences ?? {}).map(
        ([origin, selected]) => [origin, plan.remapping[selected] ?? selected],
      ),
    ),
    ...plan.remapping,
  };
  for (const definition of definitions) {
    const copyId = plan.remapping[definition._id];
    if (
      definition.scope === 'campaign' &&
      definition.campaignPreference &&
      definition.copiedFrom &&
      !carriedCatalogReferences[definition.copiedFrom] &&
      copyId
    )
      carriedCatalogReferences[definition.copiedFrom] = copyId;
  }
  if (Object.keys(carriedCatalogReferences).length > 1024)
    throw new ConvexError(
      'This Character has too many carried catalog selections to move. Remove unused selections, then try again.',
    );
  const actor = moveActor(move);
  await removeCharacterDepartureAssignments(ctx, {
    characterId: move.characterId,
    sourceCampaignId: move.sourceCampaignId,
    characterName: sheet.character.name,
    actor,
  });
  const sourceCampaign = move.sourceCampaignId
    ? await ctx.db.get('campaign', move.sourceCampaignId)
    : null;
  await ctx.db.patch('character', move.characterId, {
    campaignId: move.destinationCampaignId,
    ...(!move.destinationCampaignId && isCatalogFixtureCampaign(sourceCampaign)
      ? { catalogFixtureCampaignId: move.sourceCampaignId }
      : {}),
    carriedCatalogReferences,
    sheetMode: 'full',
    // A prepared sheet leaving a fixture campaign stays editable by its owner,
    // after a trusted return as after a voluntary departure.
    ...(move.destinationCampaignId
      ? {}
      : { sheetDemo: sheet.character.sheetDemo ?? true }),
    sheetRevision: (inputs.sheet.character.sheetRevision ?? 0) + 1,
    sheetLastOperationId: move.operationId,
    sheetUpdatedBy: actor,
  });
  if (deferFacts) return moveProgress(move);
  return finishCharacterArrival(
    ctx,
    move,
    inputs,
    definitions,
    plan,
    authority,
  );
}
async function finishCharacterArrival(
  ctx: MutationCtx,
  move: PreparedMove,
  inputs: Awaited<ReturnType<typeof readInputs>>,
  definitions: readonly Doc<'catalogEntry'>[],
  plan: {
    remapping: Record<string, Id<'catalogEntry'>>;
    copies: readonly { id: Id<'catalogEntry'> }[];
  },
  authority: MoveAuthority,
  { deferFacts = false }: { deferFacts?: boolean } = {},
) {
  const [arrived, destination] = await Promise.all([
    ctx.db.get('character', move.characterId),
    move.destinationCampaignId
      ? ctx.db.get('campaign', move.destinationCampaignId)
      : null,
  ]);
  const resourceLimits = await readCharacterMoveResourceLimits(ctx);
  const readBudget = createCharacterMoveReadBudget(resourceLimits);
  const published =
    arrived &&
    (await loadCharacterSheetFromAccess(
      ctx,
      {
        ...authority,
        character: arrived,
        campaign: destination,
      },
      { isWritable: true, resourceLimits, readBudget },
    ).catch(mapCharacterMoveReadError));
  if (!published) throw new ConvexError('Published sheet unavailable');
  const copies = await readMoveDefinitions(
    ctx,
    plan.copies.map((copy) => copy.id),
    readBudget,
  );
  // Each definition once, the published sheet's first: a carried casting
  // class listed twice would index its list twice.
  const spellDefinitions = new Map<string, Doc<'catalogEntry'>>();
  for (const row of [
    ...published.catalogEntries,
    ...definitions.filter(
      (row) => row.scope === 'global' && row.detail.kind === 'spell',
    ),
    ...copies.filter((row) => row !== null),
  ])
    if (!spellDefinitions.has(row._id)) spellDefinitions.set(row._id, row);
  // The in-place repairs (#728): a deleted definition's Spell follows another
  // definition, and a casting class gets the Spells the Character indexes.
  for (const ruleIdentity of new Set(
    inputs.staleSpellRows.flatMap((row) => row.ruleIdentity ?? []),
  ))
    await reconcileSpellIdentity({ ctx, sheet: published, ruleIdentity });
  await publishCharacterMoveSpellIndex(ctx, {
    characterId: move.characterId,
    destinationCampaignId: move.destinationCampaignId,
    entries: published.entries,
    destinationDefinitions: inputs.destinationDefinitions,
    definitions: [...spellDefinitions.values()],
  });
  const castingClassIds = new Set(
    published.calculated.spellcastings.map((casting) => casting.classEntryId),
  );
  await indexSpellcastingClasses({
    ctx,
    sheet: published,
    castingClassIds: published.catalogEntries
      .filter((row) => castingClassIds.has(row._id))
      .map((row) => row._id),
  });
  if (!deferFacts) {
    await updateCanonicalCharacter(ctx, move.characterId);
    await reconcileCompanionRelationships(ctx, {
      characterId: move.characterId,
      operationId: move.operationId,
    });
  }
  await ctx.db.patch('characterMove', move._id, { state: 'completed' });
  await ctx.scheduler.runAfter(0, internal.characterMoves.cleanup, {
    characterId: move.characterId,
  });
  return { ...moveProgress(move), state: 'completed' as const };
}
function buildPreparation(inputs: Awaited<ReturnType<typeof readInputs>>) {
  const requiredKeys = [
    ...new Set([
      ...inputs.definitions.flatMap(listCatalogDependencyKeys),
      ...inputs.roots.flatMap((root) => listCatalogDependencyKeys(root.rows)),
    ]),
  ];
  if (requiredKeys.length > 8192)
    throw new ConvexError('Character has too many required catalog keys');
  return {
    destinationCandidateIds: Array<Id<'catalogEntry'>>(),
    requiredKeys,
    candidateIds: Array<Id<'catalogEntry'>>(),
    scanPhase: 'campaignSpells' as const,
    scanCursor: null,
    fingerprint: inputs.fingerprint,
    sourceRevision: inputs.sheet.character.sheetRevision ?? 0,
    sourceSpellMembershipStamp: inputs.sourceSpellMembershipStamp,
    destinationSpellMembershipStamp: inputs.destinationSpellMembershipStamp,
    definitionIds: inputs.definitions.map((row) => row._id),
    total: inputs.definitions.length,
  };
}
/**
 * Whether preparation no longer describes the current Character. Boundary
 * changes always restart discovery. Sheet and definition edits restart it only
 * when they change the prepared closure: publication reads the live sheet, so
 * other edits are included without discarding staged work.
 */
function shouldRestartPreparation(
  move: PreparedMove,
  inputs: Awaited<ReturnType<typeof readInputs>>,
) {
  if (inputs.fingerprint !== move.fingerprint) return true;
  // Discovery's last page rereads the sheet and scans again for new keys.
  if (move.scanPhase !== 'done') return false;
  const next = buildPreparation(inputs);
  const keys = new Set(move.requiredKeys);
  const definitionIds = new Set<string>(move.definitionIds);
  return !(
    next.requiredKeys.every((key) => keys.has(key)) &&
    next.definitionIds.length === definitionIds.size &&
    next.definitionIds.every((id) => definitionIds.has(id))
  );
}
async function advanceMember(
  ctx: MutationCtx,
  storedMove: Doc<'characterMove'>,
  access: MoveAuthority,
  { allowPublication = true }: { allowPublication?: boolean } = {},
) {
  let move = await readPreparedMove(ctx, storedMove);
  if (
    !isTrustedReturn(move) &&
    !move.destinationCampaignId &&
    !access.character.sheetDemo &&
    !access.user.characterSheetDemo
  )
    throw new ConvexError(
      "Private character sheets aren't available for this account yet.",
    );
  if (move.actor !== access.user.tokenIdentifier)
    throw new ConvexError('Only the current owner can resume this move');
  if (move.state === 'completed' || move.state === 'cancelled')
    return moveProgress(move);
  // Stale work never outlives a change of campaign or owner assignment.
  if (access.character.campaignId !== move.sourceCampaignId)
    return fenceMove(ctx, move, 'campaignChanged');
  if (access.character.ownerLastOperationId !== move.ownerOperationId)
    return fenceMove(ctx, move, 'ownershipChanged');
  if (
    move.destinationCampaignId &&
    !(await isDestinationReachable(
      ctx,
      access.user,
      move.destinationCampaignId,
    ))
  )
    return waitingProgress(move);
  const [sourceStamp, destinationStamp] = await Promise.all([
    readCampaignSpellMembershipStamp(ctx, move.sourceCampaignId),
    readCampaignSpellMembershipStamp(ctx, move.destinationCampaignId),
  ]);
  if (
    sourceStamp !== move.sourceSpellMembershipStamp ||
    destinationStamp !== move.destinationSpellMembershipStamp
  )
    return resetPreparation(
      ctx,
      move,
      await readInputs(ctx, access, {
        destinationCampaignId: move.destinationCampaignId,
      }),
      access,
    );
  const hasRevisionChanged =
    (access.character.sheetRevision ?? 0) !== move.sourceRevision;
  const currentInputs =
    hasRevisionChanged || move.state === 'ready'
      ? await readInputs(ctx, access, {
          candidateIds: move.candidateIds,
          destinationCampaignId: move.destinationCampaignId,
          destinationCandidateIds: move.destinationCandidateIds,
        })
      : undefined;
  if (hasRevisionChanged && currentInputs) {
    if (shouldRestartPreparation(move, currentInputs))
      return resetPreparation(ctx, move, currentInputs, access);
    const sourceRevision = access.character.sheetRevision ?? 0;
    await ctx.db.patch('characterMove', move._id, { sourceRevision });
    move = { ...move, sourceRevision };
  }
  if (move.scanPhase !== 'done') return discover(ctx, move, access);
  if (move.state === 'ready' && !allowPublication) return moveProgress(move);
  if (move.state === 'ready' && currentInputs)
    return publish(ctx, move, currentInputs, access);
  return stage(ctx, move, access, currentInputs);
}
async function readDiscoveryPage(
  ctx: ReadCtx,
  move: PreparedMove,
  phase: Exclude<Doc<'characterMove'>['scanPhase'], 'done'>,
) {
  const campaignIds = {
    globalKeys: undefined,
    destinationSpells: move.destinationCampaignId,
    campaignKeys: move.sourceCampaignId,
    campaignSpells: move.sourceCampaignId,
  };
  const campaignId = campaignIds[phase];
  const scope = phase === 'globalKeys' ? 'global' : 'campaign';
  return ctx.db
    .query('catalogEntry')
    .withIndex('by_campaignId_and_scope_and_detail_kind', (q) => {
      return q
        .eq('campaignId', campaignId)
        .eq('scope', scope)
        .eq('detail.kind', 'spell');
    })
    .paginate({
      cursor: move.scanCursor,
      numItems: 32,
      maximumRowsRead: 32,
      maximumBytesRead: 1024 * 1024,
    });
}
async function discover(
  ctx: MutationCtx,
  preparedMove: PreparedMove,
  authority: MoveAuthority,
): Promise<ReturnType<typeof moveProgress>> {
  let move = preparedMove;
  while (move.scanPhase !== 'done') {
    const phase = move.scanPhase;
    if (
      !move.sourceCampaignId &&
      phase !== 'globalKeys' &&
      phase !== 'destinationSpells'
    ) {
      move = { ...move, scanPhase: 'globalKeys', scanCursor: null };
      continue;
    }
    if (phase === 'destinationSpells' && !move.destinationCampaignId) {
      move = { ...move, scanPhase: 'done', scanCursor: null };
      continue;
    }
    const page = await readDiscoveryPage(ctx, move, phase);
    const keys = new Set(move.requiredKeys);
    const candidates = new Set(
      phase === 'destinationSpells'
        ? move.destinationCandidateIds
        : move.candidateIds,
    );
    for (const row of page.page)
      if (isCatalogKeyedListMember(row, keys)) candidates.add(row._id);
    if (candidates.size > 8192)
      throw new ConvexError('Character has too many keyed dependencies');
    const nextScanPhase = {
      campaignSpells: 'globalKeys',
      campaignKeys: 'globalKeys',
      globalKeys: 'destinationSpells',
      destinationSpells: 'done',
    } as const;
    const scanPhase = page.isDone ? nextScanPhase[phase] : phase;
    const scanCursor = page.isDone ? null : page.continueCursor;
    const previous = move;
    move = {
      ...move,
      ...(phase === 'destinationSpells'
        ? { destinationCandidateIds: [...candidates] }
        : { candidateIds: [...candidates] }),
      scanPhase,
      scanCursor,
    };
    await patchPreparation(ctx, previous, move);
    // Convex runs one paginated query per function, so a resume takes the
    // next page, even after an empty one.
    if (scanPhase !== 'done') return moveProgress(move);
  }
  const inputs = await readInputs(ctx, authority, {
    candidateIds: move.candidateIds,
    destinationCampaignId: move.destinationCampaignId,
    destinationCandidateIds: move.destinationCandidateIds,
  });
  const keys = new Set([
    ...inputs.definitions.flatMap(listCatalogDependencyKeys),
    ...inputs.roots.flatMap((root) => listCatalogDependencyKeys(root.rows)),
  ]);
  if (keys.size > 8192)
    throw new ConvexError('Character has too many required catalog keys');
  const newKeys = [...keys].some((key) => !move.requiredKeys.includes(key));
  const next = {
    ...buildPreparation(inputs),
    fingerprint: move.fingerprint,
    sourceSpellMembershipStamp: move.sourceSpellMembershipStamp,
    destinationSpellMembershipStamp: move.destinationSpellMembershipStamp,
    candidateIds: move.candidateIds,
    destinationCandidateIds: move.destinationCandidateIds,
    scanPhase: newKeys ? ('campaignSpells' as const) : ('done' as const),
    requiredKeys: [...keys],
  };
  await patchPreparation(ctx, move, { ...move, ...next });
  move = { ...move, ...next };
  return newKeys ? moveProgress(move) : stage(ctx, move, authority, inputs);
}
async function stage(
  ctx: MutationCtx,
  move: PreparedMove,
  authority: MoveAuthority,
  inputs?: Awaited<ReturnType<typeof readInputs>>,
): Promise<ReturnType<typeof moveProgress>> {
  const currentInputs =
    inputs ??
    (await readInputs(ctx, authority, {
      candidateIds: move.candidateIds,
      destinationCampaignId: move.destinationCampaignId,
      destinationCandidateIds: move.destinationCandidateIds,
    }));
  const ids = move.definitionIds.slice(move.prepared, move.prepared + 32);
  let count = 0;
  let bytes = 0;
  for (const id of ids) {
    const row = currentInputs.definitions.find(
      (definition) => definition._id === id,
    );
    if (!row) return resetPreparation(ctx, move, currentInputs, authority);
    const { _id, _creationTime, ...definition } = row;
    const size = releaseByteCount(definition);
    if (count > 0 && bytes + size > 1024 * 1024) break;
    await ctx.db.insert('characterMoveDefinition', {
      moveId: move._id,
      characterId: move.characterId,
      generation: move.generation,
      sourceId: _id,
      sourceCreatedAt: _creationTime,
      definition,
    });
    count += 1;
    bytes += size;
  }
  const prepared = move.prepared + count;
  const state =
    prepared === move.total ? ('ready' as const) : ('preparing' as const);
  await ctx.db.patch('characterMove', move._id, { prepared, state });
  return { ...moveProgress(move), prepared, state };
}

/** Start a move, ending any pending one, and take its first discovery page. */
async function createMove(
  ctx: MutationCtx,
  authority: MoveAuthority,
  args: {
    operationId: string;
    destinationCampaignId?: Id<'campaign'>;
    departureId?: Id<'organizationDeparture'>;
    campaignDeletionId?: Id<'campaignDeletion'>;
    groupRootId?: Id<'characterMove'>;
  },
) {
  const characterId = authority.character._id;
  const pending = await latestMove(ctx, characterId);
  if (pending && (pending.state === 'preparing' || pending.state === 'ready'))
    await fenceMove(ctx, pending, 'replaced');
  const group = args.groupRootId
    ? null
    : await readCharacterMoveGroup(ctx, authority.character);
  if (group?.refusal)
    throw new ConvexError(
      `This group has ${group.refusal.groupSize} Characters. A move can include at most ${group.refusal.maxGroupSize}. Interrupt a Companion Relationship first, then try again.`,
    );
  const inputs = await readInputs(ctx, authority, {
    destinationCampaignId: args.destinationCampaignId,
  });
  const operation = {
    characterId,
    ...(args.groupRootId ? { groupRootId: args.groupRootId } : {}),
    ...(group
      ? {
          groupCharacterIds: group.characters.map((row) => row._id),
          groupFingerprint: group.fingerprint,
          groupMoveClaims: await Promise.all(
            group.characters.map(async (row) => ({
              characterId: row._id,
              moveId: (await latestMove(ctx, row._id))?._id,
              ownerOperationId: row.ownerLastOperationId,
            })),
          ),
        }
      : {}),
    operationId: args.operationId,
    actor: authority.user.tokenIdentifier,
    sourceCampaignId: authority.character.campaignId,
    ownerOperationId: authority.character.ownerLastOperationId,
    destinationCampaignId: args.destinationCampaignId,
    destinationCampaignName: args.destinationCampaignId
      ? (await ctx.db.get('campaign', args.destinationCampaignId))?.name
      : undefined,
    departureId: args.departureId,
    campaignDeletionId: args.campaignDeletionId,
    ...buildPreparation(inputs),
    generation: 0,
    prepared: 0,
    state: 'preparing' as const,
  };
  const id = await ctx.db.insert(
    'characterMove',
    prepareMoveMetadata(operation),
  );
  const move = await ctx.db.get('characterMove', id);
  if (!move) throw new ConvexError('Move unavailable');
  const preparedMove = { ...move, ...buildPreparation(inputs) };
  await persistMoveReferences(ctx, preparedMove);
  const progress = await discover(ctx, preparedMove, authority);
  return move.groupCharacterIds && move.groupCharacterIds.length > 1
    ? groupProgress(ctx, await readStoredMove(ctx, move._id))
    : progress;
}
/** Resolve member work to the operation that publishes the whole group. */
export async function readCharacterMoveRoot(
  ctx: ReadCtx,
  move: Doc<'characterMove'>,
) {
  if (!move.groupRootId) return move;
  const root = await ctx.db.get('characterMove', move.groupRootId);
  if (!root) {
    if (move.state === 'completed' || move.state === 'cancelled') return move;
    throw new ConvexError('Move not found');
  }
  return root;
}
async function readStoredMove(ctx: ReadCtx, id: Id<'characterMove'>) {
  const move = await ctx.db.get('characterMove', id);
  if (!move) throw new ConvexError('Move unavailable');
  return move;
}
async function readGroupMoves(ctx: ReadCtx, root: Doc<'characterMove'>) {
  if (!root.groupCharacterIds) return [root];
  const moves: Doc<'characterMove'>[] = [];
  for (const id of root.groupCharacterIds) {
    const move =
      id === root.characterId
        ? root
        : await findMove(ctx, id, root.operationId);
    if (move && (move._id === root._id || move.groupRootId === root._id))
      moves.push(move);
  }
  return moves;
}
async function groupProgress(
  ctx: ReadCtx,
  root: Doc<'characterMove'>,
  {
    members: loadedMembers,
  }: { members?: readonly Doc<'characterMove'>[] } = {},
): Promise<MoveProgress> {
  if (!root.groupCharacterIds || root.groupCharacterIds.length === 1)
    return moveProgress(root);
  const members = loadedMembers ?? (await readGroupMoves(ctx, root));
  const complete = root.state === 'completed';
  return {
    ...moveProgress(root),
    generation: members.reduce((total, row) => total + row.generation, 0),
    state:
      root.state === 'cancelled' || complete
        ? root.state
        : members.length === root.groupCharacterIds.length &&
            members.every((row) => row.state === 'ready')
          ? 'ready'
          : 'preparing',
    prepared: members.reduce((total, row) => total + row.prepared, 0),
    total: members.reduce((total, row) => total + row.total, 0),
    groupSize: root.groupCharacterIds.length,
    completedMembers: complete ? root.groupCharacterIds.length : 0,
  };
}

async function groupAuthority(
  ctx: ReadCtx,
  access: MoveAuthority,
  character: Doc<'character'>,
  trusted: boolean,
): Promise<MoveAuthority> {
  if (!trusted) return requireOwner(ctx, character._id);
  const campaign = character.campaignId
    ? await ctx.db.get('campaign', character.campaignId)
    : null;
  if (!campaign) throw new ConvexError('Character campaign unavailable');
  requireFixtureCampaign(campaign);
  return { ...access, character, campaign };
}
type GroupMoveMember = {
  characterId: Id<'character'>;
  authority: MoveAuthority;
  move: Doc<'characterMove'> | null;
};
type GroupPublicationMember = {
  move: PreparedMove;
  authority: MoveAuthority;
  inputs: Awaited<ReturnType<typeof readInputs>>;
  definitions: Doc<'catalogEntry'>[];
};

/** Check claims before any preparation or publication changes. */
async function readMoveGroupMembers(
  ctx: ReadCtx,
  root: Doc<'characterMove'>,
  access: MoveAuthority,
) {
  const members: GroupMoveMember[] = [];
  for (const characterId of root.groupCharacterIds ?? [root.characterId]) {
    const character = await ctx.db.get('character', characterId);
    const move =
      characterId === root.characterId
        ? root
        : await findMove(ctx, characterId, root.operationId);
    if (move && move._id !== root._id && move.groupRootId !== root._id)
      return { kind: 'cancelled' as const, reason: 'replaced' as const };
    const latest = await latestMove(ctx, characterId);
    const claim = root.groupMoveClaims?.find(
      (row) => row.characterId === characterId,
    );
    if (
      latest &&
      latest._id !== claim?.moveId &&
      latest._id !== root._id &&
      latest.groupRootId !== root._id
    )
      return { kind: 'cancelled' as const, reason: 'replaced' as const };
    if (
      character?.ownerId !== root.actor ||
      (move
        ? move.ownerOperationId !== character.ownerLastOperationId
        : claim?.ownerOperationId !== character.ownerLastOperationId)
    )
      return {
        kind: 'cancelled' as const,
        reason: 'ownershipChanged' as const,
      };
    if (character.campaignId !== root.sourceCampaignId)
      return { kind: 'cancelled' as const, reason: 'campaignChanged' as const };
    members.push({
      characterId,
      move,
      authority: await groupAuthority(
        ctx,
        access,
        character,
        isTrustedReturn(root),
      ),
    });
  }
  return { kind: 'ready' as const, members };
}

async function currentGroupProgress(
  ctx: ReadCtx,
  root: Doc<'characterMove'>,
  members: readonly GroupMoveMember[],
) {
  const current = await Promise.all(
    members.flatMap((member) =>
      member.move ? [readStoredMove(ctx, member.move._id)] : [],
    ),
  );
  return groupProgress(ctx, await readStoredMove(ctx, root._id), {
    members: current,
  });
}

/** Each resume prepares at most one member; publication waits for them all. */
async function prepareNextGroupMember(
  ctx: MutationCtx,
  root: Doc<'characterMove'>,
  members: GroupMoveMember[],
) {
  for (const member of members) {
    if (!member.move) {
      await createMove(ctx, member.authority, {
        operationId: root.operationId,
        destinationCampaignId: root.destinationCampaignId,
        departureId: root.departureId,
        campaignDeletionId: root.campaignDeletionId,
        groupRootId: root._id,
      });
      member.move = await findMove(ctx, member.characterId, root.operationId);
      return currentGroupProgress(ctx, root, members);
    }
    if (member.move.state === 'cancelled')
      return fenceMove(ctx, root, member.move.cancelReason ?? 'replaced');
    if (member.move.state !== 'ready') {
      await advanceMember(ctx, member.move, member.authority, {
        allowPublication: false,
      });
      return currentGroupProgress(ctx, root, members);
    }
  }
  return null;
}

async function requireGroupReadHeadroom(ctx: ReadCtx) {
  const metrics = await ctx.meta.getTransactionMetrics();
  if (
    metrics.bytesRead.remaining < 2 * 1024 * 1024 ||
    metrics.documentsRead.remaining < moveGroupDocumentReserve
  )
    throw new ConvexError(characterMoveCapacityRefusal);
}

async function readGroupPublicationMembers(
  ctx: MutationCtx,
  root: Doc<'characterMove'>,
  members: readonly GroupMoveMember[],
) {
  const pending: GroupPublicationMember[] = [];
  let records = 0;
  let bytes = 0;
  for (const member of members) {
    if (!member.move)
      return {
        kind: 'progress' as const,
        progress: await fenceMove(ctx, root, 'groupChanged'),
      };
    const move = await readPreparedMove(ctx, member.move);
    const inputs = await readInputs(ctx, member.authority, {
      candidateIds: move.candidateIds,
      destinationCampaignId: root.destinationCampaignId,
      destinationCandidateIds: move.destinationCandidateIds,
    });
    records +=
      inputs.roots.reduce((sum, row) => sum + row.rows.length, 0) +
      inputs.definitions.length;
    bytes += releaseByteCount({
      roots: inputs.roots.map((row) => row.rows),
      definitions: inputs.definitions,
    });
    if (records > 8192 || bytes > 8 * 1024 * 1024)
      throw new ConvexError(characterMoveCapacityRefusal);
    await requireGroupReadHeadroom(ctx);
    if (
      shouldRestartPreparation(move, inputs) ||
      inputs.sourceSpellMembershipStamp !== move.sourceSpellMembershipStamp ||
      inputs.destinationSpellMembershipStamp !==
        move.destinationSpellMembershipStamp
    ) {
      await resetPreparation(ctx, move, inputs, member.authority);
      return {
        kind: 'progress' as const,
        progress: await currentGroupProgress(ctx, root, members),
      };
    }
    const staging = await reconcileStagedDefinitions(ctx, move, inputs);
    if (staging.kind === 'closure_changed') {
      await resetPreparation(ctx, move, inputs, member.authority);
      return {
        kind: 'progress' as const,
        progress: await currentGroupProgress(ctx, root, members),
      };
    }
    if (staging.kind === 'refreshed')
      return {
        kind: 'progress' as const,
        progress: await currentGroupProgress(ctx, root, members),
      };
    pending.push({
      move,
      authority: member.authority,
      inputs,
      definitions: staging.definitions,
    });
  }
  return { kind: 'ready' as const, pending };
}

async function prepareGroupPublications(
  ctx: MutationCtx,
  pending: readonly GroupPublicationMember[],
) {
  await requireGroupReadHeadroom(ctx);
  const publications = [];
  for (const member of pending)
    publications.push({
      member,
      publication: await preparePublication(
        ctx,
        member.move,
        member.inputs,
        member.definitions,
      ),
    });
  const metrics = await ctx.meta.getTransactionMetrics();
  const writes = publications.reduce(
    (total, row) => total + row.publication.plannedWrites,
    0,
  );
  const writtenBytes = publications.reduce(
    (total, row) => total + row.publication.plannedBytes,
    0,
  );
  if (
    writes > metrics.documentsWritten.remaining ||
    writtenBytes + 2 * 1024 * 1024 > metrics.bytesWritten.remaining
  )
    throw new ConvexError(characterMoveCapacityRefusal);
  return publications;
}

async function refreshGroupFacts(
  ctx: MutationCtx,
  pending: readonly GroupPublicationMember[],
) {
  for (const member of pending) {
    const character = await ctx.db.get('character', member.move.characterId);
    if (!character) throw new ConvexError('Published Character unavailable');
    const resourceLimits = await readCharacterMoveResourceLimits(ctx);
    const sheet = await loadPreparedCharacterSheet(
      ctx,
      character,
      undefined,
      {
        resourceLimits,
        trustedLinkedInputs: true,
        includeAcceptedWarnings: false,
      },
      createCharacterMoveReadBudget(resourceLimits),
    ).catch(mapCharacterMoveReadError);
    await updateCanonicalCharacter(ctx, member.move.characterId, sheet);
  }
}

async function publishMoveGroup(
  ctx: MutationCtx,
  root: Doc<'characterMove'>,
  members: readonly GroupMoveMember[],
  pending: readonly GroupPublicationMember[],
) {
  const publications = await prepareGroupPublications(ctx, pending);
  for (const { member, publication } of publications)
    await applyPublication(
      ctx,
      member.move,
      member.inputs,
      member.authority,
      publication,
      { deferFacts: true },
    );
  for (const { member, publication } of publications)
    await finishCharacterArrival(
      ctx,
      member.move,
      member.inputs,
      publication.definitions,
      publication.plan,
      member.authority,
      { deferFacts: true },
    );
  // All access transitions are selected before any linked facts are recalculated.
  await refreshGroupFacts(ctx, pending);
  await reconcileCompanionRelationships(ctx, {
    characterId: root.characterId,
    operationId: root.operationId,
    boundedMove: true,
  });
  return currentGroupProgress(ctx, root, members);
}

/** One member's resumable preparation; one transaction publishes every ready member. */
async function advance(
  ctx: MutationCtx,
  storedMove: Doc<'characterMove'>,
  access: MoveAuthority,
): Promise<MoveProgress> {
  const root = await readCharacterMoveRoot(ctx, storedMove);
  if (!root.groupCharacterIds) {
    if (
      root.state !== 'completed' &&
      root.state !== 'cancelled' &&
      (await readCharacterMoveGroup(ctx, access.character)).characters.length >
        1
    )
      return fenceMove(ctx, root, 'groupChanged');
    return advanceMember(ctx, root, access);
  }
  if (root.state === 'completed' || root.state === 'cancelled')
    return groupProgress(ctx, root);
  const checked = await readMoveGroupMembers(ctx, root, access);
  if (checked.kind === 'cancelled') return fenceMove(ctx, root, checked.reason);
  const rootMember = checked.members.find(
    (member) => member.characterId === root.characterId,
  );
  if (!rootMember) return fenceMove(ctx, root, 'groupChanged');
  const group = await readCharacterMoveGroup(
    ctx,
    rootMember.authority.character,
  );
  if (group.refusal) throw new ConvexError(characterMoveCapacityRefusal);
  if (group.fingerprint !== root.groupFingerprint)
    return fenceMove(ctx, root, 'groupChanged');
  if (
    root.destinationCampaignId &&
    !(await isDestinationReachable(
      ctx,
      access.user,
      root.destinationCampaignId,
    ))
  )
    return {
      ...(await currentGroupProgress(ctx, root, checked.members)),
      state: 'waiting',
      waitingReason: 'destinationUnavailable',
    };
  if (checked.members.length === 1)
    return advanceMember(ctx, root, rootMember.authority);
  const progress = await prepareNextGroupMember(ctx, root, checked.members);
  if (progress) return progress;
  const publication = await readGroupPublicationMembers(
    ctx,
    root,
    checked.members,
  );
  if (publication.kind === 'progress') return publication.progress;
  return publishMoveGroup(ctx, root, checked.members, publication.pending);
}

async function readVisibleMoveCharacter(
  ctx: ReadCtx,
  character: Doc<'character'> | null,
) {
  if (!character) return null;
  return requireCharacterAccess(ctx, { characterId: character._id })
    .then(() => character)
    .catch((error: unknown) => {
      if (error instanceof ConvexError) return null;
      throw error;
    });
}

export const preview = query({
  args: { characterId: v.id('character') },
  returns: v.object({
    moving: v.array(
      v.object({ characterId: v.id('character'), name: v.string() }),
    ),
    staying: v.array(
      v.object({
        characterId: v.optional(v.id('character')),
        name: v.optional(v.string()),
        reason: v.union(
          v.literal('inactive'),
          v.literal('differentOwner'),
          v.literal('unavailable'),
          v.literal('associated'),
        ),
      }),
    ),
    maxGroupSize: v.number(),
    refusal: v.optional(
      v.object({
        reason: v.literal('groupTooLarge'),
        groupSize: v.number(),
        maxGroupSize: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const access = await requireOwner(ctx, args.characterId);
    const group = await readCharacterMoveGroup(ctx, access.character);
    const moving = group.characters.map((character) => ({
      characterId: character._id,
      name: character.name,
    }));
    const staying = await Promise.all(
      [
        ...group.staying,
        ...group.associatedCharacters.map((character) => ({
          character,
          reason: 'associated' as const,
        })),
      ].map(async (row) => {
        const visible = await readVisibleMoveCharacter(ctx, row.character);
        return {
          reason: row.reason,
          ...(visible ? { characterId: visible._id, name: visible.name } : {}),
        };
      }),
    );
    return {
      moving,
      staying,
      maxGroupSize: maxCharacterMoveGroupSize,
      ...(group.refusal ? { refusal: group.refusal } : {}),
    };
  },
});

function latestMove(ctx: ReadCtx, characterId: Id<'character'>) {
  return ctx.db
    .query('characterMove')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .order('desc')
    .first();
}

/**
 * #708: end the Character's unfinished move once its owner's account is
 * deleted. The ownership change would fence it at the next resume, but no
 * owner remains to resume it, so it is fenced now and its staging cleaned up.
 */
export async function fenceUnfinishedMove(
  ctx: MutationCtx,
  characterId: Id<'character'>,
) {
  const pending = await latestMove(ctx, characterId);
  if (pending && (pending.state === 'preparing' || pending.state === 'ready'))
    await fenceMove(ctx, pending, 'ownershipChanged');
}

type TrustedReturnOrigin =
  | {
      kind: 'organizationDeparture';
      id: Id<'organizationDeparture'>;
      round: number;
    }
  | { kind: 'campaignDeletion'; id: Id<'campaignDeletion'>; round: number };

/**
 * One bounded step of a trusted return of a Character to no campaign, through
 * the same preparation, fencing and publication as a voluntary move. The
 * caller rechecked that the return is still due; the owner's stored account
 * supplies the authority their credentials would. A fenced return, for
 * example after a member took ownership, leaves the Character in place.
 *
 * A departure (#706) and a campaign deletion (#710) can both return the same
 * Character. Each continues the other's unfinished return for the same owner
 * rather than replacing it, so the Character is returned once. A return
 * replaces a voluntary move, and an earlier round of its own lifecycle.
 */
async function advanceTrustedReturn(
  ctx: MutationCtx,
  authority: MoveAuthority & { campaign: Doc<'campaign'> },
  origin: TrustedReturnOrigin,
) {
  const latest = await latestMove(ctx, authority.character._id);
  const prefix = `${origin.kind === 'organizationDeparture' ? 'departure' : 'campaignDeletion'}:${origin.id}:${origin.round}:`;
  const isOtherLifecycle =
    latest &&
    (origin.kind === 'organizationDeparture'
      ? latest.campaignDeletionId !== undefined
      : latest.departureId !== undefined);
  // A return prepared for a previous owner is replaced: the Character goes
  // to whoever owns it now.
  if (
    latest &&
    (latest.state === 'preparing' || latest.state === 'ready') &&
    latest.actor === authority.user.tokenIdentifier &&
    (latest.operationId.startsWith(prefix) || isOtherLifecycle)
  )
    return advance(ctx, latest, authority);
  return createMove(ctx, authority, {
    operationId: `${prefix}${latest?._id ?? 'first'}`,
    ...(origin.kind === 'organizationDeparture'
      ? { departureId: origin.id }
      : { campaignDeletionId: origin.id }),
  });
}

/**
 * #706: one bounded step of the trusted return of a departed owner's Character
 * to no campaign. The caller rechecked that the owner's account survives
 * without membership of the Character's organization.
 */
export function advanceDepartureReturn(
  ctx: MutationCtx,
  authority: MoveAuthority & { campaign: Doc<'campaign'> },
  departure: { id: Id<'organizationDeparture'>; round: number },
) {
  return advanceTrustedReturn(ctx, authority, {
    kind: 'organizationDeparture',
    ...departure,
  });
}

/**
 * #710: one bounded step of returning a Character to its surviving owner
 * before its campaign is deleted. The caller rechecked that the deletion is
 * returning and that the Character's current owner's account survives.
 */
export function advanceCampaignDeletionReturn(
  ctx: MutationCtx,
  authority: MoveAuthority & { campaign: Doc<'campaign'> },
  deletion: { id: Id<'campaignDeletion'>; round: number },
) {
  return advanceTrustedReturn(ctx, authority, {
    kind: 'campaignDeletion',
    ...deletion,
  });
}

const scope = { characterId: v.id('character') };
async function requireOwner(
  ctx: ReadCtx,
  characterId: Id<'character'>,
  destinationCampaignId?: Id<'campaign'>,
) {
  const access = await requireCharacterAccess(ctx, { characterId });
  if (access.character.ownerId !== access.user.tokenIdentifier)
    throw new ConvexError(
      'Only the current owner can leave or move a Character',
    );
  if (destinationCampaignId)
    await requireCharacterCampaignAccess(ctx, {
      campaignId: destinationCampaignId,
    });
  if (access.campaign) {
    requireFixtureCampaign(access.campaign);
  } else if (!access.character.sheetDemo)
    throw new ConvexError(
      "Editing isn't available for this character sheet yet.",
    );
  if (destinationCampaignId) {
    const destination = await ctx.db.get('campaign', destinationCampaignId);
    if (!destination) throw new ConvexError('Destination campaign not found');
    requireFixtureCampaign(destination);
    if (await readCampaignDeletion(ctx, destinationCampaignId))
      throw new ConvexError('This campaign is being deleted');
  }
  return access;
}
export const start = legacyCharacterMutation({
  args: {
    ...scope,
    destinationCampaignId: v.optional(v.id('campaign')),
    operationId: v.string(),
  },
  returns: progressValidator,
  handler: async (ctx, args) => {
    const access = await requireOwner(
      ctx,
      args.characterId,
      args.destinationCampaignId,
    );
    if (
      !args.destinationCampaignId &&
      !access.character.sheetDemo &&
      !access.user.characterSheetDemo
    )
      throw new ConvexError(
        "Private character sheets aren't available for this account yet.",
      );
    if (!args.operationId.trim() || args.operationId.length > 200)
      throw new ConvexError('Enter a move operation identifier');
    const previous = await findMove(ctx, args.characterId, args.operationId);
    if (previous) {
      if (
        previous.destinationCampaignId !== args.destinationCampaignId ||
        previous.actor !== access.user.tokenIdentifier
      )
        throw new ConvexError('Move operation already used');
      return groupProgress(ctx, await readCharacterMoveRoot(ctx, previous));
    }
    if (access.character.campaignId === args.destinationCampaignId)
      throw new ConvexError('Choose a different campaign');
    return createMove(ctx, access, args);
  },
});
export const resume = legacyCharacterMutation({
  args: { ...scope, operationId: v.string() },
  returns: progressValidator,
  handler: async (ctx, args) => {
    // Authorize before looking up the operation, so no refusal reveals it.
    const access = await requireOwner(ctx, args.characterId);
    const move = await findMove(ctx, args.characterId, args.operationId);
    if (!move) throw new ConvexError('Move not found');
    return advance(ctx, move, access);
  },
});
export const status = query({
  args: { ...scope, operationId: v.optional(v.string()) },
  returns: v.union(progressValidator, v.null()),
  handler: async (ctx, args): Promise<MoveProgress | null> => {
    const access = await requireOwner(ctx, args.characterId);
    const storedMove = args.operationId
      ? await findMove(ctx, args.characterId, args.operationId)
      : await latestMove(ctx, args.characterId);
    if (!storedMove) return null;
    const move = await readCharacterMoveRoot(ctx, storedMove);
    if (move.state === 'completed' || move.state === 'cancelled')
      return groupProgress(ctx, move);
    // Report stale work as the next resume will fence it.
    const rootCharacter =
      move.characterId === access.character._id
        ? access.character
        : await ctx.db.get('character', move.characterId);
    const progress = await groupProgress(ctx, move);
    if (move.actor !== rootCharacter?.ownerId)
      return cancelledProgress(progress, 'ownershipChanged');
    if (move.sourceCampaignId !== rootCharacter.campaignId)
      return cancelledProgress(progress, 'campaignChanged');
    if (
      move.actor !== access.user.tokenIdentifier ||
      move.ownerOperationId !== rootCharacter.ownerLastOperationId
    )
      return cancelledProgress(progress, 'ownershipChanged');
    if (
      move.destinationCampaignId &&
      !(await isDestinationReachable(
        ctx,
        access.user,
        move.destinationCampaignId,
      ))
    )
      return {
        ...progress,
        state: 'waiting',
        waitingReason: 'destinationUnavailable',
      };
    if (move.groupCharacterIds) {
      if (
        !rootCharacter ||
        (await readCharacterMoveGroup(ctx, rootCharacter)).fingerprint !==
          move.groupFingerprint
      )
        return cancelledProgress(progress, 'groupChanged');
    }
    return progress;
  },
});
export const destinations = query({
  args: scope,
  returns: v.object({
    available: v.boolean(),
    isOwner: v.boolean(),
    currentCampaignId: v.optional(v.id('campaign')),
    currentCampaignHasMilitia: v.boolean(),
    departureRoles: v.array(v.string()),
    destinations: v.array(
      v.object({
        campaignId: v.id('campaign'),
        campaignName: v.string(),
        organizationId: v.string(),
        hasMilitia: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const { character, user, campaign } = await requireCharacterAccess(
      ctx,
      args,
    );
    const available = Boolean(
      campaign ? campaign.e2eFixture : character.sheetDemo,
    );
    const isOwner = character.ownerId === user.tokenIdentifier;
    const currentCampaignId = character.campaignId;
    const militia = currentCampaignId
      ? await ctx.db
          .query('militia')
          .withIndex('by_campaign', (q) =>
            q.eq('campaignId', currentCampaignId),
          )
          .unique()
      : null;
    const canonical = militia
      ? await readSelectedCanonicalMilitiaState(ctx, militia._id)
      : null;
    const departureRoles: string[] = [];
    if (
      canonical?.snapshot.roster.people.some(
        (person) => person.characterId === character._id,
      )
    )
      departureRoles.push('Militia roster');
    for (const officer of canonical?.snapshot.roster.officers ?? [])
      if (officer.characterId === character._id)
        departureRoles.push(`Officer: ${officer.role}`);
    for (const team of canonical?.snapshot.roster.teams ?? [])
      if (team.managerCharacterId === character._id)
        departureRoles.push(`Team manager: ${team.name}`);
    const currentCampaignHasMilitia = Boolean(militia);
    if (!available || !isOwner)
      return {
        available,
        isOwner,
        currentCampaignId: character.campaignId,
        currentCampaignHasMilitia,
        departureRoles,
        destinations: [],
      };
    const destinations = [];
    for (const { orgId } of user.orgIds) {
      if (await isOrganizationDeleted(ctx, orgId)) continue;
      const campaigns = await ctx.db
        .query('campaign')
        .withIndex('by_organization', (q) => q.eq('organizationId', orgId))
        .take(257);
      if (campaigns.length > 256)
        throw new ConvexError('Too many campaigns to load');
      for (const c of campaigns) {
        if (!c.e2eFixture || c._id === character.campaignId) continue;
        // A campaign being deleted takes no Characters in.
        if (await readCampaignDeletion(ctx, c._id)) continue;
        const militia = await ctx.db
          .query('militia')
          .withIndex('by_campaign', (q) => q.eq('campaignId', c._id))
          .unique();
        destinations.push({
          campaignId: c._id,
          campaignName: c.name,
          organizationId: c.organizationId,
          hasMilitia: Boolean(militia),
        });
      }
    }
    return {
      available,
      isOwner,
      currentCampaignId: character.campaignId,
      currentCampaignHasMilitia,
      departureRoles,
      destinations,
    };
  },
});

export const cancel = legacyCharacterMutation({
  args: { ...scope, operationId: v.string() },
  returns: progressValidator,
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.characterId);
    const move = await findMove(ctx, args.characterId, args.operationId);
    if (!move) throw new ConvexError('Move not found');
    const root = await readCharacterMoveRoot(ctx, move);
    if (root.state === 'completed') return groupProgress(ctx, root);
    for (const member of await readGroupMoves(ctx, root)) {
      await ctx.db.patch('characterMove', member._id, { state: 'cancelled' });
      await ctx.scheduler.runAfter(0, internal.characterMoves.cleanup, {
        characterId: member.characterId,
      });
    }
    return cancelledProgress(await groupProgress(ctx, root), root.cancelReason);
  },
});

// Housekeeping never changes live Character/catalog state. Authorized deletion
// and terminal operations retain this bounded cleanup across maintenance epochs.
export const cleanup = internalMutation({
  args: { characterId: v.id('character') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const character = await ctx.db.get('character', args.characterId);
    const rows = await ctx.db
      .query('characterMoveDefinition')
      .withIndex('by_characterId', (q) => q.eq('characterId', args.characterId))
      .take(32);
    let deleted = 0;
    for (const row of rows) {
      const move = await ctx.db.get('characterMove', row.moveId);
      if (
        !character ||
        !move ||
        move.state === 'completed' ||
        move.state === 'cancelled' ||
        row.generation !== move.generation ||
        move.actor !== character.ownerId ||
        move.sourceCampaignId !== character.campaignId
      ) {
        await ctx.db.delete('characterMoveDefinition', row._id);
        deleted += 1;
      }
    }
    const references = await ctx.db
      .query('characterMoveReference')
      .withIndex('by_characterId', (q) => q.eq('characterId', args.characterId))
      .take(32);
    let deletedReferences = 0;
    for (const row of references) {
      const move = await ctx.db.get('characterMove', row.moveId);
      if (
        !character ||
        !move ||
        move.state === 'completed' ||
        move.state === 'cancelled' ||
        row.generation !== move.generation ||
        move.actor !== character.ownerId ||
        move.sourceCampaignId !== character.campaignId
      ) {
        await ctx.db.delete('characterMoveReference', row._id);
        deletedReferences += 1;
      }
    }
    if (!character) {
      const moves = await ctx.db
        .query('characterMove')
        .withIndex('by_characterId', (q) =>
          q.eq('characterId', args.characterId),
        )
        .take(32);
      for (const move of moves) await ctx.db.delete('characterMove', move._id);
      if (moves.length === 32 || rows.length === 32 || references.length === 32)
        await ctx.scheduler.runAfter(0, internal.characterMoves.cleanup, args);
    } else if (deleted === 32 || deletedReferences === 32)
      await ctx.scheduler.runAfter(0, internal.characterMoves.cleanup, args);
    return null;
  },
});
