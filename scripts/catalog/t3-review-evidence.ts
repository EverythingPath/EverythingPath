import { randomUUID } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  rm,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, sep } from 'node:path';
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
/**
 * Whether the bytes are exactly what `jsonBytes` writes for the value they
 * parse to, final newline included: bytes that are not JSON, or that hold
 * other whitespace or trailing bytes (a write cut short, or not bind's), are
 * not.
 */
function canonical(bytes: Uint8Array) {
  try {
    return Buffer.compare(jsonBytes(json(bytes)), bytes) === 0;
  } catch {
    return false;
  }
}
/**
 * Creates `name` exclusively with mode 0444, set on the open descriptor
 * before the first byte is written (the umask can narrow the created mode),
 * then writes, flushes and closes: no mode, owner or time is ever changed by
 * path, and never on a file this call did not create.
 */
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
  const handle = await open(join(dir, name), 'wx', 0o444);
  try {
    await handle.chmod(0o444);
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}
const errorCode = (error: unknown) =>
  z.object({ code: z.string() }).safeParse(error).data?.code;
/**
 * Creates `name` in the round with this attempt's verified bytes, written
 * directly with an exclusive create (no temporary file, link or rename): false
 * when `name` exists, which is left as it is. Nothing in a round is ever
 * replaced. A write interrupted part-way leaves a file whose bytes are not
 * the ones bind writes, which no later bind accepts.
 */
async function create({
  dir,
  name,
  bytes,
}: {
  dir: string;
  name: string;
  bytes: Uint8Array;
}) {
  try {
    await freeze({ dir, name, bytes });
    return true;
  } catch (error) {
    if (errorCode(error) === 'EEXIST') return false;
    throw error;
  }
}
/** Whether a file exists; an error other than its absence is thrown. */
const present = (path: string) =>
  stat(path).then(
    () => true,
    (error: unknown) => {
      if (errorCode(error) === 'ENOENT') return false;
      throw error;
    },
  );
/** A frozen file's bytes, or null when it does not exist. */
async function frozenIfPresent({ dir, name }: { dir: string; name: string }) {
  const found = await stat(join(dir, name)).catch((error: unknown) => {
    if (z.object({ code: z.literal('ENOENT') }).safeParse(error).success)
      return null;
    throw error;
  });
  if (found === null) return null;
  if (found.mode & 0o222) throw new Error(`${name} is writable.`);
  requireMatch(
    found.size <= 1000000,
    `${name} exceeds the evidence size bound.`,
  );
  return readFile(join(dir, name));
}
async function frozen({ dir, name }: { dir: string; name: string }) {
  const bytes = await frozenIfPresent({ dir, name });
  if (bytes === null) throw new Error(`${name} does not exist.`);
  return bytes;
}
/**
 * Transport files carry what a code-mode bind attempt hands its later bridge
 * steps outside the bounded payloads: the return it checked (its offer) and
 * the status and reads it collected (its evidence). Each is alone in a private
 * directory that the step writing it makes with mkdtemp in the system
 * temporary directory; a later step reads only the directory it is handed in
 * its own call, and the attempt removes it, best effort (a failed removal
 * leaves it behind, and nothing reads it). Nothing is created at a path
 * derived from a round's path.
 */
const transportPattern = /^t3-review-transport-[A-Za-z0-9]{6}$/;
const transportFiles = { offer: 'return.json', evidence: 'evidence.json' };
/**
 * What a round command operates on, for the temporary-directory check: one
 * round's directory (`round`: capture's new one, the round prepare, bind and
 * completion are given, the archive --t3-run records), or every archive
 * --verify verifies (`archives`: the runs directory `runs` it is given and the
 * receipts' run ids, each an archive in it).
 */
export type TemporaryDirectoryScope =
  | { kind: 'round'; round: string }
  | { kind: 'archives'; runs: string; runIds: readonly string[] };
/**
 * The real path of `path` as the file system resolves it (a link before a
 * `..` is followed first; nothing is normalised as text): of the path, or of
 * its nearest existing ancestor, then the rest, name by name.
 */
async function realPathOf(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    const name = basename(path);
    const parent = dirname(path);
    if (
      errorCode(error) !== 'ENOENT' ||
      parent === path ||
      name === '.' ||
      name === '..'
    )
      throw error;
    return join(await realPathOf(parent), name);
  }
}
/**
 * A scope resolved once, by real path, with the directories it protects, in
 * the order the decline names the first one TMPDIR meets: a round and the
 * directory holding it (the runs directory, so every round beside it is
 * covered), and, for a round given as an entry that links elsewhere, the
 * directory holding the entry as given too (its own runs directory, where its
 * sibling rounds are; for a plain directory the two are one); for --verify each archive, the runs directory it is given and the
 * directory holding each archive (the runs directory unless an archive is a
 * link elsewhere). `directory`, the round's or the runs directory's real path,
 * is what the command then uses.
 */
