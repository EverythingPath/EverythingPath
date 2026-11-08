import type { ReadCtx } from '../types';

/** The organization's deletion, requested in the app or made by the provider. */
export function readOrganizationDeletion(ctx: ReadCtx, organizationId: string) {
  return ctx.db
    .query('organizationDeletion')
    .withIndex('by_organizationId', (q) =>
      q.eq('organizationId', organizationId),
    )
    .unique();
}

/**
 * Whether the provider has deleted the organization (#710). Provider
 * organization IDs are never reused, so the deletion is final: nobody has
 * access from then on, even before every membership is removed.
 */
export async function isOrganizationDeleted(
  ctx: ReadCtx,
  organizationId: string,
) {
  const deletion = await readOrganizationDeletion(ctx, organizationId);
  return deletion?.deletedAt !== undefined;
}
