import { randomBytes, randomUUID } from 'node:crypto';
import { chmod, mkdir, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { HarnessFailure } from '../../e2e/support/diagnostics';
import { isLocalConvexUrl } from '../../src/lib/local-convex-url';
import {
  createCleanupDeadline,
  getCleanupReserveMs,
  getStartupAllowanceMs,
  localBackendFailure,
  readLocalBackendReason,
  relabelDockerFailure,
  runCleanupDocker,
  runStartupDocker,
  type StartupBudget,
} from './docker';
import { assertLocalInstance, LocalInstanceMismatch } from './instance';

export { localBackendCleanupReserveMs } from './docker';

// Pin both development and E2E to the same backend. Update deliberately and
// rerun the local browser suites when upgrading this image.
export const localBackendImage =
  'ghcr.io/convex/convex-backend@sha256:d715e9ec088784407ca4ba2d3db592702cd328d02c76cdca3852c0018f2a76b4';
const ownerLabel = 'dev.everythingpath.local-convex';
const readinessCapMs = 90_000;
const instanceCheckCapMs = 5_000;

/**
 * Docker is reachable and the pinned image is present, pulling it if not.
 * Starts no container. The local E2E preflight and every startup run it.
 */
export async function checkLocalBackendHost(budget: StartupBudget = {}) {
  await relabelDockerFailure({
    step: runStartupDocker({
      budget,
      args: ['version', '--format', '{{.Server.Version}}'],
    }),
    reason: 'docker-unavailable',
  });
  const isImagePresent = await runStartupDocker({
    budget,
    args: ['image', 'inspect', '--format', '{{.Id}}', localBackendImage],
  }).then(
    () => true,
    (error: unknown) => {
      if (readLocalBackendReason(error) === 'docker') return false;
      throw error;
    },
  );
  if (!isImagePresent)
    await relabelDockerFailure({
      step: runStartupDocker({
        budget,
        args: ['pull', '--quiet', localBackendImage],
      }),
      reason: 'image',
    });
}

async function findAvailablePorts() {
  const servers = [createServer(), createServer()];
  try {
    return await Promise.all(
      servers.map(async (server) => {
        await new Promise<void>((resolve, reject) => {
          server.once('error', reject);
          server.listen(0, '127.0.0.1', resolve);
        });
        const address = server.address();
        if (!address || typeof address === 'string')
          throw new Error('Local Convex port unavailable');
        return address.port;
      }),
    );
  } finally {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
    );
  }
}

// `mode` applies only when a file or directory is created; enforce it on
// one that already existed with a looser mode.
async function writePrivateFile({
  path,
  content,
}: {
  path: string;
  content: string;
}) {
  await writeFile(path, content, { mode: 0o600 });
  await chmod(path, 0o600);
}

/** Polls the backend until it answers, within the budget. */
async function waitUntilReady({
  url,
  budget,
}: {
  url: string;
  budget: StartupBudget;
}) {
  const until =
    Date.now() + getStartupAllowanceMs({ budget, capMs: readinessCapMs });
  const throwIfInterrupted = () => {
    if (budget.signal?.aborted)
      throw localBackendFailure({ reason: 'interrupted' });
  };
  while (Date.now() < until) {
    const attempt = AbortSignal.timeout(
      Math.max(1, Math.min(1000, until - Date.now())),
    );
    const isReady = await fetch(`${url}/version`, {
      signal: budget.signal
        ? AbortSignal.any([attempt, budget.signal])
        : attempt,
    })
      .then((response) => response.ok)
      .catch(() => false);
    if (isReady) return;
    throwIfInterrupted();
    await sleep(Math.max(0, Math.min(500, until - Date.now())), undefined, {
      signal: budget.signal,
    }).catch(() => undefined);
    throwIfInterrupted();
  }
  const hasReachedDeadline =
    budget.deadline !== undefined &&
    budget.deadline - Date.now() <= getCleanupReserveMs(budget);
  throw localBackendFailure({
    reason: hasReachedDeadline ? 'timeout' : 'readiness',
  });
}

/**
 * The instance check, classified: only a real name mismatch is `instance`
 * (validation); a timeout or abort keeps its own class.
 */
async function verifyInstanceName({
  url,
  name,
  budget,
}: {
  url: string;
  name: string;
  budget: StartupBudget;
}) {
  try {
    await assertLocalInstance({
      url,
      name,
      timeoutMs: getStartupAllowanceMs({ budget, capMs: instanceCheckCapMs }),
      signal: budget.signal,
    });
  } catch (error) {
    if (readLocalBackendReason(error)) throw error;
    if (budget.signal?.aborted)
      throw localBackendFailure({ reason: 'interrupted' });
    if (error instanceof LocalInstanceMismatch)
      throw localBackendFailure({ reason: 'instance' });
    if (error instanceof DOMException && error.name === 'TimeoutError')
      throw localBackendFailure({ reason: 'timeout' });
    throw localBackendFailure({ reason: 'instance-unreachable' });
  }
}

