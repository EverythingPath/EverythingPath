import { appendFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { FIXTURE_VERSION, type FixtureScope } from '../fixtures/catalog';
import { releaseQualification } from '../fixtures/release';
import { catalogActivationStatusSchema } from '../../scripts/catalog/release-activation-command';
import { catalogRuntimeCompatibility } from '../../src/lib/catalog/runtime-compatibility';
import {
  describeDiagnostic,
  HarnessFailure,
  type ReleaseOperatorStep,
  type ReleasePhase,
  type ReleaseStep,
} from './diagnostics';
import {
  command,
  CommandFailure,
  fixtureCall,
  loadRun,
  readWriteEpoch,
  savePrivate,
  type Run,
} from './process';
import { runTokenVariable } from './process-group';
import {
  authorizePreview,
  readInstalledConvexVersion,
  releaseAdminKeyPath,
  removeAdminKeyFile,
  writeAdminKeyFile,
} from './preview-admin-key';
import {
  materializeReleaseSources,
  releaseBuildArguments,
} from './release-artifact';

/**
 * The release-qualification suite's setup (#753), run by the runner as its
 * own process before the browsers start, in this order:
 *
 * 1. seed the release case: a fixture campaign whose two Characters keep
 *    fixture provenance, the second already holding the admitted feat;
 * 2. build the bounded artifact once, under the run's temporary directory;
 * 3. get the preview's admin key (preview-admin-key.ts) into a mode-600 file;
 * 4. `catalog:release` prepare, reconcile (to readiness), activate
 *    --fixture-only --target-kind preview, and active, each with only
 *    `--admin-key-file`;
 * 5. delete the key file, whatever happened;
 * 6. record safe evidence in the run's evidence directory.
 *
 * The operator runs with an environment without the deploy key, Clerk keys
 * or the key file's path; the browsers never see the key.
 */
export const releaseEvidenceFile = 'release-qualification.json';
export const releaseCommentFile = 'release-qualification.md';
// Each invocation runs at most --max-steps of work; the next resumes it.
const reconcileMaxSteps = 100;
const maxReconcileInvocations = 5;
const fixtureNow = 1_700_000_000_000;
const operatorTimeoutMs = 600_000;

const fingerprint = z.string().regex(/^[a-f0-9]{64}$/);
const documentId = z.string().regex(/^[a-z0-9]+$/);
const count = z.number().int().nonnegative();
const builtSchema = z.object({
  manifest: z.object({
    releaseNumber: z.number().int().positive(),
    artifactFingerprint: fingerprint,
  }),
});
const preparedSchema = z.object({
  releaseNumber: z.number().int().positive(),
  state: z.literal('prepared'),
  batchCount: count,
  stagedRows: count,
});
const reconciledSchema = z.object({
  runId: documentId,
  status: z.object({
    isDiscoveryComplete: z.boolean(),
    isReady: z.boolean(),
    pendingCount: count,
    failedCount: count,
    missingIdentityCount: count.optional(),
    identityCoverageComplete: z.boolean().optional(),
    hasTruncatedCounts: z.boolean().optional(),
  }),
  stepCount: count,
  staleCompletionCount: count,
  stopped: z.enum(['ready', 'failed', 'limit', 'pending']),
});
// The operator's own status shape, held to the qualification's stricter
// identities and fixture-only mode.
const activationSchema = catalogActivationStatusSchema.extend({
  impactRunId: documentId,
  activationId: z.string().regex(/^[a-z0-9-]+$/),
  schemaIdentity: z.string().regex(/^[a-z0-9-]+$/),
  calculationIdentity: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  isFixtureOnly: z.literal(true),
});
const workSchema = z.object({
  character: z.string().regex(/^E2E [a-z-]+$/),
  state: z
    .string()
    .regex(/^[a-zA-Z]+$/)
    .nullable(),
  reasons: z.array(z.string().regex(/^[\w:/-]+$/)),
  hasFactsChanged: z.boolean().nullable(),
});
const inspectedSchema = z.object({
  characterIds: z.array(z.string()),
  releaseWork: z.array(workSchema).optional(),
});

/** What the run records; every field is a number, an identity or fixed text. */
export const releaseEvidenceSchema = z.object({
  backend: z.enum(['preview', 'local']).optional(),
  previewName: z.string().regex(/^e2e-[a-z0-9-]+$/),
  feat: z.object({
    externalKey: z.literal(releaseQualification.feat.externalKey),
    name: z.literal(releaseQualification.feat.name),
    effect: z.string(),
  }),
  artifact: z.object({
    releaseNumber: z.number().int().positive(),
    artifactFingerprint: fingerprint,
    batchCount: count,
    stagedRows: count,
  }),
  reconciliation: z.object({
    runId: documentId,
    invocations: z.number().int().positive(),
    isReady: z.literal(true),
    isDiscoveryComplete: z.literal(true),
    pendingCount: z.literal(0),
    failedCount: z.literal(0),
    missingIdentityCount: z.literal(0),
    stepCount: count,
    staleCompletionCount: count,
    work: z.array(workSchema),
  }),
  active: activationSchema,
});
export type ReleaseEvidence = z.infer<typeof releaseEvidenceSchema>;

export const releaseQualificationDependencies = {
  loadRun,
  fixtureCall,
  readWriteEpoch,
  command,
  savePrivate,
  materializeReleaseSources,
  readInstalledConvexVersion,
  authorizePreview,
  writeAdminKeyFile,
  removeAdminKeyFile,
  appendDiagnostic: (path: string, line: string) => appendFile(path, line),
  environment: () => process.env,
};
export type ReleaseQualificationDependencies =
  typeof releaseQualificationDependencies;

// Only what pnpm, tsx and the process reaper need: never the deploy key,
// the Clerk keys or anything naming the key file.
function operatorEnvironment(environment: NodeJS.ProcessEnv) {
  const kept: NodeJS.ProcessEnv = { NODE_ENV: 'production' };
  for (const key of [
    'PATH',
    'HOME',
    'TMPDIR',
    'LANG',
    'SYSTEMROOT',
    'E2E_RUN_FILE',
    'E2E_PROCESS_TOKEN',
    runTokenVariable,
  ])
    if (environment[key]) kept[key] = environment[key];
  return kept;
}

function fail(step: ReleaseStep): never {
  throw new HarnessFailure({ kind: 'release-step', step });
}

type Use = ReleaseQualificationDependencies;
type Built = {
  artifactPath: string;
  releaseNumber: number;
  artifactFingerprint: string;
  calculation: string;
};
// One release CLI step: run, parse and validate inside one boundary.
type Operator = <T>(
  step: ReleaseOperatorStep,
  args: string[],
  schema: z.ZodType<T>,
  check?: (result: T) => OperatorCheckFailure | null,
) => Promise<T>;
type Reconciled = z.infer<typeof reconciledSchema> & { invocations: number };

export async function qualifyRelease(
  overrides: Partial<ReleaseQualificationDependencies> = {},
) {
  const use = { ...releaseQualificationDependencies, ...overrides };
  const tracker: PhaseTracker = {
    phase: 'initialization',
    isKeyCleanupFailed: false,
  };
  // Until the run file is read there is no evidence directory: the phase
  // line then goes on the thrown failure only.
  let run: Run | undefined;
  try {
    run = await use.loadRun();
    const { fixture } = run;
    if (run.suite.kind !== 'release' || !fixture) return fail('mode');
    return await qualify({ use, run, fixture, tracker });
  } catch (error) {
    throw await finishFailure({ use, run, tracker, error });
  }
}

async function qualify({
  use,
  run,
  fixture,
  tracker,
}: {
  use: Use;
  run: Run;
  fixture: NonNullable<Run['fixture']>;
  tracker: PhaseTracker;
}) {
  tracker.phase = 'case';
  const scope = await seedReleaseCase({ use, run, fixture });
  const environment = use.environment();
  const operatorEnv = operatorEnvironment(environment);
  const runCommand = (stage: string, args: string[]) =>
    use.command(stage, args, {
      cwd: run.workspace,
      env: operatorEnv,
      timeoutMs: operatorTimeoutMs,
    });
  const step =
    (target: readonly string[]): Operator =>
    (name, args, schema, check) => {
      tracker.phase = name;
      return runOperatorStep({
        use,
        run,
        step: name,
        schema,
        check,
        execute: () =>
          runCommand(`catalog release ${name}`, [
            '-s',
            'catalog:release',
            ...args,
            ...target,
          ]),
      });
    };
  const built = await buildArtifact({
    use,
    run,
    tracker,
    runCommand,
    operator: step([]),
  });
  tracker.phase = 'epoch';
  const writeEpoch = String(await use.readWriteEpoch(run));
  const operated = await withAdminKey({
    use,
    run,
    fixture,
    tracker,
    previewKey: environment.CONVEX_DEPLOY_KEY ?? '',
    operate: async (target) => {
      const operator = step(target);
      const prepared = await operator(
        'prepare',
        [
          'prepare',
          '--artifact',
          built.artifactPath,
          '--write-epoch',
          writeEpoch,
        ],
        preparedSchema,
      );
      const reconciled = await reconcileToReadiness({
        operator,
        built,
        writeEpoch,
      });
      const active = await activateAndCheck({
        operator,
        built,
        reconciled,
        writeEpoch,
      });
      return { prepared, reconciled, active };
    },
  });
  tracker.phase = 'evidence';
  return recordEvidence({ use, run, scope, built, ...operated });
}

type PhaseTracker = { phase: ReleasePhase; isKeyCleanupFailed: boolean };

/**
 * The outer boundary: a failure no step diagnosed is recorded as
 * `catalog release <phase>: harness error` and carried by the thrown
 * failure, beside the harness's fixed reason if it had one. A key cleanup
 * that failed while this failure was in flight is added as a further line.
 */
async function finishFailure({
  use,
  run,
  tracker,
  error,
}: {
  use: Use;
  run: Run | undefined;
  tracker: PhaseTracker;
  error: unknown;
}) {
  const failure =
    error instanceof HarnessFailure &&
    (error.step || error.diagnostic.kind === 'release-operator')
      ? error
      : await recordStepFailure({
          use,
          run,
          step: tracker.phase,
          classification: { failure: 'harness-error' },
          error,
        });
  if (!tracker.isKeyCleanupFailed) return failure;
  return new HarnessFailure(
    failure.diagnostic,
    failure.step,
    await recordKeyCleanupFailure({ use, run }),
  );
}

async function recordKeyCleanupFailure({
  use,
  run,
}: {
  use: Use;
  run: Run | undefined;
}) {
  const diagnostic = {
    kind: 'release-operator',
    step: 'key cleanup',
    failure: 'harness-error',
  } as const;
  try {
    if (run)
      await use.appendDiagnostic(
        join(run.artifactDirectory, 'diagnostics.log'),
        `${describeDiagnostic(diagnostic)}\n`,
      );
  } catch {
    // The thrown failure still names it.
  }
  return diagnostic;
}

/**
 * One release CLI step inside one boundary: its spawn and run, then its
 * output's parse and validation. Whatever ends it records one fixed line,
 * `catalog release <step>: <class>`, chosen by error type and never by any
 * text: a refusal or failure with its exit status, termination by a signal
 * or timeout, invalid output, or a harness error. Then the step fails with
 * that line, or with the harness's own fixed failure if it raised one.
 */
async function runOperatorStep<T>({
  use,
  run,
  step,
  schema,
  execute,
  check,
}: {
  use: Use;
  run: Run;
  step: ReleaseOperatorStep;
  schema: z.ZodType<T>;
  execute: () => Promise<string>;
  /** The step's own semantic check of a schema-valid result. */
  check?: (result: T) => OperatorCheckFailure | null;
}): Promise<T> {
  let result: T;
  try {
    result = schema.parse(JSON.parse(await execute()));
  } catch (error) {
    throw await recordStepFailure({
      use,
      run,
      step,
      classification: classifyOperatorFailure(error),
      error,
    });
  }
  const failure = check?.(result) ?? null;
  if (failure)
    throw await recordStepFailure({
      use,
      run,
      step,
      classification: { failure },
    });
  return result;
}

type OperatorCheckFailure = 'not-ready' | 'mismatch';

/**
 * Records the step's fixed line and returns the failure to throw: the step
 * diagnostic, or the harness's own fixed failure carrying it, so the report
 * names the step even when diagnostics.log could not be written.
 */
async function recordStepFailure({
  use,
  run,
  step,
  classification,
  error,
}: {
  use: Use;
  run: Run | undefined;
  step: ReleasePhase;
  classification:
    | ReturnType<typeof classifyOperatorFailure>
    | { failure: OperatorCheckFailure };
  error?: unknown;
}) {
  const diagnostic = {
    kind: 'release-operator',
    step,
    ...classification,
  } as const;
  try {
    if (run)
      await use.appendDiagnostic(
        join(run.artifactDirectory, 'diagnostics.log'),
        `${describeDiagnostic(diagnostic)}\n`,
      );
  } catch {
    // The thrown failure still names the step.
  }
  return error instanceof HarnessFailure
    ? new HarnessFailure(error.diagnostic, diagnostic)
    : new HarnessFailure(diagnostic);
}

function classifyOperatorFailure(error: unknown) {
  if (error instanceof CommandFailure && error.code === undefined)
    return error.exitCode === null
      ? ({ failure: 'terminated' } as const)
      : ({ failure: 'exit', exitCode: error.exitCode } as const);
  if (error instanceof SyntaxError || error instanceof z.ZodError)
    return { failure: 'invalid-output' } as const;
  return { failure: 'harness-error' } as const;
}

/**
 * The case on the first cohort: fixture provenance only, no ordinary
 * campaign or private Character, so the activation sentinel holds without
 * any bypass.
 */
async function seedReleaseCase({
  use,
  run,
  fixture,
}: {
  use: Use;
  run: Run;
  fixture: NonNullable<Run['fixture']>;
}) {
  const worker = fixture.workers[0];
  if (!worker) return fail('case');
  const scope: FixtureScope = {
    namespace: run.resources.previewName,
    version: FIXTURE_VERSION,
    workerKey: worker.key,
    caseKey: 'catalogRelease',
    session: fixture.session,
    token: worker.capability,
  };
  await use.fixtureCall(run, 'seedIdentityProjection', scope);
  await use.fixtureCall(run, 'resetCase', { ...scope, now: fixtureNow });
  return scope;
}

/** The artifact, once per run, inside the run's temporary directory. */
async function buildArtifact({
  use,
  run,
  tracker,
  runCommand,
  operator,
}: {
  use: Use;
  run: Run;
  tracker: PhaseTracker;
  runCommand: (stage: string, args: string[]) => Promise<string>;
  operator: Operator;
}): Promise<Built> {
  const releaseDirectory = join(dirname(run.privateDirectory), 'release');
  tracker.phase = 'source';
  const sources = await use.materializeReleaseSources(
    join(releaseDirectory, 'sources'),
  );
  tracker.phase = 'pin';
  const calculation = (
    await runCommand('catalog pin', ['-s', 'catalog:pin'])
  ).trim();
  if (calculation !== catalogRuntimeCompatibility.calculation) fail('pin');
  const artifactPath = join(releaseDirectory, 'artifact', 'release.json');
  const { manifest } = await operator(
    'build',
    releaseBuildArguments({
      ...sources,
      artifactPath,
      schema: catalogRuntimeCompatibility.schema,
      calculation,
    }),
    builtSchema,
    (result) =>
      result.manifest.releaseNumber === releaseQualification.releaseNumber
        ? null
        : 'mismatch',
  );
  return { artifactPath, calculation, ...manifest };
}

/**
 * The admin key's whole lifetime: obtained once, written mode 600, passed
 * to the operator only as `--admin-key-file`, and deleted whatever happens.
 */
async function withAdminKey<T>({
  use,
  run,
  fixture,
  tracker,
  previewKey,
  operate,
}: {
  use: Use;
  run: Run;
  fixture: NonNullable<Run['fixture']>;
  tracker: PhaseTracker;
  previewKey: string;
  operate: (target: string[]) => Promise<T>;
}) {
  const path = releaseAdminKeyPath(run.privateDirectory);
  // The key is deleted whatever happens. A cleanup failure never replaces a
  // failure already in flight: that stays primary, and the outer boundary
  // adds the key cleanup line. Alone, it is the failure. Either way the run
  // fails, and the runner's leftover check still reports the file.
  let outcome: { result: T } | { error: unknown };
  try {
    tracker.phase = 'credential';
    const local = run.localDeployment;
    if (
      run.backend === 'local' &&
      (local?.url !== fixture.convexUrl || local.name !== fixture.localInstance)
    )
      throw new Error('Local release deployment binding refused');
    const deployment =
      run.backend === 'local' && local
        ? {
            deploymentName: local.name,
            deploymentUrl: local.url,
            adminKey: (await readFile(local.adminKeyFile, 'utf8')).trim(),
          }
        : await use.authorizePreview({
            previewKey,
            previewName: run.resources.previewName,
            expectedUrl: fixture.convexUrl,
            installedVersion: await use.readInstalledConvexVersion(
              run.workspace,
            ),
          });
    await use.writeAdminKeyFile({ path, adminKey: deployment.adminKey });
    outcome = {
      result: await operate([
        '--deployment-name',
        deployment.deploymentName,
        '--deployment-url',
        deployment.deploymentUrl,
        '--target-kind',
        run.backend === 'local' ? 'local' : 'preview',
        '--admin-key-file',
        path,
      ]),
    };
  } catch (error) {
    outcome = { error };
  }
  try {
    await use.removeAdminKeyFile(path);
  } catch (cleanupError) {
    if ('error' in outcome) tracker.isKeyCleanupFailed = true;
    else {
      tracker.phase = 'key cleanup';
      throw cleanupError;
    }
  }
  if ('error' in outcome) throw outcome.error;
  return outcome.result;
}

/**
 * Reruns `reconcile` while it stops at its step limit. Each invocation
 * reports only its own steps and stale completions, so they add up.
 */
async function reconcileToReadiness({
  operator,
  built,
  writeEpoch,
}: {
  operator: Operator;
  built: Built;
  writeEpoch: string;
}): Promise<Reconciled> {
  let stepCount = 0;
  let staleCompletionCount = 0;
  for (let invocations = 1; ; invocations++) {
    const reconciled = await operator(
      'reconcile',
      [
        'reconcile',
        '--number',
        String(built.releaseNumber),
        '--write-epoch',
        writeEpoch,
        '--max-steps',
        String(reconcileMaxSteps),
      ],
      reconciledSchema,
      (result) =>
        (result.stopped === 'limit' && invocations < maxReconcileInvocations) ||
        (result.stopped === 'ready' && result.status.isReady)
          ? null
          : 'not-ready',
    );
    stepCount += reconciled.stepCount;
    staleCompletionCount += reconciled.staleCompletionCount;
    if (reconciled.stopped === 'limit') continue;
    return { ...reconciled, stepCount, staleCompletionCount, invocations };
  }
}

/** Activates fixture-only, then `active` must report exactly that release. */
async function activateAndCheck({
  operator,
  built,
  reconciled,
  writeEpoch,
}: {
  operator: Operator;
  built: Built;
  reconciled: Reconciled;
  writeEpoch: string;
}) {
  const activation = await operator(
    'activate',
    [
      'activate',
      '--number',
      String(built.releaseNumber),
      '--run-id',
      reconciled.runId,
      '--operation-id',
      releaseQualification.activationId,
      '--schema',
      catalogRuntimeCompatibility.schema,
      '--calculation',
      built.calculation,
      '--fixture-only',
      '--write-epoch',
      writeEpoch,
    ],
    activationSchema,
  );
  return operator('active', ['active'], activationSchema, (active) =>
    JSON.stringify(active) === JSON.stringify(activation) &&
    active.releaseNumber === built.releaseNumber &&
    active.artifactFingerprint === built.artifactFingerprint &&
    active.impactRunId === reconciled.runId
      ? null
      : 'mismatch',
  );
}

/** The reconciled Character's work, then the evidence and comment files. */
async function recordEvidence({
  use,
  run,
  scope,
  built,
  prepared,
  reconciled,
  active,
}: {
  use: Use;
  run: Run;
  scope: FixtureScope;
  built: Built;
  prepared: z.infer<typeof preparedSchema>;
  reconciled: Reconciled;
  active: z.infer<typeof activationSchema>;
}) {
  const { releaseWork = [] } = inspectedSchema.parse(
    await use.fixtureCall(run, 'inspectCase', {
      ...scope,
      releaseRunId: reconciled.runId,
    }),
  );
  const affected = releaseWork.find(
    (row) => row.character === releaseQualification.reconciledCharacter,
  );
  if (
    affected?.state !== 'ready' ||
    !affected.reasons.includes(`key:${releaseQualification.feat.externalKey}`)
  )
    fail('work');
  const evidence = releaseEvidenceSchema.parse({
    backend: run.backend ?? 'preview',
    previewName: run.resources.previewName,
    feat: {
      externalKey: releaseQualification.feat.externalKey,
      name: releaseQualification.feat.name,
      effect: describeFeatEffect(),
    },
    artifact: {
      releaseNumber: built.releaseNumber,
      artifactFingerprint: built.artifactFingerprint,
      batchCount: prepared.batchCount,
      stagedRows: prepared.stagedRows,
    },
    reconciliation: {
      runId: reconciled.runId,
      invocations: reconciled.invocations,
      ...reconciled.status,
      missingIdentityCount: reconciled.status.missingIdentityCount ?? 0,
      stepCount: reconciled.stepCount,
      staleCompletionCount: reconciled.staleCompletionCount,
      work: releaseWork,
    },
    active,
  });
  await use.savePrivate(
    join(run.artifactDirectory, releaseEvidenceFile),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  await use.savePrivate(
    join(run.artifactDirectory, releaseCommentFile),
    formatReleaseComment(evidence),
  );
  return evidence;
}

function describeFeatEffect() {
  const { skill, bonus } = releaseQualification.feat;
  return `+${bonus} on ${skill.label} checks below 10 ranks (+6 from 10 ranks), CRB p. 134; a level-1 Fighter with Dexterity 10 goes from ${skill.label} +0 to +${bonus}`;
}

/** Reads and re-validates the evidence the qualification process wrote. */
export async function readReleaseEvidence(artifactDirectory: string) {
  try {
    return releaseEvidenceSchema.parse(
      JSON.parse(
        await readFile(join(artifactDirectory, releaseEvidenceFile), 'utf8'),
      ),
    );
  } catch {
    throw new HarnessFailure({ kind: 'release-evidence' });
  }
}

/** One console line, from validated fields only. */
export function summarizeReleaseEvidence(evidence: ReleaseEvidence) {
  const { artifact, reconciliation, active } = evidence;
  return `E2E release qualification: Catalog Release ${artifact.releaseNumber} (artifact ${artifact.artifactFingerprint}) prepared, reconciled to readiness in run ${reconciliation.runId} (${reconciliation.pendingCount} pending, ${reconciliation.failedCount} failed, ${reconciliation.stepCount} steps) and active fixture-only with calculation ${active.calculationIdentity}.\n`;
}

const pendingResult =
  '**Result.** Pending: the runner records the browser journeys’ outcome after they run.';

/**
 * The comment's result line, from the Playwright report the runner reads:
 * every journey passed with one attempt and no retry, or not.
 */
export function describeBrowserOutcome(report: unknown) {
  const parsed = z
    .object({
      status: z.literal('passed'),
      tests: z
        .array(
          z.object({
            results: z.tuple([
              z.object({ status: z.literal('passed'), retry: z.literal(0) }),
            ]),
          }),
        )
        .length(2),
    })
    .safeParse(report);
  return parsed.success
    ? `**Result.** Both browser journeys passed on the first attempt (no retries): ${releaseQualification.feat.skill.label} went from +0 to +${releaseQualification.feat.bonus} on both sessions.`
    : '**Result.** The browser journeys did not all pass on their first attempt; see report.json in the safe evidence.';
}

// A bare document ID among the reasons is the Catalog Entry the Character
// references that the release changes; the others name a release key.
function describeReason(reason: string) {
  return /^[a-z0-9]{16,}$/i.test(reason)
    ? `Catalog Entry \`${reason}\``
    : `\`${reason}\``;
}

/** The comment the orchestrator posts on #753, #318 and #729. */
export function formatReleaseComment(
  evidence: ReleaseEvidence,
  result: string = pendingResult,
) {
  const { artifact, reconciliation: run, active, feat } = evidence;
  const work = run.work
    .map(
      (row) =>
        `| ${row.character} | ${row.state ?? 'no work'} | ${row.reasons.map(describeReason).join(', ') || 'none'} | ${row.hasFactsChanged ?? 'n/a'} |`,
    )
    .join('\n');
  return `## Catalog Release qualification on the E2E ${evidence.backend === 'local' ? 'local backend' : 'preview'} (#753)

${evidence.backend === 'local' ? 'Local instance' : 'Preview'} for slot \`${evidence.previewName}\`, recreated for this run. The release suite ran the release operator with ${evidence.backend === 'local' ? 'the local instance admin key' : 'the preview admin key obtained through the preview-key exchange'}, passed only through \`--admin-key-file\`.

**Artifact.** Catalog Release ${artifact.releaseNumber}, artifact fingerprint \`${artifact.artifactFingerprint}\`: ${artifact.batchCount} batches, ${artifact.stagedRows} rows. Built by \`catalog:release build\` from the bounded input in docs/catalog-import/releases.md (the feats-365 admission at the pins), passing every release gate.

**Reconcile (#318).** Run \`${run.runId}\`: ready after ${run.invocations} ${run.invocations === 1 ? 'invocation' : 'invocations'}, discovery complete, ${run.pendingCount} pending, ${run.failedCount} failed, ${run.missingIdentityCount} missing identities, ${run.stepCount} steps, ${run.staleCompletionCount} stale completions.

| Character | Work | Reasons | Facts changed |
| --- | --- | --- | --- |
${work}

**Activate.** \`activate --fixture-only --target-kind ${evidence.backend === 'local' ? 'local' : 'preview'}\` selected release ${active.releaseNumber}; \`catalog:release active\` reports release ${active.releaseNumber}, artifact \`${active.artifactFingerprint}\`, run \`${active.impactRunId}\`, activation \`${active.activationId}\`, schema \`${active.schemaIdentity}\`, calculation \`${active.calculationIdentity}\`, fixture-only.

**Admitted feat.** ${feat.name} (\`${feat.externalKey}\`): ${feat.effect}. The browser journey selects it through the feat picker on a fixture-campaign Character and checks the sheet.

${result}
`;
}
