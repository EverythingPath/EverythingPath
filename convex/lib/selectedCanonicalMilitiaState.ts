import { isCatalogFixtureCampaign } from './catalogFixturePolicy';
import type { Doc, Id } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import {
  readSelectedCharacterFacts,
  readSelectedCatalogBoundary,
  readSelectedCampaignFactsGeneration,
} from './catalogReleaseBoundary';

/** Only Character facts are versioned; all other militia fields remain live. */
export async function selectedCanonicalMilitiaState(
  ctx: ReadCtx,
  state: Doc<'canonicalMilitiaState'>,
) {
  const campaign = await ctx.db.get('campaign', state.campaignId);
  if (!isCatalogFixtureCampaign(campaign))
    return { ...state, storedRevision: state.revision };
  const boundary = await readSelectedCatalogBoundary(ctx);
  const generation = await readSelectedCampaignFactsGeneration(
    ctx,
    state.campaignId,
    boundary,
  );
  const characters = await Promise.all(
    state.snapshot.characters.map(async (facts) => {
      const id = ctx.db.normalizeId('character', facts.characterId);
      const character = id && (await ctx.db.get('character', id));
      if (!character?.sheetMode || character.campaignId !== state.campaignId)
        return facts;
      const selected = await readSelectedCharacterFacts(
        ctx,
        character._id,
        boundary,
      );
      if (!selected) return facts;
      return { ...selected.facts, isActive: character.isActive };
    }),
  );
  return {
    ...state,
    storedRevision: state.revision,
    revision: state.revision + generation,
    snapshot: { ...state.snapshot, characters },
  };
}

export async function readSelectedCanonicalMilitiaState(
  ctx: ReadCtx,
  militiaId: Id<'militia'>,
) {
  const state = await ctx.db
    .query('canonicalMilitiaState')
    .withIndex('by_militiaId', (q) => q.eq('militiaId', militiaId))
    .unique();
  return state ? selectedCanonicalMilitiaState(ctx, state) : null;
}