async function protectedDirectories(scope: TemporaryDirectoryScope) {
  if (scope.kind === 'round') {
    const round = await realPathOf(scope.round);
    const given = await realPathOf(dirname(scope.round));
    return {
      directory: round,
      protect: [
        { what: "this round's directory", path: round },
        { what: 'the directory holding this round', path: dirname(round) },
        { what: 'the directory holding this round as given', path: given },
      ],
    };
  }
  const runs = await realPathOf(scope.runs);
  const archives = await Promise.all(
    scope.runIds.map((runId) => realPathOf(join(runs, runId))),
  );
  return {
    directory: runs,
    protect: [
      ...archives.map((path) => ({ what: 'an archive this verifies', path })),
      { what: 'the runs directory this verifies', path: runs },
      ...archives.map((path) => ({
        what: 'the directory holding an archive this verifies',
        path: dirname(path),
      })),
    ],
  };
}
/**
 * Refuses a system temporary directory (TMPDIR) whose real path is, is
 * inside or contains a round the command operates on or the directory holding
 * it (`scope`, protectedDirectories), compared by real path, before the
 * command does anything: so nothing a round command makes in TMPDIR lands in
 * the runs directory it works in, whichever round there TMPDIR names. A round
 * kept somewhere else entirely is outside this rule. Nothing is inferred from
 * file names. TMPDIR, the round and the runs directory are each resolved once,
 * here, by the file system, and what this returns (`temporary`, TMPDIR's real
 * path, and `directory`, the round's or the runs directory's) is what the
 * command uses, so what is checked is where it writes. `retry` says what to do once TMPDIR is
 * elsewhere. Every round command checks this first: the record step's
 * --capture-t3, --bind-t3, --complete-t3, --t3-run and --verify, and every
 * bridge action, which then makes, reads and removes its transport
 * directories under the `temporary` this returned; nothing else reads TMPDIR.
 */
export async function requireTemporaryDirectoryOutside(
  scope: TemporaryDirectoryScope,
  retry: string,
) {
  const temporary = await realpath(tmpdir());
  const within = (path: string, directory: string) =>
    path === directory ||
    path.startsWith(directory.endsWith(sep) ? directory : directory + sep);
  const { directory, protect } = await protectedDirectories(scope);
  const met = protect.find(
    ({ path }) => within(temporary, path) || within(path, temporary),
  );
  if (met !== undefined)
    throw new Error(
      `The system temporary directory (TMPDIR, ${temporary}) is ${met.what} (${met.path}), inside it or contains it; nothing done. Set TMPDIR to a directory outside ${scope.kind === 'round' ? 'the directory holding this round' : 'the runs directory and every archive'} and ${retry}.`,
    );
  return { temporary, directory };
}
/** What to do after bind declines a file it found in the round. */
const bindOnceMore =
  'Bind once more with the same return; if that is declined too, abandon the round and capture anew.';
/**
 * The diagnostic for a dispatch.json that bind found (`found`) and did not
 * acknowledge, with what bind compared, what it wrote (`wrote`) and what to do.
 */
const unacknowledged = (found: string, wrote: string) =>
  `${found} and was not acknowledged: bind acknowledges one only when the saved return's bytes equal the bytes it writes for the supplied return and the binding's bytes equal their canonical form and name that return's hash; ${wrote}. ${bindOnceMore}`;
/**
 * A transport directory made in `temporary`, the TMPDIR the action's entry
 * check accepted (requireTemporaryDirectoryOutside), holding `file`.
 */
async function writeTransport({
  temporary,
  file,
  bytes,
}: {
  temporary: string;
  file: keyof typeof transportFiles;
  bytes: Uint8Array;
}) {
  const directory = await mkdtemp(join(temporary, 't3-review-transport-'));
  await freeze({ dir: directory, name: transportFiles[file], bytes });
  return directory;
}
/**
 * The handed path, refused unless it is a transport directory's: a name of a
 * transport directory's shape directly in `temporary`, TMPDIR's real path
 * (where writeTransport makes them), exactly as written there.
 */
function transportDirectory(handed: string, temporary: string) {
  requireMatch(
    transportPattern.test(basename(handed)) &&
      handed === join(temporary, basename(handed)),
    'The path handed to bind is not a transport directory; nothing written.',
  );
  return handed;
}
const readTransport = async ({
  file,
  handed,
  temporary,
}: {
  file: keyof typeof transportFiles;
  handed: string;
  temporary: string;
}) =>
  json(
    await frozen({
      dir: transportDirectory(handed, temporary),
      name: transportFiles[file],
    }),
  );
