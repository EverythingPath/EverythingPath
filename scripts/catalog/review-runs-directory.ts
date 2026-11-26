import { realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

/**
 * The record step's runs directory (--verify's) as named: --runs as given,
 * else $EP_ORCH/runs, else ../ep-orch/runs beside the --root checkout, the
 * inferred default. Nothing is looked at here: the temporary-directory check
 * resolves it for use, once. With neither --runs nor EP_ORCH, --verify then
 * uses the inferred default when it resolves to a directory, and refuses when
 * it does not resolve to a directory (realInferredRunsDirectory).
 */
export function reviewRunsDirectory({
  runs,
  orch,
  root,
}: {
  runs?: string;
  orch?: string;
  root: string;
}): { runs: string; inferred: boolean } {
  if (runs !== undefined) return { runs, inferred: false };
  // The base's join($EP_ORCH, 'runs') as supplied (an empty EP_ORCH is the
  // working directory's runs), written out, not joined: join would collapse a
  // link followed by `..` as text, and the runs directory, like an explicit
  // --runs and --t3-run's $EP_ORCH/runs/$RUN_ID, is resolved by the file
  // system.
  const appendRunsComponent = (base: string) =>
    base === '' || base.endsWith(sep) ? `${base}runs` : `${base}${sep}runs`;
  if (orch !== undefined)
    return { runs: appendRunsComponent(orch), inferred: false };
  return {
    runs: appendRunsComponent(resolve(root, '../ep-orch')),
    inferred: true,
  };
}

/**
 * The inferred default's real path, resolved once: `<runs>/.` resolves only
 * when runs resolves to a directory, so the one resolution both decides and
 * gives the path used from then on. Otherwise the refusal naming --runs and
 * EP_ORCH.
 */
export async function realInferredRunsDirectory(runs: string) {
  try {
    return await realpath(`${runs}${sep}.`);
  } catch {
    throw new Error(
      `No runs directory named: --runs is absent, EP_ORCH is unset and the default ${runs} does not resolve to a directory. Name the runs directory with --runs <dir>, or set EP_ORCH to the directory holding it; nothing done.`,
    );
  }
}
