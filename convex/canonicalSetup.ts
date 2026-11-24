import { z } from 'zod';
import { campaignMutation as mutation } from './lib/campaignRuntime';
import { ConvexError, v } from 'convex/values';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import { query, type MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import type { ReadCtx } from './types';
import { loadPreparedCharacterSheets } from './lib/preparedCharacterSheet';
import { calculateMilitiaCharacterFacts } from './lib/militiaCharacterFacts';
import {
  openDraft,
  requireOrganizationMembership,
} from './lib/canonicalDraftStorage';
import { draftKeySchema } from './lib/canonicalStorageValidators';
import {
  submittedSetupValidator,
  withCurrentRecordKinds,
  withSubmittedKindsNormalized,
} from './lib/canonicalCharacters';
import {
  militiaSetupSchema,
  prepareMilitiaSetup,
} from '../src/lib/canonical-setup';
import {
  militiaSnapshotSchema,
  weeklySourceKey,
} from '../src/lib/canonical-weekly-source';

async function requireSetupAccess(ctx: ReadCtx, campaignId: Id<'campaign'>) {
  const campaign = await ctx.db.get('campaign', campaignId);
  if (!campaign)
    throw new ConvexError('Campaign access required for militia setup');
  await requireOrganizationMembership(
    ctx,
    campaign.organizationId,
    'Campaign access required for militia setup',
  );
  return campaign;
}
const setupCharacterSchema =
  militiaSnapshotSchema.shape.characters.element.extend({ name: z.string() });
export const options = query({
  args: { campaignId: v.id('campaign') },
  returns: v.union(
    v.null(),
    v.object({
      name: v.string(),
      characters: v.array(zodOutputToConvex(setupCharacterSchema)),
      started: v.boolean(),
    }),
  ),
  handler: async (ctx, { campaignId }) => {
    let campaign;
    try {
      campaign = await requireSetupAccess(ctx, campaignId);
    } catch {
      return null;
    }
    const characters = await ctx.db
      .query('character')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
      .take(257);
    if (characters.length > 256)
      throw new ConvexError('This campaign exceeds the setup character limit');
    const sheets = await loadPreparedCharacterSheets(
      ctx,
      characters,
      campaign,
      { trustedLinkedInputs: true },
    );
    const draft = await ctx.db
      .query('canonicalWeeklyDraft')
      .withIndex('by_campaignId_and_status', (q) =>
        q.eq('campaignId', campaignId),
      )
      .first();
    return {
      name: campaign.name,
      started: Boolean(draft),
      characters: await Promise.all(
        characters.map(async (character, index) => ({
          ...(await calculateMilitiaCharacterFacts(
            ctx,
            character,
            sheets[index] ?? null,
            { trustedLinkedInputs: true },
          )),
          name: character.name,
        })),
      ),
    };
  },
});
export const initialize = mutation({
  args: {
    campaignId: v.id('campaign'),
    initializationId: v.string(),
    setup: submittedSetupValidator,
  },
  returns: zodOutputToConvex(draftKeySchema),
  handler: async (ctx, args) => {
    const campaign = await requireSetupAccess(ctx, args.campaignId);
    const initializationId = z
      .string()
      .trim()
      .min(1)
      .max(200)
      .parse(args.initializationId);
    const setup = militiaSetupSchema.parse({
      ...args.setup,
      state: {
        ...args.setup.state,
        militiaSnapshot: withSubmittedKindsNormalized(
          args.setup.state.militiaSnapshot,
        ),
      },
    });
    const sourceToken = weeklySourceKey(setup);
    if (new TextEncoder().encode(sourceToken).length > 750_000)
      throw new ConvexError('Setup is too large to save in one transaction');
    const militia = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', args.campaignId))
      .unique();
    const receipt =
      militia &&
      (await ctx.db
        .query('canonicalCampaignInitialization')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
        .unique());
    if (receipt) {
      if (
        receipt.campaignId !== args.campaignId ||
        receipt.initializationId !== initializationId ||
        receipt.sourceToken !== sourceToken
      )
        throw new ConvexError(
          'Militia setup is already complete. Open the current week.',
        );
      return {
        campaignId: args.campaignId,
        militiaId: receipt.militiaId,
        draftId: receipt.draftId,
      };
    }
    await requireReviewedCharacters(
      ctx,
      args.campaignId,
      setup.state.militiaSnapshot.characters,
    );
    const prior =
      militia &&
      (await ctx.db
        .query('canonicalMilitiaState')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
        .unique());
    if (prior)
      throw new ConvexError(
        'Militia setup is already complete. Open the current week.',
      );
    const draftId = `setup:${initializationId}`;
    const plan = prepareMilitiaSetup(setup, draftId);
    const militiaId =
      militia?._id ??
      (await ctx.db.insert('militia', {
        campaignId: args.campaignId,
        name: campaign.name,
      }));
    const key = { campaignId: args.campaignId, militiaId, draftId };
    await openDraft(ctx, {
      campaignId: args.campaignId,
      militiaId,
      draft: plan.draft,
    });
    // The receipt keeps the submitted source for same-source retries; the
    // live roster mirrors each person's current record kind.
    await ctx.db.insert('canonicalMilitiaState', {
      campaignId: args.campaignId,
      militiaId,
      revision: 0,
      snapshot: await withCurrentRecordKinds(
        ctx,
        args.campaignId,
        plan.snapshot,
      ),
    });
    await ctx.db.insert('canonicalCampaignInitialization', {
      campaignId: args.campaignId,
      militiaId,
      draftId,
      initializationId,
      sourceToken,
      setupNotes: setup.notes,
    });
    return key;
  },
});

async function requireReviewedCharacters(
  ctx: MutationCtx,
  campaignId: Id<'campaign'>,
  characters: z.infer<typeof militiaSnapshotSchema>['characters'],
) {
  for (const person of characters) {
    const id = ctx.db.normalizeId('character', person.characterId);
    const character = id && (await ctx.db.get('character', id));
    if (character?.campaignId !== campaignId)
      throw new ConvexError('Choose characters belonging to this campaign');
    const facts = await calculateMilitiaCharacterFacts(
      ctx,
      character,
      undefined,
      { trustedLinkedInputs: true },
    );
    if (weeklySourceKey(person) !== weeklySourceKey(facts))
      throw new ConvexError(
        'Character facts changed. Reload setup to review the ledger.',
      );
  }
}
