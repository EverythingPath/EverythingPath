import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import {
  describeDiagnostic,
  describeHarnessFailure,
  HarnessFailure,
} from '../../e2e/support/diagnostics';
import { watchInterruption } from '../../e2e/support/interruption';
import { CommandFailure, command } from '../../e2e/support/process';
import { sanitizeLog } from '../../e2e/support/redaction';
import { startLocalBackend, type LocalBackend } from './backend';

const outputTailLines = 60;

/** Where local code generation failed, so Docker and build failures differ. */
type CodegenPhase =
  | 'setup'
  | 'docker'
  | 'environment'
  | 'push'
  | 'interrupted'
  | 'cleanup';
export class LocalCodegenFailure extends Error {
  readonly phase: CodegenPhase;
  /** Fixed text, or CLI output already redacted. */
  readonly details: readonly string[];
  /** Why the disposable backend could not be removed afterwards, if so. */
  readonly cleanupDetails: readonly string[];
  constructor({
    phase,
    details = [],
    cleanupDetails = [],
  }: {
    phase: CodegenPhase;
    details?: readonly string[];
    cleanupDetails?: readonly string[];
  }) {
    super(`Local code generation failed: ${phase}`);
    this.name = 'LocalCodegenFailure';
    this.phase = phase;
    this.details = details;
    this.cleanupDetails = cleanupDetails;
  }
}

// The admin key by value; any long hex run (the instance secret, a key's
// secret part) and the shared credential patterns by shape.
function redactSecrets({ line, secrets }: { line: string; secrets: string[] }) {
  return sanitizeLog(line, secrets).replace(
    /[0-9a-fA-F]{32,}/g,
    '[redacted-hex]',
  );
}

const phaseHeadings: Record<CodegenPhase, string> = {
  setup: 'Local code generation failed while preparing its scratch directory.',
  docker:
    'Local code generation failed while starting its Docker backend (not a build error).',
  environment:
    'Local code generation failed while configuring its local deployment.',
  push: 'Local code generation failed in `convex dev --once` (the Convex build, types or schema).',
  interrupted: 'Local code generation was interrupted.',
  cleanup:
    'Local code generation succeeded, but its Docker backend could not be removed.',
};

/**
 * What the failure prints: its phase, a redacted tail of CLI output, and a
 * backend that could not be removed afterwards with its recovery step.
 */
export function describeCodegenFailure(error: unknown) {
  if (!(error instanceof LocalCodegenFailure))
    return ['Local code generation failed; check Docker and the Convex build.'];
  const cleanup =
    error.phase !== 'cleanup' && error.cleanupDetails.length > 0
      ? ['Its Docker backend could not be removed either:']
      : [];
  return [
    phaseHeadings[error.phase],
    ...error.details,
    ...cleanup,
    ...error.cleanupDetails,
  ];
}

/** What a run created and cleanup must remove. */
type CodegenResources = { directory?: string; backend?: LocalBackend };

/** The environment without any Convex, Clerk or E2E selector or secret. */
function createCodegenEnvironment() {
  const environment = { ...process.env };
  for (const key of Object.keys(environment))
    if (
      key.startsWith('CONVEX_') ||
      key.startsWith('NEXT_PUBLIC_CONVEX_') ||
      key.startsWith('CLERK_') ||
      key.startsWith('NEXT_PUBLIC_CLERK_') ||
      key.startsWith('E2E_')
    )
      delete environment[key];
  return environment;
}

async function startCodegenBackend({
  directory,
  signal,
}: {
  directory: string;
  signal: AbortSignal;
}) {
  try {
    return await startLocalBackend({ directory, signal });
  } catch (error) {
    // The interruption stays primary; a container its rollback could not
    // remove is still named, with its recovery step.
    if (signal.aborted)
      throw new LocalCodegenFailure({
        phase: 'interrupted',
        cleanupDetails:
          error instanceof HarnessFailure && error.also
            ? [describeDiagnostic(error.also)]
            : [],
      });
    throw new LocalCodegenFailure({
      phase: 'docker',
      details:
        error instanceof HarnessFailure
          ? describeHarnessFailure(error)
          : ['The local backend could not start.'],
    });
  }
}

/** The scratch directory as a Convex project whose functions are the checkout's. */
async function linkCodegenProject({
  root,
  directory,
}: {
  root: string;
  directory: string;
}) {
  await writeFile(
    join(directory, 'convex.json'),
    JSON.stringify({ functions: relative(directory, join(root, 'convex')) }),
  );
  for (const entry of ['package.json', 'node_modules'])
    await symlink(join(root, entry), join(directory, entry));
}

