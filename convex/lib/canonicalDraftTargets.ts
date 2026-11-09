import { ConvexError } from 'convex/values';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';

type Key = {
  campaignId: Id<'campaign'>;
  militiaId: Id<'militia'>;
  draftId: string;
};
function ancestors(target: string) {
  // Older storage primitives use opaque flat targets; canonical semantic edits
  // use encoded paths. Both retain exact-target tombstones in the same table.
  try {
    const path: unknown = JSON.parse(target);
    if (Array.isArray(path) && path.every((part) => typeof part === 'string'))
      return path
        .slice(0, -1)
        .map((_, index) => JSON.stringify(path.slice(0, index + 1)));
  } catch {
    /* A legacy opaque target has no parent paths. */
  }
  return [];
}
async function targetRow(
  ctx: QueryCtx | MutationCtx,
  draftId: string,
  target: string,
) {
  return await ctx.db
    .query('canonicalDraftTarget')
    .withIndex('by_draftId_and_target', (q) =>
      q.eq('draftId', draftId).eq('target', target),
    )
    .unique();
}
export async function requireUnchangedStoredTargets(
  ctx: MutationCtx,
  key: Key,
  targets: string[],
  baseRevision: number,
) {
  for (const target of targets) {
    const row = await targetRow(ctx, key.draftId, target);
    if (row && row.subtreeRevision > baseRevision)
      throw new ConvexError('Target changed');
    for (const parent of ancestors(target)) {
      const row = await targetRow(ctx, key.draftId, parent);
      if (row && row.revision > baseRevision)
        throw new ConvexError('Target changed');
    }
  }
}
export async function writeDraftTargets(
  ctx: MutationCtx,
  key: Key,
  targets: string[],
  revision: number,
) {
  const touched = new Map<string, boolean>();
  for (const target of targets) {
    touched.set(target, true);
    for (const parent of ancestors(target))
      if (!touched.has(parent)) touched.set(parent, false);
  }
  for (const [target, exact] of touched) {
    const row = await targetRow(ctx, key.draftId, target);
    const values = {
      revision: exact ? revision : (row?.revision ?? 0),
      subtreeRevision: revision,
    };
    if (row) await ctx.db.patch('canonicalDraftTarget', row._id, values);
    else
      await ctx.db.insert('canonicalDraftTarget', {
        campaignId: key.campaignId,
        militiaId: key.militiaId,
        draftId: key.draftId,
        target,
        ...values,
      });
  }
}
