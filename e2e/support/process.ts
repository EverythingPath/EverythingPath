import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  caseKeys,
  deploymentFixtureSchema,
  resourceSchema,
  type CaseKey,
} from '../fixtures/catalog';
import { safeDiagnostic } from './artifacts';
import { browserStopReserveMs } from './deadline';
import { superviseGroup } from './process-group';
import { processStopSignal, wait } from './cancellation';
import { suiteSchema, suites } from './matrix';
import { HarnessFailure, recordSecondaryFailure } from './diagnostics';

export const runSchema = z.object({
  backend: z.enum(['preview', 'local']).optional(),
  localDeployment: z
    .object({
      name: z.string().regex(/^ep-e2e-[a-f0-9-]{36}$/),
      url: z.string(),
      adminKeyFile: z.string(),
    })
    .optional(),
  // The selected browser suites (support/matrix.ts).
  suite: suiteSchema.default(suites.mandatory),
  // Playwright workers, each bound to its own declared cohort (worker-N).
  workers: z.number().int().min(1).default(1),
  resources: resourceSchema,
  workspace: z.string(),
  sourceRoot: z.string(),
  privateDirectory: z.string(),
  artifactDirectory: z.string(),
  envFile: z.string(),
  baseURL: z.string().regex(/^http:\/\/(?:localhost|127\.0\.0\.1):[0-9]+$/),
  sourceFingerprint: z.string().optional(),
  // Whether the run reused a prepared environment (#754). A reused run is a
  // diagnosis only: its evidence says so, and it never satisfies a gate.
  preparation: z.enum(['fresh', 'reused']).default('fresh'),
  fixture: deploymentFixtureSchema.optional(),
  // The run's one clock in epoch milliseconds (deadline.ts): Playwright's
  // global timeout ends at `browserStopAt`, the application server at
  // `deadline`. Written once by the runner.
  deadline: z.number().int().positive().optional(),
  browserStopAt: z.number().int().positive().optional(),
});
export type Run = z.infer<typeof runSchema>;

export function deploymentArguments(run: Run) {
  return [
    ...(run.backend === 'local'
      ? []
      : ['--preview-name', run.resources.previewName]),
    '--env-file',
    run.envFile,
  ];
}

export async function loadRun() {
  const path = process.env.E2E_RUN_FILE;
  if (!path) throw new HarnessFailure({ kind: 'run-file-missing' });
  return runSchema.parse(JSON.parse(await readFile(path, 'utf8')));
}
export async function savePrivate(path: string, content: string | Uint8Array) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, content, { mode: 0o600 });
}

// Reads a `convex run` call's JSON arguments from stdin (#754). Resolved on
// use: browser-environment tests import this module too.
const runWithStdinArguments = () =>
  fileURLToPath(new URL('./convex-run-stdin.mjs', import.meta.url));

async function fixtureExecutable(
  args: string[],
  cwd: string,
  hasInput: boolean,
) {
  if (args[0] !== 'exec' || args[1] !== 'convex' || args[2] !== 'run')
    return { file: 'pnpm', args };
  const packagePath = createRequire(join(cwd, 'package.json')).resolve(
    'convex/package.json',
  );
  const { bin } = z
    .object({ bin: z.union([z.string(), z.object({ convex: z.string() })]) })
    .parse(JSON.parse(await readFile(packagePath, 'utf8')));
  const entry = join(
    dirname(packagePath),
    typeof bin === 'string' ? bin : bin.convex,
  );
  return {
    file: process.execPath,
    args: hasInput
      ? [runWithStdinArguments(), entry, ...args.slice(2)]
      : [entry, ...args.slice(2)],
  };
}

// Where every command's process is spawned; tests replace it to make the
// kernel refuse a spawn (`EAGAIN`).
export const processSpawning = { spawn };

