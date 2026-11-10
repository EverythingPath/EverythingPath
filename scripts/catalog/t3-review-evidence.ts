import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import {
  recoverT3Original,
  requireT3ReviewTaskFits,
} from './t3-original-message.ts';
import {
  hashReport,
  parseReviewedCovers,
  type ReviewedCover,
  type ReviewRun,
} from './review-receipts.ts';

const text = z.string().min(1);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const options = z.record(text, z.union([z.string(), z.boolean()]));
const identity = z.strictObject({
  providerInstanceId: text,
  model: text,
  options,
});
const request = z.strictObject({
  role: z.literal('review'),
  mode: z.literal('async'),
  clientRequestId: text,
  task: text.max(16000),
  title: text.optional(),
  isolation: z.enum(['shared', 'worktree']).optional(),
  target: identity,
});
const input = z.strictObject({
  kind: z.enum(['issue', 'source', 'brief']),
  identity: text,
  fetchedAt: z.iso.datetime(),
  path: text,
});
const configSchema = z.strictObject({
  author: identity,
  request: request.omit({ clientRequestId: true }),
  inputs: z.array(input).min(1),
});
const inputsSchema = z.strictObject({
  kind: z.literal('t3-review-inputs-v2'),
  nonce: z.uuid(),
  taskTemplate: text,
  caller: z.object({ threadId: text }).passthrough(),
  capturedAt: z.iso.datetime(),
  reviewedCommit: z.string().regex(/^[a-f0-9]{40}$/),
  author: identity,
  request,
  recordsSha256: hash,
  inputs: z
    .array(
      input
        .omit({ path: true })
        .extend({ file: z.string().regex(/^input-\d+$/), sha256: hash }),
    )
    .min(1),
});
// T3 task_status structuredContent. Unknown API fields are retained in the
// frozen raw response, but only these documented fields authorize completion.
const taskSchema = z.object({
  taskId: text,
  childThreadId: text,
  childNodeId: text,
  childRunId: text.nullish().transform((value) => value ?? null),
  providerInstanceId: text,
  model: text,
  options: z.array(
    z.object({ id: text, value: z.union([z.string(), z.boolean()]) }),
  ),
  status: z.enum([
    'queued',
    'running',
    'waiting',
    'completed',
    'failed',
    'cancelled',
    'interrupted',
  ]),
  workState: z.enum(['working', 'waiting_for_children', 'result_available']),
  hasPendingChildRuns: z.boolean(),
  hasPendingQuestion: z.boolean(),
  pendingApproval: z.union([
    z.null(),
    z.object({ requestId: text, runId: text, kind: text }),
  ]),
  latestTerminalRunId: text.nullable(),
  latestTerminalStatus: text.nullable(),
  waitTimedOut: z.boolean(),
  summary: text.nullable(),
  resultContextTransferId: text.nullable(),
});
const observationSchema = z.strictObject({
  args: z.unknown(),
  response: z.unknown(),
});
const bindingSchema = z.strictObject({
  // v2 replays bare equality; v3 uses local review-role-v1 exact wrapping.
  kind: z.enum(['t3-review-dispatch-v2', 't3-review-dispatch-v3']),
  dispatchReturnSha256: hash,
  observations: z.array(observationSchema).min(1).max(32),
  original: z.strictObject({
    text: text.max(16000),
    sha256: hash,
    itemId: text,
    messageId: text,
  }),
  capturedAt: z.iso.datetime(),
  inputsSha256: hash,
  response: z.unknown(),
});
const completionSchema = z.strictObject({
  kind: z.literal('t3-review-completed-v2'),
  capturedAt: z.iso.datetime(),
  inputsSha256: hash,
  dispatchSha256: hash,
  statusSha256: hash,
  reportSha256: hash,
});
const jsonBytes = (value: unknown) =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const json = (value: Uint8Array): unknown =>
  JSON.parse(Buffer.from(value).toString('utf8'));