/**
 * The startup failure, also naming the container its rollback could not
 * stop or remove and that container's recovery step.
 */
function addRollbackFailure({ error, name }: { error: unknown; name: string }) {
  const rollback = {
    kind: 'local-backend',
    reason: 'stop-after-failure',
    name,
  } as const;
  return error instanceof HarnessFailure
    ? new HarnessFailure(error.diagnostic, error.step, rollback)
    : new HarnessFailure(
        { kind: 'local-backend', reason: 'docker' },
        undefined,
        rollback,
      );
}

export type LocalBackend = {
  name: string;
  url: string;
  siteUrl: string;
  adminKeyFile: string;
  envFile: string;
  /**
   * Removes an E2E container with its volume, or, with `keep` (a prepared
   * environment, #754), only stops it; a development one is always stopped.
   */
  stop: (options?: { keep?: boolean }) => Promise<void>;
};

/** Where a container is reached, and whether it already ran before startup. */
type ContainerEndpoints = {
  containerId: string;
  url: string;
  siteUrl: string;
  isAlreadyRunning: boolean;
};

/** Removes a container: an E2E one with its anonymous volume, a development one without. */
const removeContainer = ({
  containerId,
  isDevelopment,
  cleanupDeadline,
}: {
  containerId: string;
  isDevelopment: boolean;
  cleanupDeadline: number;
}) =>
  runCleanupDocker({
    args: isDevelopment
      ? ['rm', '--force', containerId]
      : ['rm', '--force', '--volumes', containerId],
    cleanupDeadline,
  });

/**
 * An existing container we were asked to start, if it is ours and usable:
 * the development container, or a prepared E2E one (#754).
 */
async function inspectExistingContainer({
  containerId,
  name,
  expectedName,
  budget,
}: {
  containerId: string;
  name: string;
  expectedName?: string;
  budget: StartupBudget;
}): Promise<ContainerEndpoints> {
  const inspect = (format: string) =>
    runStartupDocker({
      budget,
      args: ['inspect', '--format', format, containerId],
    });
  const readPort = (internal: string, field: 'HostIp' | 'HostPort') =>
    inspect(
      `{{(index (index .HostConfig.PortBindings "${internal}/tcp") 0).${field}}}`,
    ).catch((error: unknown) => {
      if (readLocalBackendReason(error) === 'docker') return '';
      throw error;
    });
  if (
    !expectedName ||
    (await inspect(`{{index .Config.Labels "${ownerLabel}"}}`)) !== name
  )
    throw localBackendFailure({ reason: 'ownership', name: expectedName });
  for (const internal of ['3210', '3211'])
    if ((await readPort(internal, 'HostIp')) !== '127.0.0.1')
      throw localBackendFailure({ reason: 'ports', name });
  if ((await inspect('{{.Config.Image}}')) !== localBackendImage)
    throw localBackendFailure({ reason: 'image-changed', name });
  const url = `http://127.0.0.1:${await readPort('3210', 'HostPort')}`;
  const siteUrl = `http://127.0.0.1:${await readPort('3211', 'HostPort')}`;
  if (!isLocalConvexUrl(url) || !isLocalConvexUrl(siteUrl))
    throw localBackendFailure({ reason: 'ports', name });
  const isAlreadyRunning = (await inspect('{{.State.Running}}')) === 'true';
  return { containerId, url, siteUrl, isAlreadyRunning };
}

/**
 * After a failed or interrupted create, which the daemon may still have
 * completed: removes our container, found by its unique name and label.
 */
async function removeLeftoverContainer({
  name,
  isDevelopment,
  budget,
}: {
  name: string;
  isDevelopment: boolean;
  budget: StartupBudget;
}) {
  const cleanupDeadline = createCleanupDeadline(budget);
  const leftover = await runCleanupDocker({
    args: ['ps', '-aq', '--filter', `name=^/${name}$`],
    cleanupDeadline,
  });
  if (!leftover) return;
  const label = await runCleanupDocker({
    args: [
      'inspect',
      '--format',
      `{{index .Config.Labels "${ownerLabel}"}}`,
      leftover,
    ],
    cleanupDeadline,
  });
  if (label === name)
    await removeContainer({
      containerId: leftover,
      isDevelopment,
      cleanupDeadline,
    });
}

