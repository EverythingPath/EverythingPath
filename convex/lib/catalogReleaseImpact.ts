import type { MutationCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';

async function activeImpactRun(ctx: MutationCtx) {
  const controls = await ctx.db
    .query('catalogImpactControl')
    .withIndex('by_key', (q) => q.eq('key', 'global'))
    .take(2);
  if (controls.length > 1) return;
  const control = controls[0];
  const latest = !control
    ? await ctx.db
        .query('catalogRelease')
        .withIndex('by_releaseNumber')
        .order('desc')
        .first()
    : null;
  const readyRun =
    latest?.state === 'prepared'
      ? await ctx.db
          .query('catalogImpactRun')
          .withIndex('by_releaseId', (q) => q.eq('releaseId', latest._id))
          .order('desc')
          .first()
      : null;
  const run = control
    ? await ctx.db.get('catalogImpactRun', control.runId)
    : readyRun;
  if (
    !run ||
    (run.lifecycle && run.lifecycle !== 'active' && run.lifecycle !== 'ready')
  )
    return;
  const activeReleases = await ctx.db
    .query('catalogReleaseControl')
    .withIndex('by_key', (q) => q.eq('key', 'global'))
    .take(2);
  if (
    activeReleases.length > 1 ||
    activeReleases[0]?.impactRunId === run._id ||
    (run.baseReleaseNumber !== undefined &&
      (activeReleases[0]?.releaseNumber ?? null) !== run.baseReleaseNumber)
  )
    return;
  return run;
}

/** Recording work never invokes the candidate calculator in an active write. */
export async function markCatalogImpactDirty(
  ctx: MutationCtx,
  characterId: Id<'character'>,
) {
  const run = await activeImpactRun(ctx);
  if (!run) return;
  const works = await ctx.db
    .query('catalogImpactWork')
    .withIndex('by_runId_and_characterId', (q) =>
      q.eq('runId', run._id).eq('characterId', characterId),
    )
    .take(2);
  if (works.length > 1) return;
  const work = works[0];
  if (work) {
    await ctx.db.patch('catalogImpactWork', work._id, {
      revision: work.revision + 1,
      state: 'dirty',
      error: undefined,
    });
  } else {
    await ctx.db.insert('catalogImpactWork', {
      runId: run._id,
      characterId,
      revision: 1,
      state: 'dirty',
    });
  }
}

/** Candidate registration and future activation call this in their own write. */
export async function supersedeCatalogImpactTracking(ctx: MutationCtx) {
  const controls = await ctx.db
    .query('catalogImpactControl')
    .withIndex('by_key', (q) => q.eq('key', 'global'))
    .take(2);
  for (const control of controls) {
    const run = await ctx.db.get('catalogImpactRun', control.runId);
    if (run)
      await ctx.db.patch('catalogImpactRun', run._id, {
        lifecycle: 'superseded',
      });
    await ctx.db.delete('catalogImpactControl', control._id);
  }
}

/** A new live browser reference joins only this Character's candidate graph. */
export async function recordCatalogImpactSpellReference(
  ctx: MutationCtx,
  characterId: Id<'character'>,
  definition: Doc<'catalogEntry'>,
) {
  if (
    definition.copiedFrom ||
    (definition.scope !== 'global' && !definition.importedSpell)
  )
    return;
  const run = await activeImpactRun(ctx);
  if (!run) return;
  const key = `key:${definition.ruleIdentity}`;
  const changes = await ctx.db
    .query('catalogImpactChange')
    .withIndex('by_runId_and_key', (q) => q.eq('runId', run._id).eq('key', key))
    .take(2);
  if (changes.length !== 1 || !changes[0]?.hasChanged) return;
  const from = `character:${characterId}`;
  const existing = await ctx.db
    .query('catalogImpactEdge')
    .withIndex('by_runId_and_from_and_to', (q) =>
      q.eq('runId', run._id).eq('from', from).eq('to', key),
    )
    .take(2);
  if (!existing.length)
    await ctx.db.insert('catalogImpactEdge', { runId: run._id, from, to: key });
}
