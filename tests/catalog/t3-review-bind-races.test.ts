// @vitest-environment node
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { afterEach, expect, it, vi } from 'vitest';
import {
  captureT3Inputs,
  readT3Review,
} from '../../scripts/catalog/t3-review-evidence';
import {
  cleanUp,
  completeRound,
  fixture,
  otherTask,
  repoRoot,
  scratch,
  seen,
  settle,
  slow,
  snapshot,
  transports,
  type Settled,
} from './t3-review-harness';

/**
 * Overlapping binds of one round: another return offered or bound before
 * each step of the round's own bind, a bind paused at a write (by the pause
 * hook, in a real bridge process) while another completes the round, the mode
 * set on the descriptor, the old attempts path, and the private transport
 * directories. The paused step runs in a real process; the other steps of a
 * variation run in this process (t3-bridge-in-process.ts), and one test per
 * rule runs every step of the paused bind in a real process.
 */
// The tests that run real bridge processes take the limit CI gives them,
// locally too (each start is a node process under tsx).
vi.setConfig({ testTimeout: slow });
afterEach(cleanUp);
it('never reads a staged return left by a failed discard as the saved one', async () => {
  const { root, dir } = await fixture();
  const tmp = await scratch('t3-transport-');
  const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  // Another task's return passes the selection checks and is kept pending;
  // its original message refuses it, and removing it fails.
  const other = { ...syntheticStatus(), ...otherTask };
  const world = await syntheticTools({
    dir,
    status: other,
    task: 'Another review task.',
    mutateRead: (page) => ({
      ...page,
      thread: {
        ...page.thread,
        threadId: otherTask.childThreadId,
        latestRunId: otherTask.childRunId,
      },
      items: page.items.map((item) => ({
        ...item,
        sourceThreadId: otherTask.childThreadId,
        runId: otherTask.childRunId,
      })),
    }),
    tmp,
    mutateExec: ({ cmd }) =>
      cmd.includes('"action":"discard"')
        ? { exit_code: 1, output: 'discard failed' }
        : undefined,
  });
  const parent = (await readdir(root)).sort();
  await expect(world.bind(syntheticDirectReturn(other))).rejects.toThrow(
    'Original message differs',
  );
  // Its own staged return, left behind in a private temporary directory of
  // that attempt alone, and nothing of it in or beside the round.
  const left = await transports(tmp);
  expect(left).toHaveLength(1);
  expect(left[0]).toMatch(/^t3-review-transport-/);
  expect(await readdir(join(tmp, left[0] ?? ''))).toEqual(['return.json']);
  expect(
    (await readdir(dir)).filter((name) => !/^input-\d+$/.test(name)).sort(),
  ).toEqual([
    'inputs.json',
    'manifest.json',
    'request.json',
    'reviewed-records.json',
  ]);
  expect((await readdir(root)).sort()).toEqual(parent);
  const own = await syntheticTools({ dir, tmp });
  await expect(own.execute('dispatch')).resolves.toEqual({ bound: true });
  expect(
    JSON.parse(await readFile(join(dir, 'dispatch-return.json'), 'utf8')),
  ).toEqual(syntheticDirectReturn(syntheticStatus()));
  // The later bind neither read nor removed it.
  expect(await transports(tmp)).toEqual(left);
});
// Bind in this order: validate the supplied input; refuse a completed round;
// acknowledge the same return on an intact binding before any T3 tool call;
// refuse any other dispatch.json; otherwise check live and publish the
// verified bytes of this attempt, each with a create that fails if the name
// exists. Overlapping attempts each hold their own bytes: exactly one binds or
// neither, and the binding names the saved return's hash.
const pauseHook = fileURLToPath(
  new URL('./t3-bridge-pause.ts', import.meta.url),
);
const shellQuote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";
/**
 * The start of a bridge command run with the pause hook preloaded, which
 * needs tsx before the launcher; the cache is off as the launcher sets it.
 */
