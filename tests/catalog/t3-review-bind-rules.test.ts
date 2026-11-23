// @vitest-environment node
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanUp,
  fixture,
  otherTask,
  scratch,
  settle,
  slow,
  snapshot,
  transports,
} from './t3-review-harness';

/**
 * Bind's rules 2 to 4 (a completed round, the same return on an intact
 * binding, any other dispatch.json), intact meaning byte-equal, writes
 * interrupted part-way, and the bounded bridge payloads. Rules 2, 3 and 4,
 * byte-equal intact (for each file) and the largest payload keep one test
 * through the real bridge (bridge: 'process'); a write cut by a file-size
 * limit runs its publish step in a real process; the rest run the bridge's
 * actions in this process (t3-bridge-in-process.ts).
 */
// The tests that run real bridge processes take the limit CI gives them,
// locally too (each start is a node process under tsx).
vi.setConfig({ testTimeout: slow });
afterEach(cleanUp);
// Bind writes the return, then the binding, each directly into the round with
// an exclusive create; a write interrupted part-way leaves a partial file
// there, which no later bind accepts (the round is abandoned).
const fileBlock = 1024; // bash's `ulimit -f` unit outside POSIX mode
async function sizeOf(path: string) {
  const { stat } = await import('node:fs/promises');
  return (await stat(path)).size;
}
it.each([
  {
    write: 'the dispatch return',
    blocks: 1,
    partial: 'dispatch-return.json',
    refusal: 'differs from the saved one',
  },
  {
    write: 'the binding',
    blocks: 8,
    partial: 'dispatch.json',
    refusal: 'A dispatch.json exists and was not acknowledged',
  },
])(
  'declines every later bind of a round where a bind was interrupted while writing $write, leaving the partial file as it is',
  async ({ blocks, partial, refusal }) => {
    // A 6,000-unit task makes the binding (its reads) larger than the return.
    const { root, dir } = await fixture({ prefix: 'p'.repeat(6000) });
    const tmp = await scratch('t3-transport-');
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const status = { ...syntheticStatus(), summary: 's'.repeat(1500) };
    const returned = syntheticDirectReturn(status);
    // The real bridge's publication runs with a file-size limit, so the write
    // that crosses it fails part-way, as a full disk or a killed process
    // would leave it (the steps before it stage the return and the reads
    // unlimited).
    const broken = await syntheticTools({
      dir,
      status,
      tmp,
      mutateExec: ({ cmd }, run) =>
        cmd.includes('"action":"publish"')
          ? run(`ulimit -f ${blocks}; ${cmd}`)
          : undefined,
    });
    await expect(broken.bind(returned)).rejects.toThrow('T3 bridge failed');
    // The limit fell where the test name says: inside the file it names.
    const limit = blocks * fileBlock;
    expect(await sizeOf(join(dir, partial))).toBe(limit);
    if (blocks === 8)
      expect(await readFile(join(dir, 'dispatch-return.json'))).toEqual(
        Buffer.from(`${JSON.stringify(returned, null, 2)}\n`),
      );
    const before = await snapshot(dir);
    const parent = (await readdir(root)).sort();
    for (const attempt of [1, 2]) {
      const again = await syntheticTools({ dir, status, tmp });
      await expect(again.bind(returned)).rejects.toThrow(refusal);
      expect(await snapshot(dir), `bind ${attempt}`).toEqual(before);
    }
    expect((await readdir(root)).sort()).toEqual(parent);
    expect(
      (await readdir(dir)).filter((name) => !/^input-\d+$/.test(name)).sort(),
    ).toEqual(
      [
        'dispatch-return.json',
        ...(blocks === 8 ? ['dispatch.json'] : []),
        'inputs.json',
        'manifest.json',
        'request.json',
        'reviewed-records.json',
      ].sort(),
    );
    expect(broken.requests).toHaveLength(0);
  },
);
// Fix r6, both axes, finding 1: intact means byte-equal. A saved
// dispatch-return.json matches only if its bytes are the bytes bind writes for
// the supplied return (with none supplied, for what they parse to), and a
// dispatch.json is an intact binding only if its bytes are the canonical
// serialization bind writes for what it parses to, final newline included.
// Anything else is declined with nothing written; completion refuses such a
// binding too.
const reshaped = [
  {
    change: 'one byte cut before its final newline',
    reshape: (bytes: Buffer) =>
      Buffer.concat([bytes.subarray(0, -2), Buffer.from('\n')]),
  },
  {
    change: 'its final newline cut',
    reshape: (bytes: Buffer) => bytes.subarray(0, -1),
  },
  {
    change: 'a trailing space added',
    reshape: (bytes: Buffer) => Buffer.concat([bytes, Buffer.from(' ')]),
  },
  {
    change: 'a trailing newline added',
    reshape: (bytes: Buffer) => Buffer.concat([bytes, Buffer.from('\n')]),
  },
  {
    change: 'compact whitespace',
    reshape: (bytes: Buffer) =>
      Buffer.from(`${JSON.stringify(JSON.parse(bytes.toString('utf8')))}\n`),
  },
  {
    change: 'four-space indentation',
    reshape: (bytes: Buffer) =>
      Buffer.from(
        `${JSON.stringify(JSON.parse(bytes.toString('utf8')), null, 4)}\n`,
      ),
  },
];
it.each(reshaped)(
  'declines a bind whose saved dispatch-return.json has $change, with the return supplied or not, writing nothing',
  async ({ change, reshape }) => {
    const { dir } = await fixture();
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const own = syntheticDirectReturn(syntheticStatus());
    // Byte-equal intact (the saved return) once through the real bridge.
    const bridge = change === reshaped[0]?.change ? 'process' : 'in-process';
    // As an earlier write left it, with no binding yet.
    await writeFile(
      join(dir, 'dispatch-return.json'),
      reshape(Buffer.from(`${JSON.stringify(own, null, 2)}\n`)),
      { mode: 0o444 },
    );
    const before = await snapshot(dir);
    for (const supplied of [own, undefined]) {
      const world = await syntheticTools({ dir, bridge });
      await expect(world.bind(supplied)).rejects.toThrow(
        supplied === undefined
          ? 'The saved T3 dispatch return is not the bytes bind writes for it'
          : 'Supplied T3 dispatch return differs from the saved one',
      );
      expect(world.configures).toHaveLength(0);
      expect(world.statuses).toHaveLength(0);
      expect(await snapshot(dir)).toEqual(before);
    }
  },
);
it.each(reshaped)(
  'declines every bind and the completion of a round whose dispatch.json has $change, writing nothing',
  async ({ change, reshape }) => {
    const { root, dir } = await fixture();
    const { chmod } = await import('node:fs/promises');
    // Byte-equal intact (the binding) once through the real bridge.
    const bridge = change === reshaped[0]?.change ? 'process' : 'in-process';
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const own = syntheticDirectReturn(syntheticStatus());
    await (await syntheticTools({ dir })).execute('dispatch');
    const path = join(dir, 'dispatch.json');
    const whole = await readFile(path);
    await chmod(path, 0o644);
    await writeFile(path, reshape(whole));
    await chmod(path, 0o444);
    const report = join(root, 'report.md');
    await writeFile(report, 'Synthetic review report.\n');
    const before = await snapshot(dir);
    for (const attempt of [1, 2]) {
      const world = await syntheticTools({ dir, bridge });
      await expect(world.bind(own), `bind ${attempt}`).rejects.toThrow(
        'A dispatch.json exists and was not acknowledged',
      );
      expect(world.statuses).toHaveLength(0);
      expect(await snapshot(dir)).toEqual(before);
    }
    await expect(
      (await syntheticTools({ dir, bridge })).execute('complete', report),
    ).rejects.toThrow('dispatch.json is not the canonical form');
    expect(await snapshot(dir)).toEqual(before);
  },
);
it("treats bind again with the same return as success after the bind's acknowledgment is lost", async () => {
  const { root, dir } = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const lost = await syntheticTools({
    dir,
    mutateExec: async ({ cmd }, run) => {
      if (!cmd.includes('"action":"publish"')) return undefined;
      await run();
      return { exit_code: 1, output: 'connection lost' };
    },
  });
  await expect(lost.execute('dispatch')).rejects.toThrow('connection lost');
  const bound = await snapshot(dir);
  expect(await readdir(dir)).toContain('dispatch.json');
  // Rule 3 (a repeat is success) through the real bridge.
  const retry = await syntheticTools({ dir, bridge: 'process' });
  await expect(retry.bind(lost.returns[0])).resolves.toEqual({ bound: true });
  expect(await snapshot(dir)).toEqual(bound);
  // A different return is still refused.
  const { syntheticDirectReturn, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  await expect(
    retry.bind(syntheticDirectReturn({ ...syntheticStatus(), summary: 'x' })),
  ).rejects.toThrow('differs from the saved one');
  expect(await snapshot(dir)).toEqual(bound);
  const report = join(root, 'report.md');
  await writeFile(report, 'Synthetic review report.\n');
  await expect(retry.execute('complete', report)).resolves.toMatchObject({
    runId: expect.stringMatching(/^t3-review-/),
  });
});
// Fix r3: nothing in a round is ever replaced. A round holding a partial or
// invalid dispatch.json is refused by every bind and abandoned (fix r2's test
// asserted that the binding was repaired once the checks passed again).
it(
  'refuses a round holding a partial dispatch.json, even with its own return, writing nothing',
  async () => {
    const { dir } = await fixture();
    const { chmod } = await import('node:fs/promises');
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const first = await syntheticTools({ dir });
    await first.execute('dispatch');
    // As an interrupted write by the earlier helper left it: cut short.
    const whole = await readFile(join(dir, 'dispatch.json'));
    await chmod(join(dir, 'dispatch.json'), 0o644);
    await writeFile(join(dir, 'dispatch.json'), whole.subarray(0, 300));
    await chmod(join(dir, 'dispatch.json'), 0o444);
    const partial = await snapshot(dir);
    // Rule 4 (any other binding is refused) through the real bridge.
    const own = await syntheticTools({ dir, bridge: 'process' });
    await expect(
      own.bind(syntheticDirectReturn(syntheticStatus())),
    ).rejects.toThrow('dispatch.json exists');
    expect(own.configures).toHaveLength(0);
    expect(own.statuses).toHaveLength(0);
    expect(own.reads).toHaveLength(0);
    expect(await snapshot(dir)).toEqual(partial);
  },
  slow,
);
// The supplied return goes to the bridge once, alone: the bounded status and
// observation payloads stay within the range the saved return allowed.
function bridgePayloads(cmds: string[], action: string) {
  return cmds
    .map((cmd) => cmd.slice(cmd.indexOf("'") + 1, cmd.lastIndexOf("'")))
    .filter((payload) => payload.includes(`"action":"${action}"`))
    .map((payload) => Buffer.byteLength(payload.replace(/'\\''/g, "'")));
}
it('binds a 14,800-unit CJK task with a 3.5 KB summary supplied directly', async () => {
  const { dir } = await fixture({ prefix: '審'.repeat(13650) });
  const { syntheticTools, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const frozen = z
    .object({ task: z.string() })
    .parse(JSON.parse(await readFile(join(dir, 'request.json'), 'utf8')));
  expect(frozen.task.length).toBeGreaterThan(14700);
  expect(frozen.task.length).toBeLessThan(14900);
  const status = { ...syntheticStatus(), summary: 's'.repeat(3500) };
  const cmds: string[] = [];
  const adapter = await syntheticTools({
    dir,
    status,
    mutateExec: ({ cmd }) => {
      cmds.push(cmd);
      return undefined;
    },
  });
  await expect(adapter.execute('dispatch')).resolves.toEqual({ bound: true });
  const binds = bridgePayloads(cmds, 'bind');
  expect(binds).toHaveLength(1);
  const bind = binds[0] ?? 0;
  const supplied = Buffer.byteLength(JSON.stringify(adapter.returns[0]));
  // The case: adding the return to the bind payload would cross the bound.
  expect(bind).toBeLessThanOrEqual(60000);
  expect(bind + supplied).toBeGreaterThan(60000);
});
it('binds a direct return in a round sized as the archived f7fe97fc… one, whose bind payload was 58,286 bytes', async () => {
  // That round's shape: a 9,098-unit original read in five pages and a
  // 2,360-byte return; a longer status summary takes the earlier helper's
  // bind payload to 58,286 bytes, which the return would have taken past the
  // bound. The payload is that size again: it carries no return or attempt,
  // and the first read's `afterPosition: -1` is a constant of the read that
  // the bridge restores, not a part of the payload.
  const { dir } = await fixture({ prefix: 'q'.repeat(7948) });
  const { syntheticTools, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  // The payload carries the round's path, so the summary takes up its length.
  const status = {
    ...syntheticStatus(),
    summary: 's'.repeat(43802 - Buffer.byteLength(dir)),
  };
  const cmds: string[] = [];
  const adapter = await syntheticTools({
    dir,
    status,
    returned: { ...syntheticStatus(), summary: 'r'.repeat(555) },
    mutateExec: ({ cmd }) => {
      cmds.push(cmd);
      return undefined;
    },
  });
  await expect(adapter.execute('dispatch')).resolves.toEqual({ bound: true });
  expect(adapter.frozen.task.length).toBe(9098);
  expect(adapter.reads).toHaveLength(5);
  expect(Buffer.byteLength(JSON.stringify(adapter.returns[0]))).toBe(2360);
  expect(adapter.reads[0]).toMatchObject({ afterPosition: -1 });
  expect(bridgePayloads(cmds, 'bind')).toEqual([58286]);
});
/** The base's first read: the read sent, which starts from the beginning, without its start. */
function baseFirstRead(args: unknown) {
  const { afterPosition, ...base } = z
    .object({ afterPosition: z.literal(-1) })
    .passthrough()
    .parse(args);
  expect(afterPosition).toBe(-1);
  return base;
}
// Fix r3, the payload range (both axes): the bounded status and observation
// payloads of a bind are byte for byte what the base (0158082f) sent for the
// same observations, there `JSON.stringify({ action, response, observations,
// dir })` with action 'next' per step and 'bind' once. The base's first read
// had no position; the first read now starts at the thread's first message
// (`afterPosition: -1`, which the tool is sent), and its payload form is the
// base's: the same read without that constant.
it.each([
  // The Standards reviewer's case: a 15,854-unit task, its bind payload
  // 59,990 bytes on the base; the Spec reviewer's (a 7,948-unit prefix) at
  // the same size; and the largest payload the base accepts.
  { name: 'a 15,854-unit task at 59,990 bytes', task: 15854, bytes: 59990 },
  { name: 'a 7,948-unit prefix at 59,990 bytes', prefix: 7948, bytes: 59990 },
  { name: 'a 15,854-unit task at 60,000 bytes', task: 15854, bytes: 60000 },
])(
  'sends the bounded payloads the base sent for $name, and binds',
  async ({ task, prefix, bytes }) => {
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const round = async () => {
      const calibration = await fixture();
      const base = z
        .object({ task: z.string() })
        .parse(
          JSON.parse(
            await readFile(join(calibration.dir, 'request.json'), 'utf8'),
          ),
        ).task.length;
      return fixture({
        prefix: 'q'.repeat(task === undefined ? (prefix ?? 0) : task - base),
      });
    };
    const run = async (dir: string, summary: number, real = false) => {
      const status = { ...syntheticStatus(), summary: 's'.repeat(summary) };
      const cmds: string[] = [];
      const adapter = await syntheticTools({
        dir,
        status,
        bridge: real ? 'process' : 'in-process',
        mutateExec: ({ cmd }) => {
          cmds.push(cmd);
          return undefined;
        },
      });
      const settled = await settle(
        adapter.bind(syntheticDirectReturn(syntheticStatus())),
      );
      const payloads = cmds
        .map((cmd) =>
          cmd
            .slice(cmd.indexOf("'") + 1, cmd.lastIndexOf("'"))
            .replace(/'\\''/g, "'"),
        )
        .filter((payload) => /^\{"action":"(next|bind)",/.test(payload));
      // A next per step, the last once the original message is complete,
      // then bind with the same observations.
      const steps = adapter.readResults.length;
      const expected = [
        ...Array.from({ length: steps + 1 }, (_, step) => ({
          action: 'next',
          step,
        })),
        { action: 'bind', step: steps },
      ].map(({ action, step }) =>
        JSON.stringify({
          action,
          response: { structuredContent: status },
          observations: adapter.reads.slice(0, step).map((args, index) => ({
            args: index === 0 ? baseFirstRead(args) : args,
            response: adapter.readResults[index],
          })),
          dir,
        }),
      );
      return { settled, payloads, expected };
    };
    // Calibrate the summary on one round, then size it on a second whose
    // path has the same length.
    const sample = await round();
    const sampled = await run(sample.dir, 1000);
    const sampleBytes = Buffer.byteLength(sampled.expected.at(-1) ?? '');
    const sized = await round();
    expect(sized.dir.length).toBe(sample.dir.length);
    // The largest payload the base accepts through the real bridge.
    const { settled, payloads, expected } = await run(
      sized.dir,
      1000 + bytes - sampleBytes,
      bytes === 60000,
    );
    expect(Buffer.byteLength(expected.at(-1) ?? '')).toBe(bytes);
    expect(payloads).toEqual(expected);
    expect(settled).toEqual({ bound: true });
  },
  slow,
);
// t3-bind-read fix r1, Standards 2: the payload form of the first read has
// no start; one that names a position is not taken as that read.
it.each(['next', 'bind'])(
  'refuses a %s payload whose first read names its position',
  async (action) => {
    const { dir } = await fixture();
    const { runBridgeMain } = await import('./t3-bridge-in-process');
    const { syntheticStatus } = await import('./t3-code-mode-fixture');
    const before = await snapshot(dir);
    const run = await runBridgeMain(
      JSON.stringify({
        action,
        response: { structuredContent: syntheticStatus() },
        observations: [
          {
            args: {
              threadId: 'synthetic:thread',
              view: 'messages',
              limit: 1,
              maxCharsPerItem: 2048,
              runLimit: 1,
              afterPosition: 0,
            },
            response: {},
          },
        ],
        dir,
      }),
      await scratch(),
    );
    expect(run).toEqual({
      code: 1,
      stdout: '',
      stderr: 'A bounded payload carries its first read without its start.\n',
    });
    expect(await snapshot(dir)).toEqual(before);
  },
);
// Fix r4, Spec 2: a refusal under rule 4 is not always final, so after any
// refusal bind once more with the same return.
it('binds once more with the same return after rule 4 refused it because another bind published that return meanwhile', async () => {
  const { dir } = await fixture();
  const fs = await import('node:fs');
  const { syncBuiltinESMExports } = await import('node:module');
  const { offerT3DispatchReturn } =
    await import('../../scripts/catalog/t3-review-evidence');
  const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const own = syntheticDirectReturn(syntheticStatus());
  // A has found no saved return and pauses at its completed.json check.
  const stat = fs.promises.stat;
  let release: () => void = () => undefined;
  const reached = new Promise<void>((resolve) => {
    fs.promises.stat = (async (...args: Parameters<typeof stat>) => {
      if (String(args[0]) === join(dir, 'completed.json')) {
        fs.promises.stat = stat;
        syncBuiltinESMExports();
        resolve();
        await new Promise<void>((go) => (release = go));
      }
      return stat(...args);
    }) as typeof stat;
    syncBuiltinESMExports();
  });
  const a = settle(offerT3DispatchReturn({ dir, returned: own }));
  try {
    await reached;
    await expect((await syntheticTools({ dir })).bind(own)).resolves.toEqual({
      bound: true,
    });
  } finally {
    fs.promises.stat = stat;
    syncBuiltinESMExports();
    release();
  }
  // Fix r6, Standards 4: the diagnostic says only what bind compared (an
  // identical binding may already be there) and what to do, as the docs say.
  expect(await a).toMatchObject({
    bound: false,
    error: expect.stringContaining(
      "A dispatch.json exists and was not acknowledged: bind acknowledges one only when the saved return's bytes equal the bytes it writes for the supplied return and the binding's bytes equal their canonical form and name that return's hash; nothing written. Bind once more with the same return; if that is declined too, abandon the round and capture anew.",
    ),
  });
  expect((await a).error).not.toContain('does not bind');
  const bound = await snapshot(dir);
  const again = await syntheticTools({ dir });
  await expect(again.bind(own)).resolves.toEqual({ bound: true });
  expect(again.statuses).toHaveLength(0);
  expect(await snapshot(dir)).toEqual(bound);
});
it('acknowledges the same return on an intact binding before any T3 tool call, after its child has failed', async () => {
  const { dir } = await fixture();
  const { syntheticTools, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const lost = await syntheticTools({
    dir,
    status: { ...syntheticStatus(), status: 'running', workState: 'working' },
    mutateExec: async ({ cmd }, run) => {
      if (!cmd.includes('"action":"publish"')) return undefined;
      await run();
      return { exit_code: 1, output: 'connection lost' };
    },
  });
  await expect(lost.execute('dispatch')).rejects.toThrow('connection lost');
  const bound = await snapshot(dir);
  const retry = await syntheticTools({
    dir,
    status: {
      ...syntheticStatus(),
      status: 'failed',
      latestTerminalStatus: 'failed',
    },
  });
  await expect(retry.bind(lost.returns[0])).resolves.toEqual({ bound: true });
  // Not even the caller is read (Spec r3, 2).
  expect(retry.configures).toHaveLength(0);
  expect(retry.statuses).toHaveLength(0);
  expect(retry.reads).toHaveLength(0);
  expect(await snapshot(dir)).toEqual(bound);
});
it.each([
  ['with dispatch.json missing', true],
  ['with its binding intact', false],
])(
  'refuses to bind a completed round %s, writing nothing',
  async (_name, removeBinding) => {
    const { root, dir } = await fixture();
    const { cp } = await import('node:fs/promises');
    const { syntheticTools } = await import('./t3-code-mode-fixture');
    const adapter = await syntheticTools({ dir });
    await adapter.execute('dispatch');
    const report = join(root, 'report.md');
    await writeFile(report, 'Synthetic review report.\n');
    await adapter.execute('complete', report);
    // An incomplete copy of the completed round.
    const copy = join(root, 'copy');
    await cp(dir, copy, { recursive: true });
    if (removeBinding) await rm(join(copy, 'dispatch.json'));
    const before = await snapshot(copy);
    // Rule 2 (a completed round is refused) once through the real bridge.
    const retry = await syntheticTools({
      dir: copy,
      bridge: removeBinding ? 'process' : 'in-process',
    });
    await expect(retry.bind(adapter.returns[0])).rejects.toThrow(
      'completed round',
    );
    expect(retry.statuses).toHaveLength(0);
    expect(await snapshot(copy)).toEqual(before);
  },
);
it('ignores temporary files a dead attempt left and never reads one as a return', async () => {
  const { dir } = await fixture();
  const { chmod } = await import('node:fs/promises');
  const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const foreign = `${JSON.stringify(
    syntheticDirectReturn({ ...syntheticStatus(), ...otherTask }),
    null,
    2,
  )}\n`;
  const leftovers = [
    'dispatch-return.json.offer-0123456789abcdef',
    'dispatch.json.evidence-0123456789abcdef',
    'dispatch-return.json.0123456789abcdef.tmp',
    'dispatch.json.0123456789abcdef.tmp',
    'dispatch-return.pending.json',
  ];
  // Left inside the round by an earlier helper, and in transport directories
  // of the system temporary directory by a dead attempt of this one.
  const { mkdir } = await import('node:fs/promises');
  const tmp = await scratch('t3-transport-');
  const stray = join(tmp, 't3-review-transport-AAAAAA');
  await mkdir(stray);
  const places = [
    ...leftovers.map((name) => join(dir, name)),
    ...['return.json', 'evidence.json'].map((name) => join(stray, name)),
  ];
  for (const path of places) {
    await writeFile(path, foreign);
    await chmod(path, 0o444);
  }
  const own = await syntheticTools({ dir, tmp });
  await expect(own.execute('dispatch')).resolves.toEqual({ bound: true });
  expect(
    JSON.parse(await readFile(join(dir, 'dispatch-return.json'), 'utf8')),
  ).toEqual(syntheticDirectReturn(syntheticStatus()));
  for (const path of places) expect(await readFile(path, 'utf8')).toBe(foreign);
  expect(await transports(tmp)).toEqual(['t3-review-transport-AAAAAA']);
});