/** One Convex CLI step; a failure carries its phase and redacted output. */
async function runConvexStep({
  phase,
  args,
  backend,
  directory,
  environment,
  signal,
}: {
  phase: CodegenPhase;
  args: string[];
  backend: LocalBackend;
  directory: string;
  environment: NodeJS.ProcessEnv;
  signal: AbortSignal;
}) {
  if (signal.aborted) throw new LocalCodegenFailure({ phase: 'interrupted' });
  const secrets = [(await readFile(backend.adminKeyFile, 'utf8')).trim()];
  try {
    await command(
      `local codegen ${args[0]}`,
      ['exec', 'convex', ...args, '--env-file', backend.envFile],
      {
        cwd: directory,
        env: environment,
        outputTail: {
          lines: outputTailLines,
          redactLine: (line) => redactSecrets({ line, secrets }),
        },
      },
    );
  } catch (error) {
    if (signal.aborted) throw new LocalCodegenFailure({ phase: 'interrupted' });
    const exit =
      error instanceof CommandFailure && error.exitCode !== null
        ? `exit ${error.exitCode}`
        : 'terminated';
    const tail =
      error instanceof CommandFailure ? (error.outputTail ?? []) : [];
    throw new LocalCodegenFailure({
      phase,
      details: [
        `Convex CLI ${args.slice(0, 2).join(' ')}: ${exit}. Last output lines:`,
        ...tail.map((line) => `  ${line}`),
      ],
    });
  }
}

/** Starts the disposable backend, pushes the functions and generates bindings. */
async function pushToDisposableBackend({
  root,
  resources,
  signal,
}: {
  root: string;
  resources: CodegenResources;
  signal: AbortSignal;
}) {
  const directory = await mkdtemp(join(tmpdir(), 'local-codegen-')).catch(
    () => {
      throw new LocalCodegenFailure({ phase: 'setup' });
    },
  );
  resources.directory = directory;
  const environment = createCodegenEnvironment();
  process.stdout.write(
    'Target: disposable local Convex for code generation.\n',
  );
  const backend = await startCodegenBackend({ directory, signal });
  resources.backend = backend;
  await linkCodegenProject({ root, directory }).catch(() => {
    throw new LocalCodegenFailure({ phase: 'setup' });
  });
  const step = { backend, directory, environment, signal };
  // auth.config.ts needs an issuer to bundle, but this empty deployment
  // never signs in users. No Clerk API request or identity sync is needed.
  await runConvexStep({
    ...step,
    phase: 'environment',
    args: ['env', 'set', 'CLERK_FRONTEND_API_URL', 'https://codegen.invalid'],
  });
  await runConvexStep({ ...step, phase: 'push', args: ['dev', '--once'] });
}

/**
 * Removes the backend, then always the scratch directory with its
 * credentials. Returns why the backend could not be removed, if so.
 */
async function removeCodegenResources({
  directory,
  backend,
}: CodegenResources) {
  try {
    await backend?.stop();
    return [];
  } catch (error) {
    return error instanceof HarnessFailure
      ? describeHarnessFailure(error)
      : ['The local Convex container could not be removed.'];
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}

/** Push and generate real bindings without Cloud credentials or developer data. */
export async function generateLocalBindings(root: string) {
  // Keep ownership while Docker starts: startup ends promptly and removes
  // what it created; command() supervises any running CLI process group.
  const interruption = watchInterruption({
    announceStop: () =>
      process.stderr.write('Stopping local code generation, please wait.\n'),
  });
  interruption.startListening();
  const resources: CodegenResources = {};
  let primary: LocalCodegenFailure | undefined;
  let cleanupDetails: string[];
  try {
    try {
      await pushToDisposableBackend({
        root,
        resources,
        signal: interruption.signal,
      });
    } catch (error) {
      primary =
        error instanceof LocalCodegenFailure
          ? error
          : new LocalCodegenFailure({ phase: 'setup' });
    }
    cleanupDetails = await removeCodegenResources(resources);
  } finally {
    interruption.stopListening();
  }
  // The first failure stays primary; a backend left behind is also named.
  if (primary)
    throw new LocalCodegenFailure({
      phase: primary.phase,
      details: primary.details,
      cleanupDetails: [...primary.cleanupDetails, ...cleanupDetails],
    });
  if (cleanupDetails.length > 0)
    throw new LocalCodegenFailure({ phase: 'cleanup', cleanupDetails });
  if (interruption.isInterrupted())
    throw new LocalCodegenFailure({ phase: 'interrupted' });
}