// A child process that could not start or did not exit successfully. `code`
// is the spawn error's system code; `exitCode` is null after a signal/timeout.
export class CommandFailure extends Error {
  constructor(
    readonly stage: string,
    readonly exitCode: number | null,
    readonly code?: string,
    /**
     * The last output lines, each redacted by the caller's `redactLine`
     * before it is truncated, only when asked for (`outputTail`). The E2E
     * runner never asks and never prints them.
     */
    readonly outputTail?: readonly string[],
    /**
     * The fixed `safeDiagnostic` categories its output matched, in first-seen
     * order. They are fixed texts, so the harness may act on and print them.
     */
    readonly diagnostics: readonly string[] = [],
  ) {
    super(
      code === undefined
        ? `${stage}: process failed (${exitCode ?? 'terminated'})`
        : `${stage}: process could not start`,
    );
    this.name = 'CommandFailure';
  }
}

// The command's run file or first evidence write failed before it spawned.
export class CommandEvidenceFailure extends Error {
  constructor(
    readonly stage: string,
    cause: unknown,
  ) {
    super(`${stage}: evidence could not be initialized`, { cause });
    this.name = 'CommandEvidenceFailure';
  }
}

// Never forward CLI output: deployment/auth failures can contain credentials,
// arguments and provider payloads. Keep only a stage name and an exit code.
// A caller without Cloud credentials (local code generation) may ask for the
// failure's last output lines, redacted by its own function.
export async function command(
  stage: string,
  args: string[],
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    /** Until the process group is terminated; default three minutes. */
    timeoutMs?: number;
    /** Until the process group gets SIGINT, as from Ctrl+C. */
    interruptAfterMs?: number;
    /**
     * Keep this many last stdout/stderr lines for a failure. Each whole line
     * is redacted first and only then truncated, so no cut can split a secret
     * past the redaction.
     */
    outputTail?: { lines: number; redactLine: (line: string) => string };
    /**
     * Written to the child's stdin, never to its argv: a `convex run` call
     * reads its JSON arguments from here (`convex-run-stdin.mjs`).
     */
    input?: string;
    /**
     * Node's compile cache for the child (`NODE_COMPILE_CACHE`): compiled
     * code only, never its input. Separate processes share it.
     */
    compileCacheDirectory?: string;
  },
) {
  const commandId = randomUUID();
  const startedAt = performance.now();
  const environment = { ...(options.env ?? process.env) };
  if (environment.CONVEX_DEPLOY_KEY?.startsWith('preview:')) {
    // Convex otherwise prefers ~/.convex/config.json over preview deploy keys.
    // Pin the same declared key for both project selection and authentication.
    environment.CONVEX_OVERRIDE_ACCESS_TOKEN = environment.CONVEX_DEPLOY_KEY;
  }
  if (options.compileCacheDirectory)
    environment.NODE_COMPILE_CACHE = options.compileCacheDirectory;
  const runFile = environment.E2E_RUN_FILE;
  const diagnostics = new Set<string>();
  const diagnosticWrites: Promise<void>[] = [];
  let run: Run | null = null;
  let hasDiagnosticWriteFailed = false;
  const log = async (status: string) => {
    if (!run) return;
    // Only a starting command may create the evidence directory: a process
    // that ends after the wrapper copied and deleted it must not re-create it.
    if (status === 'started')
      await mkdir(run.artifactDirectory, { recursive: true });
    await appendFile(
      join(run.artifactDirectory, 'stages.log'),
      `${stage}: ${status}\n`,
    );
    await appendFile(
      join(run.artifactDirectory, 'timings.jsonl'),
      `${JSON.stringify({
        commandId,
        stage,
        status,
        at: new Date().toISOString(),
        elapsedMs: Math.round(performance.now() - startedAt),
      })}\n`,
    );
  };
  try {
    run = runFile
      ? runSchema.parse(JSON.parse(await readFile(runFile, 'utf8')))
      : null;
    await log('started');
  } catch (error) {
    throw new CommandEvidenceFailure(stage, error);
  }
  try {
    // Repeated fixture calls need the installed CLI, not pnpm's exec wrapper.
    // Deployment keeps pnpm's PATH setup for its nested --cmd build command.
    const executable = await fixtureExecutable(
      args,
      options.cwd,
      options.input !== undefined,
    );
    const child = processSpawning.spawn(executable.file, executable.args, {
      cwd: options.cwd,
      env: environment,
      // stdin is a pipe only when there is input; with 'pipe' for both
      // outputs, `stdout` and `stderr` always exist.
      stdio: [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      // Its own process group, so its descendants stop with it.
      detached: process.platform !== 'win32',
    }) as ChildProcessByStdio<Writable | null, Readable, Readable>;
    if (options.input !== undefined && child.stdin) {
      // A child that exits before reading everything (a refused or failed
      // start) closes the pipe early: its exit status reports that, so the
      // write's EPIPE is not a second failure.
      child.stdin.on('error', () => undefined);
      child.stdin.end(options.input);
    }
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      if (output.length < 4_000_000) output += chunk.toString();
    });
    const tail: string[] = [];
    const tailOptions = options.outputTail;
    for (const stream of [child.stdout, child.stderr]) {
      createInterface({ input: stream }).on('line', (line: string) => {
        if (tailOptions) {
          tail.push(tailOptions.redactLine(line).slice(0, 1_000));
          if (tail.length > tailOptions.lines) tail.shift();
        }
        const diagnostic = safeDiagnostic(line);
        if (diagnostic && !diagnostics.has(diagnostic)) {
          diagnostics.add(diagnostic);
          if (run)
            diagnosticWrites.push(
              appendFile(
                join(run.artifactDirectory, 'diagnostics.log'),
                `${stage}: ${diagnostic}\n`,
              ).catch(() => {
                hasDiagnosticWriteFailed = true;
              }),
            );
        }
      });
    }
    const outcome = await superviseGroup({
      child,
      timeoutMs: options.timeoutMs ?? 180_000,
      interruptAfterMs: options.interruptAfterMs,
      signalGraceMs: browserStopReserveMs,
    });
    const outputTail = tailOptions ? tail : undefined;
    if (outcome.kind === 'spawn-failed')
      throw new CommandFailure(stage, null, outcome.code, outputTail);
    if (!outcome.isGroupEmpty)
      throw new HarnessFailure({ kind: 'process-group' });
    if (outcome.exitCode !== 0 || outcome.isStopped)
      throw new CommandFailure(
        stage,
        outcome.isStopped ? null : outcome.exitCode,
        undefined,
        outputTail,
        [...diagnostics],
      );
    await Promise.all(diagnosticWrites);
    if (hasDiagnosticWriteFailed)
      throw new HarnessFailure({ kind: 'diagnostic-log' });
    await log('passed');
    return output;
  } catch (error) {
    await Promise.all(diagnosticWrites);
    // The command's own failure stays primary; a log failure is secondary.
    try {
      await log('failed');
    } catch (logError) {
      recordSecondaryFailure(error, logError);
    }
    throw error;
  }
}

