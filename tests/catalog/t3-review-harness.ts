/**
 * What the t3-review test files share: a captured synthetic round (fixture),
 * a round's full listing (snapshot), the test's own directories and their
 * cleanup, and the refusal of a wrong supplied return. Synthetic workflow
 * evidence only; no live review or promotion.
 */
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { expect } from 'vitest';
import { captureT3Inputs } from '../../scripts/catalog/t3-review-evidence';
import {
  author,
  killSyntheticChildren,
  reviewer,
  syntheticDirectReturn,
  syntheticStatus,
  syntheticTools,
} from './t3-code-mode-fixture';

/** The repository root, where bridge and record-step processes start. */
export const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
/** For tests that run many real bridge processes, or pause one. */
export const slow = 120_000;
/** The directories a test made, removed after it (cleanUp). */
const directories: string[] = [];
/**
 * After each test: kills the bridge processes a failed test left paused or
 * running, and removes the directories it made.
 */
export async function cleanUp() {
  killSyntheticChildren();
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
}
export const seen = [
  {
    id: 'synthetic decision',
    sources: [{ subject: 'synthetic:source', sourceSha256: 'a'.repeat(64) }],
    payloadSha256: 'b'.repeat(64),
  },
];
/** The transport directories in a bridge temporary directory. */
export const transports = async (tmp: string) =>
  (await readdir(tmp)).filter((name) =>
    name.startsWith('t3-review-transport-'),
  );
/** A directory of the test's own, outside every round and its parent. */
export async function scratch(prefix = 't3-scratch-') {
  const path = await mkdtemp(join(tmpdir(), prefix));
  directories.push(path);
  return path;
}
export async function fixture({
  prefix = '',
  caller = 'synthetic:parent',
  target = reviewer,
  fetchedAt = new Date().toISOString(),
}: {
  prefix?: string;
  caller?: string;
  /** When the issue input was fetched (default: now). */
  fetchedAt?: string;
  /** The review target the request names (default: reviewer). */
  target?: {
    providerInstanceId: string;
    model: string;
    options: Record<string, string | boolean>;
  };
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 't3-review-'));
  directories.push(root);
  const disposable = join(root, 'disposable');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(disposable);
  const issue = join(disposable, 'issue.json');
  await writeFile(issue, '{"number":766,"body":"synthetic acceptance"}\n');
  const dir = join(root, 'durable');
  const config = {
    author,
    request: {
      role: 'review',
      mode: 'async',
      task: `${prefix}Review ${'c'.repeat(40)} against the archived issue.`,
      target,
    },
    inputs: [
      {
        kind: 'issue',
        identity: 'github:synthetic/766',
        fetchedAt,
        path: issue,
      },
    ],
  };
  await captureT3Inputs({
    dir,
    reviewedCommit: 'c'.repeat(40),
    seen,
    caller: { threadId: caller },
    config,
  });

  return { root, dir, issue, disposable, config };
}
/**
 * Every name in `dir` with its mode, its modification time and its bytes (a
 * directory's own listing, the same way), so a changed permission or a touch
 * shows as well as changed contents.
 */
export async function snapshot(dir: string): Promise<Record<string, unknown>> {
  const { readdir, stat } = await import('node:fs/promises');
  return Object.fromEntries(
    await Promise.all(
      (await readdir(dir)).map(async (name): Promise<[string, unknown]> => {
        const path = join(dir, name);
        const found = await stat(path);
        return [
          name,
          {
            mode: found.mode & 0o7777,
            mtimeNs: String((await stat(path, { bigint: true })).mtimeNs),
            ...(found.isDirectory()
              ? { entries: await snapshot(path) }
              : { bytes: (await readFile(path)).toString('base64') }),
          },
        ];
      }),
    ),
  );
}
export async function resizeSyntheticCapture({
  dir,
  length,
}: {
  dir: string;
  length: number;
}) {
  // Reconstruct only disposable pre-fix/historical inputs. Real frozen evidence
  // is never resized; task is excluded from the unchanged manifest declarations.
  const { chmod } = await import('node:fs/promises');
  const inputs = z
    .object({
      taskTemplate: z.string(),
      request: z.object({ task: z.string() }).passthrough(),
    })
    .passthrough()
    .parse(JSON.parse(await readFile(join(dir, 'inputs.json'), 'utf8')));
  const padding = '🦊' + 'x'.repeat(length - inputs.request.task.length - 2);
  inputs.taskTemplate = padding + inputs.taskTemplate;
  inputs.request.task = padding + inputs.request.task;
  for (const [name, value] of [
    ['inputs.json', inputs],
    ['request.json', inputs.request],
  ] as const) {
    await chmod(join(dir, name), 0o644);
    await writeFile(join(dir, name), JSON.stringify(value, null, 2) + '\n');
    await chmod(join(dir, name), 0o444);
  }
  expect(inputs.request.task.length).toBe(length);
}
// The operator's direct delegate_task return is supplied, so the helper must
// refuse a wrong one without saving it: the round's own return still binds.
export async function refusesSupplied({
  dir,
  world,
  supplied,
  message,
}: {
  dir: string;
  world: Awaited<ReturnType<typeof syntheticTools>>;
  supplied: unknown;
  message: string;
}) {
  const before = await snapshot(dir);
  await expect(world.bind(supplied)).rejects.toThrow(message);
  expect(await snapshot(dir)).toEqual(before);
  const own = await syntheticTools({ dir });
  await expect(
    own.bind(syntheticDirectReturn(syntheticStatus())),
  ).resolves.toEqual({ bound: true });
}
export const otherTask = {
  taskId: 'synthetic:other-task',
  childThreadId: 'synthetic:other-thread',
  childNodeId: 'synthetic:other-node',
  childRunId: 'synthetic:other-run:1',
  latestTerminalRunId: 'synthetic:other-run:1',
};
export type Settled = { bound: boolean; error?: string };
export const settle = (attempt: Promise<unknown>): Promise<Settled> =>
  attempt.then(
    () => ({ bound: true }),
    (error: unknown) => ({ bound: false, error: String(error) }),
  );
/** Completes the round with a synthetic report; returns its files' bytes. */
export async function completeRound({
  root,
  dir,
}: {
  root: string;
  dir: string;
}) {
  const report = join(root, 'report.md');
  await writeFile(report, 'Synthetic review report.\n');
  await (await syntheticTools({ dir })).execute('complete', report);
  return snapshot(dir);
}