const readEvidence = async (evidence: string, temporary: string) =>
  z
    .strictObject({ response: z.unknown(), observations: z.unknown() })
    .parse(
      await readTransport({ file: 'evidence', handed: evidence, temporary }),
    );
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
/** The checks on a live status that need no return. */
function checkLiveStatus({
  inputs,
  task,
}: {
  inputs: Inputs;
  task: z.infer<typeof taskSchema>;
}) {
  checkSelection({ inputs, task });
  checkLiveWork(task);
}
/** A live status's outcome and pending work. */
function checkLiveWork(task: z.infer<typeof taskSchema>) {
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
  checkLiveWork(task);
}
/**
 * The saved return, else the supplied one. A supplied return never differs
 * from a saved one.
 */
const missingReturn =
  'Missing supported T3 request/task correlation: no capture-owned dispatch return.';
const readSavedReturn = (dir: string) =>
  frozenIfPresent({ dir, name: 'dispatch-return.json' }).catch(() => {
    throw new Error(missingReturn);
  });
async function readDispatchReturn({
  dir,
  inputs,
  supplied,
  savedBytes,
  intact = false,
}: {
  dir: string;
  inputs: Inputs;
  supplied?: unknown;
  /** The saved return, when the caller has already read it. */
  savedBytes?: Buffer | null;
  /**
   * For bind and completion: a saved return with none supplied must be the
   * bytes bind writes for what it parses to (archive verification as before).
   */
  intact?: boolean;
}) {
  if (savedBytes === undefined) savedBytes = await readSavedReturn(dir);
  const saved = savedBytes !== null;
  const bytes =
    savedBytes ?? (supplied !== undefined ? jsonBytes(supplied) : null);
  requireMatch(bytes !== null, missingReturn);
  if (saved && supplied !== undefined)
    requireMatch(
      // Byte-equal: a saved return cut short or written otherwise differs.
      Buffer.compare(bytes, jsonBytes(supplied)) === 0,
      'Supplied T3 dispatch return differs from the saved one. Compared: the saved bytes with the bytes bind writes for the supplied return; nothing written.',
    );
  else if (saved && intact)
    requireMatch(
      canonical(bytes),
      'The saved T3 dispatch return is not the bytes bind writes for it; nothing written.',
    );
  const task = readTask(json(bytes));
  checkSelection({ inputs, task });
  if (!saved)
    requireMatch(
      !['failed', 'cancelled', 'interrupted'].includes(task.status),
      'Cannot bind an unsuccessful T3 dispatch.',
    );
  return {
    task,
    response: json(bytes),
    bytes,
    saved,
    sha256: hashReport(bytes),
  };
}
/** Used only by the code-mode bridge: before the direct call, and at bind. */
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
  const savedBytes = await readSavedReturn(dir);
  const saved =
    savedBytes === null
      ? null
      : await readDispatchReturn({ dir, inputs, savedBytes });
  // Only a new dispatch uses today's representation. Historical completion
  // replays the policy selected by its binding, including bare-task-v2.
  if (saved === null) requireT3ReviewTaskFits({ task: inputs.request.task });
  return { ready: true, returned: saved?.response ?? null };
}
/** Rule 2: a round with completed.json is refused, with no write. */
async function refuseCompleted(dir: string) {
  requireMatch(
    !(await present(join(dir, 'completed.json'))),
    'A completed round is never bound again; nothing written.',
  );
}
/**
 * Whether the saved return is the supplied one and dispatch.json is a
 * complete binding that names its hash, checked on archived evidence alone.
 */
async function boundAlready({
  dir,
  inputsSha256,
  returned,
}: {
  dir: string;
  inputsSha256: string;
  returned: { saved: boolean };
}) {
  if (!returned.saved || !(await present(join(dir, 'dispatch.json'))))
    return false;
  return readBinding({ dir, inputsSha256, intact: true }).then(
    () => true,
    () => false,
  );
}
/**
 * Rules 2 to 4, on a validated return (rule 1): a completed round is refused;
 * the same return on an intact binding that names its hash is success (true);
 * any other dispatch.json (a binding of another return, partial or invalid)
 * is refused. None writes anything.
 */
