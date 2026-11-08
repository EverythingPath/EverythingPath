import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { availableParallelism, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import { createServer } from 'node:net';
import { cohortWorkers } from './cohorts';
import { verifyClerkCohorts } from './clerk';
import { loadTargets } from './configuration';
import { HarnessFailure } from './diagnostics';
import {
  command,
  CommandFailure,
  loadRun,
  readWriteEpoch,
  savePrivate,
  type Run,
} from './process';
import { finalizeProgress } from './progress';
import { evaluateResults } from './results';
import {
  describeSuite,
  requiredTests,
  selectSuite,
  suiteLabel,
  type Suite,
} from './matrix';
import {
  acquireSlotLock,
  failureReport,
  releaseSlotLock,
  setupStage,
  withCleanup,
} from './setup-failure';
import { reuseFingerprint, sourceFingerprint } from './source-evidence';
import {
  checkGeneratedBindings,
  copyBuildWorkspace,
  refreshSpecFiles,
} from './workspace';
import {
  isWorkspaceFreeOfSecrets,
  readPreparedRecord,
  writePreparedRecord,
} from './prepared-environment';
import { createPreparedLifecycle } from './prepared-lifecycle';
import { randomUUID } from 'node:crypto';
import { watchInterruption } from './interruption';
import {
  checkLocalBackendHost,
  discardLocalBackend,
  isLocalBackendRunning,
  startLocalBackend,
  type LocalBackend,
} from '../../scripts/local-convex/backend';
import {
  computeRunDeadline,
  getRemainingMs,
  parseTimeOptions,
} from './deadline';
import { reapRunProcesses, runTokenVariable } from './process-group';
import { releaseAdminKeyPath, removeAdminKeyFile } from './preview-admin-key';
import {
  describeBrowserOutcome,
  formatReleaseComment,
  readReleaseEvidence,
  releaseCommentFile,
  summarizeReleaseEvidence,
  type ReleaseEvidence,
} from './release-qualification';

async function availablePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new HarnessFailure({ kind: 'port' });
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

// Every operation with a failure mode, so tests can drive each stage.
export const runnerDependencies = {
  now: () => Date.now(),
  createRunToken: (): string => randomUUID(),
  reapRunProcesses,
  cwd: () => process.cwd(),
  loadTargets,
  cohortWorkers,
  verifyClerkCohorts: (targets: Parameters<typeof verifyClerkCohorts>[0]) =>
    verifyClerkCohorts(targets),
  createDirectory: (path: string, mode?: number) =>
    mkdir(path, { recursive: true, mode }),
  acquireSlotLock,
  releaseSlotLock,
  createTemporaryDirectory: () =>
    mkdtemp(join(tmpdir(), 'everythingpath-e2e-')),
  removeDirectory: (path: string) => rm(path, { recursive: true, force: true }),
  sourceFingerprint,
  copyBuildWorkspace,
  savePrivate,
  availablePort,
  command,
  checkGeneratedBindings,
  loadRun,
  removeAdminKeyFile,
  checkLocalBackendHost,
  startLocalBackend,
  readReleaseEvidence,
  // A prepared local environment (#754).
  reuseFingerprint,
  readToolchain: () => ({
    node: process.version,
    pnpm: execFileSync('pnpm', ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim(),
  }),
  readPreparedRecord,
  writePreparedRecord,
  isLocalBackendRunning,
  discardLocalBackend,
  refreshSpecFiles,
  readWriteEpoch,
  isWorkspaceFreeOfSecrets,
  pathExists: (path: string) => existsSync(path),
};
export type RunnerDependencies = typeof runnerDependencies;

/**
 * A run's selection is a diagnosis, never a qualification, so `--reuse` may
 * apply (#754): journeys, a nightly journey diagnosis, or focused groups
 * alone. Mandatory, live, the whole nightly and release always prepare
 * afresh.
 */
export function isDiagnosticSelection(suite: Suite) {
  return (
    suite.kind === 'journeys' ||
    (suite.kind === 'nightly' && suite.titles !== undefined) ||
    (suite.kind === 'routine' &&
      !suite.mandatory &&
      !suite.live &&
      suite.groups.length > 0)
  );
}

/**
 * A setup stage, timed on the wall clock for the before/after measurements
 * of #754: a reused environment skips the deploy and build, so the time goes
 * to these stages. Only the stage label and seconds are printed.
 */
async function timedSetupStage<T>(
  stage: Parameters<typeof setupStage>[0],
  step: () => T | Promise<T>,
) {
  const started = performance.now();
  try {
    return await setupStage(stage, step);
  } finally {
    process.stdout.write(
      `E2E setup time: ${stage} ${((performance.now() - started) / 1000).toFixed(1)} s.\n`,
    );
  }
}

/** The outcome of a run that did not fail. */
export type RunOutcome = 'qualifying' | 'diagnostic';
/** A reused run's exit status even when every result passed (#754). */
export const diagnosticExitCode = 5;

export async function runE2E(
  argv: string[],
  overrides: Partial<RunnerDependencies> = {},
): Promise<RunOutcome> {
  const use = { ...runnerDependencies, ...overrides };
  const startedAt = use.now();
  const { values, resources, time, suite } = await setupStage(
    'arguments',
    () => {
      const { values } = parseArgs({
        args: argv,
        options: {
          resources: { type: 'string' },
          backend: { type: 'string', default: 'preview' },
          secrets: { type: 'string' },
          preflight: { type: 'boolean' },
          suite: { type: 'string', multiple: true },
          group: { type: 'string', multiple: true },
          journey: { type: 'string', multiple: true },
          workers: { type: 'string' },
          'budget-minutes': { type: 'string' },
          'outer-deadline-epoch': { type: 'string' },
          reuse: { type: 'boolean' },
          'discard-prepared': { type: 'boolean' },
        },
        strict: true,
      });
      const suite = selectSuite({
        suites: values.suite,
        groups: values.group,
        journeys: values.journey,
      });
      if (
        !values.resources ||
        !['preview', 'local'].includes(values.backend) ||
        !suite
      )
        throw new HarnessFailure({ kind: 'usage' });
      const time = parseTimeOptions({
        budgetMinutes: values['budget-minutes'],
        outerDeadlineEpoch: values['outer-deadline-epoch'],
      });
      // Reuse is for local diagnosis only; every qualifying entry point
      // prepares afresh (#754).
      if (
        values.reuse &&
        (values.backend !== 'local' ||
          !isDiagnosticSelection(suite) ||
          values.preflight ||
          values['discard-prepared'] ||
          values['outer-deadline-epoch'] !== undefined ||
          process.env.CI)
      )
        throw new HarnessFailure({ kind: 'reuse-usage' });
      if (
        values['discard-prepared'] &&
        (values.backend !== 'local' || values.preflight)
      )
        throw new HarnessFailure({ kind: 'usage' });
      return { values, resources: values.resources, time, suite };
    },
  );
  // The run's one clock (deadline.ts), from the runner's start or CI's.
  const { deadline, browserStopAt } = computeRunDeadline({
    startedAt,
    ...time,
  });
  // Marks every process the run starts, in whatever process group.
  const runToken = use.createRunToken();
  const targets = await setupStage('resources', () =>
    use.loadTargets(
      resources,
      values.secrets,
      values.backend === 'local' ? 'local' : 'preview',
    ),
  );
  // The release suite has one journey, on the first cohort, which its
  // qualification also seeds.
  const workers = await setupStage('workers', () =>
    use.cohortWorkers(
      targets.resources,
      suite.kind === 'release'
        ? 1
        : values.workers === undefined
          ? undefined
          : Number(values.workers),
    ),
  );
  await setupStage('clerk-verification', () => use.verifyClerkCohorts(targets));
  // Ctrl+C or SIGTERM only requests a stop while the runner listens: local
  // mode listens from its Docker check on, Cloud mode from its workspace.
  const interruption = watchInterruption({
    announceStop: () =>
      process.stdout.write('E2E stopping: cleaning up, please wait.\n'),
  });
  try {
    // Cheap and starts no container: the daemon answers and the pinned image
    // is present (pulled if not), so the preflight covers what a run needs.
    if (values.backend === 'local') {
      interruption.startListening();
      await setupStage('local-backend', () =>
        use.checkLocalBackendHost({
          deadline: browserStopAt,
          signal: interruption.signal,
        }),
      );
    }
    if (values.preflight) {
      process.stdout.write(
        values.backend === 'local'
          ? 'E2E preflight, local Docker backend check and read-only Clerk verification passed.\n'
          : 'E2E preflight and read-only Clerk verification passed.\n',
      );
      return 'qualifying';
    }

    const sourceRoot = await setupStage('source-root', use.cwd);
    const privateRoot = join(sourceRoot, 'e2e', '.private');
    await setupStage('private-directory', () =>
      use.createDirectory(privateRoot, 0o700),
    );
    // Exclusive local slot ownership; CI also serializes by slot.
    const slotLock = await setupStage('slot-lock', () =>
      use.acquireSlotLock(privateRoot, targets.resources.previewName),
    );
    // The kept local environment for this checkout and slot (#754).
    const prepared = createPreparedLifecycle({
      use,
      sourceRoot,
      targets,
      workers,
      suite,
      ownerToken: slotLock.owner,
    });
    if (values['discard-prepared']) {
      await withCleanup(async () => {
        await setupStage('prepared-environment', prepared.discard);
        process.stdout.write('E2E prepared environment discarded.\n');
      }, [['slot-lock', () => use.releaseSlotLock(slotLock)]]);
      return 'qualifying';
    }
    let temporary: string | undefined;
    let localBackend: LocalBackend | undefined;
    let runForCleanup: Run | undefined;
    let hasBrowserStageEnded = false;
    let isTemporaryRemoved = false;
    const checkInterrupted = () => {
      if (interruption.isInterrupted())
        throw new CommandFailure('E2E setup interrupted', null);
    };
    // Nothing is deleted or released while a run process may still write.
    let hasSurvivors = false;
    const keepIfSurvivors = () => {
      if (hasSurvivors) throw new HarnessFailure({ kind: 'process-group' });
    };
    const cleanups = [
      [
        'processes',
        async () => {
          hasSurvivors =
            (await use.reapRunProcesses({ token: runToken })).length > 0;
          keepIfSurvivors();
        },
      ],
      [
        // A release run's admin key file, even if its qualification failed
        // before deleting it; then proven gone (leftover check).
        'release-admin-key',
        async () => {
          keepIfSurvivors();
          if (temporary)
            await use.removeAdminKeyFile(
              releaseAdminKeyPath(join(temporary, 'private')),
            );
        },
      ],
      [
        // Its own target: a failed `docker rm` is reported, and the temporary
        // directory with the backend's admin key is still removed. A kept
        // environment's container is only stopped (#754).
        'local-backend',
        async () => {
          keepIfSurvivors();
          if (!localBackend) return;
          await prepared.stopBackend({
            backend: localBackend,
            run: runForCleanup,
            isRunComplete:
              hasBrowserStageEnded &&
              !hasSurvivors &&
              !interruption.isInterrupted(),
          });
        },
      ],
      [
        'temporary-directory',
        async () => {
          keepIfSurvivors();
          if (temporary) {
            await use.removeDirectory(temporary);
            if (use.pathExists(temporary))
              throw new HarnessFailure({ kind: 'admin-key-leftover' });
          }
          isTemporaryRemoved = true;
        },
      ],
      [
        // Ready only once this run's private files are gone; the record
        // stays this run's until then. Anything else discards it (#754).
        'prepared-environment',
        async () => {
          keepIfSurvivors();
          await prepared.release({ isPrivateRemoved: isTemporaryRemoved });
        },
      ],
      [
        'slot-lock',
        async () => {
          keepIfSurvivors();
          await use.releaseSlotLock(slotLock);
        },
      ],
    ] as const;
    // Keep ownership through a signal during Docker startup or workspace copy;
    // active child commands also receive it through their process supervisor.
    interruption.startListening();
    return await withCleanup(async () => {
      temporary = await setupStage('temporary-directory', async () => {
        const directory = await use.createTemporaryDirectory();
        // The release suite keeps the preview admin key in this directory, so
        // it must be under the wrapper's TMPDIR (.ep-tmp/e2e-*), never /tmp.
        if (
          suite.kind === 'release' &&
          (directory === '/tmp' || directory.startsWith('/tmp/'))
        ) {
          temporary = directory;
          throw new HarnessFailure({ kind: 'release-tmpdir' });
        }
        return directory;
      });
      const privateDirectory = join(temporary, 'private');
      const runFile = join(privateDirectory, 'run.json');
      const childEnv: NodeJS.ProcessEnv = { NODE_ENV: 'production' };
      for (const key of [
        'PATH',
        'HOME',
        'TMPDIR',
        'SYSTEMROOT',
        'CI',
        'GITHUB_ACTIONS',
        'GITHUB_EVENT_NAME',
        'GITHUB_SHA',
        'GITHUB_ACTOR',
        'E2E_REVIEWED_SHA',
        'E2E_FORCE_FAILURE',
        // The local wrapper's marker for every process of the run (e2e-branch.sh).
        'E2E_PROCESS_TOKEN',
      ])
        if (process.env[key]) childEnv[key] = process.env[key];
      Object.assign(childEnv, {
        [runTokenVariable]: runToken,
        E2E_RUN_FILE: runFile,
        E2E_TRUSTED_EXECUTION: 'true',
        CLERK_PUBLISHABLE_KEY: targets.publishableKey,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: targets.publishableKey,
        CLERK_SECRET_KEY: targets.secretKey,
        ...(values.backend === 'local'
          ? {}
          : { CONVEX_DEPLOY_KEY: targets.previewKey }),
      });
      // With --reuse, reuse the kept environment or prepare afresh; any
      // other run discards one (#754).
      const selection = await timedSetupStage(
        'prepared-environment',
        async () => {
          if (!values.reuse) return await prepared.discardIfPresent();
          checkInterrupted();
          return await prepared.select({
            runId: basename(temporary!),
            privateDirectory,
            environment: childEnv,
            clock: { deadline, browserStopAt },
            signal: interruption.signal,
            isInterrupted: interruption.isInterrupted,
            adoptBackend: (backend) => {
              localBackend = backend;
            },
          });
        },
      );
      const isReused = selection?.kind === 'reused';
      const workspace = prepared.kind
        ? prepared.workspace
        : join(temporary, 'workspace');
      const artifactDirectory = join(
        sourceRoot,
        'e2e-artifacts',
        targets.resources.previewName,
        basename(temporary),
      );
      // Explicit file list prevents Next/Clerk/Convex from auto-loading personal .env files.
      const testedSource = await timedSetupStage(
        'source-snapshot',
        async () => {
          // A reused workspace only takes the current specs, against the
          // baseline taken before its reuse was checked; a kept one being
          // prepared starts empty (#754).
          const fingerprint =
            selection?.kind === 'reused'
              ? selection.sourceBaseline
              : use.sourceFingerprint(sourceRoot);
          if (isReused) await use.refreshSpecFiles(sourceRoot, workspace);
          else {
            if (prepared.kind) await use.removeDirectory(workspace);
            await use.copyBuildWorkspace(sourceRoot, workspace);
          }
          if (use.sourceFingerprint(sourceRoot) !== fingerprint)
            throw new HarnessFailure({ kind: 'source-changed' });
          prepared.verifySnapshot(childEnv);
          return fingerprint;
        },
      );
      const envFile = join(privateDirectory, 'convex.env');
      await timedSetupStage('environment', async () => {
        checkInterrupted();
        if (isReused) return;
        if (values.backend === 'local') {
          process.stdout.write(
            prepared.kind
              ? 'E2E target: new local Convex Docker instance, kept for --reuse runs.\n'
              : 'E2E target: new disposable local Convex Docker instance.\n',
          );
          // Startup ends by the browser stop point less its cleanup reserve,
          // or at once on SIGINT/SIGTERM, removing what it created.
          localBackend = await use.startLocalBackend({
            directory: privateDirectory,
            deadline: browserStopAt,
            signal: interruption.signal,
          });
          await prepared.recordContainer(localBackend);
          if (interruption.isInterrupted())
            throw new HarnessFailure({
              kind: 'local-backend',
              reason: 'interrupted',
            });
        } else
          await use.savePrivate(
            envFile,
            `CONVEX_DEPLOY_KEY=${targets.previewKey}\n`,
          );
      });
      const port = await setupStage('port', use.availablePort);
      const run: Run = {
        backend: values.backend === 'local' ? 'local' : 'preview',
        ...(localBackend
          ? {
              localDeployment: {
                name: localBackend.name,
                url: localBackend.url,
                adminKeyFile: localBackend.adminKeyFile,
              },
            }
          : {}),
        suite,
        workers,
        resources: targets.resources,
        sourceRoot,
        sourceFingerprint: testedSource,
        preparation: isReused ? 'reused' : 'fresh',
        workspace,
        privateDirectory,
        artifactDirectory,
        envFile,
        // WebKit rejects Clerk's Domain=localhost client cookie. The loopback
        // IP accepts that domain-scoped cookie without altering real auth.
        baseURL: `http://127.0.0.1:${port}`,
        deadline,
        browserStopAt,
      };
      runForCleanup = run;
      await setupStage('run-file', () =>
        use.savePrivate(runFile, JSON.stringify(run)),
      );
      process.stdout.write(
        `E2E target: ${values.backend} ${targets.resources.previewName}; ${isReused ? 'reuse the prepared deployment and build, with fresh capabilities' : 'recreate, deploy and build'}. Workers: ${workers}, one cohort each (${availableParallelism()} CPUs).\n`,
      );
      process.stdout.write(
        `E2E scope: ${describeSuite(suite)}; ${requiredTests(suite).length} required results.\n`,
      );
      if (suite.kind === 'release')
        process.stdout.write(
          'E2E release qualification: prepare, reconcile and activate a fixture-only Catalog Release on this preview before its browser journey.\n',
        );
      process.stdout.write(
        `E2E budget: from ${new Date(startedAt).toISOString()}${'budgetMinutes' in time ? ` for ${time.budgetMinutes} minutes` : ' until the outer deadline'}; browsers stop at ${new Date(browserStopAt).toISOString()}, hard deadline ${new Date(deadline).toISOString()}.\n`,
      );
      // Its run-file read and first stages.log write report as `evidence`.
      await timedSetupStage('deployment', async () => {
        checkInterrupted();
        // A reused environment is deployed and built: only this run's
        // session and capabilities are bound (#754).
        if (isReused)
          return await use.command(
            'fixture binding',
            ['exec', 'tsx', 'e2e/bind-preview.ts', '--bind-only'],
            {
              cwd: workspace,
              env: { ...childEnv, NEXT_PUBLIC_CONVEX_URL: localBackend!.url },
              timeoutMs: getRemainingMs({
                until: browserStopAt,
                now: use.now(),
              }),
            },
          );
        return await use.command(
          'preview deployment and web build',
          [
            'exec',
            'convex',
            'deploy',
            ...(values.backend === 'local'
              ? ['--yes']
              : ['--preview-create', targets.resources.previewName]),
            '--env-file',
            envFile,
            '--cmd',
            'pnpm exec tsx e2e/bind-preview.ts',
            '--cmd-url-env-var-name',
            'NEXT_PUBLIC_CONVEX_URL',
          ],
          {
            cwd: workspace,
            env: childEnv,
            // Setup must leave the browsers their whole window.
            timeoutMs: getRemainingMs({ until: browserStopAt, now: use.now() }),
          },
        );
      });
      await setupStage('generated-bindings', () =>
        use.checkGeneratedBindings(sourceRoot, workspace),
      );
      process.env.E2E_RUN_FILE = runFile;
      const fixture = await setupStage('preview-binding', async () => {
        const bound = await use.loadRun();
        if (!bound.fixture)
          throw new HarnessFailure({ kind: 'preview-unbound' });
        return bound.fixture;
      });
      childEnv.NEXT_PUBLIC_CONVEX_URL = fixture.convexUrl;
      // What a later --reuse run must match, complete once deployed (#754).
      if (localBackend)
        await setupStage('prepared-environment', () =>
          prepared.complete({
            run,
            backend: localBackend!,
            sourceFingerprint: testedSource,
            clock: { deadline, browserStopAt },
          }),
        );
      await setupStage('artifact-directory', () =>
        use.createDirectory(artifactDirectory),
      );
      let releaseEvidence: ReleaseEvidence | undefined;
      if (suite.kind === 'release') {
        checkInterrupted();
        // Seed, build, prepare, reconcile, activate and check the release
        // (release-qualification.ts) before any browser starts.
        await setupStage('release-qualification', () =>
          use.command(
            'catalog release qualification',
            ['exec', 'tsx', 'e2e/qualify-release.ts'],
            {
              cwd: workspace,
              // It needs the preview deploy key for the exchange and its
              // fixture calls, never the Clerk keys.
              env: {
                ...Object.fromEntries(
                  Object.entries(childEnv).filter(
                    ([key]) => !key.includes('CLERK'),
                  ),
                ),
                NODE_ENV: 'production',
              },
              timeoutMs: getRemainingMs({
                until: browserStopAt,
                now: use.now(),
              }),
            },
          ),
        );
        // The browsers never get the release key: its file must be gone before
        // they start. (A local run's own admin key file stays until cleanup.)
        await setupStage('release-admin-key', () =>
          use.removeAdminKeyFile(releaseAdminKeyPath(privateDirectory)),
        );
        releaseEvidence = await setupStage('release-evidence', () =>
          use.readReleaseEvidence(artifactDirectory),
        );
        process.stdout.write(summarizeReleaseEvidence(releaseEvidence));
      }
      let requiredPassed = false;
      try {
        checkInterrupted();
        const now = use.now();
        await use.command(
          `E2E ${suiteLabel(run.suite)} browser journeys`,
          ['exec', 'playwright', 'test', '--config', 'playwright.config.ts'],
          {
            cwd: workspace,
            env: childEnv,
            // SIGINT at the stop point, as Ctrl+C would: Playwright stops its
            // tests, its server and writes its report within the reserve.
            interruptAfterMs: getRemainingMs({ until: browserStopAt, now }),
            timeoutMs: getRemainingMs({ until: deadline, now }),
          },
        );
      } finally {
        hasBrowserStageEnded = true;
        // Stop → reap → finalize: Playwright's group is gone (command());
        // anything it left, such as the application server's own group, is
        // stopped and awaited before the checkpoint is finalized.
        hasSurvivors =
          (await use.reapRunProcesses({ token: runToken })).length > 0;
        if (!hasSurvivors)
          await reportFinalProgress({ artifactDirectory, suite: run.suite });
        // Only fixed diagnostics reach the console; provider output stays private.
        const report: unknown = await readFile(
          join(artifactDirectory, 'report.json'),
          'utf8',
        )
          .then((contents) => JSON.parse(contents) as unknown)
          .catch(() => null);
        requiredPassed = evaluateResults(report, run.suite);
        // The comment for the issues states the browsers' actual outcome.
        if (releaseEvidence)
          await use.savePrivate(
            join(artifactDirectory, releaseCommentFile),
            formatReleaseComment(
              releaseEvidence,
              describeBrowserOutcome(report),
            ),
          );
        // Relative to the checkout, so the console never shows a local path.
        process.stdout.write(
          `E2E ${describeSuite(run.suite)} browser results: ${requiredPassed ? 'passed' : 'failed or missing'}${run.preparation === 'reused' ? ' (reused preparation; diagnostic, not qualifying)' : ''}. Safe evidence: e2e-artifacts/${targets.resources.previewName}/${basename(temporary)}\n`,
        );
      }
      if (!requiredPassed)
        throw new HarnessFailure({ kind: 'results', suite: run.suite });
      // A reused preparation never satisfies a gate (#754): it passes as a
      // diagnosis, with its own exit status.
      if (run.preparation === 'reused') {
        process.stdout.write(
          `E2E ${suiteLabel(run.suite)} browser journeys passed on a reused preparation: diagnostic only, not qualifying (exit ${diagnosticExitCode}).\n`,
        );
        return 'diagnostic' as const;
      }
      if (process.env.GITHUB_OUTPUT)
        await appendFile(process.env.GITHUB_OUTPUT, 'required_result=passed\n');
      process.stdout.write(
        `E2E ${suiteLabel(run.suite)} browser journeys passed.\n`,
      );
      return 'qualifying' as const;
    }, cleanups);
  } finally {
    interruption.stopListening();
  }
}

/** Finalizes the checkpoint (progress.ts) and prints an interruption's counts. */
async function reportFinalProgress({
  artifactDirectory,
  suite,
}: {
  artifactDirectory: string;
  suite: Suite;
}) {
  try {
    const progress = await finalizeProgress(artifactDirectory);
    if (progress.status === 'interrupted')
      process.stdout.write(
        `E2E ${suiteLabel(suite)} browser journeys interrupted: ${progress.completed.length} completed, ${progress.interrupted.length} interrupted, ${progress.unstarted.length} not started.\n`,
      );
  } catch {
    process.stdout.write('E2E progress checkpoint could not be finalized.\n');
  }
}

// Provider errors can include payloads; print only lines rebuilt from fixed
// stage labels, closed error classes and typed diagnostic fields.
export async function runAndReport(
  argv: string[],
  overrides: Partial<RunnerDependencies> = {},
) {
  try {
    const outcome = await runE2E(argv, overrides);
    return outcome === 'diagnostic' ? diagnosticExitCode : 0;
  } catch (error) {
    process.stderr.write(`${failureReport(error).join('\n')}\n`);
    return 1;
  }
}
