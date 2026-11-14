import { ConvexError, v, type Infer } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { readAccountDeletion } from './lib/accountDeletion';
import {
  readOrganizationDeparture,
  startOrganizationDeparture,
} from './lib/organizationDeparture';
import { generalInternalMutation, readWriteGate } from './lib/writeGate';
import { lifecycleCatchUpValidator } from './schema';
import { getUserByTokenIdentifier } from './user';

// #413 F7b: the lifecycle catch-up sweep. Departures and account deletions
// that completed under legacy authority left their campaign Characters in
// place (`legacyRetained`), and events from before the integration branch
// was deployed were never recorded. After activation the sweep finds those
// Characters by state, once per reopened Write Epoch.

const MiB = 1 << 20;

/**
 * Characters read per transaction. One, because each Character, its campaign
 * and its owner's user row can be as large as a document may be (1 MiB): a
 * page reads at most six such documents (the control row, its run, the
 * Character, the campaign, the user, a departure or a deletion) before it
 * deletes any failure rows.
 */
const pageSize = 1;

/**
 * A new departure round deletes the last round's failure rows, which can be
 * as large as a document may be, so a page deletes them while every budget
 * keeps this reserve and at most 1,024 per page, as a round's start deletes
 * them. The reserve covers what follows: the next row's delete, the
 * departure's read and replacement, the run's replacement (at most 4 MiB
 * read, 3 MiB written) and slack, so a page reads at most about 14 MiB of
 * Convex's 16 MiB. With at most 7 MiB read when the first row is checked
 * (the six documents and that row), every page deletes at least one; the
 * rest wait for the next page.
 */
const failureDeleteReserve = { bytes: 6 * MiB, documents: 64 };
const failureDeletesPerPage = 1024;

type CatchUp = Infer<typeof lifecycleCatchUpValidator>;
type Counts = CatchUp['counts'];

function refuseSweep(reason: string): never {
  throw new ConvexError(`Catch-up sweep refused: ${reason}.`);
}

function readCatchUp(ctx: MutationCtx, epoch: number) {
  return ctx.db
    .query('lifecycleCatchUp')
    .withIndex('by_epoch', (q) => q.eq('epoch', epoch))
    .unique();
}

/** A stored run as the sweep and `initialMigration:status` report it. */
export function catchUpStatus({
  _id: _omitId,
  _creationTime: _omitCreationTime,
  ...catchUp
}: Doc<'lifecycleCatchUp'>): CatchUp {
  return catchUp;
}

/** What one Character called for. */
type Finding =
  | { kind: 'untouched' }
  | { kind: 'departureStarted' }
  | { kind: 'deletionResumed' }
  | { kind: 'unknownOwner'; owner: string }
  // Failure rows of the last departure round remain for the next page.
  | { kind: 'continued' };

async function hasFailureDeleteBudget(ctx: MutationCtx) {
  const metrics = await ctx.meta.getTransactionMetrics();
  return (
    metrics.bytesRead.remaining > failureDeleteReserve.bytes &&
    metrics.bytesWritten.remaining > failureDeleteReserve.bytes &&
    metrics.documentsRead.remaining > failureDeleteReserve.documents &&
    metrics.documentsWritten.remaining > failureDeleteReserve.documents
  );
}

/**
 * Deletes the last round's failure rows within the page's budget, so that
 * starting the round finds none. False when some remain.
 */
async function deleteDepartureFailures(
  ctx: MutationCtx,
  departureId: Id<'organizationDeparture'>,
) {
  let deleted = 0;
  for await (const failure of ctx.db
    .query('organizationDepartureCharacter')
    .withIndex('by_departureId_and_characterId', (q) =>
      q.eq('departureId', departureId),
    )) {
    if (
      deleted === failureDeletesPerPage ||
      !(await hasFailureDeleteBudget(ctx))
    )
      return false;
    await ctx.db.delete('organizationDepartureCharacter', failure._id);
    deleted++;
  }
  return true;
}

/**
 * The catch-up for one campaign Character with an owner:
 * - no user row: a completed account deletion of that owner resumes, so the
 *   Character is handled as a deletion now is; with no deletion at all the
 *   owner is only counted, because a lost `user.created` also leaves no row;
 * - a user who is not a member of the campaign's organization: a departure
 *   round starts, unless one is returning, once the last round's failure
 *   rows are deleted, on as many pages as that takes.
 * A member, and a lifecycle still running, are left alone.
 */