async function boundOrRefused({
  dir,
  inputsSha256,
  returned,
}: {
  dir: string;
  inputsSha256: string;
  returned: { saved: boolean };
}) {
  await refuseCompleted(dir);
  if (await boundAlready({ dir, inputsSha256, returned })) return true;
  requireMatch(
    !(await present(join(dir, 'dispatch.json'))),
    unacknowledged('A dispatch.json exists', 'nothing written'),
  );
  return false;
}
/**
 * The code-mode bind's first step, before any T3 tool call: rules 1 to 4 on
 * the supplied return (or, with none, the saved one), with no write.
 */
export async function offerT3DispatchReturn({
  dir,
  returned,
}: {
  dir: string;
  returned?: unknown;
}) {
  const { inputs, sha256 } = await readInputs(dir);
  const checked = await readDispatchReturn({
    dir,
    inputs,
    supplied: returned,
    intact: true,
  });
  return {
    bound: await boundOrRefused({
      dir,
      inputsSha256: sha256,
      returned: checked,
    }),
  };
}
/**
 * After the caller check (prepare), rules 1 to 4 again, then this attempt's
 * return goes to a transport file for its own later steps: its offer (the
 * transport directory) and the task to read.
 */
export async function stageT3DispatchReturn({
  dir,
  returned,
  temporary,
}: {
  dir: string;
  returned?: unknown;
  /** The TMPDIR the action's entry check accepted. */
  temporary: string;
}) {
  const { inputs, sha256 } = await readInputs(dir);
  const checked = await readDispatchReturn({
    dir,
    inputs,
    supplied: returned,
    intact: true,
  });
  if (await boundOrRefused({ dir, inputsSha256: sha256, returned: checked }))
    return { bound: true };
  const offer = await writeTransport({
    temporary,
    file: 'offer',
    bytes: checked.bytes,
  });
  return { bound: false, offer, taskId: checked.task.taskId };
}
/**
 * Before any original-message read: the live status against this attempt's
 * transported return (the bounded next steps check the status alone).
 */
export async function checkT3DispatchStatus({
  dir,
  offer,
  response,
  temporary,
}: {
  dir: string;
  offer: string;
  response: unknown;
  /** The TMPDIR the action's entry check accepted. */
  temporary: string;
}) {
  const { inputs } = await readInputs(dir);
  const returned = await readDispatchReturn({
    dir,
    inputs,
    supplied: await readTransport({ file: 'offer', handed: offer, temporary }),
  });
  checkDispatchStatus({
    inputs,
    returned: returned.task,
    task: readTask(response),
  });
  return { checked: true };
}
/**
 * Removing a bind attempt's own transport directories is best effort; a
 * handed path without a transport directory's shape directly in `temporary`,
 * the TMPDIR the action's entry check accepted, is left alone (and nothing is
 * removed while TMPDIR is declined: that check fails first).
 */
export async function discardT3DispatchReturn({
  offer,
  evidence,
  temporary,
}: {
  offer?: string;
  evidence?: string;
  temporary: string;
}) {
  for (const handed of [offer, evidence])
    if (handed !== undefined)
      await Promise.resolve()
        .then(() =>
          rm(transportDirectory(handed, temporary), {
            recursive: true,
            force: true,
          }),
        )
        .catch(() => undefined);
  return { discarded: true };
}
/** A bounded step: its payload is the status and the reads so far, alone. */
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
  const task = readTask(response);
  checkLiveStatus({ inputs, task });
  return recoverOriginal({
    inputs,
    task,
    observations: z.array(observationSchema).max(32).parse(observations),
  });
}
/**
 * The bounded bind step: the status and the complete reads, validated and
 * put in a transport file for this attempt's publication (`bindT3Dispatch`
 * with its offer).
 */
