import { ConvexError, v, type Infer } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, query, type MutationCtx } from './_generated/server';
import { advanceDepartureReturn } from './characterMoves';
import {
  driveLifecycle,
  readLifecycleReturnCandidate,
  readLifecycleReturnRoot,
  type LifecycleWork,
  type StepTransactionLimits,
} from './lib/lifecycleDriver';
import { readDepartureFailure } from './lib/organizationDeparture';
import { gatedInternalMutation } from './lib/writeGate';
import type { ReadCtx } from './types';
import { getUserByTokenIdentifier } from './user';

const driverArgs = {
  departureId: v.id('organizationDeparture'),
  round: v.number(),
};
const stepResultValidator = v.object({
  state: v.union(v.literal('returning'), v.literal('done')),
});
type StepResult = Infer<typeof stepResultValidator>;
type DriveArgs = {
  departureId: Id<'organizationDeparture'>;
  round: number;
  characterId?: Id<'character'>;
};

/**
 * Whether a departure can return the Character: a prepared sheet in a
 * prepared campaign, because only those move through the #703 machinery.
 * Production Characters, and flat ones in a prepared campaign, stay in the
 * campaign with their owner under legacy authority until activation (#413).
 * Account deletion (#708) deliberately uses a wider test.
 */
function isReturnableSheet(
  campaign: Doc<'campaign'>,
  character: Doc<'character'>,
) {
  return Boolean(campaign.e2eFixture && character.sheetMode);
}

/**
 * The next Character the main pass should return, skipping those set aside.
 * With none left, it finishes the departure: every Character is returned or
 * set aside, or the account or membership no longer calls for a return.
 */
async function nextReturnOrFinish(
  ctx: MutationCtx,
  departure: Doc<'organizationDeparture'>,
) {
  const user = await ctx.db.get('user', departure.userId);
  // A deleted account follows account-deletion policy, not this one.
  if (!user) return finishDeparture(ctx, departure, 'accountDeleted');
  if (user.orgIds.some((org) => org.orgId === departure.organizationId))
    return finishDeparture(ctx, departure, 'membershipRestored');
  const campaigns = await ctx.db
    .query('campaign')
    .withIndex('by_organization', (q) =>
      q.eq('organizationId', departure.organizationId),
    )
    .take(257);
  if (campaigns.length > 256)
    throw new ConvexError('Too many campaigns to return Characters from');
  let legacyRetained = 0;
  const roots = new Map<Id<'character'>, Doc<'character'>>();
  for (const campaign of campaigns) {
    const owned = await ctx.db
      .query('character')
      .withIndex('by_ownerId_and_campaignId', (q) =>
        q.eq('ownerId', user.tokenIdentifier).eq('campaignId', campaign._id),
      )
      .take(4097);
    if (owned.length > 4096)
      throw new ConvexError('Too many Characters to return');
    for (const character of owned) {
      if (!isReturnableSheet(campaign, character)) {
        legacyRetained += 1;
        continue;
      }
      const root = await readLifecycleReturnCandidate(ctx, character, roots);
      const failure = await readDepartureFailure(ctx, departure._id, root._id);
      if (!failure?.setAside) return root._id;
    }
  }
  return finishDeparture(ctx, departure, 'returned', legacyRetained);
}

async function finishDeparture(
  ctx: MutationCtx,
  departure: Doc<'organizationDeparture'>,
  outcome: Doc<'organizationDeparture'>['outcome'],
  legacyRetained?: number,
) {
  await ctx.db.patch('organizationDeparture', departure._id, {
    state: 'completed',
    outcome,
    ...(legacyRetained ? { legacyRetained } : {}),
  });
  return null;
}

/** One step of the departure's return, as the shared driver runs it. */
async function runReturnStep(
  ctx: MutationCtx,
  departure: Doc<'organizationDeparture'>,
  characterId: Id<'character'>,
  writeEpoch: number,
  transactionLimits: StepTransactionLimits,
) {
  const result: StepResult = await ctx.runMutation(
    internal.organizationDepartures.step,
    {
      departureId: departure._id,
      round: departure.round,
      characterId,
      writeEpoch,
    },
    { transactionLimits },
  );
  return result.state === 'done' ? ('done' as const) : ('pending' as const);
}