/** Creates a container on two free loopback ports, never pulling. */
async function createContainer({
  name,
  directory,
  developmentName,
  budget,
}: {
  name: string;
  directory: string;
  developmentName?: string;
  budget: StartupBudget;
}): Promise<ContainerEndpoints> {
  const [port, sitePort] = await findAvailablePorts();
  const url = `http://127.0.0.1:${port}`;
  const siteUrl = `http://127.0.0.1:${sitePort}`;
  const settings = join(directory, 'backend.env');
  await writePrivateFile({
    path: settings,
    content: [
      `INSTANCE_NAME=${name}`,
      `INSTANCE_SECRET=${randomBytes(32).toString('hex')}`,
      `CONVEX_CLOUD_ORIGIN=${url}`,
      `CONVEX_SITE_ORIGIN=${siteUrl}`,
      'DISABLE_BEACON=true',
    ].join('\n'),
  });
  try {
    const containerId = await runStartupDocker({
      budget,
      args: [
        'create',
        '--pull',
        'never',
        '--name',
        name,
        '--label',
        `${ownerLabel}=${name}`,
        '--publish',
        `127.0.0.1:${port}:3210`,
        '--publish',
        `127.0.0.1:${sitePort}:3211`,
        '--env-file',
        settings,
        '--mount',
        developmentName
          ? `type=volume,source=${name}-data,target=/convex/data`
          : 'type=volume,target=/convex/data',
        localBackendImage,
      ],
    });
    return { containerId, url, siteUrl, isAlreadyRunning: false };
  } catch (error) {
    const isRemoved = await removeLeftoverContainer({
      name,
      isDevelopment: developmentName !== undefined,
      budget,
    }).then(
      () => true,
      () => false,
    );
    throw isRemoved ? error : addRollbackFailure({ error, name });
  } finally {
    await rm(settings, { force: true });
  }
}

/** Generates the admin key and writes it, and the CLI's env file, privately. */
async function writeCredentials({
  directory,
  containerId,
  url,
  budget,
}: {
  directory: string;
  containerId: string;
  url: string;
  budget: StartupBudget;
}) {
  const key = await runStartupDocker({
    budget,
    args: ['exec', containerId, './generate_admin_key.sh'],
  });
  if (!key || /\s/.test(key))
    throw localBackendFailure({ reason: 'admin-key' });
  const adminKeyFile = join(directory, 'local-admin.key');
  const envFile = join(directory, 'convex.env');
  try {
    await writePrivateFile({ path: adminKeyFile, content: key });
    await writePrivateFile({
      path: envFile,
      content: `CONVEX_SELF_HOSTED_URL=${url}\nCONVEX_SELF_HOSTED_ADMIN_KEY=${key}\n`,
    });
  } catch {
    await rm(adminKeyFile, { force: true });
    await rm(envFile, { force: true });
    throw localBackendFailure({ reason: 'credentials' });
  }
  return { adminKeyFile, envFile };
}

/**
 * Undoes a failed startup within one cleanup deadline: removes a container
 * this attempt created, or stops one it may have started. A `docker start`
 * whose client failed may still have started it, so it counts as started.
 */
async function rollBackStartup({
  containerId,
  isCreated,
  isPossiblyStarted,
  isDevelopment,
  budget,
}: {
  containerId: string;
  isCreated: boolean;
  isPossiblyStarted: boolean;
  isDevelopment: boolean;
  budget: StartupBudget;
}) {
  const cleanupDeadline = createCleanupDeadline(budget);
  if (isCreated)
    await removeContainer({ containerId, isDevelopment, cleanupDeadline });
  else if (isPossiblyStarted)
    await runCleanupDocker({
      args: ['stop', '--time', '10', containerId],
      cleanupDeadline,
    });
}

/**
 * E2E always owns a new container. Development keeps its named data volume.
 * Every Docker call, the readiness wait and the instance check end by
 * `deadline` less the cleanup reserve, or when `signal` aborts. On failure,
 * a container this attempt created is removed (an E2E one with its volume, a
 * development one without), and one it may have started is stopped.
 */
