import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  rm,
  rmdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { resourceSchema } from '../fixtures/catalog';
import {
  describeDiagnostic,
  HarnessFailure,
  secondaryFailure,
  type Diagnostic,
  type LocalBackendReason,
} from './diagnostics';
import { CommandEvidenceFailure, CommandFailure } from './process';

// Every runner step before the browser journeys, in order. A failure reports
// only one of these fixed labels and a class from the closed set below; the
// original message, name, stack and provider output are never printed.
export const setupStages = [
  'arguments',
  'resources',
  'workers',
  'clerk-verification',
  // --backend local: Docker is reachable and the pinned image is present.
  'local-backend',
  'source-root',
  'private-directory',
  'slot-lock',
  'temporary-directory',
  // --reuse (#754): reuse, or prepare afresh, the kept local environment; a
  // run without --reuse discards any it finds.
  'prepared-environment',
  'source-snapshot',
  'environment',
  'port',
  'run-file',
  // The deployment command's run-file read and first stages.log write.
  'evidence',
  // Preview recreation, deploy, fixture binding and web build (stages.log).
  'deployment',
  'generated-bindings',
  'preview-binding',
  'artifact-directory',
  // Release suite only (#753): the qualification process, the admin key
  // file's removal before the browsers, and its evidence.
  'release-qualification',
  'release-admin-key',
  'release-evidence',
] as const;
export type SetupStage = (typeof setupStages)[number];
export const cleanupTargets = [
  'processes',
  'release-admin-key',
  // The local Docker backend (--backend local): stopped before, and
  // independently of, the temporary directory that holds its credentials.
  'local-backend',
  'temporary-directory',
  // A kept environment is published as ready only after the run's private
  // files are gone; otherwise it is discarded (#754).
  'prepared-environment',
  'slot-lock',
] as const;
export type CleanupTarget = (typeof cleanupTargets)[number];

export const systemErrorClasses = [
  'ENOENT',
  'EACCES',
  'EPERM',
  'EEXIST',
  'ENOTDIR',
  'EISDIR',
  'ENOTEMPTY',
  'ENOSPC',
  'EROFS',
  'EMFILE',
  'EBUSY',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EADDRINUSE',
  'EADDRNOTAVAIL',
] as const;
type SystemErrorClass = (typeof systemErrorClasses)[number];
export type ErrorClass =
  | SystemErrorClass
  | `exit-${number}`
  | 'terminated'
  | 'timeout'
  | 'validation'
  | 'unknown';

export function isErrorClass(value: string): value is ErrorClass {
  return (
    (systemErrorClasses as readonly string[]).includes(value) ||
    /^exit-(?:[1-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])$/.test(value) ||
    ['terminated', 'timeout', 'validation', 'unknown'].includes(value)
  );
}

// fetch (undici) reports some socket failures with its own codes.
const undiciClasses: Record<string, SystemErrorClass> = {
  UND_ERR_CONNECT_TIMEOUT: 'ETIMEDOUT',
  UND_ERR_HEADERS_TIMEOUT: 'ETIMEDOUT',
  UND_ERR_BODY_TIMEOUT: 'ETIMEDOUT',
  UND_ERR_SOCKET: 'ECONNRESET',
};
function codeOf(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error))
    return undefined;
  return error.code;
}
function systemClass(code: unknown): SystemErrorClass | undefined {
  if (typeof code !== 'string') return undefined;
  return (
    systemErrorClasses.find((known) => known === code) ??
    (Object.hasOwn(undiciClasses, code) ? undiciClasses[code] : undefined)
  );
}
function exitClass(status: unknown): ErrorClass | undefined {
  return typeof status === 'number' &&
    Number.isInteger(status) &&
    status >= 1 &&
    status <= 255
    ? `exit-${status}`
    : undefined;
}

// An interrupted local setup is `terminated`, as an interrupted command is.
const localBackendClasses: Partial<Record<LocalBackendReason, ErrorClass>> = {
  interrupted: 'terminated',
  timeout: 'timeout',
  readiness: 'timeout',
  ownership: 'validation',
  ports: 'validation',
  'image-changed': 'validation',
  instance: 'validation',
  'admin-key': 'validation',
};