// The cases the running test owns in its cohort. A Playwright worker process
// runs one test at a time, so each reset it sends asks `resetCase` to check
// that the cohort's organizations hold no other campaign (isolation canary).
let isolatedCases: readonly CaseKey[] = [];
export function isolateCases(keys: readonly CaseKey[]) {
  isolatedCases = keys;
}
const resetScope = z.object({ caseKey: z.enum(caseKeys) });
export function withIsolationCanary(
  operation: string,
  args: Record<string, unknown>,
) {
  if (operation !== 'resetCase' && operation !== 'resetAndInitialize')
    return args;
  const { caseKey } = resetScope.parse(
    operation === 'resetCase' ? args : args.scope,
  );
  return { ...args, isolatedWith: [...new Set([caseKey, ...isolatedCases])] };
}

// Narrow fixture retries (#754). A read is retried after a transport failure;
// any call, mutations included, only when its process never started, so
// nothing reached the CLI, let alone Convex. A mutation that started is
// never repeated: the Write Gate epoch rejects stale writers but does not
// deduplicate, and several fixtures are not safe to replay. Nothing is ever
// classified from the CLI's own fetch.
const maxFixtureRetries = 2;
// Each retry's wait, uniformly jittered within its range.
const retryWaitRangesMs = [
  [500, 1000],
  [1500, 3000],
] as const;
// The kernel refused the spawn for lack of resources: the child never ran.
const retryableSpawnCodes = ['EAGAIN', 'EMFILE', 'ENFILE'];
// A fixed category that means the call itself was refused, so repeating the
// same read would fail the same way.
const refusedReadDiagnostics = [
  'fixture authorization refused',
  'identity ownership conflict',
  'Convex schema validation failed',
  'Convex argument validation failed',
  'Convex function is missing',
  'authentication token or issuer failure',
  'service rejected authentication',
  'service rejected authorization',
];
const transportDiagnostics = [
  'service connection failed',
  'service rate limit reached',
];