async function freeze({
  dir,
  name,
  bytes,
}: {
  dir: string;
  name: string;
  bytes: Uint8Array;
}) {
  requireMatch(
    bytes.byteLength <= 1000000,
    `${name} exceeds the evidence size bound.`,
  );
  await writeFile(join(dir, name), bytes, { flag: 'wx', mode: 0o444 });
  await chmod(join(dir, name), 0o444);
}
async function frozen({ dir, name }: { dir: string; name: string }) {
  if ((await stat(join(dir, name))).mode & 0o222)
    throw new Error(`${name} is writable.`);
  requireMatch(
    (await stat(join(dir, name))).size <= 1000000,
    `${name} exceeds the evidence size bound.`,
  );
  return readFile(join(dir, name));
}
function requireMatch(matches: boolean, message: string): asserts matches {
  if (!matches) throw new Error(message);
}
function t3ToolData(response: unknown): unknown {
  const tool = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.unknown().optional(),
    })
    .passthrough()
    .parse(response);
  requireMatch(!tool.isError, 'T3 tool returned an error.');
  return tool.structuredContent === undefined
    ? response
    : tool.structuredContent;
}
function readTask(response: unknown) {
  return taskSchema.parse(t3ToolData(response));
}
function taskIdentity(task: z.infer<typeof taskSchema>) {
  const entries = task.options.map(({ id, value }) => [id, value] as const);
  requireMatch(
    new Set(entries.map(([id]) => id)).size === entries.length,
    'Duplicate T3 option IDs.',
  );
  return {
    providerInstanceId: task.providerInstanceId,
    model: task.model,
    options: Object.fromEntries(entries),
  };
}
function checkSelection({
  inputs,
  task,
}: {
  inputs: z.infer<typeof inputsSchema>;
  task: z.infer<typeof taskSchema>;
}) {
  requireMatch(
    isDeepStrictEqual(inputs.request.target, taskIdentity(task)),
    'T3 provider/model/options differ from the pre-dispatch request.',
  );
  requireMatch(
    inputs.author.model !== task.model,
    'T3 review must cross author/reviewer models.',
  );
}
function completed(task: z.infer<typeof taskSchema>) {
  requireMatch(
    task.childRunId !== null &&
      task.pendingApproval === null &&
      task.status === 'completed' &&
      task.workState === 'result_available' &&
      !task.hasPendingChildRuns &&
      !task.hasPendingQuestion &&
      !task.waitTimedOut &&
      task.latestTerminalRunId === task.childRunId &&
      task.latestTerminalStatus === 'completed' &&
      task.summary !== null &&
      task.resultContextTransferId !== null,
    'T3 original run has no completed terminal result, or has pending/later work.',
  );
}
async function readInputs(dir: string) {
  const bytes = await frozen({ dir, name: 'inputs.json' });
  const inputs = inputsSchema.parse(json(bytes));
  requireMatch(
    isDeepStrictEqual(
      json(await frozen({ dir, name: 'manifest.json' })),
      manifestOf(inputs),
    ),
    'T3 manifest changed.',
  );
  requireMatch(
    inputs.request.task === compileTask(inputs),
    'T3 frozen task does not match its manifest.',
  );
  requireMatch(
    isDeepStrictEqual(
      json(await frozen({ dir, name: 'request.json' })),
      inputs.request,
    ),
    'T3 dispatch request changed.',
  );
  requireMatch(
    inputs.taskTemplate.includes(inputs.reviewedCommit),
    'T3 request must name the exact reviewed commit.',
  );
  const records = await frozen({ dir, name: 'reviewed-records.json' });
  requireMatch(
    hashReport(records) === inputs.recordsSha256,
    'Pre-dispatch record snapshot changed.',
  );
  const seen = parseReviewedCovers(json(records));
  requireMatch(
    new Set(seen.map(({ id }) => id)).size === seen.length,
    'Duplicate pre-dispatch record IDs.',
  );
  requireMatch(
    inputs.inputs.some(({ kind }) => kind === 'issue'),
    'Missing archived issue input.',
  );
  for (const entry of inputs.inputs) {
    requireMatch(
      Date.parse(entry.fetchedAt) <= Date.parse(inputs.capturedAt),
      'Input fetch time follows capture.',
    );
    requireMatch(
      hashReport(await frozen({ dir, name: entry.file })) === entry.sha256,
      `Archived input ${entry.identity} changed.`,
    );
  }
  return { inputs, seen, sha256: hashReport(bytes) };
}

