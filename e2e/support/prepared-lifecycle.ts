import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  localBackendCleanupReserveMs,
  localBackendImage,
  type LocalBackend,
} from '../../scripts/local-convex/backend';
import { HarnessFailure } from './diagnostics';
import type { Suite } from './matrix';
import type { SafeTargets } from './preflight';
import {
  discardPreparedEnvironment,
  findMismatch,
  hashText,
  planPreparation,
  preparedEnvironmentDirectory,
  type ExpectedPreparation,
  type Preparation,
} from './prepared-environment';
import type { Run } from './process';
import type { RunnerDependencies } from './runner';

// One run's use of the kept local environment (#754): which environment it
// selects, its ownership record, resuming the container, keeping it after a
// clean run, and publishing or discarding it at cleanup. The runner calls
// these at its stages; the policy stays here.

type Use = Pick<
  RunnerDependencies,
  | 'now'
  | 'sourceFingerprint'
  | 'reuseFingerprint'
  | 'readToolchain'
  | 'readPreparedRecord'
  | 'writePreparedRecord'
  | 'isLocalBackendRunning'
  | 'discardLocalBackend'
  | 'removeDirectory'
  | 'pathExists'
  | 'startLocalBackend'
  | 'readWriteEpoch'
  | 'isWorkspaceFreeOfSecrets'
>;

/** The run clock's fields (deadline.ts) that bound verification. */
type Clock = { deadline: number; browserStopAt: number };

// A verification read that has not answered by then will not: the
// environment is not used or kept, rather than waiting out the budget.
const verificationReadCapMs = 30_000;
const cleanupReadCapMs = 15_000;

export type PreparedSelection =
  | {
      kind: 'reused';
      backend: LocalBackend;
      /** The full source fingerprint, taken before the reuse check. */
      sourceBaseline: string;
    }
  | { kind: 'fresh' };