export async function stageT3DispatchEvidence({
  dir,
  response,
  observations,
  temporary,
}: {
  dir: string;
  response: unknown;
  observations: unknown;
  /** The TMPDIR the action's entry check accepted. */
  temporary: string;
}) {
  readTask(response);
  const reads = z.array(observationSchema).min(1).max(32).parse(observations);
  await refuseCompleted(dir);
  const evidence = await writeTransport({
    temporary,
    file: 'evidence',
    bytes: jsonBytes({ response, observations: reads }),
  });
  return { evidence };
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
/**
 * Bind's input, named by its kind: the raw form (a status and its reads, which
 * a raw import has none of, and optionally the return) or the staged form
 * (this code-mode attempt's transport directories: its return and its status
 * and reads), whole and never mixed.
 */
type BindInput = { dir: string } & (
  | {
      kind: 'raw';
      response: unknown;
      observations: unknown;
      returned?: unknown;
      offer?: never;
      evidence?: never;
      temporary?: never;
    }
  | {
      kind: 'staged';
      /** This code-mode attempt's transported return. */
      offer: string;
      /** This code-mode attempt's transported status and reads. */
      evidence: string;
      /** The TMPDIR the action's entry check accepted, holding both. */
      temporary: string;
      response?: never;
      observations?: never;
      returned?: never;
    }
);
/** The input's form, checked at run time too: untyped callers reach bind. */
function bindForm(args: BindInput): BindInput {
  const given = (key: string) => Reflect.get(args, key) !== undefined;
  const kind: unknown = Reflect.get(args, 'kind');
  requireMatch(
    kind === 'staged'
      ? typeof args.offer === 'string' &&
          typeof args.evidence === 'string' &&
          typeof args.temporary === 'string' &&
          !['response', 'observations', 'returned'].some(given)
      : kind === 'raw' &&
          'response' in args &&
          !['offer', 'evidence', 'temporary'].some(given),
    'Bind takes its raw form or its staged form, named by its kind, whole and unmixed.',
  );
  return args;
}
/**
 * Raw imported responses remain insufficient: binding needs a dispatch return
 * (saved or supplied, or transported by this code-mode attempt as its offer)
 * plus original-message reads (supplied, or transported as its evidence). In
 * order: (1) the input is validated; (2) a completed round is refused; (3) the
 * same return on an intact binding that names its hash is success; (4) any
 * other dispatch.json is refused; (5) otherwise every check runs, and the
 * verified bytes are written directly into the round, each with an exclusive
 * create that fails if the name exists: the return (equal existing bytes
 * carry on, different ones refuse), then, with completed.json checked again
 * just before, the binding, whose failed create is success only if the
 * binding there names this return's hash. Rules 2 to 4 write nothing.
 */
export async function bindT3Dispatch(args: BindInput) {
  const { dir } = args;
  const form = bindForm(args);
  try {
    const { inputs, sha256 } = await readInputs(dir);
    const returned = await readDispatchReturn({
      dir,
      inputs,
      supplied:
        form.kind === 'raw'
          ? form.returned
          : await readTransport({
              file: 'offer',
              handed: form.offer,
              temporary: form.temporary,
            }),
      intact: true,
    });
    const { response, observations } =
      form.kind === 'raw'
        ? form
        : await readEvidence(form.evidence, form.temporary);
    const task = readTask(response);
    const reads = z.array(observationSchema).min(1).max(32).parse(observations);
    if (await boundOrRefused({ dir, inputsSha256: sha256, returned })) return;
    checkDispatchStatus({ inputs, returned: returned.task, task });
    const recovered = recoverOriginal({ inputs, task, observations: reads });
    requireMatch(
      recovered.kind === 'complete',
      'Incomplete original-message evidence.',
    );
    if (
      !(await create({
        dir,
        name: 'dispatch-return.json',
        bytes: returned.bytes,
      }))
    )
      requireMatch(
        Buffer.compare(
          await frozen({ dir, name: 'dispatch-return.json' }),
          returned.bytes,
        ) === 0,
        `A dispatch-return.json was created meanwhile, and its bytes are not this return's; nothing written. ${bindOnceMore}`,
      );
    const binding = jsonBytes({
      kind: 't3-review-dispatch-v3',
      capturedAt: new Date().toISOString(),
      inputsSha256: sha256,
      dispatchReturnSha256: returned.sha256,
      response,
      observations: reads,
      original: {
        text: recovered.text,
        sha256: hashReport(Buffer.from(recovered.text)),
        itemId: recovered.itemId,
        messageId: recovered.messageId,
      },
    });
    // A completed round always has a binding, so the create below also fails
    // if completion follows this check.
    await refuseCompleted(dir);
    if (await create({ dir, name: 'dispatch.json', bytes: binding })) return;
    requireMatch(
      await boundAlready({
        dir,
        inputsSha256: sha256,
        returned: { saved: true },
      }),
      unacknowledged(
        'A dispatch.json was created meanwhile',
        'this bind wrote no binding',
      ),
    );
  } finally {
    if (form.kind === 'staged') await discardT3DispatchReturn(form);
  }
}
async function readBinding({
  dir,
  inputsSha256,
  intact = false,
}: {
  dir: string;
  inputsSha256: string;
  /**
   * For bind and completion: the binding and the saved return must be the
   * bytes bind writes for what they parse to (archive verification as before).
   */
  intact?: boolean;
}) {
  const bytes = await frozen({ dir, name: 'dispatch.json' });
  if (intact)
    requireMatch(
      canonical(bytes),
      'dispatch.json is not the canonical form bind writes for it; nothing written.',
    );
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
  const returned = await readDispatchReturn({ dir, inputs, intact });
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
  } = await readBinding({ dir, inputsSha256: sha256, intact: true });
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
