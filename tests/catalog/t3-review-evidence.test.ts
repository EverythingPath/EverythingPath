// @vitest-environment node
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { z } from 'zod';
import type { runT3ReviewCodeMode } from '../../scripts/catalog/t3-review-code-mode';
import { afterEach, expect, it } from 'vitest';
import earlier from '../fixtures/review-766/earlier-762-spec.json';
import earlierOriginal from '../fixtures/review-766/earlier-762-original.json';
import {
  captureT3Inputs,
  bindT3Dispatch,
  completeT3Review,
  readT3Review,
} from '../../scripts/catalog/t3-review-evidence';

// Synthetic workflow evidence only; no live review or promotion.
const directories: string[] = [];
afterEach(async () => {
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
async function fixture({ prefix = '', caller = 'synthetic:parent' } = {}) {
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
      target: reviewer,
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
  await expect(bindT3Dispatch({ dir, response })).rejects.toThrow(
    'request/task correlation',
  );
  expect(await snapshot(dir)).toEqual(before);
});
async function snapshot(dir: string) {
  const { readdir } = await import('node:fs/promises');
  return Object.fromEntries(
    await Promise.all(
      (await readdir(dir)).map(async (name) => [
        name,
        (await readFile(join(dir, name))).toString('base64'),
      ]),
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
  await expect(bindT3Dispatch({ dir, response })).rejects.toThrow();
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
      bindT3Dispatch({ dir, response: result() }),
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
    JSON.stringify({
      capturedAt: new Date().toISOString(),
      inputsSha256: hashReport(await readFile(join(dir, 'inputs.json'))),
      response: earlier.result,
    }),
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
    const after = await snapshot(dir);
    delete after['dispatch-return.json'];
    expect(after).toEqual(before);
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
  const recovered = await syntheticTools({ dir });
  await recovered.execute('bind');
  expect(recovered.requests).toHaveLength(0);
  expect(initial.requests).toHaveLength(1);
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
  adapter.tools.mcp__t3_code__delegate_task = async () => ({
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
  'stops on %s failure and reuses the frozen retry key on recovery',
  async (failure) => {
    const { dir } = await fixture();
    const { syntheticTools } = await import('./t3-code-mode-fixture');
    const broken = await syntheticTools({
      dir,
      mutateExec: ({ cmd }) => {
        if (failure === 'persistence' && cmd.includes('"action":"returned"'))
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
    await recovered.execute('dispatch');
    if (failure === 'persistence')
      expect(recovered.requests).toEqual(broken.requests);
  },
);
it('stops on a lost delegate response and retries the identical frozen object', async () => {
  const { dir } = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const broken = await syntheticTools({ dir });
  let submitted: unknown;
  broken.tools.mcp__t3_code__delegate_task = async (request) => {
    submitted = request;
    throw new Error('Response lost');
  };
  await expect(broken.execute('dispatch')).rejects.toThrow('Response lost');
  await expect(readFile(join(dir, 'dispatch-return.json'))).rejects.toThrow();
  const recovered = await syntheticTools({ dir });
  await recovered.execute('dispatch');
  expect(recovered.requests).toEqual([submitted]);
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
    if (tool === 'delegate') adapter.tools.mcp__t3_code__delegate_task = error;
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
    '--import',
    'tsx',
    'scripts/catalog/t3-review-bridge.ts',
    '--code-mode',
  ]);
  // Safe cast: the emitted expression is the checked-in portable helper; this test exercises its actual JavaScript emission.
  const emitted = runInNewContext(stdout, {
    TextEncoder: undefined,
  }) as typeof runT3ReviewCodeMode;
  await expect(
    emitted({
      tools: adapter.tools,
      root: process.cwd(),
      dir,
      operation: 'dispatch',
    }),
  ).resolves.toEqual({ bound: true });
});

it('fails closed when complete timeline recovery exceeds its read bound', async () => {
  const { dir } = await fixture();
  const { syntheticStatus, syntheticPage } =
    await import('./t3-code-mode-fixture');
  const { saveT3DispatchReturn, nextT3OriginalRead } =
    await import('../../scripts/catalog/t3-review-evidence');
  await saveT3DispatchReturn({ dir, response: syntheticStatus() });
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
    nextT3OriginalRead({ dir, response: syntheticStatus(), observations }),
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
it('requires independent original-message observations even with a capture-owned return', async () => {
  const { dir } = await fixture();
  const { syntheticStatus } = await import('./t3-code-mode-fixture');
  const { saveT3DispatchReturn } =
    await import('../../scripts/catalog/t3-review-evidence');
  await saveT3DispatchReturn({ dir, response: syntheticStatus() });
  const before = await snapshot(dir);
  await expect(
    bindT3Dispatch({ dir, response: syntheticStatus() }),
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
  await expect(
    (await syntheticTools({ dir, returned: queued, status: queued })).execute(
      'dispatch',
    ),
  ).rejects.toThrow('pending/unbound');
  const recovered = await syntheticTools({ dir });
  await recovered.execute('bind');
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
  await writeFile(path, JSON.stringify(binding));
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
    const after = await snapshot(dir);
    delete after['dispatch-return.json']; // The real dispatch-owning seam retains its raw return.
    expect(after).toEqual(before);
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
    const { saveT3DispatchReturn } =
      await import('../../scripts/catalog/t3-review-evidence');
    const { hashReport } =
      await import('../../scripts/catalog/review-receipts');
    const inputs = await readFile(join(dir, 'inputs.json'));
    const request = z
      .object({ task: z.string() })
      .parse(JSON.parse(await readFile(join(dir, 'request.json'), 'utf8')));
    const response = { structuredContent: syntheticStatus() };
    await saveT3DispatchReturn({ dir, response });
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
