// @vitest-environment node
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { z } from 'zod';
import type { runT3ReviewCodeMode } from '../../scripts/catalog/t3-review-code-mode';
import type { syntheticTools as SyntheticTools } from './t3-code-mode-fixture';
import { afterEach, expect, expectTypeOf, it, vi } from 'vitest';
import earlier from '../fixtures/review-766/earlier-762-spec.json';
import earlierOriginal from '../fixtures/review-766/earlier-762-original.json';
import inventory from '../fixtures/t3-code-mode-inventory/recorded-2026-11-20.json';
import {
  captureT3Inputs,
  bindT3Dispatch,
  completeT3Review,
  readT3Review,
} from '../../scripts/catalog/t3-review-evidence';
import type { requireTemporaryDirectoryOutside } from '../../scripts/catalog/t3-review-evidence';

// Synthetic workflow evidence only; no live review or promotion.
/** For tests that run many real bridge processes, or pause one. */
const slow = 120_000;
// Nearly every test here runs real bridge processes, each a node start under
// tsx with its disk cache off (about 0.4 s), so one dispatch can take longer
// than Vitest's 5 s local default under load (7 timed out under capped.sh);
// every test here takes the limit CI gives it, locally too.
vi.setConfig({ testTimeout: slow });
const directories: string[] = [];
afterEach(async () => {
  // A failed test can leave a bridge process it started paused or running.
  const { killSyntheticChildren } = await import('./t3-code-mode-fixture');
  killSyntheticChildren();
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});
const author = {
  providerInstanceId: 'codex',
  model: 'gpt-6.1-sol',
  options: { reasoningEffort: 'high', serviceTier: 'default' },
};
const reviewer = {
  providerInstanceId: 'codex',
  model: 'gpt-6-astra',
  options: { reasoningEffort: 'high', serviceTier: 'default' },
};
const seen = [
  {
    id: 'synthetic decision',
    sources: [{ subject: 'synthetic:source', sourceSha256: 'a'.repeat(64) }],
    payloadSha256: 'b'.repeat(64),
  },
];
const result = () => ({
  taskId: 'node:synthetic:review-766',
  childThreadId: 'thread:synthetic:review-766',
  childNodeId: 'node:synthetic:review-766',
  childRunId: 'run:synthetic:ordinal:1',
  ...reviewer,
  options: Object.entries(reviewer.options).map(([id, value]) => ({
    id,
    value,
  })),
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
/** The transport directories in a bridge temporary directory. */
const transports = async (tmp: string) =>
  (await readdir(tmp)).filter((name) =>
    name.startsWith('t3-review-transport-'),
  );
/** A directory of the test's own, outside every round and its parent. */
async function scratch(prefix = 't3-scratch-') {
  const path = await mkdtemp(join(tmpdir(), prefix));
  directories.push(path);
  return path;
}
async function fixture({
  prefix = '',
  caller = 'synthetic:parent',
  target = reviewer,
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
        fetchedAt: new Date().toISOString(),
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
/**
 * Every name in `dir` with its mode, its modification time and its bytes (a
 * directory's own listing, the same way), so a changed permission or a touch
 * shows as well as changed contents.
 */
async function snapshot(dir: string): Promise<Record<string, unknown>> {
  const { readdir, stat } = await import('node:fs/promises');
  return Object.fromEntries(
    await Promise.all(
      (await readdir(dir)).map(async (name) => {
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
async function resizeSyntheticCapture({
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

it("names only tools code mode exposed on 2026-11-20 and binds the operator's direct delegate_task return", async () => {
  const { dir } = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({ dir });
  const t3 = Object.keys(adapter.tools).filter((name) =>
    name.startsWith('mcp__'),
  );
  expect(t3.sort()).toEqual([
    'mcp__t3_code__t3_thread_configure',
    'mcp__t3_code__t3_thread_read',
    'mcp__t3_code__task_status',
  ]);
  for (const name of t3) expect(inventory.codeMode).toContain(name);
  expect(inventory.codeMode).not.toContain('mcp__t3_code__delegate_task');
  expectTypeOf<
    keyof Parameters<typeof runT3ReviewCodeMode>[0]['tools']
  >().toEqualTypeOf<
    | 'exec_command'
    | 'mcp__t3_code__t3_thread_configure'
    | 'mcp__t3_code__task_status'
    | 'mcp__t3_code__t3_thread_read'
  >();
  await expect(adapter.execute('dispatch')).resolves.toEqual({ bound: true });
  expect(
    JSON.parse(await readFile(join(dir, 'dispatch-return.json'), 'utf8')),
  ).toEqual(adapter.returns[0]);
});
it('binds a direct return supplied as its task object alone, as parsed from the JSON text', async () => {
  const { dir } = await fixture();
  const { syntheticTools, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({ dir });
  await expect(adapter.bind(syntheticStatus())).resolves.toEqual({
    bound: true,
  });
});
// The operator's direct delegate_task return is supplied, so the helper must
// refuse a wrong one without saving it: the round's own return still binds.
async function refusesSupplied({
  dir,
  world,
  supplied,
  message,
}: {
  dir: string;
  world: Awaited<ReturnType<typeof SyntheticTools>>;
  supplied: unknown;
  message: string;
}) {
  const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const before = await snapshot(dir);
  await expect(world.bind(supplied)).rejects.toThrow(message);
  expect(await snapshot(dir)).toEqual(before);
  const own = await syntheticTools({ dir });
  await expect(
    own.bind(syntheticDirectReturn(syntheticStatus())),
  ).resolves.toEqual({ bound: true });
}
const otherTask = {
  taskId: 'synthetic:other-task',
  childThreadId: 'synthetic:other-thread',
  childNodeId: 'synthetic:other-node',
  childRunId: 'synthetic:other-run:1',
  latestTerminalRunId: 'synthetic:other-run:1',
};
it("refuses another task's direct return: its child's original message is another task", async () => {
  const { dir } = await fixture();
  const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const other = { ...syntheticStatus(), ...otherTask };
  const world = await syntheticTools({
    dir,
    status: other,
    task: 'Another review task of the same caller and selection.',
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
  });
  await refusesSupplied({
    dir,
    world,
    supplied: syntheticDirectReturn(other),
    message: 'Original message differs from the full frozen nonce-bearing task',
  });
});
it.each([
  {
    name: 'task text',
    change: (request: Record<string, unknown>) => ({
      ...request,
      task: `${String(request.task)}\nAlso review the rest.`,
    }),
    message: 'Original message differs from the full frozen nonce-bearing task',
  },
  {
    name: 'model',
    change: (request: Record<string, unknown>) => ({
      ...request,
      target: { ...reviewer, model: 'gpt-6.2-sol' },
    }),
    message: 'provider/model/options differ',
  },
  {
    name: 'option',
    change: (request: Record<string, unknown>) => ({
      ...request,
      target: {
        ...reviewer,
        options: { ...reviewer.options, reasoningEffort: 'low' },
      },
    }),
    message: 'provider/model/options differ',
  },
])(
  'refuses the right task sent with a changed $name',
  async ({ change, message }) => {
    const { dir } = await fixture();
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const frozen = z
      .record(z.string(), z.unknown())
      .parse(JSON.parse(await readFile(join(dir, 'request.json'), 'utf8')));
    const sent = z
      .object({
        task: z.string(),
        target: z.object({
          model: z.string(),
          options: z.record(z.string(), z.string()),
        }),
      })
      .parse(change(frozen));
    // T3 runs what was sent: its status and original message follow the change.
    const status = {
      ...syntheticStatus(),
      model: sent.target.model,
      options: Object.entries(sent.target.options).map(([id, value]) => ({
        id,
        value,
      })),
    };
    const world = await syntheticTools({ dir, status, task: sent.task });
    await refusesSupplied({
      dir,
      world,
      supplied: syntheticDirectReturn(status),
      message,
    });
  },
);
it('refuses a direct return whose child belongs to a different caller thread', async () => {
  const { dir } = await fixture();
  const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const world = await syntheticTools({
    dir,
    mutateRead: (page) => ({
      ...page,
      thread: { ...page.thread, parentThreadId: 'synthetic:other-caller' },
      items: page.items.map((item) => ({
        ...item,
        senderThreadId: 'synthetic:other-caller',
      })),
    }),
  });
  await refusesSupplied({
    dir,
    world,
    supplied: syntheticDirectReturn(syntheticStatus()),
    message: 'thread/parent/run differs',
  });
});
it("refuses a direct return replayed from an earlier round on the next round's capture", async () => {
  const first = await fixture();
  const second = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const earlier = await syntheticTools({ dir: first.dir });
  await earlier.execute('dispatch');
  // T3 still says that child's original message is the first round's task.
  const world = await syntheticTools({
    dir: second.dir,
    task: earlier.frozen.task,
  });
  await refusesSupplied({
    dir: second.dir,
    world,
    supplied: earlier.returns[0],
    message: 'Original message differs from the full frozen nonce-bearing task',
  });
});
it('refuses a second supplied return that differs from the one already saved', async () => {
  const { dir } = await fixture();
  const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({ dir });
  await adapter.execute('dispatch');
  const before = await snapshot(dir);
  const changed = syntheticDirectReturn({
    ...syntheticStatus(),
    status: 'running',
    workState: 'working',
  });
  await expect(adapter.bind(changed)).rejects.toThrow(
    'Supplied T3 dispatch return differs from the saved one.',
  );
  await expect(adapter.execute('dispatch')).rejects.toThrow(
    'A dispatch return is already saved',
  );
  expect(adapter.requests).toHaveLength(1);
  expect(await snapshot(dir)).toEqual(before);
});
it('refuses a nested isError direct return even with plausible structured data', async () => {
  const { dir } = await fixture();
  const { syntheticTools, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const world = await syntheticTools({ dir });
  await refusesSupplied({
    dir,
    world,
    supplied: {
      content: [{ type: 'text', text: 'delegate failed' }],
      structuredContent: syntheticStatus(),
      isError: true,
    },
    message: 'tool returned an error',
  });
  expect(world.reads).toHaveLength(0);
});
it('dispatches the exact frozen object and binds an independently recovered original message, including fast completion', async () => {
  const { dir } = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({ dir });
  await expect(adapter.execute('dispatch')).resolves.toEqual({ bound: true });
  const request = JSON.parse(await readFile(join(dir, 'request.json'), 'utf8'));
  expect(adapter.requests).toEqual([request]);
  const binding = JSON.parse(
    await readFile(join(dir, 'dispatch.json'), 'utf8'),
  );
  expect(binding.kind).toBe('t3-review-dispatch-v3');
  expect(binding.original).toMatchObject({
    text: 'Act as the review sub-agent for this task.\n\n' + request.task,
    itemId: 'synthetic:item:original',
    messageId: 'synthetic:message:original',
  });
  const report = join(dir, 'review.md');
  await writeFile(report, 'Synthetic full report.\n');
  await adapter.execute('complete', report);
  expect((await readT3Review({ dir })).report.toString()).toBe(
    'Synthetic full report.\n',
  );
});

// The record step writes this label into every record the review checks; the
// agent-launch guard allowlists it per record file by exact line
// (agent-launch-guard.test.py: a record checked on a gpt-6.2-sol review).
it("labels the record step's output with the model the review ran on", async () => {
  const sol = { ...reviewer, model: 'gpt-6.2-sol' };
  const { dir } = await fixture({ target: sol });
  const { syntheticTools, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({
    dir,
    status: { ...syntheticStatus(), model: sol.model },
  });
  await expect(adapter.execute('dispatch')).resolves.toEqual({ bound: true });
  const report = join(dir, 'review.md');
  await writeFile(report, 'Synthetic full report.\n');
  await adapter.execute('complete', report);
  const { run } = await readT3Review({ dir });
  expect(run.reviewedBy).toBe(
    `gpt-6.2-sol (${sol.providerInstanceId}; AI review) for the owner`,
  );
});

it.each([
  {
    name: 'foreign same-selection running task',
    task: 'Foreign task',
    change: { status: 'running', workState: 'working' },
  },
  { name: 'wrong task text', task: 'Wrong nonce-bearing task' },
  {
    name: 'missing nonce',
    edit: (s: string) => s.replace(/"nonce": "[^"]+"/, '"nonce": ""'),
  },
])(
  'rejects $name through capture-owned dispatch at INITIAL binding',
  async ({ task, change, edit }) => {
    const { dir } = await fixture();
    const { syntheticTools, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const frozen = z
      .object({ task: z.string() })
      .parse(JSON.parse(await readFile(join(dir, 'request.json'), 'utf8')));
    const adapter = await syntheticTools({
      dir,
      task: edit ? edit(frozen.task) : task,
      status: { ...syntheticStatus(), ...change },
    });
    const before = await snapshot(dir);
    await expect(adapter.execute('dispatch')).rejects.toThrow();
    expect(await snapshot(dir)).toEqual(before);
  },
);
it('rejects cross-capture replay despite identical brief/selection/record inputs', async () => {
  const one = await fixture();
  const two = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const request = JSON.parse(
    await readFile(join(one.dir, 'request.json'), 'utf8'),
  );
  const adapter = await syntheticTools({ dir: two.dir, task: request.task });
  await expect(adapter.execute('dispatch')).rejects.toThrow(
    'Original message differs',
  );
  await expect(readFile(join(two.dir, 'dispatch.json'))).rejects.toThrow();
});
it.each([
  ['sender', { senderThreadId: 'foreign:parent' }],
  ['source', { sourceThreadId: 'foreign:child' }],
  ['run', { runId: 'synthetic:run:2' }],
  ['missing run', { runId: null }],
  ['assistant quotation', { type: 'assistant_message' }],
  ['human steering', { createdBy: 'user', creationSource: 'web' }],
  ['provider origin', { creationSource: 'provider' }],
  ['inherited', { visibility: 'inherited' }],
  ['synthetic', { visibility: 'synthetic' }],
  ['missing sender', { senderThreadId: undefined }],
  ['missing message identity', { messageId: null }],
  ['missing item identity', { itemId: '' }],
  ['truncated no cursor', { textTruncated: true, nextTextOffset: null }],
  ['stalled UTF-16 cursor', { textTruncated: true, nextTextOffset: 0 }],
  ['false final cursor', { textTruncated: false, nextTextOffset: 2048 }],
])(
  'rejects invalid original-message %s without a binding',
  async (_name, changes) => {
    const { dir } = await fixture();
    const { syntheticTools } = await import('./t3-code-mode-fixture');
    const adapter = await syntheticTools({
      dir,
      mutateRead: (page) => ({
        ...page,
        items: page.items.map((item) => ({ ...item, ...changes })),
      }),
    });
    await expect(adapter.execute('dispatch')).rejects.toThrow();
    await expect(readFile(join(dir, 'dispatch.json'))).rejects.toThrow();
  },
);
it.each([
  ['parent', { parentThreadId: 'foreign:parent' }],
  ['fork', { relationshipToParent: 'fork' }],
  ['missing relationship', { relationshipToParent: null }],
  ['later run', { latestRunId: 'synthetic:run:2', runCount: 2 }],
  ['wrong thread', { threadId: 'foreign:thread' }],
  ['pending question', { pendingRequestCount: 1 }],
])('rejects thread %s without a binding', async (_name, change) => {
  const { dir } = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({
    dir,
    mutateRead: (page) => ({ ...page, thread: { ...page.thread, ...change } }),
  });
  await expect(adapter.execute('dispatch')).rejects.toThrow();
  await expect(readFile(join(dir, 'dispatch.json'))).rejects.toThrow();
});
it('does not select a later matching message after an original mismatch', async () => {
  const { dir } = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({
    dir,
    mutateRead: (page) => ({
      ...page,
      hasMore: true,
      items: page.items.map((item) => ({
        ...item,
        text: 'Unrelated original message',
      })),
    }),
  });
  await expect(adapter.execute('dispatch')).rejects.toThrow(
    'Original message differs',
  );
  expect(adapter.reads).toHaveLength(1);
});
it('recovers a queued null original run later without redispatch or rebinding its identities', async () => {
  const { dir } = await fixture();
  const { syntheticTools, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const queued = {
    ...syntheticStatus(),
    childRunId: null,
    status: 'queued',
    workState: 'working',
    latestTerminalRunId: null,
    latestTerminalStatus: null,
    summary: null,
    resultContextTransferId: null,
  };
  const initial = await syntheticTools({
    dir,
    returned: queued,
    status: queued,
  });
  await expect(initial.execute('dispatch')).rejects.toThrow('pending/unbound');
  await expect(readFile(join(dir, 'dispatch.json'))).rejects.toThrow();
  // A return is saved only by the bind that matches its original message.
  await expect(readFile(join(dir, 'dispatch-return.json'))).rejects.toThrow(
    'ENOENT',
  );
  const recovered = await syntheticTools({ dir });
  await expect(recovered.bind(initial.returns[0])).resolves.toEqual({
    bound: true,
  });
  expect(recovered.requests).toHaveLength(0);
  expect(initial.requests).toHaveLength(1);
  expect(
    JSON.parse(await readFile(join(dir, 'dispatch-return.json'), 'utf8')),
  ).toEqual(initial.returns[0]);
});
it.each([
  ['changed model', { model: 'gpt-6.1-sol' }],
  ['changed provider', { providerInstanceId: 'foreign' }],
  ['missing options', { options: null }],
  ['absent options', { options: undefined }],
  ['missing option', { options: [{ id: 'reasoningEffort', value: 'high' }] }],
  [
    'changed option',
    {
      options: [
        { id: 'reasoningEffort', value: 'low' },
        { id: 'serviceTier', value: 'default' },
      ],
    },
  ],
  [
    'duplicate options',
    {
      options: [
        { id: 'reasoningEffort', value: 'high' },
        { id: 'reasoningEffort', value: 'high' },
      ],
    },
  ],
  ['missing task', { taskId: undefined }],
  ['missing child node', { childNodeId: null }],
  ['failed', { status: 'failed' }],
  ['interrupted', { status: 'interrupted' }],
  ['cancelled', { status: 'cancelled' }],
])('rejects dispatch selection/identity %s', async (_name, changes) => {
  const { dir } = await fixture();
  const { syntheticTools, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({
    dir,
    returned: { ...syntheticStatus(), ...changes },
  });
  const before = await snapshot(dir);
  await expect(adapter.execute('dispatch')).rejects.toThrow();
  expect(await snapshot(dir)).toEqual(before);
});
it('stops on an MCP error even when the outer exec succeeded, without saving its return', async () => {
  const { dir } = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({ dir });
  adapter.direct.delegate_task = async () => ({
    isError: true,
    content: [{ type: 'text', text: 'tool failure' }],
  });
  const before = await snapshot(dir);
  await expect(adapter.execute('dispatch')).rejects.toThrow(
    'tool returned an error',
  );
  expect(await snapshot(dir)).toEqual(before);
});
it.each(['persistence', 'truncated read', 'running shell', 'oversized read'])(
  'stops on %s failure and recovers without a second child',
  async (failure) => {
    const { dir } = await fixture();
    const { syntheticTools } = await import('./t3-code-mode-fixture');
    const broken = await syntheticTools({
      dir,
      mutateExec: ({ cmd }) => {
        if (failure === 'persistence' && cmd.includes('"action":"publish"'))
          return { exit_code: 1, output: 'exclusive persistence failed' };
        if (failure === 'truncated read')
          return { exit_code: 0, output: '{"request":' };
        if (failure === 'running shell') return { session_id: 1, output: '{}' };
        if (failure === 'oversized read')
          return { exit_code: 0, output: '{}', original_token_count: 20000 };
      },
    });
    await expect(broken.execute('dispatch')).rejects.toThrow();
    await expect(readFile(join(dir, 'dispatch.json'))).rejects.toThrow();
    const recovered = await syntheticTools({ dir });
    // A failure before the direct call leaves nothing sent; after it, the
    // operator binds the return they already hold.
    if (failure === 'persistence') {
      expect(broken.requests).toHaveLength(1);
      await recovered.bind(broken.returns[0]);
      expect(recovered.requests).toHaveLength(0);
    } else {
      expect(broken.requests).toHaveLength(0);
      await recovered.execute('dispatch');
    }
    await readFile(join(dir, 'dispatch.json'));
  },
);
it('stops on a lost delegate response and retries the identical frozen object', async () => {
  const { dir } = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const broken = await syntheticTools({ dir });
  let submitted: unknown;
  broken.direct.delegate_task = async (request) => {
    submitted = request;
    throw new Error('Response lost');
  };
  await expect(broken.execute('dispatch')).rejects.toThrow('Response lost');
  await expect(readFile(join(dir, 'dispatch-return.json'))).rejects.toThrow();
  const recovered = await syntheticTools({ dir });
  await recovered.execute('dispatch');
  expect(recovered.requests).toEqual([submitted]);
});
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
  async ({ reshape }) => {
    const { dir } = await fixture();
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const own = syntheticDirectReturn(syntheticStatus());
    // As an earlier write left it, with no binding yet.
    await writeFile(
      join(dir, 'dispatch-return.json'),
      reshape(Buffer.from(`${JSON.stringify(own, null, 2)}\n`)),
      { mode: 0o444 },
    );
    const before = await snapshot(dir);
    for (const supplied of [own, undefined]) {
      const world = await syntheticTools({ dir });
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
  async ({ reshape }) => {
    const { root, dir } = await fixture();
    const { chmod } = await import('node:fs/promises');
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
      const world = await syntheticTools({ dir });
      await expect(world.bind(own), `bind ${attempt}`).rejects.toThrow(
        'A dispatch.json exists and was not acknowledged',
      );
      expect(world.statuses).toHaveLength(0);
      expect(await snapshot(dir)).toEqual(before);
    }
    await expect(
      (await syntheticTools({ dir })).execute('complete', report),
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
  const retry = await syntheticTools({ dir });
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
    const own = await syntheticTools({ dir });
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
  // bound. The payload is that size again: it carries no return or attempt.
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
  expect(bridgePayloads(cmds, 'bind')).toEqual([58286]);
});
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
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
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
type Settled = { bound: boolean; error?: string };
const settle = (attempt: Promise<unknown>): Promise<Settled> =>
  attempt.then(
    () => ({ bound: true }),
    (error: unknown) => ({ bound: false, error: String(error) }),
  );
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
 * Runs the round's own bind (A) with every bridge process it starts preloaded
 * with the pause hook: the process about to write, link or rename a file whose
 * base name matches `at` pauses there while `meanwhile` runs (told whether A
 * paused or had already finished), and the pause is released even if
 * `meanwhile` throws.
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
}: {
  dir: string;
  at: string;
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
      const ran = await run(
        (umask === undefined ? '' : `umask ${umask}; `) +
          // A function, so the pattern's `$` is never a replacement pattern.
          cmd.replace('node scripts/', () =>
            pausedNode(
              pause,
              `EP_T3_PAUSE_AT=${shellQuote(at)}${exits ? ' EP_T3_EXIT_AFTER_PAUSE=1' : ''}${afterWrite ? ' EP_T3_PAUSE_AFTER_WRITE=1' : ''}`,
            ),
          ),
      );
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
/** Completes the round with a synthetic report; returns its files' bytes. */
async function completeRound({ root, dir }: { root: string; dir: string }) {
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const report = join(root, 'report.md');
  await writeFile(report, 'Synthetic review report.\n');
  await (await syntheticTools({ dir })).execute('complete', report);
  return snapshot(dir);
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
    const { paused, settled } = await pausedAt({
      dir,
      at: '^dispatch\\.json$',
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
  {
    name: 'its transported reads, its reply lost (the Standards reviewer)',
    at: '^evidence\\.json$',
    loses: 'bind',
  },
  {
    name: 'its transported return, its reply lost (the Spec reviewer)',
    at: '^return\\.json$',
    loses: 'stage',
  },
  {
    name: 'the return, its process dying',
    at: '^dispatch-return\\.json$',
    exits: true,
  },
  {
    // Its create fails on the binding of its own return: acknowledged.
    name: 'the binding, its process dying',
    at: '^dispatch\\.json$',
    exits: true,
    bound: true,
  },
])(
  'leaves the completed round exactly as completed when a bind writes $name after another bind completed it',
  async ({ at, loses, exits, bound = false }) => {
    const { root, dir } = await fixture();
    const tmp = await scratch('t3-transport-');
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const own = syntheticDirectReturn(syntheticStatus());
    let completed: Record<string, unknown> | undefined;
    const { paused, settled } = await pausedAt({
      dir,
      at,
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
  { file: 'dispatch-return.json', bound: false },
  { file: 'dispatch.json', bound: true },
])(
  'leaves every mode, time and byte of the completed round as completed when a bind that wrote $file under umask 077 resumes after another bind completed it',
  async ({ file, bound }) => {
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
// Fix r6, Spec 3, and fix r9, Standards 2: the system temporary directory can
// be the round bind operates on, inside it or contain it. Bind then declines
// before it creates a transport directory, naming the variable, and nothing in
// or around the round changes (the bridge runs tsx with its disk cache off, so
// tsx writes nothing there either). Nothing is inferred from file names
// elsewhere: a TMPDIR at another completed round, which bind does not operate
// on, is not refused, and the transport directory made there is removed.
it.each([
  { where: 'the round', declined: true },
  { where: 'a subdirectory of the round', declined: true },
  { where: "the round's parent", declined: true },
  { where: "the round's grandparent", declined: true },
  { where: 'another completed round', declined: false },
])(
  'binds or declines with TMPDIR at $where (declined: $declined)',
  async ({ where, declined }) => {
    const { root, dir, config } = await fixture();
    const { dirname } = await import('node:path');
    const { mkdir } = await import('node:fs/promises');
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const own = syntheticDirectReturn(syntheticStatus());
    let tmp = dir;
    if (where === 'a subdirectory of the round') {
      tmp = join(dir, 'tmp');
      await mkdir(tmp);
    }
    if (where === "the round's parent") tmp = root;
    if (where === "the round's grandparent") tmp = dirname(root);
    if (where === 'another completed round') {
      tmp = join(await scratch(), 'other');
      await captureT3Inputs({
        dir: tmp,
        reviewedCommit: 'c'.repeat(40),
        seen,
        caller: { threadId: 'synthetic:parent' },
        config,
      });
      await (await syntheticTools({ dir: tmp })).execute('dispatch');
      await completeRound({ root: dirname(tmp), dir: tmp });
    }
    const before = await snapshot(root);
    const other = await snapshot(tmp);
    const world = await syntheticTools({ dir, tmp });
    if (declined) {
      await expect(world.bind(own)).rejects.toThrow(
        `The system temporary directory (TMPDIR, ${tmp}) is this round's directory (${dir}), inside it or contains it`,
      );
      expect(await snapshot(root)).toEqual(before);
      // With TMPDIR elsewhere the same return binds.
      await expect(
        (
          await syntheticTools({ dir, tmp: await scratch('t3-transport-') })
        ).bind(own),
      ).resolves.toEqual({ bound: true });
    } else {
      await expect(world.bind(own)).resolves.toEqual({ bound: true });
      expect(await snapshot(tmp)).toEqual(other);
    }
  },
  slow,
);
const launcher = 'scripts/catalog/start-without-tsx-cache.mjs';
/**
 * Where a documented line names the bridge or the record step, and how:
 * `command`, a round command it starts (the bridge, or the record step with
 * --capture-t3, --bind-t3, --complete-t3, --t3-run or --verify); `other`, a
 * command it starts with no round action; `reference`, a name that nothing
 * before it in its code starts (prose, or code beginning with the name).
 */
type Documented = {
  source: string;
  line: number;
  kind: 'command' | 'other' | 'reference';
  command: string;
};
/** Any name of either entry point: its path or file name, .ts or .mjs. */
const entryName = /(?:catalog-record-review|t3-review-bridge)\.[cm]?[jt]s\b/g;
const roundAction = /--(?:capture-t3|bind-t3|complete-t3|t3-run|verify)\b/;
/** The span from `from` to the next `close` at or after `at`, or the line's end. */
function spanTo(
  line: string,
  { from, close, at }: { from: number; close: string; at: number },
) {
  const end = line.indexOf(close, at);
  return { from, to: end < 0 ? line.length : end };
}
/** In prose, the inline code span holding `at`, else none (prose names). */
function inlineCodeAround(line: string, at: number) {
  const ticks = [...line.slice(0, at)].filter((c) => c === '`').length;
  return ticks % 2 === 0
    ? undefined
    : spanTo(line, { from: line.lastIndexOf('`', at) + 1, close: '`', at });
}
/** In a code block, the quoted string holding `at`, else the whole line. */
function blockCodeAround(line: string, at: number) {
  let quote: { char: string; from: number } | undefined;
  for (const [index, char] of [...line.slice(0, at)].entries())
    if (quote === undefined && (char === "'" || char === '"'))
      quote = { char, from: index };
    else if (char === quote?.char) quote = undefined;
  return quote === undefined
    ? { from: 0, to: line.length }
    : spanTo(line, { from: quote.from + 1, close: quote.char, at });
}
/**
 * TEXT's lines with their 1-based numbers, each marked as in a code block or
 * not; the fences themselves are left out, and a block line ending in a
 * backslash continues on the next. `code` reads all of TEXT as one block.
 */
function textLines(text: string, code: boolean) {
  const lines = text.split('\n');
  const read: { line: string; number: number; block: boolean }[] = [];
  let block = code;
  for (let index = 0; index < lines.length; index++) {
    const number = index + 1;
    let line = lines[index] ?? '';
    if (!code && /^\s*(?:```|~~~)/.test(line)) {
      block = !block;
      continue;
    }
    while (block && line.endsWith('\\') && index + 1 < lines.length)
      line = `${line.slice(0, -1)} ${(lines[++index] ?? '').trim()}`;
    read.push({ line, number, block });
  }
  return read;
}
/**
 * One name of an entry point at `at` on `line`, classified by the code around
 * it: the code before the name (from the start of its word) is its launcher,
 * the code after it its arguments.
 */
function classifyName(
  line: string,
  { at, name, block }: { at: number; name: string; block: boolean },
) {
  let start = at;
  while (start > 0 && !/[\s`'"]/.test(line[start - 1] ?? '')) start--;
  const around = block
    ? blockCodeAround(line, start)
    : inlineCodeAround(line, start);
  if (around === undefined)
    return { kind: 'reference' as const, command: name };
  const command = line.slice(around.from, around.to).trim();
  if (line.slice(around.from, start).trim() === '')
    return { kind: 'reference' as const, command };
  const round =
    name.startsWith('t3-review-bridge') ||
    roundAction.test(line.slice(start, around.to));
  return { kind: round ? ('command' as const) : ('other' as const), command };
}
/**
 * Every place TEXT names the bridge or the record step, however it is
 * launched: each name of either entry point (`entryName`), wherever it stands
 * (`textLines`), classified by the code around it (`classifyName`): in a code
 * block, the quoted string holding it or else the whole line; in prose, the
 * inline code span holding it or else nothing. `code` reads all of TEXT as one
 * code block (the CLI help, a package script).
 */
function documentedNames(
  source: string,
  text: string,
  { code = false } = {},
): Documented[] {
  return textLines(text, code).flatMap(({ line, number, block }) =>
    [...line.matchAll(entryName)].map((match) => ({
      source,
      line: number,
      ...classifyName(line, { at: match.index, name: match[0], block }),
    })),
  );
}
/** The one documented way to start a round command (pnpm exec may run it). */
const launched =
  /^(?:pnpm exec )?node scripts\/catalog\/start-without-tsx-cache\.mjs scripts\/(?:catalog-record-review|catalog\/t3-review-bridge)\.ts(?: |$)/;
const runNode = async (
  args: string[],
  tmp: string,
  env: Record<string, string> = {},
) => {
  const { execFile } = await import('node:child_process');
  return new Promise<{ failed: boolean; stdout: string; stderr: string }>(
    (resolve) => {
      execFile(
        process.execPath,
        args,
        {
          cwd: repoRoot,
          // tsx's cache switch is absent unless the launcher sets it.
          env: {
            ...process.env,
            TSX_DISABLE_CACHE: undefined,
            TMPDIR: tmp,
            ...env,
          },
          maxBuffer: 1 << 24,
        },
        (error, stdout, stderr) =>
          resolve({ failed: error !== null, stdout, stderr }),
      );
    },
  );
};
/** The decline of a TMPDIR that is, is inside or contains a round. */
const temporaryDeclined = 'The system temporary directory (TMPDIR, ';
/**
 * A completed round archived under a runs directory as a committed T3
 * receipt's run, so it is the round every round command below operates on:
 * --verify of this checkout verifies it among its archives.
 */
async function archivedRound() {
  const { rename } = await import('node:fs/promises');
  const { root, dir: captured, config } = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  await (await syntheticTools({ dir: captured })).execute('dispatch');
  await completeRound({ root, dir: captured });
  const committed = z
    .object({
      receipts: z.array(z.object({ runId: z.string(), evidence: z.unknown() })),
    })
    .parse(
      JSON.parse(
        await readFile(
          join(repoRoot, 'scripts/catalog/review-receipts.json'),
          'utf8',
        ),
      ),
    );
  const runId = committed.receipts.find(
    ({ evidence }) => evidence !== undefined,
  )?.runId;
  if (runId === undefined) throw Error('No committed T3 receipt.');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(join(root, 'runs'));
  const dir = join(root, 'runs', runId);
  await rename(captured, dir);
  return { root, dir, config, runs: join(root, 'runs') };
}
/**
 * Runs each round command as documented, with TMPDIR at a completed round,
 * which is the round every one of them operates on (capture's new directory
 * lies inside it, --verify verifies it): each declines, naming TMPDIR, and
 * leaves the round's full listing unchanged, and a loader of the bridge's
 * code-mode helper gives a helper whose every operation declines the same
 * way. Returns the round actions run.
 */
async function exerciseRoundCommands(commands: Documented[]) {
  const { root, dir, config, runs } = await archivedRound();
  const { syntheticTools, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const files = await scratch();
  await writeFile(join(files, 'config.json'), JSON.stringify(config));
  await writeFile(
    join(files, 'status.json'),
    JSON.stringify(syntheticStatus()),
  );
  await writeFile(join(files, 'ids.txt'), 'synthetic decision\n');
  const fresh = join(dir, 'new-round');
  // Each placeholder of the help and each shell word of the documents.
  const values: Record<string, string> = {
    '<dir>': dir,
    '<new durable dir>': fresh,
    '<archived dir>': dir,
    '<json>': join(files, 'config.json'),
    '<tool response>': JSON.stringify({ threadId: 'synthetic:parent' }),
    '<delegate_task response json>': join(dir, 'dispatch-return.json'),
    '<task_status response json>': join(files, 'status.json'),
    '<full report>': join(root, 'report.md'),
    '<file>': join(files, 'ids.txt'),
    '$EP_ORCH/runs/$RUN_ID': dir,
    '$EP_ORCH/runs': runs,
    $IDS: join(files, 'ids.txt'),
    $WT: repoRoot,
  };
  // What a placeholder after these options stands for, whatever its name.
  const after: Record<string, string> = { '--root': repoRoot, '--runs': runs };
  const argv = ({ command, source, line }: Documented) => {
    const words =
      command
        .replace(/^pnpm exec /, '')
        .replace(/[[\]]/g, '')
        .match(/<[^>]*>|"[^"]*"|'[^']*'|\S+/g) ?? [];
    return words.map((word, index) => {
      const unquoted = /^(["']).*\1$/.test(word) ? word.slice(1, -1) : word;
      if (!unquoted.startsWith('<') && !unquoted.includes('$')) return unquoted;
      const value = after[words[index - 1] ?? ''] ?? values[unquoted];
      if (value === undefined)
        throw Error(`No value for ${unquoted}: ${source}:${line}: ${command}`);
      return value;
    });
  };
  const before = await snapshot(root);
  const actions: string[] = [];
  for (const documented of commands) {
    const where = `${documented.source}:${documented.line}: ${documented.command}`;
    expect(documented.command, `${where} starts another way`).toMatch(launched);
    const action =
      /--code-mode|--(?:capture|bind|complete)-t3\b|--t3-run\b|--verify\b/.exec(
        documented.command,
      )?.[0];
    expect(action, where).toBeDefined();
    actions.push(action ?? '');
    const [node, ...args] = argv(documented);
    expect(node, where).toBe('node');
    // --verify's default runs directory is the one holding the round.
    const ran = await runNode(args, dir, { EP_ORCH: root });
    if (action === '--code-mode') {
      expect(ran.failed, `${where}: ${ran.stderr}`).toBe(false);
      // Safe cast: the emitted expression is the checked-in portable helper.
      const run = runInNewContext(ran.stdout, {
        TextEncoder: undefined,
      }) as typeof runT3ReviewCodeMode;
      const { tools } = await syntheticTools({ dir, tmp: dir });
      const context = { tools, root: repoRoot, dir };
      const returned: unknown = JSON.parse(
        await readFile(join(dir, 'dispatch-return.json'), 'utf8'),
      );
      for (const call of [
        () =>
          run({
            ...context,
            dir: fresh,
            operation: 'capture',
            config: join(files, 'config.json'),
          }),
        () => run({ ...context, operation: 'prepare' }),
        () => run({ ...context, operation: 'bind', returned }),
        () =>
          run({
            ...context,
            operation: 'complete',
            report: join(root, 'report.md'),
          }),
      ])
        await expect(call(), where).rejects.toThrow(temporaryDeclined);
    } else {
      expect(ran.failed, where).toBe(true);
      expect(ran.stdout, where).toBe('');
      expect(ran.stderr, where).toContain(temporaryDeclined);
    }
    expect(await snapshot(root), where).toEqual(before);
  }
  return [...new Set(actions)].sort();
}
/**
 * Copies of the repository's Markdown that names the bridge or the record
 * step, which scripts/orchestration/t3-review-commands.test.sh (the workflow
 * suite) hands over: no test of this suite may read a lane-eligible file
 * itself (operations.md, "Light landing lane"), so in the full suite the next
 * test runs the help's commands alone, and the workflow suite checks that the
 * runner read every line of the documents naming either (EP_T3_EXERCISED
 * lists each with how it is classified).
 */
async function documentedInFiles(base: string) {
  const { relative } = await import('node:path');
  const names: Documented[] = [];
  for (const entry of await readdir(base, {
    recursive: true,
    withFileTypes: true,
  }))
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const path = join(entry.parentPath, entry.name);
      names.push(
        ...documentedNames(relative(base, path), await readFile(path, 'utf8')),
      );
    }
  return names.sort(
    (a, b) => a.source.localeCompare(b.source, 'en') || a.line - b.line,
  );
}
// Fix r7, r8 and r9, both axes: every documented round command, however it is
// launched, is the launcher's form and, run as documented with TMPDIR at the
// round it operates on, declines naming TMPDIR and leaves the round
// unchanged. The commands are read from the record step's help, as the CLI
// prints it, from the package scripts, and from the documents when they are
// handed over.
it(
  'runs every round command of the record step help, and of the documents the workflow suite hands over, with TMPDIR at the round it operates on, which declines and leaves the round unchanged',
  async () => {
    const help = await runNode(
      [launcher, 'scripts/catalog-record-review.ts', '--help'],
      await scratch('t3-transport-'),
    );
    expect(help.failed, help.stderr).toBe(false);
    // A package script would be a launch the runner cannot start as written.
    const { scripts } = z
      .object({ scripts: z.record(z.string(), z.string()) })
      .parse(
        JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8')),
      );
    const packaged = Object.entries(scripts).flatMap(([name, script]) =>
      documentedNames(`package.json scripts.${name}`, script, { code: true }),
    );
    expect(
      packaged.filter(({ kind }) => kind !== 'other'),
      'a package script that starts a round command or names one: teach this runner its pnpm form first',
    ).toEqual([]);
    const documents = process.env.EP_T3_DOCUMENTS;
    const documented =
      documents === undefined ? [] : await documentedInFiles(documents);
    const named = [
      ...documentedNames('--help', help.stdout, { code: true }),
      ...documented,
    ];
    const actions = await exerciseRoundCommands(
      named.filter(({ kind }) => kind === 'command'),
    );
    // The help's five round commands, and the runbook's loader when the
    // documents are handed over.
    expect(actions).toEqual([
      '--bind-t3',
      '--capture-t3',
      ...(documents === undefined ? [] : ['--code-mode']),
      '--complete-t3',
      '--t3-run',
      '--verify',
    ]);
    const exercised = process.env.EP_T3_EXERCISED;
    if (exercised)
      await writeFile(
        exercised,
        documented
          .map(({ source, line, kind }) => `${source}:${line} ${kind}\n`)
          .join(''),
      );
  },
  slow,
);
// Fix r9, root's correction of fix r8: a round command started under tsx
// alone, its disk cache on, runs as before; its output and exit status are
// those of the same command through the launcher (tsx's disk cache aside).
it.each([
  ['scripts/catalog/t3-review-bridge.ts', '--code-mode'],
  ['scripts/catalog-record-review.ts', '--bind-t3', 'x', '--dispatch', 'y'],
  ['scripts/catalog-record-review.ts', '--t3-run', 'x', '--ids', 'y'],
  ['scripts/catalog-record-review.ts', '--verify', '--runs', 'no-such-runs'],
])(
  'runs %s under tsx alone, its disk cache on, as through the launcher',
  async (entry, ...args) => {
    const tmp = await scratch('t3-transport-');
    const alone = await runNode(['--import', 'tsx', entry, ...args], tmp);
    const through = await runNode([launcher, entry, ...args], tmp);
    expect(alone).toEqual(through);
    expect(alone.stderr).not.toContain(launcher);
  },
  slow,
);
// Fix r9, both axes: every round command of the record step (--capture-t3,
// --bind-t3, --complete-t3, --t3-run) and every bridge action declines a
// TMPDIR that is the round it operates on, inside it or contains it (capture's
// round is the new directory it is given), naming the variable, before doing
// anything, and changes nothing. --verify's cases are in review-receipts.test.ts.
it(
  'declines every round command with TMPDIR at its round, inside it or containing it, naming the variable and changing nothing',
  async () => {
    const { root, dir, config } = await fixture();
    const { dirname } = await import('node:path');
    const { mkdir } = await import('node:fs/promises');
    const { syntheticTools, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    await (await syntheticTools({ dir })).execute('dispatch');
    await completeRound({ root, dir });
    const files = await scratch();
    const configPath = join(files, 'config.json');
    await writeFile(configPath, JSON.stringify(config));
    const statusPath = join(files, 'status.json');
    await writeFile(statusPath, JSON.stringify(syntheticStatus()));
    const ids = join(files, 'ids.txt');
    await writeFile(ids, 'synthetic decision\n');
    const fresh = join(dir, 'new-round');
    await mkdir(join(dir, 'tmp'));
    const caller = { threadId: 'synthetic:parent' };
    const returned: unknown = JSON.parse(
      await readFile(join(dir, 'dispatch-return.json'), 'utf8'),
    );
    const record = (...args: string[]) => [
      launcher,
      'scripts/catalog-record-review.ts',
      ...args,
    ];
    const bridge = (args: Record<string, unknown>) => [
      launcher,
      'scripts/catalog/t3-review-bridge.ts',
      JSON.stringify(args),
    ];
    const status = syntheticStatus();
    const commands: { name: string; round: string; args: string[] }[] = [
      {
        name: '--capture-t3',
        round: fresh,
        args: record(
          '--capture-t3',
          fresh,
          '--config',
          configPath,
          '--caller-json',
          JSON.stringify(caller),
          '--root',
          repoRoot,
        ),
      },
      {
        name: '--bind-t3',
        round: dir,
        args: record(
          '--bind-t3',
          dir,
          '--dispatch',
          join(dir, 'dispatch-return.json'),
        ),
      },
      {
        name: '--complete-t3',
        round: dir,
        args: record(
          '--complete-t3',
          dir,
          '--status',
          statusPath,
          '--report',
          join(root, 'report.md'),
        ),
      },
      {
        name: '--t3-run',
        round: dir,
        args: record('--t3-run', dir, '--ids', ids, '--root', repoRoot),
      },
      ...[
        {
          action: 'capture',
          dir: fresh,
          root: repoRoot,
          config: configPath,
          caller,
        },
        { action: 'prepare', dir, caller },
        { action: 'offer', dir, returned },
        { action: 'stage', dir, returned },
        { action: 'check', dir, offer: files, response: status },
        { action: 'discard', dir, offer: files },
        { action: 'next', dir, response: status, observations: [] },
        { action: 'bind', dir, response: status, observations: [] },
        { action: 'publish', dir, offer: files, evidence: files },
        {
          action: 'complete',
          dir,
          response: status,
          report: join(root, 'report.md'),
        },
      ].map((args) => ({
        name: `the bridge's ${args.action}`,
        round: args.dir,
        args: bridge(args),
      })),
    ];
    const before = await snapshot(root);
    for (const { name, round, args } of commands)
      for (const tmp of [
        round,
        join(round, 'tmp'),
        dirname(round),
        dirname(dirname(round)),
      ]) {
        // Capture's new round does not exist yet: nothing can be in it.
        if (round === fresh && tmp.startsWith(fresh)) continue;
        const where = `${name} with TMPDIR at ${tmp}`;
        const ran = await runNode(args, tmp);
        expect(ran.failed, where).toBe(true);
        expect(ran.stdout, where).toBe('');
        expect(ran.stderr, where).toContain(
          `${temporaryDeclined}${tmp}) is this round's directory (${round}), inside it or contains it; nothing done.`,
        );
        expect(await snapshot(root), where).toEqual(before);
      }
    // A TMPDIR at another completed round is no round --t3-run operates on:
    // it goes on to its own checks (this round's reviewed commit is not HEAD).
    const other = join(await scratch(), 'other');
    const { cp } = await import('node:fs/promises');
    await cp(dir, other, { recursive: true });
    const ran = await runNode(commands[3]?.args ?? [], other);
    expect(ran.stderr).not.toContain(temporaryDeclined);
    expect(ran.stderr).toContain(
      'Current HEAD differs from the T3 reviewed commit.',
    );
    expect(await snapshot(root)).toEqual(before);
  },
  slow,
);
// Fix r9, Standards 4: the temporary-directory check takes what the command
// operates on, named by its kind.
it('types the temporary-directory scope by its kind', () => {
  type Scope = Parameters<typeof requireTemporaryDirectoryOutside>[0];
  const accepts = (scope: Scope) => scope.kind;
  const check = () => [
    accepts({ kind: 'round', round: 'r' }),
    accepts({ kind: 'archives', runs: 'runs', archives: ['a'] }),
    // @ts-expect-error the scope is named by its kind
    accepts({ round: 'r' }),
    // @ts-expect-error the scope is named by its kind
    accepts({ runs: 'runs', archives: [] }),
    // @ts-expect-error a round scope names its round
    accepts({ kind: 'round', runs: 'runs', archives: [] }),
    // @ts-expect-error an archives scope names its runs and archives
    accepts({ kind: 'archives', round: 'r' }),
  ];
  expectTypeOf(check).returns.toEqualTypeOf<Scope['kind'][]>();
});
// Fix r3, the payload range (both axes): the bounded status and observation
// payloads of a bind are byte for byte what the base (0158082f) sent for the
// same observations, there `JSON.stringify({ action, response, observations,
// dir })` with action 'next' per step and 'bind' once.
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
    const run = async (dir: string, summary: number) => {
      const status = { ...syntheticStatus(), summary: 's'.repeat(summary) };
      const cmds: string[] = [];
      const adapter = await syntheticTools({
        dir,
        status,
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
            args,
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
    const { settled, payloads, expected } = await run(
      sized.dir,
      1000 + bytes - sampleBytes,
    );
    expect(Buffer.byteLength(expected.at(-1) ?? '')).toBe(bytes);
    expect(payloads).toEqual(expected);
    expect(settled).toEqual({ bound: true });
  },
  slow,
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
    const retry = await syntheticTools({ dir: copy });
    await expect(retry.bind(adapter.returns[0])).rejects.toThrow(
      'completed round',
    );
    expect(retry.statuses).toHaveLength(0);
    expect(await snapshot(copy)).toEqual(before);
  },
);
it('refuses a running child while its status shows pending work, then binds the same return once the checks pass', async () => {
  const { dir } = await fixture();
  const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
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
  const returned = syntheticDirectReturn(running);
  const before = await snapshot(dir);
  const asking = await syntheticTools({
    dir,
    status: { ...running, hasPendingQuestion: true },
  });
  await expect(asking.bind(returned)).rejects.toThrow('pending work');
  expect(await snapshot(dir)).toEqual(before);
  const later = await syntheticTools({ dir, status: running });
  await expect(later.bind(returned)).resolves.toEqual({ bound: true });
});
it('refuses to bind a child that has failed since its return, so its round is abandoned', async () => {
  const { dir } = await fixture();
  const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const before = await snapshot(dir);
  const failed = await syntheticTools({
    dir,
    status: {
      ...syntheticStatus(),
      status: 'failed',
      latestTerminalStatus: 'failed',
    },
  });
  await expect(
    failed.bind(syntheticDirectReturn(syntheticStatus())),
  ).rejects.toThrow('Cannot bind an unsuccessful T3 task.');
  expect(await snapshot(dir)).toEqual(before);
});
it.each([
  ['task', { taskId: 'synthetic:other-task' }, 'T3 taskId differs'],
  [
    'child thread',
    { childThreadId: 'synthetic:other-thread' },
    'T3 childThreadId differs',
  ],
  [
    'child node',
    { childNodeId: 'synthetic:other-node' },
    'T3 childNodeId differs',
  ],
  [
    'original run',
    { childRunId: 'synthetic:run:2', latestTerminalRunId: 'synthetic:run:2' },
    'original run differs',
  ],
])(
  'refuses a return whose live task_status names another %s, writing nothing',
  async (_name, change, message) => {
    const { dir } = await fixture();
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const before = await snapshot(dir);
    const world = await syntheticTools({
      dir,
      status: { ...syntheticStatus(), ...change },
    });
    await expect(
      world.bind(syntheticDirectReturn(syntheticStatus())),
    ).rejects.toThrow(message);
    expect(await snapshot(dir)).toEqual(before);
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
it('rejects a different actual caller before dispatch', async () => {
  const { dir } = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({ dir, caller: 'foreign:parent' });
  const before = await snapshot(dir);
  await expect(adapter.execute('dispatch')).rejects.toThrow('caller differs');
  expect(adapter.requests).toHaveLength(0);
  expect(await snapshot(dir)).toEqual(before);
});
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
it('recovers timeline pages and UTF-16 slices across a split non-BMP character', async () => {
  const { dir } = await fixture({ prefix: 'x'.repeat(2003) + '🦊' });
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({
    dir,
    mutateRead: (page, args) => {
      const cursor = z
        .object({
          afterPosition: z.number().optional(),
          itemId: z.string().optional(),
        })
        .parse(args);
      if (cursor.afterPosition === undefined && cursor.itemId === undefined)
        return { ...page, items: [], hasMore: true, nextPosition: 0 };
      return {
        ...page,
        items: page.items.map((item) => ({ ...item, position: 1 })),
      };
    },
  });
  await adapter.execute('dispatch');
  expect(adapter.reads).toHaveLength(3);
  expect(adapter.reads[2]).toMatchObject({
    itemId: 'synthetic:item:original',
    textOffset: 2048,
  });
});
it.each([
  'changed item',
  'changed thread',
  'stalled timeline',
  'missing message',
])('rejects %s pagination', async (problem) => {
  const { dir } = await fixture({ prefix: 'x'.repeat(2200) });
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  let count = 0;
  const adapter = await syntheticTools({
    dir,
    mutateRead: (page) => {
      count++;
      if (problem === 'changed item' && count > 1)
        return {
          ...page,
          items: page.items.map((item) => ({ ...item, updatedAt: 'changed' })),
        };
      if (problem === 'changed thread' && count > 1)
        return { ...page, thread: { ...page.thread, createdAt: 'changed' } };
      if (problem === 'stalled timeline')
        return { ...page, items: [], hasMore: true, nextPosition: 0 };

      if (problem === 'missing message')
        return { ...page, items: [], hasMore: false };
      return page;
    },
  });
  await expect(adapter.execute('dispatch')).rejects.toThrow();
  await expect(readFile(join(dir, 'dispatch.json'))).rejects.toThrow();
});
it('refuses an unchanged authentic #762 completion at INITIAL capture-owned binding with the same parent', async () => {
  // Same-parent capture is synthetic; the foreign status and original message are unchanged authentic observations.
  const caller = earlierOriginal.thread.parentThreadId;
  const { dir } = await fixture({ caller });
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({
    dir,
    caller,
    returned: earlier.result,
    status: earlier.result,
  });
  adapter.tools.mcp__t3_code__t3_thread_read = async () => earlierOriginal;
  await expect(adapter.execute('dispatch')).rejects.toThrow(
    'Original message differs from the full frozen nonce-bearing task',
  );
  await expect(readFile(join(dir, 'dispatch.json'))).rejects.toThrow();
});
it.each(['delegate', 'status', 'thread'])(
  'refuses %s tool error even when it carries plausible structured data',
  async (tool) => {
    const { dir } = await fixture();
    const { syntheticTools, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const adapter = await syntheticTools({ dir });
    const error = async () => ({
      isError: true,
      structuredContent: syntheticStatus(),
    });
    if (tool === 'delegate') adapter.direct.delegate_task = error;
    if (tool === 'status') adapter.tools.mcp__t3_code__task_status = error;
    if (tool === 'thread') adapter.tools.mcp__t3_code__t3_thread_read = error;
    await expect(adapter.execute('dispatch')).rejects.toThrow(
      'tool returned an error',
    );
    await expect(readFile(join(dir, 'dispatch.json'))).rejects.toThrow();
  },
);
it('executes the emitted code-mode source with injected callable tools', async () => {
  const { dir } = await fixture();
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({ dir });
  const { stdout } = await promisify(execFile)('node', [
    'scripts/catalog/start-without-tsx-cache.mjs',
    'scripts/catalog/t3-review-bridge.ts',
    '--code-mode',
  ]);
  // Safe cast: the emitted expression is the checked-in portable helper; this test exercises its actual JavaScript emission.
  const emitted = runInNewContext(stdout, {
    TextEncoder: undefined,
  }) as typeof runT3ReviewCodeMode;
  const context = { tools: adapter.tools, root: process.cwd(), dir };
  await expect(emitted({ ...context, operation: 'prepare' })).resolves.toEqual({
    ready: true,
  });
  const returned = await adapter.direct.delegate_task(
    JSON.parse(await readFile(join(dir, 'request.json'), 'utf8')),
  );
  await expect(
    emitted({ ...context, operation: 'bind', returned }),
  ).resolves.toEqual({ bound: true });
  // The emitted source builds its {} in another realm, so compare the bytes sent.
  expect(JSON.stringify(adapter.configures)).toBe('[{},{}]');
  // Only bind takes a return; the emitted JavaScript checks it too.
  for (const operation of ['capture', 'prepare', 'complete'] as const) {
    const args = { ...context, operation, returned };
    // @ts-expect-error called as untyped JavaScript could call it
    await expect(emitted(args)).rejects.toThrow('Only bind takes a dispatch');
  }
});
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
    accepts({ kind: 'staged', dir, offer: 'a', evidence: 'b' }),
    // @ts-expect-error neither form
    accepts({ dir }),
    // @ts-expect-error the form is named by its kind
    accepts({ dir, response: {}, observations: [] }),
    // @ts-expect-error the form is named by its kind
    accepts({ dir, offer: 'a', evidence: 'b' }),
    // @ts-expect-error the staged form needs its evidence
    accepts({ kind: 'staged', dir, offer: 'a' }),
    // @ts-expect-error the staged form needs its offer
    accepts({ kind: 'staged', dir, evidence: 'b' }),
    // @ts-expect-error the raw form needs its reads, even when absent
    accepts({ kind: 'raw', dir, response: {} }),
    // @ts-expect-error no mix: a staged offer with a raw status
    accepts({ kind: 'staged', dir, offer: 'a', evidence: 'b', response: {} }),
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
      response: {},
    },
  ],
  ['a staged offer alone', { kind: 'staged', offer: tmpdir() }],
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
    }),
  ).rejects.toThrow('not a transport directory');
  expect(await snapshot(dir)).toEqual(before);
});
it('reads the caller with t3_thread_configure and no arguments, so it can never set the model', async () => {
  const { root, dir } = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({ dir });
  await adapter.execute('dispatch');
  const report = join(root, 'report.md');
  await writeFile(report, 'Synthetic review report.\n');
  await adapter.execute('complete', report);
  // One read per operation (prepare, bind, complete), each with exactly {}:
  // modelSelection would set the caller's model.
  expect(adapter.configures).toStrictEqual([{}, {}, {}]);
  type Configure = Parameters<
    typeof runT3ReviewCodeMode
  >[0]['tools']['mcp__t3_code__t3_thread_configure'];
  expectTypeOf<Parameters<Configure>>().toEqualTypeOf<
    [args: Record<string, never>]
  >();
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
    args: i === 0 ? base : { ...base, afterPosition: i - 1 },
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
it('persists literal quotes and shell metacharacters in round paths and task text', async () => {
  const { dir, root } = await fixture({
    prefix: "O'Connor's literal $(printf bad) `printf bad` $HOME. ",
  });
  const { rename } = await import('node:fs/promises');
  const literalDir = join(root, "round ' $(printf bad) `printf bad`");
  await rename(dir, literalDir);
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  await (await syntheticTools({ dir: literalDir })).execute('dispatch');
  const binding = JSON.parse(
    await readFile(join(literalDir, 'dispatch.json'), 'utf8'),
  );
  expect(binding.original.text).toContain(
    "O'Connor's literal $(printf bad) `printf bad` $HOME.",
  );
});
it('leaves no binding on a response too large to persist through code mode', async () => {
  const { dir } = await fixture();
  const { syntheticTools, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({
    dir,
    returned: { ...syntheticStatus(), summary: 'x'.repeat(61000) },
  });
  const before = await snapshot(dir);
  await expect(adapter.execute('dispatch')).rejects.toThrow(
    'persistence bound',
  );
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
it('recovers a missing original run later without accepting absent identity as a binding', async () => {
  const { dir } = await fixture();
  const { syntheticTools, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const queued = {
    ...syntheticStatus(),
    childRunId: undefined,
    status: 'queued',
    workState: 'working',
  };
  const initial = await syntheticTools({
    dir,
    returned: queued,
    status: queued,
  });
  await expect(initial.execute('dispatch')).rejects.toThrow('pending/unbound');
  const [queuedReturn] = initial.returns;
  const recovered = await syntheticTools({ dir });
  await recovered.bind(queuedReturn);
  expect(recovered.requests).toHaveLength(0);
});
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
it('bounds report-file reads in the actual completion bridge before writing outputs', async () => {
  const { dir } = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({ dir });
  await adapter.execute('dispatch');
  const report = join(dir, 'oversized-report.md');
  await writeFile(report, Buffer.alloc(1000001, 'x'));
  const before = await snapshot(dir);
  await expect(adapter.execute('complete', report)).rejects.toThrow(
    'Review file exceeds',
  );
  expect(await snapshot(dir)).toEqual(before);
});

it.each([
  ['bare payload', ''],
  ['changed wrapper', 'Act as the implementation sub-agent for this task.\n\n'],
  [
    'duplicated wrapper',
    'Act as the review sub-agent for this task.\n\nAct as the review sub-agent for this task.\n\n',
  ],
  [
    'arbitrary preamble',
    'Please review:\n\nAct as the review sub-agent for this task.\n\n',
  ],
])(
  'rejects %s at capture-owned binding without changing captured outputs',
  async (_name, prefix) => {
    const { dir } = await fixture();
    const { syntheticTools, syntheticPage } =
      await import('./t3-code-mode-fixture');
    const request = z
      .object({ task: z.string() })
      .parse(JSON.parse(await readFile(join(dir, 'request.json'), 'utf8')));
    const adapter = await syntheticTools({
      dir,
      mutateRead: (_page, args) =>
        syntheticPage({
          task: prefix + request.task,
          offset: z.object({ textOffset: z.number().optional() }).parse(args)
            .textOffset,
        }),
    });
    const before = await snapshot(dir);
    await expect(adapter.execute('dispatch')).rejects.toThrow(
      'Original message differs',
    );
    expect(await snapshot(dir)).toEqual(before);
  },
);
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