async function catchUpCharacter(
  ctx: MutationCtx,
  owner: string,
  campaign: Doc<'campaign'>,
): Promise<Finding> {
  const user = await getUserByTokenIdentifier(ctx, owner);
  if (!user) {
    const deletion = await readAccountDeletion(ctx, owner);
    if (!deletion) return { kind: 'unknownOwner', owner };
    if (deletion.state !== 'completed') return { kind: 'untouched' };
    await ctx.db.patch('accountDeletion', deletion._id, {
      state: 'deleting',
      legacyRetained: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.accountDeletions.drive, {
      deletionId: deletion._id,
    });
    return { kind: 'deletionResumed' };
  }
  const { organizationId } = campaign;
  if (user.orgIds.some(({ orgId }) => orgId === organizationId))
    return { kind: 'untouched' };
  const departure = await readOrganizationDeparture(
    ctx,
    user._id,
    organizationId,
  );
  if (departure?.state === 'returning') return { kind: 'untouched' };
  if (departure && !(await deleteDepartureFailures(ctx, departure._id)))
    return { kind: 'continued' };
  // The newest removal's provider time keeps fencing older membership events.
  await startOrganizationDeparture(ctx, {
    userId: user._id,
    organizationId,
    webhookUpdatedAt: departure?.webhookUpdatedAt,
  });
  return { kind: 'departureStarted' };
}

type SweepingRun = Extract<Doc<'lifecycleCatchUp'>, { state: 'sweeping' }>;
type Tally = { counts: Counts; lastUnknownOwner: string | null };

/**
 * Counts one finding. An owner's Characters are adjacent in the owner index,
 * so an unknown owner is counted at their first Character, on any page.
 */
function tally({ counts, lastUnknownOwner }: Tally, finding: Finding): Tally {
  switch (finding.kind) {
    case 'departureStarted':
      return {
        counts: { ...counts, departuresStarted: counts.departuresStarted + 1 },
        lastUnknownOwner,
      };
    case 'deletionResumed':
      return {
        counts: { ...counts, deletionsResumed: counts.deletionsResumed + 1 },
        lastUnknownOwner,
      };
    case 'unknownOwner':
      return {
        counts:
          finding.owner === lastUnknownOwner
            ? counts
            : { ...counts, unknownOwners: counts.unknownOwners + 1 },
        lastUnknownOwner: finding.owner,
      };
    case 'untouched':
    case 'continued':
      return { counts, lastUnknownOwner };
  }
}

/** What the page's Character called for; null for one the sweep skips. */
async function findCharacter(
  ctx: MutationCtx,
  { ownerId, campaignId }: Doc<'character'>,
): Promise<Finding | null> {
  if (!ownerId || !campaignId) return null;
  const campaign = await ctx.db.get('campaign', campaignId);
  if (!campaign) return null;
  return catchUpCharacter(ctx, ownerId, campaign);
}

/**
 * One page of the owner index. A Character whose departure still has failure
 * rows to delete keeps the cursor, so the next page reads it again.
 */
async function sweepPage(ctx: MutationCtx, run: SweepingRun) {
  const result = await ctx.db
    .query('character')
    .withIndex('by_ownerId_and_campaignId', (q) => q.gt('ownerId', ''))
    .paginate({ numItems: pageSize, cursor: run.cursor });
  const sum: Tally = {
    counts: run.counts,
    lastUnknownOwner: run.lastUnknownOwner,
  };
  const [character] = result.page;
  const finding = character ? await findCharacter(ctx, character) : null;
  if (finding?.kind === 'continued')
    return { isDone: false, cursor: run.cursor, ...sum };
  return {
    isDone: result.isDone,
    cursor: result.continueCursor,
    ...(finding
      ? tally(
          {
            ...sum,
            counts: { ...sum.counts, characters: sum.counts.characters + 1 },
          },
          finding,
        )
      : sum),
  };
}

/**
 * The epoch's run, started at page 0. Refuses a page that is not a whole
 * number, and a later page with no run.
 */
async function readOrStartRun(ctx: MutationCtx, epoch: number, page: number) {
  if (!Number.isSafeInteger(page) || page < 0)
    refuseSweep('supply a page number');
  const stored = await readCatchUp(ctx, epoch);
  if (stored) return stored;
  if (page !== 0) refuseSweep('the page sequence changed; inspect the status');
  const runId = await ctx.db.insert('lifecycleCatchUp', {
    epoch,
    startedAt: Date.now(),
    counts: {
      characters: 0,
      departuresStarted: 0,
      deletionsResumed: 0,
      unknownOwners: 0,
    },
    state: 'sweeping',
    nextPage: 0,
    cursor: null,
    lastUnknownOwner: null,
  });
  const run = await ctx.db.get('lifecycleCatchUp', runId);
  if (!run) throw new Error('The catch-up run was not stored');
  return run;
}

/** The run after sweeping its expected page. */
async function sweepNextPage(ctx: MutationCtx, run: SweepingRun) {
  const { isDone, cursor, counts, lastUnknownOwner } = await sweepPage(
    ctx,
    run,
  );
  const shared = { epoch: run.epoch, startedAt: run.startedAt, counts };
  const next: CatchUp = isDone
    ? {
        ...shared,
        state: 'completed',
        pages: run.nextPage + 1,
        completedAt: Date.now(),
      }
    : {
        ...shared,
        state: 'sweeping',
        nextPage: run.nextPage + 1,
        cursor,
        lastUnknownOwner,
      };
  await ctx.db.replace('lifecycleCatchUp', run._id, next);
  return next;
}

/**
 * The lifecycle catch-up sweep (#413 F7b), one page of the owner index (one
 * Character) per transaction. Only `initialMigration:reopen` schedules its
 * first page, for the Write Epoch it opens, and each page schedules the
 * next; a page that leaves failure rows to delete keeps the cursor, so the
 * next page reads the same Character again. A page already
 * swept (a duplicate driver, a rerun) returns the recorded run and changes
 * nothing; a page ahead of it refuses. It writes only departure and account
 * deletion rows and its own run, never a Character: the drivers it starts
 * move or release the Characters under the sheet Character gate. It is
 * refused under legacy authority, while the gate is closed and at an earlier
 * epoch.
 */
export const sweep = generalInternalMutation({
  args: { page: v.number() },
  returns: lifecycleCatchUpValidator,
  async handler(ctx, args) {
    const control = await readWriteGate(ctx);
    if (control?.authority !== 'sheet')
      refuseSweep('the deployment is not under sheet authority');
    const epoch = ctx.writeEpoch;
    const run = await readOrStartRun(ctx, epoch, args.page);
    if (run.state === 'completed' || args.page < run.nextPage)
      return catchUpStatus(run);
    if (args.page > run.nextPage)
      refuseSweep('the page sequence changed; inspect the status');
    const next = await sweepNextPage(ctx, run);
    if (next.state === 'sweeping')
      await ctx.scheduler.runAfter(0, internal.lifecycleCatchUp.sweep, {
        writeEpoch: epoch,
        page: next.nextPage,
      });
    return next;
  },
});