type Inputs = z.infer<typeof inputsSchema>;
function manifestOf(
  inputs: Pick<
    Inputs,
    | 'nonce'
    | 'caller'
    | 'reviewedCommit'
    | 'author'
    | 'request'
    | 'recordsSha256'
    | 'inputs'
  >,
) {
  const { task: _task, ...declarations } = inputs.request;
  return {
    kind: 't3-review-manifest-v2',
    nonce: inputs.nonce,
    callerThreadId: inputs.caller.threadId,
    reviewedCommit: inputs.reviewedCommit,
    author: inputs.author,
    declarations,
    recordsSha256: inputs.recordsSha256,
    inputs: inputs.inputs,
  };
}
function compileTask(
  inputs: Parameters<typeof manifestOf>[0] & { taskTemplate: string },
) {
  return `${inputs.taskTemplate}\n\nT3 review capture manifest (local declarations):\n${JSON.stringify(manifestOf(inputs), null, 2)}`;
}
function recoverOriginal({
  inputs,
  task,
  observations,
  policy = 'review-role-v1',
}: {
  inputs: Inputs;
  task: z.infer<typeof taskSchema>;
  observations: z.infer<typeof observationSchema>[];
  policy?: Parameters<typeof recoverT3Original>[0]['policy'];
}) {
  requireMatch(
    task.childRunId !== null,
    'T3 original run is pending/unbound; recover with task_status later.',
  );
  return recoverT3Original({
    parentThreadId: inputs.caller.threadId,
    childThreadId: task.childThreadId,
    childRunId: task.childRunId,
    expectedText: inputs.request.task,
    role: inputs.request.role,
    policy,
    observations,
    toolData: t3ToolData,
  });
}
function checkDispatchStatus({
  inputs,
  returned,
  task,
}: {
  inputs: Inputs;
  returned: z.infer<typeof taskSchema>;
  task: z.infer<typeof taskSchema>;
}) {
  checkSelection({ inputs, task });
  for (const key of ['taskId', 'childThreadId', 'childNodeId'] as const)
    requireMatch(
      returned[key] === task[key],
      `T3 ${key} differs from the tool return.`,
    );
  requireMatch(
    returned.childRunId === null || returned.childRunId === task.childRunId,
    'T3 original run differs from the tool return.',
  );
  requireMatch(
    !['failed', 'cancelled', 'interrupted'].includes(task.status),
    'Cannot bind an unsuccessful T3 task.',
  );
  requireMatch(
    !task.hasPendingChildRuns &&
      !task.hasPendingQuestion &&
      task.pendingApproval === null &&
      !task.waitTimedOut &&
      task.workState !== 'waiting_for_children',
    'T3 task has pending work.',
  );
  if (task.status === 'completed') completed(task);
}
async function readDispatchReturn({
  dir,
  inputs,
}: {
  dir: string;
  inputs: Inputs;
}) {
  const bytes = await frozen({ dir, name: 'dispatch-return.json' }).catch(
    () => {
      throw new Error(
        'Missing supported T3 request/task correlation: no capture-owned dispatch return.',
      );
    },
  );
  const task = readTask(json(bytes));
  checkSelection({ inputs, task });
  return { task, response: json(bytes), sha256: hashReport(bytes) };
}
/** Used only by the code-mode bridge, which calls the real delegate tool itself. */
export async function prepareT3Dispatch({
  dir,
  caller,
}: {
  dir: string;
  caller: unknown;
}) {
  const { inputs } = await readInputs(dir);
  const current = z.object({ threadId: text }).parse(t3ToolData(caller));
  requireMatch(
    current.threadId === inputs.caller.threadId,
    'T3 dispatch caller differs from capture.',
  );
  const exists = await stat(join(dir, 'dispatch-return.json')).then(
    () => true,
    () => false,
  );
  // Only a new dispatch uses today's representation. Historical completion
  // replays the policy selected by its binding, including bare-task-v2.
  if (!exists) requireT3ReviewTaskFits({ task: inputs.request.task });
  const returned = exists ? await readDispatchReturn({ dir, inputs }) : null;
  return { request: inputs.request, returned: returned?.response ?? null };
}
export async function saveT3DispatchReturn({
  dir,
  response,
}: {
  dir: string;
  response: unknown;
}) {
  const { inputs } = await readInputs(dir);
  const task = readTask(response);
  checkSelection({ inputs, task });
  requireMatch(
    !['failed', 'cancelled', 'interrupted'].includes(task.status),
    'Cannot save an unsuccessful T3 dispatch.',
  );
  await freeze({
    dir,
    name: 'dispatch-return.json',
    bytes: jsonBytes(response),
  });
}
export async function nextT3OriginalRead({
  dir,
  response,
  observations,
}: {
  dir: string;
  response: unknown;
  observations: unknown;
}) {
  const { inputs } = await readInputs(dir);
  const returned = await readDispatchReturn({ dir, inputs });
  const task = readTask(response);
  checkDispatchStatus({ inputs, returned: returned.task, task });
  return recoverOriginal({
    inputs,
    task,
    observations: z.array(observationSchema).max(32).parse(observations),
  });
}
async function readBoundedInput(path: string) {
  requireMatch(
    (await stat(path)).size <= 1000000,
    'Review input exceeds size bound.',
  );
  return readFile(path);
}
/** Run before delegate_task. Copies all inputs outside disposable checkouts. */
export async function captureT3Inputs({
  dir,
  config,
  reviewedCommit,
  seen,
  caller,
}: {
  caller: unknown;
  dir: string;
  config: unknown;
  reviewedCommit: string;
  seen: ReviewedCover[];
}) {
  const parsed = configSchema.parse(config);
  requireMatch(
    parsed.author.model !== parsed.request.target.model,
    'T3 review must cross author/reviewer models.',
  );
  requireMatch(
    parsed.inputs.some(({ kind }) => kind === 'issue'),
    'Missing archived issue input.',
  );
  requireMatch(
    parsed.request.task.includes(reviewedCommit),
    'T3 request must name the exact reviewed commit.',
  );
  const parent = z
    .object({ threadId: text })
    .passthrough()
    .parse(t3ToolData(caller));
  const capturedAt = new Date().toISOString();
  const files = await Promise.all(
    parsed.inputs.map(async ({ path, ...entry }, index) => ({
      ...entry,
      file: `input-${index}`,
      bytes: await readBoundedInput(path),
    })),
  );
  const records = jsonBytes(parseReviewedCovers(seen));
  requireMatch(
    records.length <= 1000000,
    'Record snapshot exceeds size bound.',
  );
  requireMatch(
    new Set(seen.map(({ id }) => id)).size === seen.length,
    'Duplicate pre-dispatch record IDs.',
  );
  const nonce = randomUUID();
  const provisional = inputsSchema.parse({
    kind: 't3-review-inputs-v2',
    nonce,
    taskTemplate: parsed.request.task,
    caller: parent,
    capturedAt,
    reviewedCommit,
    author: parsed.author,
    request: {
      ...parsed.request,
      clientRequestId: `t3-review-${randomUUID()}`,
    },
    recordsSha256: hashReport(records),
    inputs: files.map(({ bytes, ...entry }) => ({
      ...entry,
      sha256: hashReport(bytes),
    })),
  });
  const inputs = inputsSchema.parse({
    ...provisional,
    request: { ...provisional.request, task: compileTask(provisional) },
  });
  requireT3ReviewTaskFits({ task: inputs.request.task });
  for (const entry of inputs.inputs)
    requireMatch(
      Date.parse(entry.fetchedAt) <= Date.parse(capturedAt),
      'Input fetch time follows capture.',
    );
  await mkdir(dir); // A new directory per round; never replace earlier evidence.
  for (const file of files)
    await freeze({ dir, name: file.file, bytes: file.bytes });
  await freeze({ dir, name: 'reviewed-records.json', bytes: records });
  await freeze({
    dir,
    name: 'manifest.json',
    bytes: jsonBytes(manifestOf(inputs)),
  });
  await freeze({ dir, name: 'request.json', bytes: jsonBytes(inputs.request) });
  await freeze({ dir, name: 'inputs.json', bytes: jsonBytes(inputs) });
  return readInputs(dir);
}
/** Raw imported responses remain insufficient; the code-mode helper owns dispatch. */
export async function bindT3Dispatch({
  dir,
  response,
  observations,
}: {
  dir: string;
  response: unknown;
  observations?: unknown;
}) {
  const { inputs, sha256 } = await readInputs(dir);
  const returned = await readDispatchReturn({ dir, inputs });
  const task = readTask(response);
  checkDispatchStatus({ inputs, returned: returned.task, task });
  const reads = z.array(observationSchema).min(1).max(32).parse(observations);
  const recovered = recoverOriginal({ inputs, task, observations: reads });
  requireMatch(
    recovered.kind === 'complete',
    'Incomplete original-message evidence.',
  );
  const original = {
    text: recovered.text,
    sha256: hashReport(Buffer.from(recovered.text)),
    itemId: recovered.itemId,
    messageId: recovered.messageId,
  };
  await freeze({
    dir,
    name: 'dispatch.json',
    bytes: jsonBytes({
      kind: 't3-review-dispatch-v3',
      capturedAt: new Date().toISOString(),
      inputsSha256: sha256,
      dispatchReturnSha256: returned.sha256,
      response,
      observations: reads,
      original,
    }),
  });
}
async function readBinding({
  dir,
  inputsSha256,
}: {
  dir: string;
  inputsSha256: string;
}) {
  const bytes = await frozen({ dir, name: 'dispatch.json' });
  const raw = json(bytes);
  requireMatch(
    z.object({ kind: bindingSchema.shape.kind }).safeParse(raw).success,
    'Missing supported T3 request/task correlation (uncorrelated v1 binding).',
  );
  const binding = bindingSchema.parse(raw);
  requireMatch(
    binding.inputsSha256 === inputsSha256,
    'Dispatch inputs changed.',
  );
  const { inputs } = await readInputs(dir);
  const returned = await readDispatchReturn({ dir, inputs });
  requireMatch(
    binding.dispatchReturnSha256 === returned.sha256,
    'Dispatch return changed.',
  );
  const task = readTask(binding.response);
  checkDispatchStatus({ inputs, returned: returned.task, task });
  const recovered = recoverOriginal({
    inputs,
    task,
    observations: binding.observations,
    policy:
      binding.kind === 't3-review-dispatch-v2'
        ? 'bare-task-v2'
        : 'review-role-v1',
  });
  requireMatch(
    recovered.kind === 'complete',
    'Incomplete original-message evidence.',
  );
  requireMatch(
    isDeepStrictEqual(binding.original, {
      text: recovered.text,
      sha256: hashReport(Buffer.from(recovered.text)),
      itemId: recovered.itemId,
      messageId: recovered.messageId,
    }),
    'Recovered original-message archive changed.',
  );
  return { binding, task, sha256: hashReport(bytes) };
}
function checkCompletion({
  inputs,
  binding,
  dispatched,
  status,
  capturedAt,
}: {
  inputs: z.infer<typeof inputsSchema>;
  binding: z.infer<typeof bindingSchema>;
  dispatched: z.infer<typeof taskSchema>;
  status: z.infer<typeof taskSchema>;
  capturedAt: string;
}) {
  checkSelection({ inputs, task: dispatched });
  checkSelection({ inputs, task: status });
  completed(status);
  for (const key of [
    'taskId',
    'childThreadId',
    'childNodeId',
    'childRunId',
  ] as const)
    requireMatch(
      dispatched[key] === status[key],
      `T3 ${key} differs from dispatch.`,
    );
  requireMatch(
    Date.parse(inputs.capturedAt) <= Date.parse(binding.capturedAt) &&
      Date.parse(binding.capturedAt) <= Date.parse(capturedAt),
    'T3 capture chronology is inconsistent.',
  );
}
/** Freeze actual task_status plus the completed full report, never a prose-only claim. */
export async function completeT3Review({
  dir,
  response,
  report,
}: {
  dir: string;
  response: unknown;
  report: Uint8Array;
}) {
  const { inputs, sha256 } = await readInputs(dir);
  const {
    binding,
    task,
    sha256: dispatchSha256,
  } = await readBinding({ dir, inputsSha256: sha256 });
  const capturedAt = new Date().toISOString();
  checkCompletion({
    inputs,
    binding,
    dispatched: task,
    status: readTask(response),
    capturedAt,
  });
  requireMatch(
    report.byteLength <= 1000000 &&
      Buffer.from(report).toString('utf8').trim().length > 0,
    'T3 review has no report.',
  );
  const status = jsonBytes(response);
  requireMatch(
    status.byteLength <= 1000000,
    'T3 status exceeds the evidence size bound.',
  );
  for (const name of ['status.json', 'report.snapshot.md', 'completed.json'])
    requireMatch(
      !(await stat(join(dir, name)).then(
        () => true,
        () => false,
      )),
      `${name} already exists.`,
    );
  await freeze({ dir, name: 'status.json', bytes: status });
  await freeze({ dir, name: 'report.snapshot.md', bytes: report });
  await freeze({
    dir,
    name: 'completed.json',
    bytes: jsonBytes({
      kind: 't3-review-completed-v2',
      capturedAt,
      inputsSha256: sha256,
      dispatchSha256,
      statusSha256: hashReport(status),
      reportSha256: hashReport(report),
    }),
  });
  return readT3Review({ dir });
}
/** Revalidate the entire durable chain on record AND every --verify. */
export async function readT3Review({ dir }: { dir: string }) {
  const bytes = await frozen({ dir, name: 'completed.json' });
  requireMatch(
    z
      .object({ kind: z.literal('t3-review-completed-v2') })
      .safeParse(json(bytes)).success,
    'Missing supported T3 request/task correlation (uncorrelated v1 completion).',
  );
  const completion = completionSchema.parse(json(bytes));
  const { inputs, seen, sha256 } = await readInputs(dir);
  requireMatch(
    completion.inputsSha256 === sha256,
    'T3 completed inputs changed.',
  );
  const {
    binding,
    task,
    sha256: dispatchSha256,
  } = await readBinding({ dir, inputsSha256: sha256 });
  requireMatch(
    completion.dispatchSha256 === dispatchSha256,
    'T3 dispatch changed.',
  );
  const status = await frozen({ dir, name: 'status.json' });
  requireMatch(
    completion.statusSha256 === hashReport(status),
    'T3 terminal status changed.',
  );
  const terminal = readTask(json(status));
  checkCompletion({
    inputs,
    binding,
    dispatched: task,
    status: terminal,
    capturedAt: completion.capturedAt,
  });
  const report = await frozen({ dir, name: 'report.snapshot.md' });
  requireMatch(
    completion.reportSha256 === hashReport(report) &&
      report.toString('utf8').trim().length > 0,
    'T3 report snapshot changed or empty.',
  );
  requireMatch(
    isDeepStrictEqual(
      json(await frozen({ dir, name: 'request.json' })),
      inputs.request,
    ),
    'T3 dispatch request changed.',
  );
  const run: Extract<ReviewRun, { kind: 't3' }> = {
    kind: 't3',
    runId: `t3-review-${sha256}`,
    reportSha256: completion.reportSha256,
    reviewedBy: `${terminal.model} (${terminal.providerInstanceId}; AI review) for the owner`,
    reviewedOn: completion.capturedAt.slice(0, 10),
    evidence: {
      kind: 't3',
      sha256: hashReport(bytes),
      reviewedCommit: inputs.reviewedCommit,
    },
  };
  return { run, report, seen };
}