/**
 * The error class is read only from:
 * - the harness's typed errors (`HarnessFailure`, `CommandFailure`,
 *   `CommandEvidenceFailure`) and the library error types `ZodError` and
 *   `SyntaxError` (an instanceof check, no field is read);
 * - `error.code`, compared against the closed system-code set (Node system
 *   errors, `ERR_PARSE_ARGS_*`, and DOMException `TIMEOUT_ERR` for
 *   `AbortSignal.timeout`);
 * - an exit `status` or `signal` (execFileSync);
 * - `error.cause.code`, one level, closed set only: fetch() rejects with
 *   `TypeError('fetch failed')` and puts the socket's system error in `cause`,
 *   so this is the only place a Clerk connection failure's code exists.
 * Messages, names and stacks are never read.
 */
export function classifyError(error: unknown): ErrorClass {
  if (error instanceof HarnessFailure) {
    const { diagnostic } = error;
    if (diagnostic.kind === 'local-backend')
      return localBackendClasses[diagnostic.reason] ?? 'unknown';
    return diagnostic.kind === 'deadline' ? 'timeout' : 'validation';
  }
  if (error instanceof CommandEvidenceFailure)
    return classifyError(error.cause);
  if (error instanceof CommandFailure)
    return (
      systemClass(error.code) ??
      (error.exitCode === null
        ? error.code === undefined
          ? 'terminated'
          : 'unknown'
        : (exitClass(error.exitCode) ?? 'unknown'))
    );
  const code = codeOf(error);
  const system = systemClass(code);
  if (system) return system;
  if (typeof code === 'string' && code.startsWith('ERR_PARSE_ARGS_'))
    return 'validation';
  if (error instanceof DOMException && code === DOMException.TIMEOUT_ERR)
    return 'timeout';
  if (typeof error !== 'object' || error === null) return 'unknown';
  const { status, signal } = error as { status?: unknown; signal?: unknown };
  const exited = exitClass(status);
  if (exited) return exited;
  if (status === null && typeof signal === 'string') return 'terminated';
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return 'validation';
  if (error instanceof TypeError) {
    const cause = systemClass(codeOf(error.cause));
    if (cause) return cause;
  }
  return 'unknown';
}

type LockEvidence = {
  slot: string;
  createdAt?: string;
  // False when owner.json is missing or unreadable, as after a crash.
  ownerRecorded?: boolean;
};
export class SetupFailure extends Error {
  constructor(
    readonly stage: SetupStage,
    readonly errorClass: ErrorClass,
    // Only fixed fields: printed text is rebuilt by `failureReport`.
    readonly diagnostic?: Diagnostic,
    readonly secondary?: ErrorClass,
    readonly lock?: LockEvidence,
    /** A cleanup the failed step ran that also failed. */
    readonly also?: Diagnostic,
  ) {
    super(`E2E setup failed: ${stage} (${errorClass})`);
    this.name = 'SetupFailure';
  }
}

export function setupFailure(stage: SetupStage, error: unknown) {
  if (error instanceof SetupFailure) return error;
  const secondary = secondaryFailure(error);
  return new SetupFailure(
    error instanceof CommandEvidenceFailure ? 'evidence' : stage,
    classifyError(error),
    error instanceof HarnessFailure ? error.diagnostic : undefined,
    secondary === undefined ? undefined : classifyError(secondary),
    undefined,
    error instanceof HarnessFailure ? error.also : undefined,
  );
}

export async function setupStage<T>(
  stage: SetupStage,
  step: () => T | Promise<T>,
): Promise<T> {
  try {
    return await step();
  } catch (error) {
    throw setupFailure(stage, error);
  }
}

