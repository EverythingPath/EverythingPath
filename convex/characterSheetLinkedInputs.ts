import { v } from 'convex/values';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import { query } from './_generated/server';
import { legacyCharacterMutation } from './lib/campaignRuntime';
import { companionLinkedInputValidator } from './schema';
import {
  companionLinkedInputResolutionSchema,
  linkedInputProjectionSchema,
  linkedInputUnavailableReasonSchema,
} from '../src/lib/character-sheet-linked-inputs';
import {
  readLinkedInput,
  listLinkedInputs,
  writeLinkedInput,
} from './lib/characterSheetLinkedInputs';

const scope = {
  characterId: v.id('character'),
  relationshipId: v.id('companionRelationship'),
  input: companionLinkedInputValidator,
};
const writeScope = { ...scope, operationId: v.string() };
const resolutionValidator = zodOutputToConvex(
  companionLinkedInputResolutionSchema,
).extend({
  sources: v.array(v.object({ key: v.string(), label: v.string() })),
  unavailableReason: v.union(
    zodOutputToConvex(linkedInputUnavailableReasonSchema),
    v.null(),
  ),
  interpretation: v.union(v.object({ sourceKey: v.string() }), v.null()),
  revision: v.number(),
  lastOperationId: v.union(v.string(), v.null()),
  updatedBy: v.union(v.string(), v.null()),
});
const projectionValidator = v.optional(
  zodOutputToConvex(linkedInputProjectionSchema),
);
export const list = query({
  args: {
    characterId: scope.characterId,
    relationshipId: scope.relationshipId,
    projection: projectionValidator,
  },
  returns: v.array(resolutionValidator),
  async handler(ctx, args) {
    return await listLinkedInputs(ctx, args);
  },
});

export const read = query({
  args: {
    ...scope,
    projection: projectionValidator,
  },
  returns: resolutionValidator,
  async handler(ctx, args) {
    return await readLinkedInput(ctx, args);
  },
});

export const saveFallback = legacyCharacterMutation({
  args: { ...writeScope, value: v.number() },
  returns: v.null(),
  async handler(ctx, args) {
    return await writeLinkedInput(ctx, args, {
      kind: 'saveFallback',
      value: args.value,
    });
  },
});

export const clearFallback = legacyCharacterMutation({
  args: writeScope,
  returns: v.null(),
  async handler(ctx, args) {
    return await writeLinkedInput(ctx, args, { kind: 'clearFallback' });
  },
});

export const saveInterpretation = legacyCharacterMutation({
  args: { ...writeScope, sourceKey: v.string() },
  returns: v.null(),
  async handler(ctx, args) {
    return await writeLinkedInput(ctx, args, {
      kind: 'saveInterpretation',
      sourceKey: args.sourceKey,
    });
  },
});

export const clearInterpretation = legacyCharacterMutation({
  args: writeScope,
  returns: v.null(),
  async handler(ctx, args) {
    return await writeLinkedInput(ctx, args, { kind: 'clearInterpretation' });
  },
});
