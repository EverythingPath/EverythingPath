import { renameSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

/**
 * `progress.json`, the run's durable checkpoint in the evidence directory.
 * The reporter saves the planned tests when the run begins, each attempt as it
 * starts and each attempt's evidence as it ends, so a run cut off before
 * Playwright's own report still shows what ran. `running` is never final:
 * Playwright's `onEnd` or, failing that, the runner (`finalizeProgress`)
 * replaces it with `finished` or `interrupted` and the three lists below.
 */
const testSchema = z.object({ project: z.string(), title: z.string() });
const plannedSchema = testSchema.extend({ id: z.string(), file: z.string() });
const progressSchema = z
  .object({
    status: z.enum(['running', 'finished', 'interrupted']),
    // The run's selected suites (support/matrix.ts), for its scope line.
    suite: z.unknown().optional(),
    // A reused preparation's results are diagnostic only (#754).
    preparation: z.enum(['fresh', 'reused']).optional(),
    errors: z.number().int().nonnegative(),
    planned: z.array(plannedSchema),
    started: z.array(z.object({ id: z.string(), retry: z.number().int() })),
    evidence: z.array(
      z
        .object({
          testId: z.string(),
          retry: z.number().int(),
          status: z.string(),
        })
        .passthrough(),
    ),
  })
  .passthrough();
export type Progress = z.infer<typeof progressSchema>;
export type PlannedTest = z.infer<typeof plannedSchema>;

export const progressFile = 'progress.json';

/**
 * Each planned test once: `completed` if its latest attempt ended (with that
 * attempt's status), `interrupted` if its latest attempt started but never
 * ended or ended as interrupted, `unstarted` if no attempt began.
 */
export function classifyPlannedTests(progress: Progress) {
  const completed: (z.infer<typeof testSchema> & { status: string })[] = [];
  const interrupted: z.infer<typeof testSchema>[] = [];
  const unstarted: z.infer<typeof testSchema>[] = [];
  for (const { id, project, title } of progress.planned) {
    const attempts = progress.started.filter((start) => start.id === id);
    const latest = attempts.at(-1);
    if (!latest) {
      unstarted.push({ project, title });
      continue;
    }
    const ended = progress.evidence.find(
      (attempt) => attempt.testId === id && attempt.retry === latest.retry,
    );
    if (!ended || ended.status === 'interrupted')
      interrupted.push({ project, title });
    else completed.push({ project, title, status: ended.status });
  }
  return { completed, interrupted, unstarted };
}

function writeJsonAtomically({
  path,
  value,
}: {
  path: string;
  value: unknown;
}) {
  writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2));
  renameSync(`${path}.tmp`, path);
}

/** The reporter's checkpoint: synchronous, because its hooks are. */
export function saveProgress({
  directory,
  progress,
}: {
  directory: string;
  progress: Progress;
}) {
  writeJsonAtomically({ path: join(directory, progressFile), value: progress });
}

/** The reporter's last write: the run ended, completely or not. */
export function saveFinalProgress({
  directory,
  progress,
  isInterrupted,
}: {
  directory: string;
  progress: Pick<
    Progress,
    'suite' | 'preparation' | 'errors' | 'planned' | 'started' | 'evidence'
  >;
  isInterrupted: boolean;
}) {
  const final: Progress = {
    ...progress,
    status: isInterrupted ? 'interrupted' : 'finished',
  };
  writeJsonAtomically({
    path: join(directory, progressFile),
    value: { ...final, ...classifyPlannedTests(final) },
  });
}

/**
 * The runner's step once Playwright and everything it started have exited:
 * a checkpoint still `running` (or missing) becomes `interrupted`, with the
 * completed, interrupted and unstarted tests listed. A final status Playwright
 * wrote itself is left as it is.
 */
export async function finalizeProgress(directory: string) {
  const path = join(directory, progressFile);
  const saved = await readFile(path, 'utf8').then(
    (text) => progressSchema.parse(JSON.parse(text)),
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    },
  );
  if (saved && saved.status !== 'running')
    return { ...saved, ...classifyPlannedTests(saved) };
  const progress: Progress = {
    ...(saved ?? { errors: 0, planned: [], started: [], evidence: [] }),
    status: 'interrupted',
  };
  const final = { ...progress, ...classifyPlannedTests(progress) };
  writeJsonAtomically({ path, value: final });
  return final;
}