/** Why `error` may be retried, or null. */
export function classifyFixtureFailure(
  error: unknown,
  kind: 'read' | 'write',
): 'spawn' | 'read transport' | null {
  if (!(error instanceof CommandFailure)) return null;
  if (error.code !== undefined)
    return retryableSpawnCodes.includes(error.code) ? 'spawn' : null;
  if (
    kind === 'read' &&
    error.exitCode !== null &&
    error.diagnostics.some((line) => transportDiagnostics.includes(line)) &&
    !error.diagnostics.some((line) => refusedReadDiagnostics.includes(line))
  )
    return 'read transport';
  return null;
}

// Tests replace these to record waits instead of sleeping.
export const fixtureRetry = {
  sleep: wait,
  random: Math.random,
  now: () => Date.now(),
};

async function withFixtureRetries({
  run,
  stage,
  kind,
  call,
  until = Number.POSITIVE_INFINITY,
}: {
  run: Run;
  stage: string;
  kind: 'read' | 'write';
  call: () => Promise<string>;
  /** No retry starts that would end after this (epoch milliseconds). */
  until?: number;
}) {
  const stopAt = Math.min(run.browserStopAt ?? Number.POSITIVE_INFINITY, until);
  const stop = processStopSignal();
  try {
    for (let retry = 0; ; retry++) {
      try {
        return await call();
      } catch (error) {
        const failure = classifyFixtureFailure(error, kind);
        const range = retryWaitRangesMs[retry];
        if (!failure || retry >= maxFixtureRetries || !range) throw error;
        const [low, high] = range;
        const waitMs = Math.round(low + (high - low) * fixtureRetry.random());
        if (stop.signal.aborted || fixtureRetry.now() + waitMs >= stopAt)
          throw error;
        await appendFile(
          join(run.artifactDirectory, 'stages.log'),
          `${stage}: retry ${retry + 1} (${failure})\n`,
        ).catch(() => undefined);
        await fixtureRetry.sleep(waitMs, stop.signal);
        if (stop.signal.aborted || fixtureRetry.now() >= stopAt) throw error;
      }
    }
  } finally {
    stop.release();
  }
}

// One fixture or status function on the run's preview, through its own CLI
// process (`command`), with the deployment selection every call shares. The
// processes share Node's compile cache in the run's private directory, which
// the run removes with it: from the second call on, the CLI bundle (5.7 MB)
// loads without being compiled again (#774).
function runPreviewFunction({
  run,
  stage,
  functionName,
  args,
  kind,
  until,
}: {
  run: Run;
  stage: string;
  functionName: string;
  args: Record<string, unknown>;
  /** Only a declared query is a `read` (#754). */
  kind: 'read' | 'write';
  /**
   * When the call, its retries included, must have ended (epoch
   * milliseconds); without it, a call gets `command()`'s default limit.
   */
  until?: number;
}) {
  // The arguments carry the cohort capability: stdin, never argv (#754).
  return withFixtureRetries({
    run,
    stage,
    kind,
    until,
    call: () => {
      const timeoutMs =
        until === undefined ? undefined : until - fixtureRetry.now();
      if (timeoutMs !== undefined && timeoutMs <= 0)
        return Promise.reject(new HarnessFailure({ kind: 'deadline' }));
      return command(
        stage,
        ['exec', 'convex', 'run', functionName, ...deploymentArguments(run)],
        {
          cwd: run.workspace,
          input: JSON.stringify(args),
          timeoutMs,
          compileCacheDirectory: join(
            run.privateDirectory,
            'node-compile-cache',
          ),
        },
      );
    },
  });
}

