import {
  spawn,
  type ChildProcess,
  type SpawnOptions,
} from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmod, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  describeDiagnostic,
  describeHarnessFailure,
  HarnessFailure,
} from '../../e2e/support/diagnostics';
import { command } from '../../e2e/support/process';
import { killGraceMs, superviseGroup } from '../../e2e/support/process-group';
import { startLocalBackend, type LocalBackend } from './backend';
import { readIdentityProjection, syncLocalIdentities } from './identities';

// Every operation with a failure mode, so tests can drive each stage.
export const developmentDependencies = {
  startLocalBackend,
  syncLocalIdentities,
  spawnPnpm: ({
    args,
    options,
  }: {
    args: string[];
    options: SpawnOptions;
  }): ChildProcess => spawn('pnpm', args, options),
  /** One `convex run` of an internal function, with the admin key file. */
  runFunction: ({
    functionName,
    args,
    envFile,
    cwd,
    env,
  }: {
    functionName: string;
    args: Record<string, unknown>;
    envFile: string;
    cwd: string;
    env: NodeJS.ProcessEnv;
  }) =>
    command(
      `local ${functionName}`,
      [
        'exec',
        'convex',
        'run',
        functionName,
        JSON.stringify(args),
        '--env-file',
        envFile,
      ],
      { cwd, env, timeoutMs: 120_000 },
    ),
};
export type DevelopmentDependencies = typeof developmentDependencies;

/**
 * A development failure, and the backend stop that also failed after it. The
 * first stays primary; the stop failure names the container and its recovery.
 */
export class DevelopmentStopFailure extends Error {
  constructor(
    readonly primary: unknown,
    readonly stopFailure: unknown,
  ) {
    super('Local development failed, and its backend could not be stopped');
    this.name = 'DevelopmentStopFailure';
  }
}

/** Fixed texts only: Clerk and Convex failures can carry provider payloads and credentials. */
export function describeDevelopmentFailure(error: unknown): string[] {
  if (error instanceof DevelopmentStopFailure)
    return [
      ...describeDevelopmentFailure(error.primary),
      ...describeDevelopmentFailure(error.stopFailure),
    ];
  if (error instanceof HarnessFailure)
    return describeHarnessFailure(error).map(
      (line) => `Local development failed: ${line}`,
    );
  return [
    'Local development failed. Check Docker, Clerk development keys, and the local backend.',
  ];
}

/**
 * A container a stop or rollback left running, with its recovery step: from
 * a failed backend stop, or from startup's own rollback after a failure.
 */
function describeLeftContainer(error: unknown): string[] {
  if (error instanceof DevelopmentStopFailure)
    return describeDevelopmentFailure(error.stopFailure);
  if (error instanceof HarnessFailure && error.also)
    return [`Local development failed: ${describeDiagnostic(error.also)}`];
  return [];
}

/**
 * What `pnpm dev` prints and exits with when it fails (scripts/local-convex/
 * dev.ts). A stop request stays primary, but a container left running is
 * still named with its recovery step.
 */
export function describeDevelopmentExit({
  error,
  isStopped,
}: {
  error: unknown;
  isStopped: boolean;
}) {
  return isStopped
    ? {
        lines: ['Local development stopped.', ...describeLeftContainer(error)],
        exitCode: 130,
      }
    : { lines: describeDevelopmentFailure(error), exitCode: 1 };
}

/**
 * Each command and service in its own process group, supervised until the
 * whole group is gone (process-group.ts): after its leader exits, on its own
 * or after a stop, the rest of the group gets SIGTERM and then SIGKILL.
 */