// The lock directory records its owner so cleanup releases only our lock.
const ownerFile = 'owner.json';
const ownerSchema = z.object({
  owner: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type SlotLock = { path: string; owner: string };
export function slotLockPath(privateRoot: string, slot: string) {
  return join(privateRoot, `${slot}.lock`);
}
async function recordedOwner(path: string) {
  try {
    return ownerSchema.parse(
      JSON.parse(await readFile(join(path, ownerFile), 'utf8')),
    );
  } catch {
    return undefined;
  }
}
async function lockCreatedAt(path: string) {
  const recorded = await recordedOwner(path);
  if (recorded) return recorded.createdAt;
  try {
    const lock = await stat(path);
    return (lock.birthtimeMs > 0 ? lock.birthtime : lock.mtime).toISOString();
  } catch {
    return undefined;
  }
}

// An existing lock is never removed here: it may belong to a running gate.
export async function acquireSlotLock(
  privateRoot: string,
  slot: string,
): Promise<SlotLock> {
  const path = slotLockPath(privateRoot, slot);
  try {
    await mkdir(path);
  } catch (error) {
    const failure = setupFailure('slot-lock', error);
    if (failure.errorClass !== 'EEXIST') throw failure;
    throw new SetupFailure('slot-lock', 'EEXIST', undefined, undefined, {
      slot,
      createdAt: await lockCreatedAt(path),
      ownerRecorded: (await recordedOwner(path)) !== undefined,
    });
  }
  const owner = { owner: randomUUID(), createdAt: new Date().toISOString() };
  // Written beside, then renamed: owner.json is either complete or absent.
  const temporary = join(path, `${ownerFile}.tmp-${owner.owner}`);
  try {
    await writeFile(temporary, JSON.stringify(owner), {
      flag: 'wx',
      mode: 0o600,
    });
    await rename(temporary, join(path, ownerFile));
  } catch (error) {
    // Only this run writes inside the directory its mkdir created. Removing
    // our partial file leaves it empty; rmdir refuses anything else.
    await rm(temporary, { force: true }).catch(() => undefined);
    await rmdir(path).catch(() => undefined);
    throw setupFailure('slot-lock', error);
  }
  return { path, owner: owner.owner };
}

/**
 * Removes the lock only if it still records our owner token.
 *
 * The lock directory is first renamed away from the lock path (rename is
 * atomic), and only the renamed directory is inspected and deleted. A lock
 * another run creates at the lock path after that rename is a different
 * directory and is never touched, so no replacement can be deleted.
 *
 * Residual cases: if the renamed directory is not ours, the lock path was
 * free between the rename and our attempt to put it back. We claim the free
 * path with mkdir (exclusive) and rename the foreign lock over that empty
 * placeholder. If another run took the path first, the foreign lock stays at
 * `<slot>.lock.releasing-<our token>` and is reported for manual review. A
 * crash between the rename and the delete leaves our own lock under that
 * name; it never blocks a run and can be deleted.
 * Known gap (only after a live lock is removed by hand; see "Setup failures"
 * in e2e/README.md): renaming a live run's lock aside lets a third run take
 * the slot concurrently, so a reported `.releasing-*` may be a live lock; an
 * OS-level flock is the planned remedy (#199).
 */
export async function releaseSlotLock(
  lock: SlotLock,
  // Test seam: runs after the owner check and before the delete.
  hooks: { beforeRemove?: () => Promise<void> } = {},
) {
  const releasing = `${lock.path}.releasing-${lock.owner}`;
  try {
    await rename(lock.path, releasing);
  } catch (error) {
    if (codeOf(error) === 'ENOENT')
      throw new HarnessFailure({ kind: 'slot-lock-replaced' });
    throw error;
  }
  if ((await recordedOwner(releasing))?.owner === lock.owner) {
    await hooks.beforeRemove?.();
    await rm(releasing, { recursive: true, force: true });
    return;
  }
  try {
    await mkdir(lock.path);
  } catch (error) {
    if (codeOf(error) === 'EEXIST')
      throw new HarnessFailure({ kind: 'slot-lock-displaced' });
    throw error;
  }
  try {
    await rename(releasing, lock.path);
  } catch {
    await rmdir(lock.path).catch(() => undefined);
    throw new HarnessFailure({ kind: 'slot-lock-displaced' });
  }
  throw new HarnessFailure({ kind: 'slot-lock-replaced' });
}

export class CleanupFailure extends Error {
  constructor(
    readonly target: CleanupTarget,
    readonly errorClass: ErrorClass,
    readonly diagnostic: Diagnostic | undefined,
    // The run's own failure, which cleanup must not replace.
    readonly primary?: { error: unknown },
  ) {
    super(
      `E2E cleanup ${primary ? 'also ' : ''}failed: ${target} (${errorClass})`,
    );
    this.name = 'CleanupFailure';
  }
}

// Runs every cleanup even after one fails; the body's failure stays primary.
export async function withCleanup<T>(
  body: () => Promise<T>,
  cleanups: readonly (readonly [CleanupTarget, () => Promise<unknown>])[],
): Promise<T> {
  let outcome: { value: T } | { error: unknown };
  try {
    outcome = { value: await body() };
  } catch (error) {
    outcome = { error };
  }
  let cleanupFailure: CleanupFailure | undefined;
  for (const [target, clean] of cleanups) {
    try {
      await clean();
    } catch (error) {
      cleanupFailure ??= new CleanupFailure(
        target,
        classifyError(error),
        error instanceof HarnessFailure ? error.diagnostic : undefined,
        'error' in outcome ? { error: outcome.error } : undefined,
      );
    }
  }
  if (cleanupFailure) throw cleanupFailure;
  if ('error' in outcome) throw outcome.error;
  return outcome.value;
}

export const slotLockGuidance =
  'Not removed automatically. Check `docker ps` (and local `pnpm test:e2e` processes) for a running gate before removing it; see "Setup failures" in e2e/README.md.';

// Commands whose failure the runner reports by name outside a setup stage.
const runnerCommands = [
  'E2E mandatory browser journeys',
  'E2E nightly browser journeys',
  'E2E release browser journeys',
] as const;
const slotName = resourceSchema.shape.previewName;
const timestamp = z.string().datetime();

function lockLines(lock: LockEvidence | undefined) {
  const slot = slotName.safeParse(lock?.slot).success ? lock!.slot : '<slot>';
  const created = timestamp.safeParse(lock?.createdAt).success
    ? ` (created ${lock!.createdAt})`
    : '';
  return [
    'E2E setup failed: slot already locked (active or stale)',
    `Lock: e2e/.private/${slot}.lock${created}`,
    ...(lock?.ownerRecorded === false
      ? [
          'Its owner record is missing or unreadable, so a run probably crashed while acquiring it.',
        ]
      : []),
    slotLockGuidance,
  ];
}
function secondaryLine(errorClass: ErrorClass | undefined) {
  return errorClass ? [`E2E evidence log also failed (${errorClass})`] : [];
}

// The only text the runner prints for a failure. Every line is rebuilt from
// fixed labels, closed classes and typed diagnostic fields.
export function failureReport(error: unknown): string[] {
  if (error instanceof CleanupFailure) {
    const cleanup = [
      `E2E cleanup ${error.primary ? 'also ' : ''}failed: ${error.target} (${error.errorClass})`,
      ...(error.diagnostic ? [describeDiagnostic(error.diagnostic)] : []),
    ];
    return error.primary
      ? [...failureReport(error.primary.error), ...cleanup]
      : cleanup;
  }
  if (error instanceof SetupFailure) {
    if (error.stage === 'slot-lock' && error.errorClass === 'EEXIST')
      return lockLines(error.lock);
    return [
      ...(error.diagnostic ? [describeDiagnostic(error.diagnostic)] : []),
      `E2E setup failed: ${error.stage} (${error.errorClass})`,
      ...(error.also ? [describeDiagnostic(error.also)] : []),
      ...secondaryLine(error.secondary),
    ];
  }
  const secondary = secondaryFailure(error);
  const secondaryLines = secondaryLine(
    secondary === undefined ? undefined : classifyError(secondary),
  );
  if (error instanceof HarnessFailure)
    return [
      describeDiagnostic(error.diagnostic),
      ...(error.step ? [describeDiagnostic(error.step)] : []),
      ...(error.also ? [describeDiagnostic(error.also)] : []),
      ...secondaryLines,
    ];
  if (
    error instanceof CommandFailure &&
    (runnerCommands as readonly string[]).includes(error.stage)
  )
    return [
      `${error.stage}: process failed (${classifyError(error)})`,
      ...secondaryLines,
    ];
  return [
    `E2E failed after setup (${classifyError(error)}); inspect the safe evidence directory.`,
    ...secondaryLines,
  ];
}