const pausedNode = (pause: string, settings: string) =>
  `EP_T3_PAUSE=${shellQuote(pause)} ${settings} TSX_DISABLE_CACHE=1 node --import tsx --import ${shellQuote(pauseHook)} scripts/`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/**
 * Another attempt's return staged by the real CLI (its stage step) whose
 * reply was lost, so its transport file stays.
 */
async function strayOffer({
  dir,
  returned,
}: {
  dir: string;
  returned: unknown;
}) {
  const { execFile } = await import('node:child_process');
  // Its transported return stays in a temporary directory of the test's own.
  const tmp = await scratch('t3-transport-');
  await new Promise<void>((resolve) => {
    execFile(
      'node',
      [
        'scripts/catalog/start-without-tsx-cache.mjs',
        'scripts/catalog/t3-review-bridge.ts',
        JSON.stringify({ action: 'stage', returned, dir }),
      ],
      { cwd: repoRoot, env: { ...process.env, TMPDIR: tmp } },
      () => resolve(),
    );
  });
}
async function expectOneBindingOfItsReturn({
  root,
  dir,
  outcomes,
}: {
  root: string;
  dir: string;
  outcomes: { returned: unknown; settled: Settled }[];
}) {
  const { createHash } = await import('node:crypto');
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const bound = outcomes.filter(({ settled }) => settled.bound);
  expect(bound.length).toBeLessThanOrEqual(1);
  const names = await readdir(dir);
  if (!names.includes('dispatch.json')) {
    expect(bound).toHaveLength(0);
    return;
  }
  expect(bound).toHaveLength(1);
  const saved = await readFile(join(dir, 'dispatch-return.json'));
  const binding = z
    .object({ dispatchReturnSha256: z.string() })
    .parse(JSON.parse(await readFile(join(dir, 'dispatch.json'), 'utf8')));
  expect(binding.dispatchReturnSha256).toBe(
    createHash('sha256').update(saved).digest('hex'),
  );
  expect(JSON.parse(saved.toString('utf8'))).toEqual(bound[0]?.returned);
  const report = join(root, 'report.md');
  await writeFile(report, 'Synthetic review report.\n');
  await expect(
    (await syntheticTools({ dir })).execute('complete', report),
  ).resolves.toMatchObject({ runId: expect.stringMatching(/^t3-review-/) });
}
/**
 * Runs the round's own bind (A) and, right before A's bridge step `step` (or,
 * for 'publication', while A's publish process is paused before its first
 * write), another attempt `other`.
 */
async function interleave({
  dir,
  step,
  own,
  other,
}: {
  dir: string;
  step: (typeof steps)[number];
  own: unknown;
  other: () => Promise<void>;
}) {
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const pause = join(await scratch('t3-pause-'), 'pause');
  let fired = false;
  const a = await syntheticTools({
    dir,
    mutateExec: async ({ cmd }, run) => {
      const action = /"action":"(\w+)"/.exec(cmd)?.[1];
      if (fired) return undefined;
      if (step !== 'publication') {
        if (action !== step) return undefined;
        fired = true;
        await other();
        return undefined;
      }
      if (action !== 'publish') return undefined;
      fired = true;
      let done = false;
      const running = run(
        cmd.replace('node scripts/', () =>
          pausedNode(pause, 'EP_T3_PAUSE_AT=.'),
        ),
      ).finally(() => {
        done = true;
      });
      while (!done && !(await exists(`${pause}.paused`))) await sleep(10);
      expect(done).toBe(false); // A reached its first write.
      await other();
      await writeFile(`${pause}.go`, '');
      return running;
    },
  });
  const settled = await settle(a.bind(own));
  expect(fired).toBe(true);
  return settled;
}
const exists = (path: string) =>
  readFile(path).then(
    () => true,
    () => false,
  );