function superviseServices(spawnPnpm: DevelopmentDependencies['spawnPnpm']) {
  const controller = new AbortController();
  const running = new Set<Promise<unknown>>();
  const run = async ({
    args,
    env,
    cwd,
    isQuiet = false,
  }: {
    args: string[];
    env: NodeJS.ProcessEnv;
    cwd: string;
    isQuiet?: boolean;
  }) => {
    if (controller.signal.aborted) throw new Error('Local development stopped');
    const child = spawnPnpm({
      args,
      options: {
        env,
        cwd,
        detached: true,
        stdio: isQuiet ? 'ignore' : 'inherit',
      },
    });
    const supervised = superviseGroup({
      child,
      signalGraceMs: killGraceMs,
      signal: controller.signal,
    });
    running.add(supervised);
    const outcome = await supervised.finally(() => running.delete(supervised));
    if (outcome.kind === 'spawn-failed')
      throw new Error(`Local development ${args[0]} could not start`);
    if (!outcome.isGroupEmpty)
      throw new Error('Local development processes survived SIGKILL');
    if (outcome.isStopped) throw new Error('Local development stopped');
    if (outcome.exitCode !== 0)
      throw new Error(
        `Local development ${args[0]} failed (${outcome.exitCode})`,
      );
  };
  /** Stops every running group and waits until each is empty. */
  const stop = async () => {
    controller.abort();
    await Promise.allSettled([...running]);
  };
  return { run, stop };
}
type Services = ReturnType<typeof superviseServices>;

/**
 * `.local-convex/` as a Convex project for the checkout's functions, plus the
 * private settings file the deployment's environment comes from.
 */
async function prepareConvexDirectory({
  directory,
  clerkHost,
  webhookSecret,
}: {
  directory: string;
  clerkHost: string;
  webhookSecret: string;
}) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(
    join(directory, 'convex.json'),
    JSON.stringify({ functions: '../convex/' }),
  );
  for (const entry of ['package.json', 'node_modules'])
    await symlink(`../${entry}`, join(directory, entry)).catch(
      (error: unknown) => {
        const isExisting =
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'EEXIST';
        if (!isExisting) throw error;
      },
    );
  const settings = join(directory, 'settings.env');
  await writeFile(
    settings,
    `CLERK_FRONTEND_API_URL=https://${clerkHost}\nCLERK_HOSTNAME=${clerkHost}\nCLERK_WEBHOOK_SECRET=${webhookSecret}\n`,
    { mode: 0o600 },
  );
  await chmod(settings, 0o600);
  return settings;
}

/** Sets the deployment's environment and pushes the functions once. */
async function deployFunctions({
  services,
  backend,
  settings,
  directory,
  environment,
}: {
  services: Services;
  backend: LocalBackend;
  settings: string;
  directory: string;
  environment: NodeJS.ProcessEnv;
}) {
  const select = ['--env-file', backend.envFile];
  // Convex dev writes frontend URLs even with --env-file. Its small
  // working directory keeps those writes out of the owner's .env files.
  const convex = { env: environment, cwd: directory };
  await services.run({
    ...convex,
    args: [
      'exec',
      'convex',
      'env',
      'set',
      '--from-file',
      settings,
      '--force',
      ...select,
    ],
    isQuiet: true,
  });
  await services.run({
    ...convex,
    args: ['exec', 'convex', 'dev', '--once', ...select],
  });
}

/** Replays Clerk into the backend, reconciled against what it holds. */
async function syncIdentities({
  use,
  backend,
  secretKey,
  webhookSecret,
  clerkHost,
  directory,
  environment,
}: {
  use: DevelopmentDependencies;
  backend: LocalBackend;
  secretKey: string;
  webhookSecret: string;
  clerkHost: string;
  directory: string;
  environment: NodeJS.ProcessEnv;
}) {
  // Removals now reconcile against the backend; the old snapshot is unused.
  await rm(join(directory, 'identities.json'), { force: true });
  return use.syncLocalIdentities({
    secretKey,
    webhookSecret,
    siteUrl: backend.siteUrl,
    clerkHost,
    readProjection: () =>
      readIdentityProjection((args) =>
        use.runFunction({
          functionName: 'user:listIdentityProjection',
          args,
          envFile: backend.envFile,
          cwd: directory,
          env: environment,
        }),
      ),
  });
}