export async function startLocalBackend({
  directory,
  developmentName,
  reuseName,
  ...budget
}: {
  directory: string;
  developmentName?: string;
  /** A prepared E2E container to resume, which must exist (#754). */
  reuseName?: string;
} & StartupBudget): Promise<LocalBackend> {
  const name = developmentName ?? reuseName ?? `ep-e2e-${randomUUID()}`;
  const isDevelopment = developmentName !== undefined;
  if (!/^ep-(?:dev-[a-f0-9]{12}|e2e-[a-f0-9-]{36})$/.test(name))
    throw new Error('Invalid local Convex instance name');
  // Nothing starts without its cleanup reserve, or once canceled.
  getStartupAllowanceMs({ budget, capMs: 0 });
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  await checkLocalBackendHost(budget);
  const existing = await runStartupDocker({
    budget,
    args: ['ps', '-aq', '--filter', `name=^/${name}$`],
  });
  if (reuseName && !existing)
    throw localBackendFailure({ reason: 'missing', name });
  const endpoints = existing
    ? await inspectExistingContainer({
        containerId: existing,
        name,
        expectedName: developmentName ?? reuseName,
        budget,
      })
    : await createContainer({ name, directory, developmentName, budget });
  const { containerId, url, siteUrl } = endpoints;
  const isCreated = !existing;
  let isPossiblyStarted = false;
  try {
    isPossiblyStarted = !endpoints.isAlreadyRunning;
    await relabelDockerFailure({
      step: runStartupDocker({ budget, args: ['start', containerId] }),
      reason: isCreated ? 'start' : 'start-existing',
      name,
    });
    await waitUntilReady({ url, budget });
    await verifyInstanceName({ url, name, budget });
    const credentials = await writeCredentials({
      directory,
      containerId,
      url,
      budget,
    });
    // A development container, or a prepared E2E one kept for reuse
    // (#754), is only stopped; any other E2E container goes with its volume.
    const stop = ({ keep = false }: { keep?: boolean } = {}) =>
      stopLocalBackend({
        containerId,
        name,
        retainContainer: isDevelopment || keep,
      });
    return { name, url, siteUrl, ...credentials, stop };
  } catch (error) {
    const isRolledBack = await rollBackStartup({
      containerId,
      isCreated,
      isPossiblyStarted,
      isDevelopment,
      budget,
    }).then(
      () => true,
      () => false,
    );
    throw isRolledBack ? error : addRollbackFailure({ error, name });
  }
}

/**
 * Within one cleanup deadline, stops a container to retain (with its data),
 * or removes an E2E one with its anonymous volume. A failure names the
 * container and its `docker rm` recovery.
 */
async function stopLocalBackend({
  containerId,
  name,
  retainContainer,
}: {
  containerId: string;
  name: string;
  retainContainer: boolean;
}) {
  const cleanupDeadline = createCleanupDeadline();
  try {
    if (retainContainer)
      await runCleanupDocker({
        args: ['stop', '--time', '10', containerId],
        cleanupDeadline,
      });
    else
      await removeContainer({
        containerId,
        isDevelopment: false,
        cleanupDeadline,
      });
  } catch {
    throw localBackendFailure({ reason: 'stop', name });
  }
}

const e2eInstanceName = /^ep-e2e-[a-f0-9-]{36}$/;

/** Our labelled E2E container with this name, if one exists. */
async function findOwnContainer({
  name,
  cleanupDeadline,
}: {
  name: string;
  cleanupDeadline: number;
}) {
  if (!e2eInstanceName.test(name))
    throw new Error('Invalid local Convex instance name');
  const containerId = await runCleanupDocker({
    args: ['ps', '-aq', '--filter', `name=^/${name}$`],
    cleanupDeadline,
  });
  if (!containerId) return { containerId: null, isOurs: false };
  const label = await runCleanupDocker({
    args: [
      'inspect',
      '--format',
      `{{index .Config.Labels "${ownerLabel}"}}`,
      containerId,
    ],
    cleanupDeadline,
  });
  return { containerId, isOurs: label === name };
}

/**
 * Whether a prepared E2E container is running (#754). A container with this
 * name that is not ours counts as running, so it is never discarded.
 */
export async function isLocalBackendRunning(name: string) {
  const cleanupDeadline = createCleanupDeadline();
  const { containerId, isOurs } = await findOwnContainer({
    name,
    cleanupDeadline,
  });
  if (!containerId) return false;
  if (!isOurs) return true;
  return (
    (await runCleanupDocker({
      args: ['inspect', '--format', '{{.State.Running}}', containerId],
      cleanupDeadline,
    })) === 'true'
  );
}

/**
 * Removes a prepared E2E container and its anonymous volume, if it exists
 * and carries our label (#754). Another owner's container is left alone.
 */
export async function discardLocalBackend(name: string) {
  const cleanupDeadline = createCleanupDeadline();
  try {
    const { containerId, isOurs } = await findOwnContainer({
      name,
      cleanupDeadline,
    });
    if (containerId && isOurs)
      await removeContainer({
        containerId,
        isDevelopment: false,
        cleanupDeadline,
      });
  } catch {
    throw localBackendFailure({ reason: 'stop', name });
  }
}
