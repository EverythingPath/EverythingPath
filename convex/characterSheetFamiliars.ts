import { ConvexError, v } from 'convex/values';
import {
  familiarBaseCreatureKeySchema,
  representativeFamiliars,
} from '../src/lib/catalog/representative-familiars';
import { abilityKeys, abilityTargets } from '../src/lib/character-sheet';
import { familiarBaseCreatureKeyValidator } from './schema';
import { legacyCharacterMutation } from './lib/campaignRuntime';
import {
  loadCharacterSheet,
  pruneWarningAcceptancesAndRecordChange,
} from './lib/characterSheet';

export const selectBaseCreature = legacyCharacterMutation({
  args: {
    characterId: v.id('character'),
    relationshipId: v.id('companionRelationship'),
    baseCreatureKey: v.union(familiarBaseCreatureKeyValidator, v.null()),
    operationId: v.string(),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadCharacterSheet(ctx, args, { isWritable: true });
    if (!sheet) throw new ConvexError('Character Sheet not found');
    const relationship = await ctx.db.get(
      'companionRelationship',
      args.relationshipId,
    );
    if (
      relationship?.kind !== 'familiar' ||
      relationship.companionCharacterId !== args.characterId
    )
      throw new ConvexError(
        'Familiar relationship does not belong to this Character',
      );
    const parsed = familiarBaseCreatureKeySchema
      .nullable()
      .safeParse(args.baseCreatureKey);
    if (!parsed.success)
      throw new ConvexError('Choose a representative familiar creature');
    if (!args.operationId.trim())
      throw new ConvexError('Provide an operation identifier');
    const key = parsed.data ?? undefined;
    if (sheet.character.familiarBaseCreatureKey === key) return null;
    await ctx.db.patch('character', args.characterId, {
      familiarBaseCreatureKey: key,
    });
    sheet.character = { ...sheet.character, familiarBaseCreatureKey: key };
    const baseScoresEntry = sheet.baseScoresEntry;
    const hasRecordedScores =
      !sheet.character.familiarBaseScoresPending &&
      baseScoresEntry.modifiers.some((modifier) =>
        abilityKeys.some(
          (ability) => abilityTargets[ability] === modifier.target,
        ),
      );
    if (key && !hasRecordedScores) {
      const scores = representativeFamiliars[key].abilityScores;

      const modifiers = baseScoresEntry.modifiers.map((modifier) => {
        const ability = abilityKeys.find(
          (key) => abilityTargets[key] === modifier.target,
        );
        return ability ? { ...modifier, value: scores[ability] } : modifier;
      });
      await ctx.db.patch('character', args.characterId, {
        familiarBaseScoresPending: undefined,
      });
      sheet.character = {
        ...sheet.character,
        familiarBaseScoresPending: undefined,
      };
      await ctx.db.patch('catalogEntry', baseScoresEntry._id, { modifiers });
      sheet.catalogEntries = sheet.catalogEntries.map((row) =>
        row._id === baseScoresEntry._id
          ? { ...baseScoresEntry, modifiers }
          : row,
      );
    }
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