/** A departure's trusted returns, in the shared lifecycle driver's terms. */
function departureWork(
  ctx: MutationCtx,
  departure: Doc<'organizationDeparture'>,
): LifecycleWork<DriveArgs, Doc<'organizationDepartureCharacter'>> {
  return {
    isPassCurrent: departure.state === 'returning',
    nextCharacterOrComplete: () => nextReturnOrFinish(ctx, departure),
    runStep: (characterId, writeEpoch, transactionLimits) =>
      runReturnStep(ctx, departure, characterId, writeEpoch, transactionLimits),
    readFailure: (characterId) =>
      readDepartureFailure(ctx, departure._id, characterId),
    async writeFailure(characterId, failure, existing) {
      const record = {
        departureId: departure._id,
        userId: departure.userId,
        organizationId: departure.organizationId,
        characterId,
        ...failure,
      };
      if (existing)
        await ctx.db.replace(
          'organizationDepartureCharacter',
          existing._id,
          record,
        );
      else await ctx.db.insert('organizationDepartureCharacter', record);
    },
    clearFailure: (existing) =>
      ctx.db.delete('organizationDepartureCharacter', existing._id),
    schedule: (args, delayMs = 0) =>
      ctx.scheduler.runAfter(
        delayMs,
        internal.organizationDepartures.drive,
        args,
      ),
  };
}

/**
 * Drives one departure's trusted returns, one bounded step per transaction
 * (#706). The main pass returns the owner's Characters one at a time; with a
 * `characterId` it is the slower retry of one Character set aside after
 * repeated failed steps. Each step runs as a nested
 * transaction under the legacy Character Write Gate with the current epoch:
 * it rechecks authoritative account, membership and ownership state, so it is
 * never a stale command. A failed step rolls back alone and is recorded on
 * its Character, so completion needs neither the departed owner nor a
 * repeated provider event.
 */
export const drive = internalMutation({
  args: { ...driverArgs, characterId: v.optional(v.id('character')) },
  returns: v.null(),
  async handler(ctx, args) {
    const departure = await ctx.db.get(
      'organizationDeparture',
      args.departureId,
    );
    // A run from an earlier round has nothing left to do.
    if (departure?.round !== args.round) return null;
    await driveLifecycle(ctx, args, departureWork(ctx, departure));
    return null;
  },
});

/** The Character's return authority, or null once it needs no return. */
async function readReturnTarget(
  ctx: ReadCtx,
  departure: Doc<'organizationDeparture'>,
  characterId: Id<'character'>,
) {
  const [user, character] = await Promise.all([
    ctx.db.get('user', departure.userId),
    ctx.db.get('character', characterId),
  ]);
  if (
    !user ||
    user.orgIds.some((org) => org.orgId === departure.organizationId) ||
    !character?.campaignId ||
    character.ownerId !== user.tokenIdentifier
  )
    return null;
  const campaign = await ctx.db.get('campaign', character.campaignId);
  if (
    campaign?.organizationId !== departure.organizationId ||
    !isReturnableSheet(campaign, character)
  )
    return null;
  return { character, campaign, user };
}

/**
 * One bounded unit of a Character's return: a discovery page, staging batch
 * or publication. It rechecks the account, membership and owner first, and
 * reports `done` once the Character needs nothing more.
 */
export const step = gatedInternalMutation({
  args: { ...driverArgs, characterId: v.id('character') },
  returns: stepResultValidator,
  async handler(ctx, args): Promise<StepResult> {
    const departure = await ctx.db.get(
      'organizationDeparture',
      args.departureId,
    );
    if (departure?.round !== args.round) return { state: 'done' };
    const candidate = await readReturnTarget(ctx, departure, args.characterId);
    if (!candidate) return { state: 'done' };
    const root = await readLifecycleReturnRoot(ctx, candidate.character);
    const target = await readReturnTarget(ctx, departure, root._id);
    if (!target) return { state: 'done' };
    const progress = await advanceDepartureReturn(ctx, target, {
      id: departure._id,
      round: departure.round,
    });
    return { state: progress.state === 'completed' ? 'done' : 'returning' };
  },
});

/**
 * The signed-in user's organizations whose Characters are still returning to
 * them, with how many were set aside because they couldn't be returned yet.
 * Names and campaigns stay hidden: membership, not ownership, grants campaign
 * access.
 */
export const listReturning = query({
  args: {},
  returns: v.array(
    v.object({ organizationId: v.string(), setAside: v.number() }),
  ),
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    const user =
      identity &&
      (await getUserByTokenIdentifier(ctx, identity.tokenIdentifier));
    if (!user) return [];
    const [departures, setAside] = await Promise.all([
      ctx.db
        .query('organizationDeparture')
        .withIndex('by_userId_and_state', (q) =>
          q.eq('userId', user._id).eq('state', 'returning'),
        )
        .take(256),
      ctx.db
        .query('organizationDepartureCharacter')
        .withIndex('by_userId_and_setAside', (q) =>
          q.eq('userId', user._id).eq('setAside', true),
        )
        .take(1024),
    ]);
    const organizations = new Map(
      departures.map(({ organizationId }) => [organizationId, 0]),
    );
    for (const { organizationId } of setAside)
      organizations.set(
        organizationId,
        (organizations.get(organizationId) ?? 0) + 1,
      );
    return [...organizations].map(([organizationId, count]) => ({
      organizationId,
      setAside: count,
    }));
  },
});
