import type { Doc } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { CANONICAL_WEEKLY_RULESET_VERSION } from '../../src/lib/ruleset-versions';
import { readWriteGate } from './writeGate';

/**
 * The Ruleset Version Weekly Resolution uses on this deployment (#413 f6b2):
 * the one the current run's activation recorded while the deployment is under
 * sheet authority, else the current version. Legacy authority, a missing
 * control row, sheet authority without an activation (fixture seeding) and an
 * activation stored before f6b2 all keep the current version. A record keeps
 * the version it was confirmed under; nothing here re-resolves one.
 */
export function weeklyRulesetVersion(
  control: Pick<Doc<'initialMigrationControl'>, 'authority'> | null,
  run: Doc<'initialMigrationRun'> | null,
) {
  if (
    control?.authority !== 'sheet' ||
    !run ||
    run.state === 'maintenance' ||
    run.state === 'aborted'
  )
    return CANONICAL_WEEKLY_RULESET_VERSION;
  return run.activation.rulesetVersion ?? CANONICAL_WEEKLY_RULESET_VERSION;
}

/** Reads the control row and, under sheet authority only, its current run. */
export async function readWeeklyRulesetVersion(ctx: Pick<QueryCtx, 'db'>) {
  const control = await readWriteGate(ctx);
  const run =
    control?.authority === 'sheet'
      ? await ctx.db.get('initialMigrationRun', control.runId)
      : null;
  return weeklyRulesetVersion(control, run);
}
