import type { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import type { MutationCtx } from '../_generated/server';
import type { ReadCtx } from '../types';
import { departureGraceMs } from './lifecycleDriver';

/**
 * Who a trusted return's writes are attributed to: neither the departed owner,
 * who didn't make them, nor a member.
 */
export const organizationDepartureActor = 'system:organizationDeparture';

export function readDepartureFailure(
  ctx: ReadCtx,
  departureId: Id<'organizationDeparture'>,
  characterId: Id<'character'>,
) {
  return ctx.db
    .query('organizationDepartureCharacter')
    .withIndex('by_departureId_and_characterId', (q) =>
      q.eq('departureId', departureId).eq('characterId', characterId),
    )
    .unique();
}

export function readOrganizationDeparture(
  ctx: ReadCtx,
  userId: Id<'user'>,
  organizationId: string,
) {
  return ctx.db
    .query('organizationDeparture')
    .withIndex('by_userId_and_organizationId', (q) =>
      q.eq('userId', userId).eq('organizationId', organizationId),
    )
    .unique();
}

/**
 * Record a removal and start a new round of trusted returns (PRD 14). Access
 * is already gone with the membership; the scheduled driver returns the
 * departed owner's Characters without their credentials. It starts after the
 * grace, so an account deletion arriving meanwhile takes precedence (#708).
 * Only the isolated browser fixture shortens the grace.
 */
export async function startOrganizationDeparture(
  ctx: MutationCtx,
  {
    userId,
    organizationId,
    webhookUpdatedAt,
    graceMs = departureGraceMs,
  }: {
    userId: Id<'user'>;
    organizationId: string;
    webhookUpdatedAt?: number;
    graceMs?: number;
  },
) {
  const existing = await readOrganizationDeparture(ctx, userId, organizationId);
  const round = (existing?.round ?? 0) + 1;
  const departure = {
    userId,
    organizationId,
    webhookUpdatedAt,
    round,
    state: 'returning' as const,
  };
  const departureId = existing?._id;
  if (departureId) {
    await ctx.db.replace('organizationDeparture', departureId, departure);
    // A new round starts every Character afresh.
    const failures = await ctx.db
      .query('organizationDepartureCharacter')
      .withIndex('by_departureId_and_characterId', (q) =>
        q.eq('departureId', departureId),
      )
      .take(1024);
    for (const failure of failures)
      await ctx.db.delete('organizationDepartureCharacter', failure._id);
  }
  const id =
    departureId ?? (await ctx.db.insert('organizationDeparture', departure));
  await ctx.scheduler.runAfter(graceMs, internal.organizationDepartures.drive, {
    departureId: id,
    round,
  });
}
