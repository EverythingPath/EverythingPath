import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import {
  createReadBudget,
  readCharacterSheetDataWithBudget,
} from './characterSheetData';
import { readCompanionGraph } from './companionRelationshipGraph';
import { releaseFingerprint } from '../../src/lib/catalog/release-schema';

/** Including the requested Character; matching the downstream fact-refresh bound. */
export const maxCharacterMoveGroupSize = 16;
export const maxMoveGroupRelationships = 1024;
export const moveGroupDocumentReserve = 1024;
export const characterMoveCapacityRefusal =
  'This move is too large to complete at once. Reduce the group or remove unused sheet content, then try again.';

/** Only downward active links owned by the root's owner are eligible. */
export async function readCharacterMoveGroup(
  ctx: ReadCtx,
  root: Doc<'character'>,
) {
  const characters = [root];
  const visited = new Set<Id<'character'>>([root._id]);
  const relationships: Doc<'companionRelationship'>[] = [];
  const staying: {
    character: Doc<'character'> | null;
    reason: 'inactive' | 'differentOwner' | 'unavailable';
  }[] = [];
  const resourceLimits = await readCharacterMoveResourceLimits(
    ctx,
    moveGroupDocumentReserve,
  );
  const readBudget = createCharacterMoveReadBudget(resourceLimits);
  const graph = await readCompanionGraph(ctx, root._id, [], {
    readBudget,
    readSheet: (character) =>
      readCharacterSheetDataWithBudget(
        ctx,
        character,
        [],
        { resourceLimits, includeAcceptedWarnings: false },
        readBudget,
      ).catch(mapCharacterMoveReadError),
  });
  for (const character of characters) {
    const rows = [...graph.relationships.values()].filter(
      (row) => row.associatedCharacterId === character._id,
    );
    relationships.push(...rows);
    if (relationships.length > maxMoveGroupRelationships)
      throw new ConvexError('This move has too many Companion Relationships');
    for (const row of rows) {
      const companion = graph.characters.get(row.companionCharacterId) ?? null;
      if (!companion) {
        staying.push({ character: null, reason: 'unavailable' });
        continue;
      }
      if (graph.states.get(row._id)?.status !== 'active') {
        staying.push({ character: companion, reason: 'inactive' });
        continue;
      }
      if (companion.ownerId !== root.ownerId) {
        staying.push({ character: companion, reason: 'differentOwner' });
        continue;
      }
      if (visited.has(companion._id)) continue;
      visited.add(companion._id);
      characters.push(companion);
    }
  }
  return {
    characters,
    staying,
    associatedCharacters: [...graph.relationships.values()]
      .filter(
        (row) =>
          row.companionCharacterId === root._id &&
          graph.states.get(row._id)?.status === 'active',
      )
      .map((row) => graph.characters.get(row.associatedCharacterId) ?? null),
    refusal:
      characters.length > maxCharacterMoveGroupSize
        ? {
            reason: 'groupTooLarge' as const,
            groupSize: characters.length,
            maxGroupSize: maxCharacterMoveGroupSize,
          }
        : undefined,
    fingerprint: await releaseFingerprint({
      characters: characters.map((character) => ({
        characterId: character._id,
        ownerId: character.ownerId,
        ownerOperationId: character.ownerLastOperationId,
        campaignId: character.campaignId,
      })),
      // Record eligibility, not unrelated source labels or operation IDs.
      relationships: relationships.map((row) => ({
        id: row._id,
        associated: row.associatedCharacterId,
        companion: row.companionCharacterId,
        status: graph.states.get(row._id)?.status,
      })),
    }),
  };
}

/**
 * Unique references and physical reads are different limits: the same
 * definition may be read repeatedly. Ordinary resumable work keeps 64 reads
 * for later bookkeeping; group discovery and final publication keep 1,024.
 */
export async function readCharacterMoveResourceLimits(
  ctx: ReadCtx,
  documentReserve = 64,
) {
  const metrics = await ctx.meta.getTransactionMetrics();
  const resourceLimits = {
    maximumTotalBytesRead: Math.min(
      8 * 1024 * 1024,
      metrics.bytesRead.remaining - 2 * 1024 * 1024,
    ),
    maximumReferences: 8192,
    maximumDocumentsRead: metrics.documentsRead.remaining - documentReserve,
  };
  if (
    resourceLimits.maximumTotalBytesRead <= 0 ||
    resourceLimits.maximumDocumentsRead <= 0
  )
    throw new ConvexError(characterMoveCapacityRefusal);
  return resourceLimits;
}
export function createCharacterMoveReadBudget(
  resourceLimits: Awaited<ReturnType<typeof readCharacterMoveResourceLimits>>,
) {
  const budget = createReadBudget(resourceLimits);
  let documents = 0;
  return {
    accountRead(value: unknown) {
      accountMoveRead(() => budget.accountRead(value));
      if (++documents > resourceLimits.maximumDocumentsRead)
        throw new ConvexError(characterMoveCapacityRefusal);
    },
    accountReference: (id: string) =>
      accountMoveRead(() => budget.accountReference(id)),
  };
}

/** Translate known shared sheet-budget refusals without hiding unexpected errors. */
function accountMoveRead(account: () => void) {
  try {
    account();
  } catch (error) {
    mapCharacterMoveReadError(error);
  }
}

export function mapCharacterMoveReadError(error: unknown): never {
  if (
    error instanceof ConvexError &&
    (error.data === 'Recorded sheet exceeds the backfill read resource limit' ||
      error.data ===
        'Recorded sheet exceeds the backfill reference resource limit')
  )
    throw new ConvexError(characterMoveCapacityRefusal);
  throw error;
}
