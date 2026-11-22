// @vitest-environment node
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { runT3ReviewCodeMode } from '../../scripts/catalog/t3-review-code-mode';
import { afterEach, expect, expectTypeOf, it } from 'vitest';
import earlier from '../fixtures/review-766/earlier-762-spec.json';
import {
  captureT3Inputs,
  bindT3Dispatch,
  completeT3Review,
  readT3Review,
} from '../../scripts/catalog/t3-review-evidence';
import {
  cleanUp,
  fixture,
  resizeSyntheticCapture,
  seen,
  snapshot,
} from './t3-review-harness';
import { author, reviewer } from './t3-code-mode-fixture';

/**
 * T3 review evidence at its entry points, with no bridge: capture and its
 * bounds, the raw bind entry point and its forms, completion's refusals,
 * historical verification and archived v1/v2 evidence. Bind and completion run
 * through the code-mode helper only to set a round up, in this process
 * (t3-bridge-in-process.ts).
 */
afterEach(cleanUp);
const result = () => ({
  taskId: 'node:synthetic:review-766',
  childThreadId: 'thread:synthetic:review-766',
  childNodeId: 'node:synthetic:review-766',
  childRunId: 'run:synthetic:ordinal:1',
  // The fixture's review target, its options as task_status lists them.
  providerInstanceId: 'codex',
  model: 'gpt-6-astra',
  options: [
    { id: 'reasoningEffort', value: 'high' },
    { id: 'serviceTier', value: 'default' },
  ],
  status: 'completed',
  workState: 'result_available',
  hasPendingChildRuns: false,
  latestTerminalRunId: 'run:synthetic:ordinal:1',
  latestTerminalStatus: 'completed',
  hasPendingQuestion: false,
  pendingApproval: null,
  waitTimedOut: false,
  summary: 'Synthetic review confirms the synthetic decision.',
  resultContextTransferId: 'synthetic:result',
});
it('rejects a 15,957-unit compiled task before creating fresh capture artifacts', async () => {
  const { root, dir, config } = await fixture();
  const request = z
    .object({ task: z.string() })
    .parse(JSON.parse(await readFile(join(dir, 'request.json'), 'utf8')));
  const oversized = join(root, 'oversized');
  const task =
    '🦊' + 'x'.repeat(15957 - request.task.length - 2) + config.request.task;
  const before = await readdir(root);
  await expect(
    captureT3Inputs({
      dir: oversized,
      reviewedCommit: 'c'.repeat(40),
      seen,
      caller: { threadId: 'synthetic:parent' },
      config: { ...config, request: { ...config.request, task } },
    }),
  ).rejects.toThrow('Original-message text bound exceeded');
  expect(await readdir(root)).toEqual(before);
});
it('captures, dispatches and verifies a 15,956-unit task as a 16,000-unit review original', async () => {
  const { root, dir: calibration, config, disposable } = await fixture();
  const baseline = z
    .object({ task: z.string() })
    .parse(
      JSON.parse(await readFile(join(calibration, 'request.json'), 'utf8')),
    );
  const task =
    '🦊' + 'x'.repeat(15956 - baseline.task.length - 2) + config.request.task;
  const dir = join(root, 'exact-bound');
  await captureT3Inputs({
    dir,
    reviewedCommit: 'c'.repeat(40),
    seen,
    caller: { threadId: 'synthetic:parent' },
    config: { ...config, request: { ...config.request, task } },
  });
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({ dir });
  expect(adapter.frozen.task.length).toBe(15956);
  expect([...adapter.frozen.task].length).toBe(15955);
  await expect(adapter.execute('dispatch')).resolves.toEqual({ bound: true });
  const binding = z
    .object({ kind: z.string(), original: z.object({ text: z.string() }) })
    .parse(JSON.parse(await readFile(join(dir, 'dispatch.json'), 'utf8')));
  expect(binding.kind).toBe('t3-review-dispatch-v3');
  expect(binding.original.text.length).toBe(16000);
  expect(binding.original.text).toBe(
    'Act as the review sub-agent for this task.\n\n' + adapter.frozen.task,
  );
  const report = join(disposable, 'boundary-report.md');
  await writeFile(report, 'Synthetic exact-boundary report.\n');
  await adapter.execute('complete', report);
  await rm(disposable, { recursive: true });
  expect((await readT3Review({ dir })).report.toString()).toBe(
    'Synthetic exact-boundary report.\n',
  );
});
it('captures durable pre-dispatch inputs without claiming task linkage', async () => {
  const { dir, disposable } = await fixture();
  const records = await readFile(join(dir, 'reviewed-records.json'), 'utf8');
  const inputs = JSON.parse(await readFile(join(dir, 'inputs.json'), 'utf8'));
  expect(JSON.parse(records)).toEqual(seen);
  expect(inputs.author).toEqual(author);
  expect(inputs.kind).toBe('t3-review-inputs-v2');
  expect(inputs.request.task).toContain(inputs.nonce);
  expect(inputs.request.clientRequestId).toMatch(/^t3-review-/);
  const second = await fixture();
  const other = JSON.parse(
    await readFile(join(second.dir, 'inputs.json'), 'utf8'),
  );
  expect(other.nonce).not.toBe(inputs.nonce);
  expect(other.request.clientRequestId).not.toBe(
    inputs.request.clientRequestId,
  );
  await rm(disposable, { recursive: true });
  expect(await readFile(join(dir, 'input-0'), 'utf8')).toBe(
    '{"number":766,"body":"synthetic acceptance"}\n',
  );
  await expect(readFile(join(dir, 'dispatch.json'))).rejects.toThrow();
});
it.each([
  {
    name: 'unchanged earlier real #762 completed task',
    response: earlier.result,
  },
  {
    name: 'foreign running task with the same selection',
    response: { ...earlier.result, status: 'running', workState: 'working' },
  },
  {
    name: 'replayed client request on a different captured request',
    response: earlier.result,
  },
  // Extra claims are deliberately not treated as API correlation metadata.
  {
    name: 'caller-asserted mismatched clientRequestId/task identity',
    response: { ...earlier.result, clientRequestId: 'synthetic-766-r1' },
  },
  { name: 'synthetic same-selection completion', response: result() },
])('rejects $name at INITIAL bind without artifacts', async ({ response }) => {
  const { dir } = await fixture();
  const before = await snapshot(dir);
  await expect(
    bindT3Dispatch({ kind: 'raw', dir, response, observations: undefined }),
  ).rejects.toThrow('request/task correlation');
  expect(await snapshot(dir)).toEqual(before);
});
it.each([15957, 16000])(
  'rejects a pre-fix unbound %i-unit capture before dispatch without changing artifacts',
  async (length) => {
    const { dir } = await fixture();
    await resizeSyntheticCapture({ dir, length });
    const { syntheticTools } = await import('./t3-code-mode-fixture');
    const adapter = await syntheticTools({ dir });
    const before = await snapshot(dir);
    await expect(adapter.execute('dispatch')).rejects.toThrow(
      'Original-message text bound exceeded',
    );
    expect(adapter.requests).toHaveLength(0);
    expect(adapter.reads).toHaveLength(0);
    expect(await snapshot(dir)).toEqual(before);
  },
);
it.each([
  'taskId',
  'childRunId',
  'options',
  'status',
  'workState',
  'hasPendingChildRuns',
  'latestTerminalRunId',
  'latestTerminalStatus',
  'pendingApproval',
])('rejects missing %s before binding', async (key) => {
  const { dir } = await fixture();
  const response = result();
  Reflect.deleteProperty(response, key);
  const before = await snapshot(dir);
  await expect(
    bindT3Dispatch({ kind: 'raw', dir, response, observations: undefined }),
  ).rejects.toThrow();
  expect(await snapshot(dir)).toEqual(before);
});
it.each(['inputs.json', 'reviewed-records.json', 'input-0'])(
  'detects changed frozen %s before attempting a bind',
  async (name) => {
    const { dir } = await fixture();
    const { chmod } = await import('node:fs/promises');
    await chmod(join(dir, name), 0o644);
    await writeFile(join(dir, name), '{}');
    await chmod(join(dir, name), 0o444);
    await expect(
      bindT3Dispatch({
        kind: 'raw',
        dir,
        response: result(),
        observations: undefined,
      }),
    ).rejects.not.toThrow('request/task correlation');
    await expect(readFile(join(dir, 'dispatch.json'))).rejects.toThrow();
  },
);
it('refuses completion of a pre-existing uncorrelated v1 binding', async () => {
  const { dir } = await fixture();
  const { hashReport } = await import('../../scripts/catalog/review-receipts');
  const { chmod } = await import('node:fs/promises');
  await writeFile(
    join(dir, 'dispatch.json'),
    // In the canonical form, so completion reaches the correlation check.
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        inputsSha256: hashReport(await readFile(join(dir, 'inputs.json'))),
        response: earlier.result,
      },
      null,
      2,
    )}\n`,
  );
  await chmod(join(dir, 'dispatch.json'), 0o444);
  const before = await snapshot(dir);
  await expect(
    completeT3Review({
      dir,
      response: earlier.result,
      report: Buffer.from('Existing ordinary report'),
    }),
  ).rejects.toThrow('request/task correlation');
  expect(await snapshot(dir)).toEqual(before);
});
it('refuses previously completed v1 evidence on read/verify, without a compatibility exemption', async () => {
  const { dir } = await fixture();
  const { hashReport } = await import('../../scripts/catalog/review-receipts');
  const { chmod } = await import('node:fs/promises');
  const inputsSha256 = hashReport(await readFile(join(dir, 'inputs.json')));
  const dispatch = Buffer.from(
    JSON.stringify({
      capturedAt: new Date().toISOString(),
      inputsSha256,
      response: earlier.result,
    }),
  );
  const status = Buffer.from(JSON.stringify(earlier.result));
  const report = Buffer.from('Ordinary report lacking request correlation');
  const completion = {
    kind: 't3-review-completed-v1',
    capturedAt: new Date().toISOString(),
    inputsSha256,
    dispatchSha256: hashReport(dispatch),
    statusSha256: hashReport(status),
    reportSha256: hashReport(report),
  };
  for (const [name, bytes] of [
    ['dispatch.json', dispatch],
    ['status.json', status],
    ['report.snapshot.md', report],
    ['completed.json', Buffer.from(JSON.stringify(completion))],
  ] as const) {
    await writeFile(join(dir, name), bytes);
    await chmod(join(dir, name), 0o444);
  }
  await expect(readT3Review({ dir })).rejects.toThrow(
    'request/task correlation',
  );
});

it.each([
  // Zod's messages: no reads to parse, and a status with no taskId.
  [
    'an imported status with no original-message reads',
    () => result(),
    'expected array, received undefined',
  ],
  [
    'a malformed status',
    () => ({ status: 'completed' }),
    'expected string, received undefined',
  ],
])(
  'refuses %s at the raw bind entry point against an intact binding',
  async (_name, response, message) => {
    const { dir } = await fixture();
    const { syntheticTools } = await import('./t3-code-mode-fixture');
    await (await syntheticTools({ dir })).execute('dispatch');
    const bound = await snapshot(dir);
    await expect(
      bindT3Dispatch({
        kind: 'raw',
        dir,
        response: response(),
        observations: undefined,
      }),
    ).rejects.toThrow(message);
    expect(await snapshot(dir)).toEqual(bound);
  },
);
it.each([
  ['running', { status: 'running', workState: 'working' }],
  ['failed', { status: 'failed' }],
  ['interrupted', { status: 'interrupted' }],
  ['cancelled', { status: 'cancelled' }],
  ['later terminal', { latestTerminalRunId: 'synthetic:run:2' }],
  ['missing original', { childRunId: null }],
  ['pending children', { hasPendingChildRuns: true }],
  ['waiting children', { workState: 'waiting_for_children' }],
  ['pending question', { hasPendingQuestion: true }],
  [
    'pending approval',
    {
      pendingApproval: {
        kind: 'command',
        requestId: 'synthetic:approval',
        runId: 'synthetic:run:1',
      },
    },
  ],
  ['missing summary', { summary: null }],
  ['missing transfer', { resultContextTransferId: null }],
  ['changed task', { taskId: 'foreign:task' }],
  ['changed thread', { childThreadId: 'foreign:thread' }],
  ['changed node', { childNodeId: 'foreign:node' }],
])(
  'refuses terminal %s without changing existing evidence or report',
  async (_name, change) => {
    const { dir } = await fixture();
    const { syntheticTools, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    await (await syntheticTools({ dir })).execute('dispatch');
    const before = await snapshot(dir);
    await expect(
      completeT3Review({
        dir,
        response: { ...syntheticStatus(), ...change },
        report: Buffer.from('Synthetic review'),
      }),
    ).rejects.toThrow();
    expect(await snapshot(dir)).toEqual(before);
  },
);
it.each([
  'input-0',
  'reviewed-records.json',
  'manifest.json',
  'request.json',
  'inputs.json',
  'dispatch-return.json',
  'dispatch.json',
  'status.json',
  'report.snapshot.md',
  'completed.json',
])(
  'detects downstream tamper of %s on historical verification',
  async (name) => {
    const { dir } = await fixture();
    const { syntheticTools, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    await (await syntheticTools({ dir })).execute('dispatch');
    await completeT3Review({
      dir,
      response: syntheticStatus(),
      report: Buffer.from('Synthetic review'),
    });
    const { chmod } = await import('node:fs/promises');
    await chmod(join(dir, name), 0o644);
    await writeFile(join(dir, name), '{}');
    await chmod(join(dir, name), 0o444);
    const before = await snapshot(dir);
    await expect(readT3Review({ dir })).rejects.toThrow();
    expect(await snapshot(dir)).toEqual(before);
  },
);
it('admits a dispatch return in the type of bind only', () => {
  type Run = Parameters<typeof runT3ReviewCodeMode>[0];
  const accepts = (args: Run) => args.operation;
  const check = (common: Pick<Run, 'tools' | 'root' | 'dir'>) => [
    accepts({ ...common, operation: 'bind', returned: {} }),
    // @ts-expect-error prepare takes no dispatch return
    accepts({ ...common, operation: 'prepare', returned: {} }),
    // @ts-expect-error capture takes no dispatch return
    accepts({ ...common, operation: 'capture', config: 'c', returned: {} }),
    // @ts-expect-error complete takes no dispatch return
    accepts({ ...common, operation: 'complete', report: 'r', returned: {} }),
  ];
  expectTypeOf(check).returns.toEqualTypeOf<Run['operation'][]>();
});
// Fix r4, Standards 2: bind takes its raw form or its staged form, whole.
it('types bind as its raw form or its staged form, never a mix or a part', () => {
  type Bind = Parameters<typeof bindT3Dispatch>[0];
  const accepts = (args: Bind) => args.dir;
  const dir = 'round';
  const check = () => [
    accepts({ kind: 'raw', dir, response: {}, observations: [] }),
    accepts({ kind: 'raw', dir, response: {}, observations: [], returned: {} }),
    accepts({ kind: 'staged', dir, offer: 'a', evidence: 'b', temporary: 't' }),
    // @ts-expect-error the staged form names the TMPDIR its check accepted
    accepts({ kind: 'staged', dir, offer: 'a', evidence: 'b' }),
    // @ts-expect-error neither form
    accepts({ dir }),
    // @ts-expect-error the form is named by its kind
    accepts({ dir, response: {}, observations: [] }),
    // @ts-expect-error the form is named by its kind
    accepts({ dir, offer: 'a', evidence: 'b' }),
    // @ts-expect-error the staged form needs its evidence
    accepts({ kind: 'staged', dir, offer: 'a', temporary: 't' }),
    // @ts-expect-error the staged form needs its offer
    accepts({ kind: 'staged', dir, evidence: 'b', temporary: 't' }),
    // @ts-expect-error the raw form needs its reads, even when absent
    accepts({ kind: 'raw', dir, response: {} }),
    // @ts-expect-error no mix: a staged offer with a raw status
    accepts({
      kind: 'staged',
      dir,
      offer: 'a',
      evidence: 'b',
      temporary: 't',
      response: {},
    }),
    // @ts-expect-error no mix: a raw return with a staged evidence
    accepts({
      kind: 'raw',
      dir,
      response: {},
      observations: [],
      evidence: 'b',
    }),
    // @ts-expect-error no mix: the raw form under the staged kind
    accepts({ kind: 'staged', dir, response: {}, observations: [] }),
  ];
  expectTypeOf(check).returns.toEqualTypeOf<string[]>();
});
it.each([
  [
    'a staged offer with a raw status',
    {
      kind: 'staged',
      offer: tmpdir(),
      evidence: tmpdir(),
      temporary: tmpdir(),
      response: {},
    },
  ],
  ['a staged offer alone', { kind: 'staged', offer: tmpdir() }],
  [
    'a staged form naming no temporary directory',
    { kind: 'staged', offer: tmpdir(), evidence: tmpdir() },
  ],
  ['neither form', {}],
  ['the raw form with no kind', { response: {}, observations: [] }],
  [
    'the staged form under the raw kind',
    { kind: 'raw', offer: tmpdir(), evidence: tmpdir() },
  ],
])('refuses %s at bind, writing nothing', async (_name, args) => {
  const { dir } = await fixture();
  const before = await snapshot(dir);
  // Called as untyped JavaScript (the bridge's publish step) could call it.
  const untyped = bindT3Dispatch as (args: object) => Promise<void>;
  await expect(untyped({ dir, ...args })).rejects.toThrow(
    'Bind takes its raw form or its staged form',
  );
  expect(await snapshot(dir)).toEqual(before);
});
// Fix r5: the staged form names private transport directories of the system
// temporary directory; bind reads no other path, whatever it is handed.
it.each([
  [
    'the old attempts path beside the round',
    (dir: string) => `${dir}.attempts`,
  ],
  ['the round itself', (dir: string) => dir],
  ['a fix r4 staged id', () => '0123456789abcdef'],
  [
    'a directory nested in a transport directory',
    () => join(tmpdir(), 't3-review-transport-AAAAAA', 'nested'),
  ],
])('refuses a staged form naming %s, writing nothing', async (_name, path) => {
  const { dir } = await fixture();
  const before = await snapshot(dir);
  await expect(
    bindT3Dispatch({
      kind: 'staged',
      dir,
      offer: path(dir),
      evidence: path(dir),
      temporary: tmpdir(),
    }),
  ).rejects.toThrow('not a transport directory');
  expect(await snapshot(dir)).toEqual(before);
});
it('fails closed when complete timeline recovery exceeds its read bound', async () => {
  const { dir } = await fixture();
  const { syntheticStatus, syntheticPage } =
    await import('./t3-code-mode-fixture');
  const { nextT3OriginalRead } =
    await import('../../scripts/catalog/t3-review-evidence');
  const base = {
    threadId: 'synthetic:thread',
    view: 'messages',
    limit: 1,
    maxCharsPerItem: 2048,
    runLimit: 1,
  };
  const observations = Array.from({ length: 32 }, (_, i) => ({
    args: { ...base, afterPosition: i - 1 },
    response: {
      ...syntheticPage({ task: '' }),
      items: [],
      hasMore: true,
      nextPosition: i,
    },
  }));
  const before = await snapshot(dir);
  await expect(
    nextT3OriginalRead({
      dir,
      response: syntheticStatus(),
      observations,
    }),
  ).rejects.toThrow('read bound');
  expect(await snapshot(dir)).toEqual(before);
});
it('requires independent original-message observations even with a supplied return', async () => {
  const { dir } = await fixture();
  const { syntheticStatus } = await import('./t3-code-mode-fixture');
  const before = await snapshot(dir);
  await expect(
    bindT3Dispatch({
      kind: 'raw',
      dir,
      response: syntheticStatus(),
      observations: undefined,
      returned: syntheticStatus(),
    }),
  ).rejects.toThrow();
  expect(await snapshot(dir)).toEqual(before);
});
it.each(['clientRequestId', 'nonce'])(
  'rejects caller-chosen %s before creating a capture',
  async (key) => {
    const { root, issue } = await fixture();
    const dir = join(root, 'caller-chosen');
    await expect(
      captureT3Inputs({
        dir,
        reviewedCommit: 'c'.repeat(40),
        seen,
        caller: { threadId: 'synthetic:parent' },
        config: {
          author,
          request: {
            role: 'review',
            mode: 'async',
            target: reviewer,
            task: `Review ${'c'.repeat(40)}`,
            [key]: 'reusable',
          },
          inputs: [
            {
              kind: 'issue',
              identity: 'synthetic:766',
              fetchedAt: new Date().toISOString(),
              path: issue,
            },
          ],
        },
      }),
    ).rejects.toThrow();
    const { stat } = await import('node:fs/promises');
    await expect(stat(dir)).rejects.toThrow();
  },
);
it('rejects an empty or oversized completed report before writing any completion outputs', async () => {
  const { dir } = await fixture();
  const { syntheticTools, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  await (await syntheticTools({ dir })).execute('dispatch');
  const before = await snapshot(dir);
  for (const report of [Buffer.from(' '), Buffer.alloc(1000001, 'x')]) {
    await expect(
      completeT3Review({ dir, response: syntheticStatus(), report }),
    ).rejects.toThrow();
    expect(await snapshot(dir)).toEqual(before);
  }
});
it('binds its own running original request and later completes that same run', async () => {
  const { dir, disposable } = await fixture();
  const { syntheticTools, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const running = {
    ...syntheticStatus(),
    status: 'running',
    workState: 'working',
    latestTerminalRunId: null,
    latestTerminalStatus: null,
    summary: null,
    resultContextTransferId: null,
  };
  await (
    await syntheticTools({ dir, returned: running, status: running })
  ).execute('dispatch');
  await rm(disposable, { recursive: true });
  await completeT3Review({
    dir,
    response: syntheticStatus(),
    report: Buffer.from('Synthetic original-run report'),
  });
  expect((await readT3Review({ dir })).report.toString()).toBe(
    'Synthetic original-run report',
  );
});
it('rechecks archived origin/lineage during completion even if its local binding hash is recomputed', async () => {
  const { dir } = await fixture();
  const { syntheticTools, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  await (await syntheticTools({ dir })).execute('dispatch');
  const { chmod } = await import('node:fs/promises');
  const path = join(dir, 'dispatch.json');
  const binding = JSON.parse(await readFile(path, 'utf8'));
  binding.observations[0].response.structuredContent.items[0].senderThreadId =
    'foreign:parent';
  await chmod(path, 0o644);
  // In the canonical form, so completion reaches the lineage check.
  await writeFile(path, `${JSON.stringify(binding, null, 2)}\n`);
  await chmod(path, 0o444);
  const before = await snapshot(dir);
  await expect(
    completeT3Review({
      dir,
      response: syntheticStatus(),
      report: Buffer.from('Synthetic report'),
    }),
  ).rejects.toThrow('sender/source/run');
  expect(await snapshot(dir)).toEqual(before);
});
it.each([
  { name: 'short', length: null },
  { name: '16,000-unit', length: 16000 },
])(
  'replays an archived v2 $name bare original without rewriting its binding bytes',
  async ({ length }) => {
    // Entirely synthetic historical fixture in the previous serialized format.
    // No real failed capture or correlation evidence is retrofitted.
    const { dir, disposable } = await fixture();
    if (length !== null) await resizeSyntheticCapture({ dir, length });
    const { syntheticStatus, syntheticPage } =
      await import('./t3-code-mode-fixture');
    const { hashReport } =
      await import('../../scripts/catalog/review-receipts');
    const inputs = await readFile(join(dir, 'inputs.json'));
    const request = z
      .object({ task: z.string() })
      .parse(JSON.parse(await readFile(join(dir, 'request.json'), 'utf8')));
    const response = { structuredContent: syntheticStatus() };
    // The return a v2-era helper saved before binding.
    await writeFile(
      join(dir, 'dispatch-return.json'),
      JSON.stringify(response, null, 2) + '\n',
      { mode: 0o444, flag: 'wx' },
    );
    const observations = [];
    for (let offset = 0; offset < request.task.length; offset += 2048) {
      observations.push({
        args: {
          threadId: 'synthetic:thread',
          view: 'messages',
          limit: 1,
          maxCharsPerItem: 2048,
          runLimit: 1,
          ...(offset > 0
            ? { itemId: 'synthetic:item:original', textOffset: offset }
            : {}),
        },
        response: {
          structuredContent: syntheticPage({ task: request.task, offset }),
        },
      });
    }
    const bytes =
      JSON.stringify(
        {
          kind: 't3-review-dispatch-v2',
          capturedAt: new Date().toISOString(),
          inputsSha256: hashReport(inputs),
          dispatchReturnSha256: hashReport(
            await readFile(join(dir, 'dispatch-return.json')),
          ),
          response,
          observations,
          original: {
            text: request.task,
            sha256: hashReport(Buffer.from(request.task)),
            itemId: 'synthetic:item:original',
            messageId: 'synthetic:message:original',
          },
        },
        null,
        2,
      ) + '\n';
    await writeFile(join(dir, 'dispatch.json'), bytes, {
      mode: 0o444,
      flag: 'wx',
    });
    const report = join(disposable, 'report.md');
    await writeFile(report, 'Synthetic archived report.\n');
    const { syntheticTools } = await import('./t3-code-mode-fixture');
    const adapter = await syntheticTools({ dir });
    await adapter.execute('complete', report);
    expect(adapter.requests).toHaveLength(0);
    expect(adapter.reads).toHaveLength(0);
    await rm(disposable, { recursive: true });
    expect((await readT3Review({ dir })).report.toString()).toBe(
      'Synthetic archived report.\n',
    );
    expect(await readFile(join(dir, 'dispatch.json'), 'utf8')).toBe(bytes);
  },
);