const steps = [
  'offer',
  'prepare',
  'stage',
  'check',
  'next',
  'bind',
  'publish',
  'publication',
] as const;
it.each(
  steps.flatMap((step) => [
    { step, other: 'offers' },
    { step, other: 'binds' },
  ]),
)(
  'binds one return or none when another return of the same child $other before step $step of the round’s own bind',
  async ({ step, other }) => {
    const { root, dir } = await fixture();
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const own = syntheticDirectReturn(syntheticStatus());
    // Another return of the same child that passes every check on its own.
    const second = syntheticDirectReturn({
      ...syntheticStatus(),
      summary: 'Another return of the same child.',
    });
    const outcomes: { returned: unknown; settled: Settled }[] = [];
    const settled = await interleave({
      dir,
      step,
      own,
      other: async () => {
        if (other === 'offers') return strayOffer({ dir, returned: second });
        const world = await syntheticTools({ dir });
        outcomes.push({
          returned: second,
          settled: await settle(world.bind(second)),
        });
      },
    });
    outcomes.push({ returned: own, settled });
    // An offer alone never binds: the round's own bind binds its own bytes.
    if (other === 'offers') expect(settled).toEqual({ bound: true });
    await expectOneBindingOfItsReturn({ root, dir, outcomes });
  },
);
it.each(['next', 'publication'] as const)(
  "never saves another task's offered return under the round's own checks when it is offered before step %s",
  async (step) => {
    const { root, dir } = await fixture();
    const { syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const own = syntheticDirectReturn(syntheticStatus());
    const settled = await interleave({
      dir,
      step,
      own,
      other: () =>
        strayOffer({
          dir,
          returned: syntheticDirectReturn({
            ...syntheticStatus(),
            ...otherTask,
          }),
        }),
    });
    expect(settled).toEqual({ bound: true });
    await expectOneBindingOfItsReturn({
      root,
      dir,
      outcomes: [{ returned: own, settled }],
    });
  },
);
/**
 * Runs the round's own bind (A) with every bridge process it starts (or only
 * its `step` process, the others in this process) preloaded with the pause
 * hook: the process about to write, link or rename a file whose base name
 * matches `at` pauses there while `meanwhile` runs (told whether A paused or
 * had already finished), and the pause is released even if `meanwhile`
 * throws.
 */
async function pausedAt({
  dir,
  at,
  own,
  meanwhile,
  exits = false,
  afterWrite = false,
  umask,
  loses,
  tmp,
  step,
}: {
  dir: string;
  at: string;
  /** The one bridge step that runs as a real, paused process. */
  step?: 'stage' | 'bind' | 'publish';
  /** Pause right after the file's bytes are written, not before its create. */
  afterWrite?: boolean;
  /** The umask of A's bridge processes (as an operator's shell may set it). */
  umask?: string;
  /** The bridge processes' system temporary directory. */
  tmp?: string;
  own: unknown;
  meanwhile: (paused: boolean) => Promise<void>;
  /** The paused process dies right after its paused write. */
  exits?: boolean;
  /** The bridge step whose reply is lost after it ran. */
  loses?: string;
}) {
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const pause = join(await scratch('t3-pause-'), 'pause-at');
  const a = await syntheticTools({
    dir,
    tmp,
    mutateExec: async ({ cmd }, run) => {
      const real = step === undefined || cmd.includes(`"action":"${step}"`);
      const ran = real
        ? await run(
            (umask === undefined ? '' : `umask ${umask}; `) +
              // A function, so the pattern's `$` is never a replacement pattern.
              cmd.replace('node scripts/', () =>
                pausedNode(
                  pause,
                  `EP_T3_PAUSE_AT=${shellQuote(at)}${exits ? ' EP_T3_EXIT_AFTER_PAUSE=1' : ''}${afterWrite ? ' EP_T3_PAUSE_AFTER_WRITE=1' : ''}`,
                ),
              ),
          )
        : await run();
      if (loses !== undefined && cmd.includes(`"action":"${loses}"`))
        throw new Error('Simulated lost reply.');
      return ran;
    },
  });
  let done = false;
  const attempt = settle(a.bind(own)).finally(() => {
    done = true;
  });
  let paused = false;
  try {
    while (!done && !(await exists(`${pause}.paused`))) await sleep(10);
    paused = !done;
    await meanwhile(paused);
  } finally {
    await writeFile(`${pause}.go`, '');
  }
  return { paused, settled: await attempt };
}
// Fix r3, both reviewers' finding 1: a bind paused at its publication, while
// another bind of the same return binds and completes the round, never
// changes the completed round.
it(
  'refuses both binds of a round holding a partial dispatch.json, so a paused one cannot change a round completed meanwhile',
  async () => {
    const { root, dir } = await fixture();
    const { chmod } = await import('node:fs/promises');
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    await (await syntheticTools({ dir })).execute('dispatch');
    await chmod(join(dir, 'dispatch.json'), 0o644);
    await writeFile(join(dir, 'dispatch.json'), '{"kind":');
    await chmod(join(dir, 'dispatch.json'), 0o444);
    const before = await snapshot(dir);
    const own = syntheticDirectReturn(syntheticStatus());
    let other: Settled | undefined;
    let completed: Record<string, unknown> | undefined;
    const { settled } = await pausedAt({
      dir,
      at: '^dispatch\\.json$',
      own,
      meanwhile: async () => {
        other = await settle((await syntheticTools({ dir })).bind(own));
        if (other.bound) completed = await completeRound({ root, dir });
      },
    });
    if (completed !== undefined) {
      // Whatever A did, the completed round still verifies unchanged.
      expect(await snapshot(dir)).toEqual(completed);
      await expect(readT3Review({ dir })).resolves.toBeDefined();
    }
    expect(other).toMatchObject({ bound: false });
    expect(settled).toMatchObject({ bound: false });
    expect(await snapshot(dir)).toEqual(before);
  },
  slow,
);
it(
  'refuses a bind that finds the round completed after it published the return, leaving the completed round unchanged',
  async () => {
    const { root, dir } = await fixture();
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const own = syntheticDirectReturn(syntheticStatus());
    let completed: Record<string, unknown> | undefined;
    const { paused, settled } = await pausedAt({
      dir,
      at: '^dispatch-return\\.json$',
      own,
      meanwhile: async () => {
        await expect(
          (await syntheticTools({ dir })).bind(own),
        ).resolves.toEqual({ bound: true });
        completed = await completeRound({ root, dir });
      },
    });
    expect(paused).toBe(true);
    expect(settled).toMatchObject({
      bound: false,
      error: expect.stringContaining('completed round'),
    });
    expect(await snapshot(dir)).toEqual(completed);
    await expect(readT3Review({ dir })).resolves.toBeDefined();
  },
  slow,
);
it(
  'acknowledges a bind whose exclusive create of the binding fails on the binding of its own return, leaving the completed round unchanged',
  async () => {
    const { root, dir } = await fixture();
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const own = syntheticDirectReturn(syntheticStatus());
    let completed: Record<string, unknown> | undefined;
    // Its publication alone in a real process; the test above runs every step.
    const { paused, settled } = await pausedAt({
      dir,
      at: '^dispatch\\.json$',
      step: 'publish',
      own,
      meanwhile: async () => {
        await expect(
          (await syntheticTools({ dir })).bind(own),
        ).resolves.toEqual({ bound: true });
        completed = await completeRound({ root, dir });
      },
    });
    expect(paused).toBe(true);
    expect(settled).toEqual({ bound: true });
    expect(await snapshot(dir)).toEqual(completed);
    await expect(readT3Review({ dir })).resolves.toBeDefined();
  },
  slow,
);
it(
  'refuses to stage its reads in a round another bind completed meanwhile, leaving nothing of its own there',
  async () => {
    const { root, dir } = await fixture();
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const own = syntheticDirectReturn(syntheticStatus());
    let completed: Record<string, unknown> | undefined;
    const settled = await interleave({
      dir,
      step: 'bind',
      own,
      other: async () => {
        await (await syntheticTools({ dir })).bind(own);
        completed = await completeRound({ root, dir });
      },
    });
    expect(settled).toMatchObject({
      bound: false,
      error: expect.stringContaining('completed round'),
    });
    expect(await snapshot(dir)).toEqual(completed);
    await expect(readT3Review({ dir })).resolves.toBeDefined();
  },
  slow,
);
// Fix r4 and r5, both reviewers' finding 1: nothing is ever created at a path
// derived from a round's path other than the round's two evidence files, so a
// bind that passed its checks before another bind completed the round adds,
// changes and removes nothing in the round or its parent, whether its reply
// is then lost or its process dies right after the write.
it.each([
  // Every step a real process in the first case; in the others the writing
  // step alone.
  {
    name: 'its transported reads, its reply lost (the Standards reviewer)',
    at: '^evidence\\.json$',
    loses: 'bind',
  },
  {
    name: 'its transported return, its reply lost (the Spec reviewer)',
    at: '^return\\.json$',
    loses: 'stage',
    step: 'stage' as const,
  },
  {
    name: 'the return, its process dying',
    at: '^dispatch-return\\.json$',
    exits: true,
    step: 'publish' as const,
  },
  {
    // Its create fails on the binding of its own return: acknowledged.
    name: 'the binding, its process dying',
    at: '^dispatch\\.json$',
    exits: true,
    bound: true,
    step: 'publish' as const,
  },
])(
  'leaves the completed round exactly as completed when a bind writes $name after another bind completed it',
  async ({ at, loses, exits, step, bound = false }) => {
    const { root, dir } = await fixture();
    const tmp = await scratch('t3-transport-');
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const own = syntheticDirectReturn(syntheticStatus());
    let completed: Record<string, unknown> | undefined;
    const { paused, settled } = await pausedAt({
      dir,
      at,
      step,
      own,
      loses,
      exits,
      tmp,
      meanwhile: async () => {
        await expect(
          (await syntheticTools({ dir, tmp })).bind(own),
        ).resolves.toEqual({ bound: true });
        completed = await completeRound({ root, dir });
      },
    });
    expect(paused).toBe(true);
    expect(completed).toHaveProperty(['completed.json']);
    // Every name in the round and every byte of each, unfiltered.
    expect(await snapshot(dir)).toEqual(completed);
    expect(settled.bound).toBe(bound);
    await expect(readT3Review({ dir })).resolves.toBeDefined();
    // The round's parent holds the test's own entries alone.
    expect((await readdir(root)).sort()).toEqual([
      'disposable',
      'durable',
      'report.md',
    ]);
  },
  slow,
);
// Fix r6, both axes, finding 2: the final mode is set on the descriptor right
// after the exclusive create, before the first byte, and nothing changes a
// mode, owner or time by path. A bind that wrote a file under umask 077 (which
// narrows the created mode) and paused right after, while another bind of the
// same return bound and completed the round, changes no mode, time or byte of
// the completed round when it resumes.
it.each([
  // Every step a real process under the umask in the first case; in the
  // second the publication alone.
  { file: 'dispatch-return.json', bound: false },
  { file: 'dispatch.json', bound: true, step: 'publish' as const },
])(
  'leaves every mode, time and byte of the completed round as completed when a bind that wrote $file under umask 077 resumes after another bind completed it',
  async ({ file, bound, step }) => {
    const { root, dir } = await fixture();
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const own = syntheticDirectReturn(syntheticStatus());
    let completed: Record<string, unknown> | undefined;
    const { paused, settled } = await pausedAt({
      dir,
      at: `^${file.replace('.', '\\.')}$`,
      afterWrite: true,
      umask: '077',
      step,
      own,
      meanwhile: async () => {
        await expect(
          (await syntheticTools({ dir })).bind(own),
        ).resolves.toEqual({ bound: true });
        completed = await completeRound({ root, dir });
      },
    });
    expect(paused).toBe(true);
    expect(completed).toHaveProperty(['completed.json']);
    // Every name, mode, modification time and byte, unfiltered.
    expect(await snapshot(dir)).toEqual(completed);
    expect(settled.bound).toBe(bound);
    await expect(readT3Review({ dir })).resolves.toBeDefined();
  },
  slow,
);
// Fix r5, both reviewers' finding 1: a second round captured at the path the
// fix r4 helper staged its attempts at (the first round's path plus
// `.attempts`) is never touched by a bind of the first round.
it.each(['stage', 'check', 'next', 'bind', 'publish', 'discard'])(
  'leaves a completed round at the old attempts path of another round exactly as completed when that round binds with its %s reply lost',
  async (lost) => {
    const { root, dir, config } = await fixture();
    const tmp = await scratch('t3-transport-');
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const neighbour = `${dir}.attempts`;
    await captureT3Inputs({
      dir: neighbour,
      reviewedCommit: 'c'.repeat(40),
      seen,
      caller: { threadId: 'synthetic:parent' },
      config,
    });
    await (await syntheticTools({ dir: neighbour })).execute('dispatch');
    const completed = await completeRound({ root, dir: neighbour });
    expect(completed).toHaveProperty(['completed.json']);
    const verified = await readT3Review({ dir: neighbour });
    const parent = (await readdir(root)).sort();
    const own = syntheticDirectReturn(syntheticStatus());
    // The lost reply: the step ran, its answer never reached code mode (for
    // discard, another task's return makes the bind fail and discard run).
    const broken = await syntheticTools({
      dir,
      tmp,
      ...(lost === 'discard'
        ? { status: { ...syntheticStatus(), ...otherTask } }
        : {}),
      mutateExec: async ({ cmd }, run) => {
        if (!cmd.includes(`"action":"${lost}"`)) return undefined;
        await run();
        return { exit_code: 1, output: 'connection lost' };
      },
    });
    await expect(
      broken.bind(
        lost === 'discard'
          ? syntheticDirectReturn({ ...syntheticStatus(), ...otherTask })
          : own,
      ),
    ).rejects.toThrow(
      lost === 'discard'
        ? 'Original-message thread/parent/run differs'
        : 'connection lost',
    );
    // Binding once more with the round's own return succeeds.
    await expect(
      (await syntheticTools({ dir, tmp })).bind(own),
    ).resolves.toEqual({ bound: true });
    // A refused bind and a bind on the completed neighbour change nothing.
    await expect(
      (await syntheticTools({ dir, tmp })).bind(
        syntheticDirectReturn({ ...syntheticStatus(), summary: 'x' }),
      ),
    ).rejects.toThrow('differs from the saved one');
    await expect(
      (await syntheticTools({ dir: neighbour, tmp })).bind(own),
    ).rejects.toThrow('completed round');
    expect(await snapshot(neighbour)).toEqual(completed);
    expect(await readT3Review({ dir: neighbour })).toEqual(verified);
    expect((await readdir(root)).sort()).toEqual(parent);
  },
  slow,
);
// Fix r5, transport files: the return and the reads handed to the bridge
// outside the bounded payloads live in private directories made with mkdtemp
// in the system temporary directory, which the attempt removes.
it(
  'transports the return and the reads through private temporary directories of the attempt, and removes them',
  async () => {
    const { root, dir } = await fixture();
    const tmp = await scratch('t3-transport-');
    const { stat } = await import('node:fs/promises');
    const { syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const own = syntheticDirectReturn(syntheticStatus());
    const parent = (await readdir(root)).sort();
    const seenThere: { name: string; files: string[]; mode: number }[] = [];
    const { paused, settled } = await pausedAt({
      dir,
      at: '^dispatch\\.json$',
      own,
      tmp,
      meanwhile: async () => {
        for (const name of await transports(tmp))
          seenThere.push({
            name,
            files: await readdir(join(tmp, name)),
            mode: (await stat(join(tmp, name))).mode & 0o777,
          });
      },
    });
    expect(paused).toBe(true);
    expect(settled).toEqual({ bound: true });
    expect(seenThere.map(({ files }) => files.join()).sort()).toEqual([
      'evidence.json',
      'return.json',
    ]);
    for (const { name, mode } of seenThere) {
      expect(name).toMatch(/^t3-review-transport-[A-Za-z0-9]{6}$/);
      expect(mode).toBe(0o700);
    }
    expect(await transports(tmp)).toEqual([]);
    expect((await readdir(root)).sort()).toEqual(parent);
  },
  slow,
);