/** Watches Convex and runs Next.js until either ends or is stopped. */
async function serveUntilStopped({
  services,
  backend,
  root,
  directory,
  environment,
}: {
  services: Services;
  backend: LocalBackend;
  root: string;
  directory: string;
  environment: NodeJS.ProcessEnv;
}) {
  const served = {
    ...environment,
    NEXT_PUBLIC_CONVEX_URL: backend.url,
    NEXT_PUBLIC_CONVEX_SITE_URL: backend.siteUrl,
  };
  await Promise.race([
    services.run({
      args: ['exec', 'convex', 'dev', '--env-file', backend.envFile],
      env: served,
      cwd: directory,
    }),
    services.run({ args: ['dev:web'], env: served, cwd: root }),
  ]);
}

/**
 * Local development against the checkout's persistent Docker backend:
 * deploy, sync Clerk identities, then (`serve`) watch Convex and run Next.js
 * until a service ends or `signal` aborts. Every service group is reaped
 * before the backend stops. `setup` leaves a healthy backend running; any
 * failure or stop after the backend started stops it.
 */
export async function runLocalDevelopment({
  root,
  mode,
  environment,
  secretKey,
  clerkHost,
  signal,
  use = developmentDependencies,
}: {
  root: string;
  mode: 'serve' | 'setup';
  environment: NodeJS.ProcessEnv;
  secretKey: string;
  clerkHost: string;
  signal: AbortSignal;
  use?: DevelopmentDependencies;
}) {
  const directory = join(root, '.local-convex');
  const name = `ep-dev-${createHash('sha256').update(root).digest('hex').slice(0, 12)}`;
  process.stdout.write(
    `Target: local development Convex (${name}); persistent Docker data.\n`,
  );
  const services = superviseServices(use.spawnPnpm);
  const stopServices = () => void services.stop();
  signal.addEventListener('abort', stopServices, { once: true });
  const throwIfStopped = () => {
    if (signal.aborted) throw new Error('Local development stopped');
  };
  let backend: LocalBackend | undefined;
  let primary: { error: unknown } | undefined;
  try {
    backend = await use.startLocalBackend({
      directory,
      developmentName: name,
      signal,
    });
    throwIfStopped();
    const webhookSecret = `whsec_${randomBytes(32).toString('base64')}`;
    const settings = await prepareConvexDirectory({
      directory,
      clerkHost,
      webhookSecret,
    });
    const stage = { backend, directory, environment };
    await deployFunctions({ ...stage, services, settings });
    const count = await syncIdentities({
      ...stage,
      use,
      secretKey,
      webhookSecret,
      clerkHost,
    });
    throwIfStopped();
    process.stdout.write(
      `Local Convex ready at ${backend.url}; synchronized ${count} development identities.\n`,
    );
    if (mode === 'serve') await serveUntilStopped({ ...stage, services, root });
  } catch (error) {
    primary = { error };
  }
  signal.removeEventListener('abort', stopServices);
  await stopDevelopment({
    services,
    // A healthy setup-mode backend keeps running for the next start.
    backend: mode === 'setup' && !primary ? undefined : backend,
    primary,
  });
}

/**
 * Reaps every service group, then stops the backend. The first failure stays
 * primary; a stop failing after it is reported with it, never dropped.
 */
async function stopDevelopment({
  services,
  backend,
  primary,
}: {
  services: Services;
  backend?: LocalBackend;
  primary?: { error: unknown };
}) {
  await services.stop();
  const stopFailure = await backend?.stop().then(
    () => undefined,
    (error: unknown) => ({ error }),
  );
  if (primary && stopFailure)
    throw new DevelopmentStopFailure(primary.error, stopFailure.error);
  if (primary) throw primary.error;
  if (stopFailure) throw stopFailure.error;
}
