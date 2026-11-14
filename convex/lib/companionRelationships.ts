import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import {
  readCharacterSheetDataWithBudget,
  type readCharacterSheetData,
} from './characterSheetData';
import { loadPreparedCharacterSheet } from './preparedCharacterSheet';
import {
  createCharacterMoveReadBudget,
  mapCharacterMoveReadError,
  readCharacterMoveResourceLimits,
} from './characterMoveGroup';
import { updateCanonicalCharacter } from './canonicalCharacters';
import {
  hasAvailableSupportingSource,
  readCompanionGraph,
  isSupportingSourceAvailable,
} from './companionRelationshipGraph';
type CompanionSheet = Awaited<ReturnType<typeof readCharacterSheetData>>;
type CompanionGraph = Awaited<ReturnType<typeof readCompanionGraph>>;

// Sheet edits publish support loss/restoration together with their existing state.
// Reads also derive eligibility, covering ownership/campaign changes and deletion.
export async function reconcileCompanionRelationships(
  ctx: MutationCtx,
  {
    characterId,
    operationId,
    loadedSheets = [],
    previousCountingEntries,
    boundedMove = false,
  }: {
    characterId: Id<'character'>;
    operationId?: string;
    loadedSheets?: CompanionSheet[];
    previousCountingEntries?: Set<string>;
    boundedMove?: boolean;
  },
) {
  const resourceLimits = boundedMove
    ? await readCharacterMoveResourceLimits(ctx)
    : undefined;
  const readBudget = resourceLimits
    ? createCharacterMoveReadBudget(resourceLimits)
    : undefined;
  const graph = await readCompanionGraph(
    ctx,
    characterId,
    loadedSheets,
    readBudget
      ? {
          readBudget,
          readSheet: (endpoint) =>
            readCharacterSheetDataWithBudget(
              ctx,
              endpoint,
              [],
              { resourceLimits, includeAcceptedWarnings: false },
              readBudget,
            ).catch(mapCharacterMoveReadError),
        }
      : {},
  );
  // Relationships this change wrote: the caller's own write, attributed to
  // its operation, and every status this reconciliation publishes.
  const changed = new Set(
    [...graph.relationships.values()]
      .filter((row) => operationId && row.lastOperationId === operationId)
      .map((row) => row._id),
  );
  for (const row of graph.relationships.values()) {
    const state = graph.states.get(row._id);
    const hasChangedAvailability =
      previousCountingEntries &&
      row.associatedCharacterId === characterId &&
      row.sources.some(
        (source) =>
          isSupportingSourceAvailable(source, previousCountingEntries) !==
          isSupportingSourceAvailable(
            source,
            graph.countingEntries.get(characterId),
          ),
      );
    if (
      state &&
      (state.status !== row.status || (operationId && hasChangedAvailability))
    ) {
      await ctx.db.patch('companionRelationship', row._id, {
        status: state.status,
        ...(operationId ? { lastOperationId: operationId } : {}),
      });
      changed.add(row._id);
    }
  }
  // Every Character downstream of the change reads it through a linked input:
  // its companions, theirs and so on, whatever the relationship kind.
  const downstream = listDownstreamCompanions(graph, characterId, changed);
  if (downstream.length > maxCompanionFactRefreshes)
    throw new ConvexError(
      'This Companion group is too large to change at once. Switch off the supporting sources of a Companion you no longer use, then try again.',
    );
  // Their Militia Character Facts refresh with the change. The canonical
  // writer increments revisions only when those facts change.
  for (const companionId of downstream) {
    const character = graph.characters.get(companionId);
    if (!character) continue;
    if (!boundedMove) {
      await updateCanonicalCharacter(ctx, companionId);
      continue;
    }
    const limits = await readCharacterMoveResourceLimits(ctx);
    const sheet = await loadPreparedCharacterSheet(
      ctx,
      character,
      undefined,
      {
        resourceLimits: limits,
        trustedLinkedInputs: true,
        includeAcceptedWarnings: false,
      },
      createCharacterMoveReadBudget(limits),
    ).catch(mapCharacterMoveReadError);
    await updateCanonicalCharacter(ctx, companionId, sheet);
  }
}

/**
 * The most Characters one change refreshes downstream. Each refresh loads the
 * Companion's prepared sheet and its associated Character's sheet within the
 * same transaction, so the traversal is bounded well below the relationship
 * graph's own 1,024-row limit; a larger linked group refuses the change
 * rather than leave stale facts. Representative groups stay far smaller; the
 * bound is revisited once the per-refresh read budget is measured.
 */
export const maxCompanionFactRefreshes = 16;

/**
 * Whether a relationship's companion reads its associated Character after
 * this change: an active link, an interrupted one whose sources still count,
 * or one the change itself wrote. Replaced history and links with no counting
 * source read nothing from it, so they never refresh or count toward the
 * bound.
 */
function doesReadAssociated(
  graph: CompanionGraph,
  row: Doc<'companionRelationship'>,
  changed: Set<Id<'companionRelationship'>>,
) {
  const status = graph.states.get(row._id)?.status ?? row.status;
  return (
    changed.has(row._id) ||
    status === 'active' ||
    (status === 'interrupted' &&
      hasAvailableSupportingSource(
        row.sources,
        graph.countingEntries.get(row.associatedCharacterId),
      ))
  );
}

function listDownstreamCompanions(
  graph: CompanionGraph,
  characterId: Id<'character'>,
  changed: Set<Id<'companionRelationship'>>,
) {
  const pending = [characterId];
  const visited = new Set<Id<'character'>>([characterId]);
  for (const id of pending)
    for (const row of graph.relationships.values())
      if (
        row.associatedCharacterId === id &&
        !visited.has(row.companionCharacterId) &&
        doesReadAssociated(graph, row, changed)
      ) {
        visited.add(row.companionCharacterId);
        pending.push(row.companionCharacterId);
      }
  return pending.slice(1);
}