export function createPreparedLifecycle({
  use,
  sourceRoot,
  targets,
  workers,
  suite,
  ownerToken,
}: {
  use: Use;
  sourceRoot: string;
  targets: SafeTargets;
  workers: number;
  suite: Suite;
  /** The slot lock's owner, which the record names while this run holds it. */
  ownerToken: string;
}) {
  const directory = preparedEnvironmentDirectory({
    sourceRoot,
    previewName: targets.resources.previewName,
  });
  const workspace = join(directory, 'workspace');
  let state:
    | {
        kind: 'reused' | 'fresh';
        expected: ExpectedPreparation;
        runId: string;
        /** Complete once deployed and verified. */
        preparation?: Preparation;
      }
    | undefined;
  let isKept = false;

  const discard = () =>
    discardPreparedEnvironment({
      directory,
      discardBackend: use.discardLocalBackend,
      removeDirectory: use.removeDirectory,
    });
  const expectFor = (
    environment: Record<string, string | undefined>,
  ): ExpectedPreparation => ({
    ...use.reuseFingerprint({
      root: sourceRoot,
      environment,
      toolchain: use.readToolchain(),
    }),
    target: {
      resources: hashText(JSON.stringify(targets.resources)),
      previewName: targets.resources.previewName,
      clerkHost: targets.resources.clerkHost,
      publishableKey: hashText(targets.publishableKey),
    },
    workers,
    releaseState: 'none',
    image: localBackendImage,
  });
  const claim = ({
    runId,
    preparation,
    instanceName = preparation?.backend.instanceName ?? null,
  }: {
    runId: string;
    preparation: Preparation | null;
    instanceName?: string | null;
  }) =>
    use.writePreparedRecord(directory, {
      schema: 1,
      state: 'in-use',
      ownerToken,
      runId,
      instanceName,
      preparation,
    });
  const verificationUntil = (until: number) =>
    Math.min(until, use.now() + verificationReadCapMs);

  /**
   * The kept container, resumed with this run's own admin key, must answer
   * as recorded, and the sources must still match after the wait: an edit
   * made meanwhile is not in the kept build. Otherwise it is removed and the
   * reason returned.
   */
  async function resume({
    preparation,
    privateDirectory,
    environment,
    clock,
    signal,
    isInterrupted,
    adoptBackend,
  }: {
    preparation: Preparation;
    privateDirectory: string;
    environment: Record<string, string | undefined>;
    clock: Clock;
    signal: AbortSignal;
    isInterrupted: () => boolean;
    adoptBackend: (backend: LocalBackend | undefined) => void;
  }) {
    let backend: LocalBackend | undefined;
    const reject = async (reason: string) => {
      await backend?.stop().catch(() => undefined);
      adoptBackend(undefined);
      return reason;
    };
    try {
      backend = await use.startLocalBackend({
        directory: privateDirectory,
        reuseName: preparation.backend.instanceName,
        deadline: clock.browserStopAt,
        signal,
      });
      // Cleanup removes it if the run stops from here on.
      adoptBackend(backend);
      if (
        backend.url !== preparation.backend.url ||
        backend.siteUrl !== preparation.backend.siteUrl
      )
        return await reject('backend URL');
      const epoch = await use.readWriteEpoch(
        {
          backend: 'local',
          localDeployment: {
            name: backend.name,
            url: backend.url,
            adminKeyFile: backend.adminKeyFile,
          },
          suite,
          workers,
          resources: targets.resources,
          workspace,
          sourceRoot,
          privateDirectory,
          artifactDirectory: join(privateDirectory, 'resume'),
          envFile: backend.envFile,
          baseURL: 'http://127.0.0.1:1',
          preparation: 'reused',
          ...clock,
        },
        { until: verificationUntil(clock.browserStopAt) },
      );
      if (epoch !== preparation.writeEpoch) return await reject('write epoch');
      const sourceBaseline = use.sourceFingerprint(sourceRoot);
      const changed = findMismatch({
        preparation,
        expected: expectFor(environment),
        now: use.now(),
      });
      if (changed) return await reject(changed);
      return { backend, sourceBaseline };
    } catch (error) {
      if (isInterrupted()) throw error;
      return await reject('backend');
    }
  }

  return {
    workspace,
    get kind() {
      return state?.kind;
    },
    /** Removes the kept environment, if there is one. */
    async discardIfPresent() {
      if (use.pathExists(directory)) await discard();
    },
    /**
     * Reuses the kept environment when everything matches, or prepares
     * afresh: either way this run then holds its record.
     */
    async select({
      runId,
      privateDirectory,
      environment,
      clock,
      signal,
      isInterrupted,
      adoptBackend,
    }: {
      runId: string;
      privateDirectory: string;
      /** The deploy and build environment the fingerprint covers. */
      environment: Record<string, string | undefined>;
      clock: Clock;
      signal: AbortSignal;
      isInterrupted: () => boolean;
      adoptBackend: (backend: LocalBackend | undefined) => void;
    }): Promise<PreparedSelection> {
      const expected = expectFor(environment);
      const plan = await planPreparation({
        record: await use.readPreparedRecord(directory),
        expected,
        now: use.now(),
        isRunning: use.isLocalBackendRunning,
      });
      if (plan.kind === 'refuse')
        throw new HarnessFailure({ kind: 'prepared-in-use' });
      let reason = plan.kind === 'prepare' ? plan.reason : null;
      if (plan.kind === 'reuse') {
        await claim({ runId, preparation: plan.preparation });
        const resumed = await resume({
          preparation: plan.preparation,
          privateDirectory,
          environment,
          clock,
          signal,
          isInterrupted,
          adoptBackend,
        });
        if (typeof resumed !== 'string') {
          state = {
            kind: 'reused',
            expected,
            runId,
            preparation: plan.preparation,
          };
          process.stdout.write(
            'E2E prepared environment: reused (diagnostic, not qualifying).\n',
          );
          return { kind: 'reused', ...resumed };
        }
        reason = resumed;
      }
      if (use.pathExists(directory)) await discard();
      await claim({ runId, preparation: null });
      // The sources may have changed while the old one was checked.
      state = { kind: 'fresh', expected: expectFor(environment), runId };
      process.stdout.write(
        `E2E prepared environment: preparing afresh${reason ? ` (${reason} changed)` : ''}.\n`,
      );
      return { kind: 'fresh' };
    },
    /**
     * After the workspace snapshot: the sources still match what the
     * environment was, or is being, prepared from.
     */
    verifySnapshot(environment: Record<string, string | undefined>) {
      if (!state) return;
      const matched =
        state.preparation?.reuseFingerprint ?? state.expected.reuseFingerprint;
      if (expectFor(environment).reuseFingerprint !== matched)
        throw new HarnessFailure({ kind: 'source-changed' });
    },
    /** A crash from here on leaves a container the record names. */
    async recordContainer(backend: LocalBackend) {
      if (state?.kind !== 'fresh') return;
      await claim({
        runId: state.runId,
        preparation: null,
        instanceName: backend.name,
      });
    },
    /**
     * What a later --reuse run must match, once deployed. An epoch that
     * cannot be read in time leaves it incomplete, so it is not kept.
     */
    async complete({
      run,
      backend,
      sourceFingerprint,
      clock,
    }: {
      run: Run;
      backend: LocalBackend;
      sourceFingerprint: string;
      clock: Clock;
    }) {
      if (state?.kind !== 'fresh') return;
      let writeEpoch: number;
      try {
        writeEpoch = await use.readWriteEpoch(run, {
          until: verificationUntil(clock.browserStopAt),
        });
      } catch {
        process.stdout.write(
          'E2E prepared environment: not kept (its write epoch could not be read in time).\n',
        );
        return;
      }
      const { expected } = state;
      state.preparation = {
        reuseFingerprint: expected.reuseFingerprint,
        parts: expected.parts,
        sourceFingerprint,
        target: expected.target,
        workers,
        releaseState: 'none',
        backend: {
          image: expected.image,
          instanceName: backend.name,
          url: backend.url,
          siteUrl: backend.siteUrl,
        },
        writeEpoch,
        createdAt: use.now(),
      };
    },
    /**
     * The `local-backend` cleanup: keeps (stops) the container only after a
     * whole, clean run that left no case behind, still sees the epoch it was
     * prepared with (read within the cleanup budget) and holds no secret in
     * its workspace; otherwise removes it.
     */
    async stopBackend({
      backend,
      run,
      isRunComplete,
    }: {
      backend: LocalBackend;
      run: Run | undefined;
      isRunComplete: boolean;
    }) {
      if (
        state?.preparation &&
        run &&
        isRunComplete &&
        (await isCleanToKeep(state.preparation, run))
      ) {
        await backend.stop({ keep: true });
        isKept = true;
      } else await backend.stop();
    },
    /**
     * The `prepared-environment` cleanup: ready only once the run's private
     * files are gone; this run's record until then; anything else discards.
     */
    async release({ isPrivateRemoved }: { isPrivateRemoved: boolean }) {
      if (!state) return;
      if (isKept && isPrivateRemoved && state.preparation)
        await use.writePreparedRecord(directory, {
          schema: 1,
          state: 'ready',
          ownerToken,
          runId: state.runId,
          instanceName: state.preparation.backend.instanceName,
          preparation: state.preparation,
        });
      else await discard();
    },
    discard,
  };

  async function isCleanToKeep(preparation: Preparation, run: Run) {
    try {
      const leftovers = join(run.privateDirectory, 'leftover-cases');
      for (const cohort of await readdir(leftovers).catch(() => []))
        if ((await readdir(join(leftovers, cohort))).length > 0) return false;
      const now = use.now();
      const until = Math.min(
        (run.deadline ?? Number.POSITIVE_INFINITY) -
          localBackendCleanupReserveMs,
        now + cleanupReadCapMs,
      );
      if ((await use.readWriteEpoch(run, { until })) !== preparation.writeEpoch)
        return false;
      return await use.isWorkspaceFreeOfSecrets({
        workspace: run.workspace,
        secrets: [targets.secretKey],
      });
    } catch {
      return false;
    }
  }
}
