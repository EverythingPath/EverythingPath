import { readSelectedCanonicalMilitiaState } from './lib/selectedCanonicalMilitiaState';
import { ConvexError, v } from 'convex/values';
import { z } from 'zod';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import { query } from './_generated/server';
import { campaignMutation } from './lib/campaignRuntime';
import { requireScope, readOpenDraft } from './lib/canonicalDraftStorage';
import {
  submittedSnapshotValidator,
  withCurrentRecordKinds,
  withSubmittedKindsNormalized,
} from './lib/canonicalCharacters';
import { createWeeklyDraft } from '../src/lib/weekly-draft';
import { weekStartFactsSchema } from '../src/lib/weekly-draft-contract';
import { draftReferenceRequirements } from '../src/lib/weekly-draft-references';
import {
  militiaSnapshotSchema,
  canonicalWeekStateSchema,
  weeklySourceKey,
} from '../src/lib/canonical-weekly-source';

const scope = { campaignId: v.id('campaign'), militiaId: v.id('militia') };
export const read = query({
  args: scope,
  returns: v.object({
    revision: v.number(),
    state: zodOutputToConvex(canonicalWeekStateSchema),
  }),
  handler: async (ctx, args) => {
    await requireScope(ctx, args);
    const source = await readSelectedCanonicalMilitiaState(ctx, args.militiaId);
    const draft = await readOpenDraft(ctx, args);
    if (!source || !draft) throw new ConvexError('Militia week unavailable');
    const { persistentPhaseEligible: _eligibility, ...context } = draft.context;
    return {
      revision: source.revision,
      state: canonicalWeekStateSchema.parse({
        week: draft.week,
        context,
        militiaSnapshot: source.snapshot,
      }),
    };
  },
});

export const save = campaignMutation({
  args: {
    ...scope,
    expectedRevision: v.number(),
    snapshot: submittedSnapshotValidator,
    reason: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireScope(ctx, args);
    const reason = z
      .string()
      .trim()
      .min(1, 'Explain the correction')
      .max(2000)
      .parse(args.reason);
    const source = await readSelectedCanonicalMilitiaState(ctx, args.militiaId);
    if (
      source?.campaignId !== args.campaignId ||
      source.revision !== args.expectedRevision
    )
      throw new ConvexError(
        'Militia changed. Review the latest ledger before saving.',
      );
    const snapshot = militiaSnapshotSchema.parse(
      withSubmittedKindsNormalized(args.snapshot),
    );
    const draft = await readOpenDraft(ctx, args);
    if (!draft) throw new ConvexError('Militia week unavailable');
    const { persistentPhaseEligible: _eligibility, ...context } = draft.context;
    const carried = createWeeklyDraft({
      draftId: draft.draftId,
      week: draft.week,
      context: weekStartFactsSchema.parse(context),
      slotIds: [],
    });
    if (draftReferenceRequirements(carried, snapshot, snapshot).length)
      throw new ConvexError(
        'Keep entities referenced by carried events, orders and queued effects.',
      );
    // Character records are edited through the character ledger. A stale copy
    // from this form must not replace a more recent character edit.
    if (
      weeklySourceKey(snapshot.characters) !==
      weeklySourceKey(source.snapshot.characters)
    )
      throw new ConvexError(
        'Keep the current character records; edit them in the character ledger.',
      );
    const storedRevision = source.storedRevision + 1;
    const effectiveRevision = source.revision + 1;
    await ctx.db.patch('canonicalMilitiaState', source._id, {
      snapshot: await withCurrentRecordKinds(ctx, args.campaignId, snapshot),
      revision: storedRevision,
    });
    await ctx.db.insert('canonicalSourceCorrection', {
      campaignId: args.campaignId,
      militiaId: args.militiaId,
      expectedRevision: args.expectedRevision,
      revision: effectiveRevision,
      reason,
      // Safe cast: requireScope at the top of this handler throws unless the
      // caller's identity is an organization member, so it is present here.
      actor: (await ctx.auth.getUserIdentity())!.tokenIdentifier,
      createdAt: Date.now(),
    });
    return effectiveRevision;
  },
});