export async function fixtureCall(
  run: Run,
  operation:
    | 'seedIdentityProjection'
    | 'resetCase'
    | 'inspectCase'
    | 'inspectMoves'
    | 'cleanupCase'
    | 'loseMembership'
    | 'deleteAccount',
  args: Record<string, unknown>,
): Promise<unknown> {
  const stage = `fixture ${operation}`;
  const scopedArgs = withIsolationCanary(operation, args);
  // `inspectCase` and `inspectMoves` are the fixtures' declared queries.
  const isRead = operation === 'inspectCase' || operation === 'inspectMoves';
  const call = (fixtureArgs: Record<string, unknown>) =>
    runPreviewFunction({
      run,
      stage,
      functionName: `e2eFixtures:${operation}`,
      args: fixtureArgs,
      kind: isRead ? 'read' : 'write',
    });
  const output = isRead
    ? await call(scopedArgs)
    : await writeFixture({
        run,
        stage,
        isCleanup: operation === 'cleanupCase',
        write: (writeEpoch) => call({ ...scopedArgs, writeEpoch }),
      });
  return parseFixtureResponse(operation, output);
}

// The Write Gate epoch (convex/lib/writeGate.ts) is read once per worker
// session, not before every write: a Playwright worker is one process, and
// fixture writes never move the epoch. The server still rejects a stale epoch
// inside each write's transaction. A write the server rejects, with the epoch
// since moved, fails the session clearly: this and every later write in the
// worker fail with the `write-epoch` diagnostic, while cleanup refreshes once
// and retries so the cohort is not left with its case. A test that moves the
// epoch on purpose calls `refreshWriteEpoch` afterwards. A worker Playwright
// restarts after a failure reads the epoch afresh; the failure has already
// made the run red.
type EpochSession =
  | { kind: 'current'; read: number }
  // A server rejection found the epoch moved: writes fail, cleanup uses `now`.
  | { kind: 'moved'; read: number; now: number };
const epochSessions = new Map<string, Promise<EpochSession>>();
const sessionKey = (run: Run) =>
  JSON.stringify([run.resources.previewName, run.envFile, run.workspace]);

function getOrCreateEpochSession(run: Run) {
  const key = sessionKey(run);
  const existing = epochSessions.get(key);
  if (existing) return existing;
  // Concurrent first calls share one read; a failed read is not kept.
  const session = readWriteEpoch(run).then(
    (read): EpochSession => ({ kind: 'current', read }),
  );
  epochSessions.set(key, session);
  session.catch(() => {
    if (epochSessions.get(key) === session) epochSessions.delete(key);
  });
  return session;
}

/** Adopts the deployment's current epoch, after a test moved it on purpose. */
export async function refreshWriteEpoch(run: Run) {
  const read = await readWriteEpoch(run);
  epochSessions.set(
    sessionKey(run),
    Promise.resolve({ kind: 'current', read }),
  );
  return read;
}

// Only a write whose process exited on its own with a failure can be the
// server's stale-epoch rejection. A timeout, signal, spawn or evidence failure
// starts no further command, so the run deadline and cancellation hold.
const isServerRejection = (error: unknown) =>
  error instanceof CommandFailure &&
  error.code === undefined &&
  error.exitCode !== null;

