import { createHash, randomUUID } from 'node:crypto';
import {
  chmod,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';

// A prepared local environment (#754): a stopped local Convex container,
// deployed and bound to a source, and a built workspace, kept between
// diagnostic `--reuse` runs. Its record holds no secret.

/** Reused for at most this long after it was prepared. */
export const preparedEnvironmentTtlMs = 24 * 60 * 60 * 1000;

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const preparationSchema = z
  .object({
    // What reuse matches on: sources without `e2e/*.spec.ts`, the effective
    // build environment, the toolchain and the installed dependencies.
    reuseFingerprint: sha256,
    parts: z
      .object({
        sources: sha256,
        buildEnvironment: sha256,
        node: z.string(),
        pnpm: z.string(),
        dependencies: sha256,
      })
      .strict(),
    // Evidence only: the full source fingerprint it was prepared from.
    sourceFingerprint: z.string(),
    target: z
      .object({
        resources: sha256,
        previewName: z.string(),
        clerkHost: z.string(),
        publishableKey: sha256,
      })
      .strict(),
    workers: z.number().int().min(1),
    releaseState: z.literal('none'),
    backend: z
      .object({
        image: z.string(),
        instanceName: z.string().regex(/^ep-e2e-[a-f0-9-]{36}$/),
        url: z.string(),
        siteUrl: z.string(),
      })
      .strict(),
    writeEpoch: z.number().int().nonnegative(),
    createdAt: z.number().int().positive(),
  })
  .strict();
export type Preparation = z.infer<typeof preparationSchema>;

export const preparedRecordSchema = z
  .object({
    schema: z.literal(1),
    state: z.enum(['in-use', 'ready']),
    // The slot-lock owner of the run holding it.
    ownerToken: z.string().min(1),
    runId: z.string().min(1),
    // The container, once one exists.
    instanceName: z
      .string()
      .regex(/^ep-e2e-[a-f0-9-]{36}$/)
      .nullable(),
    // Null until a run prepared it completely.
    preparation: preparationSchema.nullable(),
  })
  .strict();
export type PreparedRecord = z.infer<typeof preparedRecordSchema>;

/** What the current run would prepare; a reusable preparation must match. */
export type ExpectedPreparation = Pick<
  Preparation,
  'reuseFingerprint' | 'parts' | 'target' | 'workers' | 'releaseState'
> & { image: string };

export const hashText = (text: string) =>
  createHash('sha256').update(text).digest('hex');

/**
 * Outside every checkout and run TMPDIR (and `/tmp`): next to the repo's
 * other private temporary files, keyed by the checkout and the slot.
 */
export function preparedEnvironmentDirectory({
  sourceRoot,
  previewName,
}: {
  sourceRoot: string;
  previewName: string;
}) {
  return join(
    dirname(sourceRoot),
    '.ep-tmp',
    'e2e-prepared',
    `${previewName}-${hashText(sourceRoot).slice(0, 12)}`,
  );
}

const recordPath = (directory: string) => join(directory, 'record.json');

/** The record, null when there is none, or 'unreadable'. */
export async function readPreparedRecord(directory: string) {
  let text: string;
  try {
    text = await readFile(recordPath(directory), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return null;
    return 'unreadable' as const;
  }
  try {
    return preparedRecordSchema.parse(JSON.parse(text));
  } catch {
    return 'unreadable' as const;
  }
}

/** Replaces the record atomically: a reader sees the old or the new one. */
export async function writePreparedRecord(
  directory: string,
  record: PreparedRecord,
) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const candidate = `${recordPath(directory)}.${randomUUID()}`;
  try {
    await writeFile(
      candidate,
      JSON.stringify(preparedRecordSchema.parse(record)),
      { mode: 0o600 },
    );
    await rename(candidate, recordPath(directory));
  } finally {
    await rm(candidate, { force: true });
  }
}

export type PreparationPlan =
  | { kind: 'reuse'; preparation: Preparation }
  | {
      kind: 'prepare';
      /** A container to remove first, if any. */
      discard: string | null;
      /** Why an existing environment is not reused, if there was one. */
      reason: string | null;
    }
  | { kind: 'refuse'; instanceName: string };

/**
 * Whether the current run reuses the environment it found. A record another
 * run holds is discarded if its container is stopped (that run crashed, or
 * the machine restarted) and refused if it is running, since that run may
 * still be using it; nothing is removed automatically then.
 */
export async function planPreparation({
  record,
  expected,
  now,
  isRunning,
}: {
  record: PreparedRecord | null | 'unreadable';
  expected: ExpectedPreparation;
  now: number;
  isRunning: (instanceName: string) => Promise<boolean>;
}): Promise<PreparationPlan> {
  if (record === null)
    return { kind: 'prepare', discard: null, reason: null };
  if (record === 'unreadable')
    return { kind: 'prepare', discard: null, reason: 'record' };
  const discard = record.instanceName;
  if (record.state === 'in-use') {
    if (discard && (await isRunning(discard)))
      return { kind: 'refuse', instanceName: discard };
    return { kind: 'prepare', discard, reason: 'abandoned' };
  }
  const reason = findMismatch({
    preparation: record.preparation,
    expected,
    now,
  });
  return reason === null && record.preparation
    ? { kind: 'reuse', preparation: record.preparation }
    : { kind: 'prepare', discard, reason };
}

/** The first field that rules reuse out, or null. */
export function findMismatch({
  preparation,
  expected,
  now,
}: {
  preparation: Preparation | null;
  expected: ExpectedPreparation;
  now: number;
}) {
  if (!preparation) return 'incomplete';
  const { parts } = preparation;
  const checks: [string, boolean][] = [
    ['sources', parts.sources === expected.parts.sources],
    [
      'build environment',
      parts.buildEnvironment === expected.parts.buildEnvironment,
    ],
    ['node', parts.node === expected.parts.node],
    ['pnpm', parts.pnpm === expected.parts.pnpm],
    ['dependencies', parts.dependencies === expected.parts.dependencies],
    [
      'reuse fingerprint',
      preparation.reuseFingerprint === expected.reuseFingerprint,
    ],
    [
      'target',
      JSON.stringify(preparation.target) === JSON.stringify(expected.target),
    ],
    ['workers', expected.workers <= preparation.workers],
    ['release state', preparation.releaseState === expected.releaseState],
    ['backend image', preparation.backend.image === expected.image],
    [
      'age',
      now >= preparation.createdAt &&
        now - preparation.createdAt < preparedEnvironmentTtlMs,
    ],
  ];
  return checks.find(([, matches]) => !matches)?.[0] ?? null;
}

/**
 * Removes a prepared environment: its container with its volume (only if it
 * carries our label) and its directory. An unreadable record names no
 * container; README's recovery covers that case.
 */
export async function discardPreparedEnvironment({
  directory,
  discardBackend,
  removeDirectory,
}: {
  directory: string;
  discardBackend: (instanceName: string) => Promise<void>;
  removeDirectory: (path: string) => Promise<void>;
}) {
  const record = await readPreparedRecord(directory);
  if (record && record !== 'unreadable' && record.instanceName)
    await discardBackend(record.instanceName);
  await removeDirectory(directory);
}

/**
 * Whether a workspace may be kept (#754): it holds no env or key file, and
 * none of `secrets` appears in its build output. `node_modules` is the
 * checkout's, copied, and is not searched.
 */
export async function isWorkspaceFreeOfSecrets({
  workspace,
  secrets,
}: {
  workspace: string;
  secrets: string[];
}) {
  const needles = secrets.filter(Boolean).map((secret) => Buffer.from(secret));
  const visit = async (path: string, isBuildOutput: boolean) => {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        if (!(await visit(child, isBuildOutput || entry.name === '.next')))
          return false;
        continue;
      }
      if (entry.name.startsWith('.env') || entry.name.endsWith('.key'))
        return false;
      if (isBuildOutput && entry.isFile()) {
        const content = await readFile(child);
        if (needles.some((needle) => content.includes(needle))) return false;
      }
    }
    return true;
  };
  return await visit(workspace, false);
}
