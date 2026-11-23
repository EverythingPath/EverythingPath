// @vitest-environment node
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { runT3ReviewCodeMode } from '../../scripts/catalog/t3-review-code-mode';
import { afterEach, expect, expectTypeOf, it, vi } from 'vitest';
import inventory from '../fixtures/t3-code-mode-inventory/recorded-2026-11-20.json';
import { readT3Review } from '../../scripts/catalog/t3-review-evidence';
import {
  cleanUp,
  fixture,
  otherTask,
  refusesSupplied,
  slow,
  snapshot,
} from './t3-review-harness';
import { reviewer } from './t3-code-mode-fixture';

/**
 * The operator's direct delegate_task return, supplied to the helper's bind:
 * the tools code mode exposes, a return that binds, and every refusal of a
 * wrong one (another task's, a changed request, another caller's, a replayed
 * or second return, a nested error, a changed selection, a live status that
 * differs), with the failures and recoveries around the direct call. Rules 1
 * and 5 each keep one test through the real bridge (bridge: 'process'); the
 * rest run the bridge's actions in this process (t3-bridge-in-process.ts).
 */
// The tests that run real bridge processes take the limit CI gives them,
// locally too (each start is a node process under tsx).
vi.setConfig({ testTimeout: slow });
afterEach(cleanUp);
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
// Rule 5 through the real bridge: every step a process, as code mode runs it.
it('dispatches the exact frozen object and binds an independently recovered original message, including fast completion', async () => {
  const { dir } = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({ dir, bridge: 'process' });
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
  await expect(readFile(join(dir, 'dispatch.json'))).rejects.toThrow('ENOENT');
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
])('rejects dispatch selection/identity %s', async (name, changes) => {
  const { dir } = await fixture();
  const { syntheticTools, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({
    dir,
    returned: { ...syntheticStatus(), ...changes },
    // Rule 1 (the input is validated) once through the real bridge.
    bridge: name === 'changed model' ? 'process' : 'in-process',
  });
  const before = await snapshot(dir);
  await expect(adapter.execute('dispatch')).rejects.toThrow(
    'T3 bridge failed or output was incomplete',
  );
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
    await expect(broken.execute('dispatch')).rejects.toThrow(
      failure === 'truncated read'
        ? 'Unexpected end of JSON input'
        : 'T3 bridge failed or output was incomplete',
    );
    await expect(readFile(join(dir, 'dispatch.json'))).rejects.toThrow(
      'ENOENT',
    );
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
  await expect(readFile(join(dir, 'dispatch-return.json'))).rejects.toThrow(
    'ENOENT',
  );
  const recovered = await syntheticTools({ dir });
  await recovered.execute('dispatch');
  expect(recovered.requests).toEqual([submitted]);
});
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
it('rejects a different actual caller before dispatch', async () => {
  const { dir } = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({ dir, caller: 'foreign:parent' });
  const before = await snapshot(dir);
  await expect(adapter.execute('dispatch')).rejects.toThrow('caller differs');
  expect(adapter.requests).toHaveLength(0);
  expect(await snapshot(dir)).toEqual(before);
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
    await expect(readFile(join(dir, 'dispatch.json'))).rejects.toThrow(
      'ENOENT',
    );
  },
);
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