async function writeFixture({
  run,
  stage,
  isCleanup,
  write,
}: {
  run: Run;
  stage: string;
  isCleanup: boolean;
  write: (writeEpoch: number) => Promise<string>;
}) {
  const session = await getOrCreateEpochSession(run);
  const epochFailure = ({
    now,
    outcome,
  }: {
    now: number;
    outcome: 'write' | 'cleaned' | 'cleanup-failed';
  }) =>
    new HarnessFailure({
      kind: 'write-epoch',
      stage,
      read: session.read,
      now,
      outcome,
    });
  if (session.kind === 'moved' && !isCleanup)
    throw epochFailure({ now: session.now, outcome: 'write' });
  const writeEpoch = session.kind === 'moved' ? session.now : session.read;
  try {
    return await write(writeEpoch);
  } catch (error) {
    if (!isServerRejection(error)) throw error;
    let now: number;
    try {
      now = await readWriteEpoch(run);
    } catch (readError) {
      recordSecondaryFailure(error, readError);
      throw error;
    }
    if (now === writeEpoch) throw error;
    epochSessions.set(
      sessionKey(run),
      Promise.resolve({ kind: 'moved', read: session.read, now }),
    );
    if (!isCleanup) throw epochFailure({ now, outcome: 'write' });
    try {
      await write(now);
    } catch (retryError) {
      const failure = epochFailure({ now, outcome: 'cleanup-failed' });
      recordSecondaryFailure(failure, retryError);
      throw failure;
    }
    throw epochFailure({ now, outcome: 'cleaned' });
  }
}

/**
 * The deployment's Write Gate epoch. `until` bounds the read and its
 * retries, for the checks that verify a prepared environment (#754).
 */
export async function readWriteEpoch(
  run: Run,
  { until }: { until?: number } = {},
) {
  const output = await runPreviewFunction({
    run,
    stage: 'fixture write epoch',
    functionName: 'initialMigration:clientStatus',
    args: {},
    // A declared query.
    kind: 'read',
    until,
  });
  return z
    .object({ epoch: z.number().int().nonnegative() })
    .parse(JSON.parse(output)).epoch;
}

export async function canonicalPersistenceFixtureCall(
  run: Run,
  operation:
    | 'initialize'
    | 'resetAndInitialize'
    | 'initializeUpkeep'
    | 'installAcceptanceSource'
    | 'close'
    | 'changeSource'
    | 'blockSuccessor'
    | 'appendHistory'
    | 'inspect',
  args: Record<string, unknown>,
): Promise<unknown> {
  const stage = `canonical persistence fixture ${operation}`;
  const scopedArgs = withIsolationCanary(operation, args);
  const call = (fixtureArgs: Record<string, unknown>) =>
    runPreviewFunction({
      run,
      stage,
      functionName: `canonicalPersistenceFixtures:${operation}`,
      args: fixtureArgs,
      // Even `inspect` is a mutation that only reads by convention; Convex
      // does not enforce it, so none of these is retried as a read.
      kind: 'write',
    });
  const output =
    operation === 'inspect'
      ? await call(scopedArgs)
      : await writeFixture({
          run,
          stage,
          isCleanup: false,
          write: (writeEpoch) => call({ ...scopedArgs, writeEpoch }),
        });
  if (
    [
      'close',
      'changeSource',
      'blockSuccessor',
      'installAcceptanceSource',
      'appendHistory',
    ].includes(operation) &&
    !output.trim()
  )
    return null;
  try {
    return JSON.parse(output) as unknown;
  } catch {
    throw new Error(
      'Canonical persistence fixture returned an invalid response',
    );
  }
}

export function parseFixtureResponse(
  operation:
    | 'seedIdentityProjection'
    | 'resetCase'
    | 'inspectCase'
    | 'inspectMoves'
    | 'cleanupCase'
    | 'loseMembership'
    | 'deleteAccount',
  output: string,
): unknown {
  // Convex CLI omits output for null returns from these mutations.
  if (
    !output.trim() &&
    (operation === 'seedIdentityProjection' ||
      operation === 'cleanupCase' ||
      operation === 'loseMembership' ||
      operation === 'deleteAccount')
  )
    return null;
  try {
    return JSON.parse(output) as unknown;
  } catch {
    throw new Error('Fixture operation returned an invalid response');
  }
}
