import { ConvexError } from 'convex/values';
import type { ReadCtx } from '../types';
import type { MutationCtx } from '../_generated/server';
import {
  loadCharacterSheet,
  pruneWarningAcceptancesAndRecordChange,
} from './characterSheet';
import { requireCharacterAccess } from './characterAccess';
import {
  isLinkedInputInterpretationCandidate,
  type LinkedInputProjection,
} from '../../src/lib/character-sheet-linked-inputs';
import {
  loadSavedLinkedInputs,
  loadLinkedInputContext,
  resolveLinkedInput,
  requireCuratedLinkedInput,
  listLinkedInputsForSheet,
  type RelationshipScope,
  type InputScope,
  type LinkedInputRead,
  type LinkedEndpointReader,
} from './characterSheetLinkedInputReader';
export type { LinkedInputRead };

function createEndpointReader(ctx: ReadCtx): LinkedEndpointReader {
  return async (characterId) => {
    try {
      await requireCharacterAccess(ctx, { characterId });
    } catch (error) {
      if (!(error instanceof ConvexError)) throw error;
      return { accessible: false, sheet: null };
    }
    const sheet = await loadCharacterSheet(ctx, { characterId });
    return {
      accessible: true,
      sheet,
    };
  };
}
export async function loadLinkedInputScope(
  ctx: ReadCtx,
  args: RelationshipScope,
  { isWritable = false }: { isWritable?: boolean } = {},
) {
  const sheet = await loadCharacterSheet(ctx, args, { isWritable });
  if (!sheet) throw new ConvexError('Character Sheet not found');
  const relationship = await ctx.db.get(
    'companionRelationship',
    args.relationshipId,
  );
  if (
    !relationship ||
    (relationship.associatedCharacterId !== args.characterId &&
      relationship.companionCharacterId !== args.characterId)
  )
    throw new ConvexError('Companion Relationship not found');
  const saved = await loadSavedLinkedInputs(ctx, args);
  return { sheet, relationship, saved };
}
export async function readLinkedInput(
  ctx: ReadCtx,
  args: InputScope & { projection?: LinkedInputProjection },
): Promise<LinkedInputRead> {
  const scope = await loadLinkedInputScope(ctx, args);
  const context = await loadLinkedInputContext(ctx, {
    scope,
    projection: args.projection ?? 'current',
    readEndpoint: createEndpointReader(ctx),
  });
  return resolveLinkedInput(context, args.input, new Map());
}
export async function listLinkedInputs(
  ctx: ReadCtx,
  args: RelationshipScope & { projection?: LinkedInputProjection },
): Promise<LinkedInputRead[]> {
  const scope = await loadLinkedInputScope(ctx, args);
  return await listLinkedInputsForSheet(ctx, {
    sheet: scope.sheet,
    saved: scope.saved,
    relationship: scope.relationship,
    projection: args.projection ?? 'current',
    readEndpoint: createEndpointReader(ctx),
  });
}
export async function writeLinkedInput(
  ctx: MutationCtx,
  args: InputScope & { operationId: string },
  change:
    | { kind: 'saveFallback'; value: number }
    | { kind: 'clearFallback' }
    | { kind: 'saveInterpretation'; sourceKey: string }
    | { kind: 'clearInterpretation' },
) {
  const scope = await loadLinkedInputScope(ctx, args, {
    isWritable: true,
  });
  const context = await loadLinkedInputContext(ctx, {
    scope,
    projection: 'current',
    readEndpoint: createEndpointReader(ctx),
  });
  const { sheet, relationship, saved } = scope;
  const inputKey = requireCuratedLinkedInput(
    { ...relationship, sources: context.sources },
    args.input,
  );
  const recorded = saved.find((row) => row.inputKey === inputKey);
  if (!args.operationId.trim())
    throw new ConvexError('Provide an operation identifier');
  if (change.kind === 'saveFallback' && !Number.isSafeInteger(change.value))
    throw new ConvexError('Enter a finite whole fallback value');
  if (change.kind === 'saveInterpretation') {
    const current = resolveLinkedInput(context, args.input, new Map());
    if (
      !current.candidates.some(
        (candidate) =>
          candidate.sourceKey === change.sourceKey &&
          isLinkedInputInterpretationCandidate(candidate),
      )
    )
      throw new ConvexError(
        'Choose an available supporting source from this relationship',
      );
  }
  const fallback =
    change.kind === 'saveFallback'
      ? change.value
      : change.kind === 'clearFallback'
        ? undefined
        : recorded?.fallback;
  const interpretation =
    change.kind === 'saveInterpretation'
      ? { sourceKey: change.sourceKey }
      : change.kind === 'clearInterpretation'
        ? undefined
        : recorded?.interpretation;
  if (recorded) {
    if (fallback === undefined && interpretation === undefined)
      await ctx.db.delete('characterLinkedInput', recorded._id);
    else
      await ctx.db.patch('characterLinkedInput', recorded._id, {
        fallback,
        interpretation,
      });
  } else if (fallback !== undefined || interpretation !== undefined)
    await ctx.db.insert('characterLinkedInput', {
      characterId: args.characterId,
      relationshipId: args.relationshipId,
      inputKey,
      input: args.input,
      ...(fallback === undefined ? {} : { fallback }),
      ...(interpretation === undefined ? {} : { interpretation }),
    });
  await pruneWarningAcceptancesAndRecordChange(ctx, {
    sheet,
    operationId: args.operationId,
  });
  return null;
}
