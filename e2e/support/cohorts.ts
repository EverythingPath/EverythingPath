import { availableParallelism } from 'node:os';
import { resourceSchema, type Resources } from '../fixtures/catalog';
import { HarnessFailure } from './diagnostics';

// Each concurrently running Playwright worker owns one declared cohort: a
// member organization, an outsider organization and three users. Two workers
// never share a cohort, so organization campaign lists cannot leak between
// tests. More cohorts than this may be declared; the extras stay idle.
export const defaultMaximumWorkers = 3;

/**
 * Playwright's worker count for a declaration: one per distinct cohort, capped
 * at `requested`. Without a request, it is also capped at three and at one
 * worker per two available CPUs. Each worker drives two or three browser
 * contexts, its fixture CLI processes and a share of one production server.
 * On a 4-vCPU GitHub runner three workers made every journey about 1.6 times
 * slower than locally (layout steps up to 2.7 times, sync steps 1.2–1.5), which
 * pushed the five tightest `canonical-workspace` journeys past their limits
 * (#198). One cohort keeps the run exactly serial. Worker N uses cohort
 * `worker-N`, matching Playwright's `parallelIndex`.
 */
export function cohortWorkers(
  resources: Resources,
  requested?: number,
  cpus = availableParallelism(),
) {
  if (!resourceSchema.safeParse(resources).success)
    throw new HarnessFailure({ kind: 'cohorts-distinct' });
  resources.workers.forEach((worker, index) => {
    if (worker.key !== `worker-${index}`)
      throw new HarnessFailure({ kind: 'cohorts-order' });
  });
  const cohorts = resources.workers.length;
  if (requested === undefined)
    return Math.max(
      1,
      Math.min(cohorts, defaultMaximumWorkers, Math.floor(cpus / 2)),
    );
  if (!Number.isSafeInteger(requested) || requested < 1 || requested > cohorts)
    throw new HarnessFailure({ kind: 'workers-range', cohorts });
  return requested;
}
