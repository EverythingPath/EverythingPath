import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { HarnessFailure } from '../../e2e/support/diagnostics';
import { command } from '../../e2e/support/process';
import { catalogRuntimeCompatibility } from '../../src/lib/catalog/runtime-compatibility.ts';
import { isLocalConvexUrl } from '../../src/lib/local-convex-url';
import { pcgenPin } from '../catalog/inventory.ts';
import { launchInventoryPaths } from '../catalog/launch-inventory-pins.ts';
import { runCatalogReleaseOperator } from '../catalog/release-operator.ts';
import {
  runLocalTrialCutover,
  type LocalTrialRelease,
  type LocalTrialTarget,
} from '../initial-migration/local-trial.ts';
import { localBackendOwnerLabel } from './backend';
import {
  createCleanupDeadline,
  localBackendFailure,
  runCleanupDocker,
} from './docker';
import {
  describeDevelopmentExit,
  describeDevelopmentFailure,
  developmentDependencies,
  developmentInstance,
  DevelopmentStopFailure,
  runLocalDevelopment,
  type DeployedStage,
  type LocalInstance,
} from './development';

/**
 * `pnpm dev:trial`: the owner tries the builder locally with the party's
 * content, on a trial-only instance beside `pnpm dev`'s. Fixture-only
 * activation refuses a deployment with ordinary data, and sheet authority
 * has no way back, so the trial never touches the owner's development data:
 * it has its own backend, volume and directory, removed by `--discard`.
 */
export const trialInstance = (root: string): LocalInstance => ({
  name: `ep-dev-${createHash('sha256').update(`${root}#owner-trial`).digest('hex').slice(0, 12)}`,
  directory: join(root, '.local-convex', 'owner-trial'),
  description: 'local owner-trial Convex',
});

/**
 * A refusal or failed step of the trial itself, whose text names no
 * credential: printed as it is, unlike a Clerk or Docker failure.
 */
export class TrialRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrialRefusal';
  }
}

export const trialUsage =
  'Usage: pnpm dev:trial [--discard]\nThe trial always runs on its own local instance; it takes no deployment flags.';

/** `pnpm dev:trial`'s one flag; any other, a deployment flag included, is refused. */
export function parseTrialArguments(args: string[]) {
  try {
    const { values } = parseArgs({
      args,
      options: { discard: { type: 'boolean' } },
      strict: true,
      allowPositionals: false,
    });
    return { discard: values.discard === true };
  } catch {
    throw new TrialRefusal(trialUsage);
  }
}

/** What `pnpm dev:trial` prints and exits with when it fails. */
export function describeTrialExit({
  error,
  isStopped,
}: {
  error: unknown;
  isStopped: boolean;
}) {
  const isStopFailure = error instanceof DevelopmentStopFailure;
  const primary = isStopFailure ? error.primary : error;
  if (isStopped || !(primary instanceof TrialRefusal))
    return describeDevelopmentExit({ error, isStopped });
  return {
    lines: [
      primary.message,
      ...(isStopFailure ? describeDevelopmentFailure(error.stopFailure) : []),
    ],
    exitCode: 1,
  };
}

/** Refuses a trial instance that would be `pnpm dev`'s, or no local one. */
export function assertTrialInstance(root: string, trial: LocalInstance) {
  const development = developmentInstance(root);
  if (!/^ep-dev-[a-f0-9]{12}$/.test(trial.name))
    throw new TrialRefusal('Invalid local Convex instance name');
  if (
    trial.name === development.name ||
    trial.directory === development.directory
  )
    throw new TrialRefusal(
      `The trial instance must not be pnpm dev's instance (${development.name}).`,
    );
}

/** The party scope the trial builds, and the one release it prepares. */
const partyScope = 'campaign-party-v1';
const releaseNumber = 1;

/** Every operation with a failure mode, so tests can drive each stage. */
export const trialDependencies = {
  development: developmentDependencies,
  /** The calculation identity `pnpm catalog:pin` prints and verifies. */
  readCalculation: async ({
    root,
    environment,
  }: {
    root: string;
    environment: NodeJS.ProcessEnv;
  }) =>
    command('catalog pin', ['-s', 'catalog:pin'], {
      cwd: root,
      env: environment,
    }),
  /** The pinned source checkouts the party build reads. */
  checkouts: () => {
    const paths = launchInventoryPaths();
    return {
      system: paths.pf1,
      content: paths['pf1-content'],
      pcgen: resolve(
        paths.pcgen,
        ...pcgenPin.directory.split('/').map(() => '..'),
      ),
    };
  },
  releaseOperator: (args: string[]) => runCatalogReleaseOperator({ args }),
  cutover: runLocalTrialCutover,
  docker: (args: string[]) =>
    runCleanupDocker({ args, cleanupDeadline: createCleanupDeadline() }),
};
export type TrialDependencies = typeof trialDependencies;

/** The trial's files, all inside its own ignored directory. */
const trialFiles = (directory: string) => ({
  artifact: join(directory, 'release', `release-${releaseNumber}.json`),
  scopeReport: join(
    directory,
    'release',
    `release-${releaseNumber}.scope.json`,
  ),
  buildLog: join(directory, 'build.log'),
  release: join(directory, 'trial-release.json'),
  characters: join(directory, 'characters.txt'),
});

/** No inherited deployment selector or override reaches a child command. */
function localOnly(environment: NodeJS.ProcessEnv) {
  const blanked = { ...environment };
  for (const key of Object.keys(blanked))
    if (key.startsWith('CONVEX_')) blanked[key] = '';
  return blanked;
}

const scopeReportSchema = z.looseObject({
  qualification: z.looseObject({
    status: z.enum(['QUALIFIED', 'FAILED']),
    characters: z.array(
      z.looseObject({
        id: z.string(),
        served: z.boolean(),
        failing: z.array(z.looseObject({ cause: z.string() })),
      }),
    ),
  }),
  release: z.looseObject({ artifactFingerprint: z.string().optional() }),
});
const artifactSchema = z.looseObject({
  manifest: z.looseObject({
    artifactFingerprint: z.string(),
    compatibility: z.looseObject({
      schema: z.string(),
      calculation: z.string(),
    }),
  }),
});
const savedReleaseSchema = z.strictObject({
  releaseNumber: z.number(),
  impactRunId: z.string(),
  schema: z.string(),
  calculation: z.string(),
});

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return undefined;
    throw error;
  }
}

/** Plain words for each cause a scope report gives a failing row. */
const causeWords: Record<string, string> = {
  held: 'held for review',
  'dependent-omitted': 'left out with what they need',
  unmatched: 'not matched to the catalog',
  'race-open': 'race not decided',
  'no-candidate': 'no catalog entry',
  'unreviewed-notice': 'notice not reviewed',
};

/**
 * Which characters the build serves completely and, for the others, how
 * many of their entries fail and why: character numbers and counts only.
 */
export function describeCharacters(report: z.infer<typeof scopeReportSchema>) {
  return report.qualification.characters.map(({ id, served, failing }) => {
    if (served) return `Character ${id}: complete`;
    const counts = new Map<string, number>();
    for (const { cause } of failing)
      counts.set(cause, (counts.get(cause) ?? 0) + 1);
    const why = [...counts]
      .map(([cause, count]) => `${count} ${causeWords[cause] ?? cause}`)
      .join(', ');
    return `Character ${id}: partial (${why})`;
  });
}

/**
 * The party artifact, built once: a scoped build exits 1 when the scope is
 * FAILED and still writes the artifact, which the trial accepts; no artifact,
 * or one the scope report does not bind, is refused.
 */
async function buildPartyRelease({
  root,
  stage,
  calculation,
  use,
}: {
  root: string;
  stage: DeployedStage;
  calculation: string;
  use: TrialDependencies;
}) {
  const files = trialFiles(stage.directory);
  const accepted = async () => {
    const report = scopeReportSchema.safeParse(
      await readJson(files.scopeReport),
    );
    const artifact = artifactSchema.safeParse(await readJson(files.artifact));
    if (!report.success || !artifact.success) return undefined;
    const { manifest } = artifact.data;
    if (
      report.data.release.artifactFingerprint !== manifest.artifactFingerprint
    )
      return undefined;
    if (
      manifest.compatibility.calculation !== calculation ||
      manifest.compatibility.schema !== catalogRuntimeCompatibility.schema
    )
      throw new Error(
        'The trial release was built for another calculation. Start again with `pnpm dev:trial --discard`, then `pnpm dev:trial`.',
      );
    return report.data;
  };
  let report = await accepted();
  if (!report) {
    const { system, content, pcgen } = use.checkouts();
    process.stdout.write(
      `Building the party release (this takes a while); output in ${files.buildLog}.\n`,
    );
    await mkdir(join(stage.directory, 'release'), { recursive: true });
    const exitCode = await stage.run({
      args: [
        '-s',
        'catalog:release',
        'build',
        '--number',
        String(releaseNumber),
        '--schema',
        catalogRuntimeCompatibility.schema,
        '--calculation',
        calculation,
        '--system',
        system,
        '--content',
        content,
        '--pcgen',
        pcgen,
        '--scope',
        partyScope,
        '--artifact',
        files.artifact,
      ],
      env: localOnly(stage.environment),
      cwd: root,
      logFile: files.buildLog,
      exitCodes: [0, 1],
    });
    report = await accepted();
    if (!report)
      throw new Error(
        `The party build wrote no artifact (exit ${exitCode}); see ${files.buildLog}.`,
      );
  }
  const lines = [
    `Party scope ${report.qualification.status}; the trial uses the artifact it wrote.`,
    ...describeCharacters(report),
  ];
  await writeFile(files.characters, `${lines.join('\n')}\n`);
  process.stdout.write(`${lines.join('\n')}\n`);
}

/** The flags every release step names its local target with. */
const releaseTarget = (target: LocalTrialTarget, writeEpoch: number) => [
  '--deployment-name',
  target.name,
  '--deployment-url',
  target.url,
  '--target-kind',
  'local',
  '--admin-key-file',
  target.adminKeyFile,
  '--write-epoch',
  String(writeEpoch),
];

/** Prepare, allocate and reconcile the artifact on the trial instance. */
async function prepareRelease({
  target,
  writeEpoch,
  artifact,
  use,
}: {
  target: LocalTrialTarget;
  writeEpoch: number;
  artifact: string;
  use: TrialDependencies;
}) {
  const flags = releaseTarget(target, writeEpoch);
  const number = ['--number', String(releaseNumber)];
  await use.releaseOperator(['prepare', '--artifact', artifact, ...flags]);
  const allocation = z
    .looseObject({ stopped: z.string() })
    .parse(await use.releaseOperator(['allocate', ...number, ...flags]));
  if (allocation.stopped !== 'complete')
    throw new Error(`Identity allocation stopped: ${allocation.stopped}.`);
  // A run past its step budget resumes on the next call.
  for (let attempt = 0; attempt < 5; attempt++) {
    const reconciled = z
      .looseObject({ runId: z.string(), stopped: z.string() })
      .parse(await use.releaseOperator(['reconcile', ...number, ...flags]));
    if (reconciled.stopped === 'ready') return reconciled.runId;
    if (reconciled.stopped !== 'limit')
      throw new Error(`Reconciliation stopped: ${reconciled.stopped}.`);
  }
  throw new Error('Reconciliation did not finish; rerun `pnpm dev:trial`.');
}

/**
 * The trial's step between deploying and the identity sync: build the party
 * release once, then cut the instance over to sheet authority, resuming from
 * whatever stage `initialMigration:status` reports. The target is the
 * backend `startLocalBackend` returned, never a file or flag.
 */
export async function prepareOwnerTrial({
  root,
  stage,
  use = trialDependencies,
}: {
  root: string;
  stage: DeployedStage;
  use?: TrialDependencies;
}) {
  const { backend } = stage;
  if (
    backend.name !== trialInstance(root).name ||
    !isLocalConvexUrl(backend.url)
  )
    throw new TrialRefusal(
      'The trial runs only against its own local instance.',
    );
  const target = {
    name: backend.name,
    url: backend.url,
    adminKeyFile: backend.adminKeyFile,
  };
  const files = trialFiles(stage.directory);
  const environment = localOnly(stage.environment);
  const outcome = await use.cutover({
    target,
    log: (line) => process.stdout.write(`${line}\n`),
    buildIdentity: async () => {
      // Without a commit the identity is the development build, `dev`.
      const withoutCommit = { ...environment };
      delete withoutCommit.COMMIT_REF;
      await stage.run({
        args: [
          'exec',
          'node',
          '--import',
          'tsx',
          'scripts/write-build-identity.ts',
        ],
        env: withoutCommit,
        cwd: root,
      });
      return join(root, 'public', 'build-identity.json');
    },
    release: {
      saved: async () => {
        const saved = await readJson(files.release);
        return saved === undefined
          ? undefined
          : savedReleaseSchema.parse(saved);
      },
      prepare: async (writeEpoch): Promise<LocalTrialRelease> => {
        const calculation = (
          await use.readCalculation({ root, environment })
        ).trim();
        if (!/^sha256:[0-9a-f]{64}$/.test(calculation))
          throw new Error('pnpm catalog:pin printed no calculation identity.');
        await buildPartyRelease({ root, stage, calculation, use });
        const impactRunId = await prepareRelease({
          target,
          writeEpoch,
          artifact: files.artifact,
          use,
        });
        const release = {
          releaseNumber,
          impactRunId,
          schema: catalogRuntimeCompatibility.schema,
          calculation,
        };
        await writeFile(files.release, `${JSON.stringify(release)}\n`);
        return release;
      },
    },
  });
  if (outcome === 'already-open') {
    const characters = await readFile(files.characters, 'utf8').catch(() => '');
    process.stdout.write(
      `The trial instance is already open under sheet authority.\n${characters}`,
    );
  }
}

/**
 * `pnpm dev:trial`: start the trial backend, deploy, cut it over with the
 * party release (once), sync development identities and serve the web app
 * against it until stopped.
 */
export async function runOwnerTrial({
  root,
  environment,
  secretKey,
  clerkHost,
  signal,
  use = trialDependencies,
}: {
  root: string;
  environment: NodeJS.ProcessEnv;
  secretKey: string;
  clerkHost: string;
  signal: AbortSignal;
  use?: TrialDependencies;
}) {
  const instance = trialInstance(root);
  assertTrialInstance(root, instance);
  await runLocalDevelopment({
    root,
    mode: 'serve',
    environment: localOnly(environment),
    secretKey,
    clerkHost,
    signal,
    use: use.development,
    instance,
    afterDeploy: (stage) =>
      prepareOwnerTrial({ root, stage, use }).catch((error: unknown) => {
        // A Docker, Clerk or command failure keeps its own fixed text.
        throw error instanceof HarnessFailure || error instanceof TrialRefusal
          ? error
          : new TrialRefusal(
              error instanceof Error ? error.message : String(error),
            );
      }),
  });
}

/**
 * `pnpm dev:trial --discard`: removes the trial container, its data volume
 * and its directory. Refused for any other instance than the trial's, and
 * for a container of that name without the trial's label.
 */
export async function discardOwnerTrial({
  root,
  name,
  use = trialDependencies,
}: {
  root: string;
  name: string;
  use?: Pick<TrialDependencies, 'docker'>;
}) {
  const trial = trialInstance(root);
  assertTrialInstance(root, trial);
  if (name !== trial.name)
    throw new TrialRefusal(
      `Only the trial instance (${trial.name}) is discarded.`,
    );
  const container = await use.docker([
    'ps',
    '-aq',
    '--filter',
    `name=^/${name}$`,
  ]);
  if (container) {
    const label = await use.docker([
      'inspect',
      '--format',
      `{{index .Config.Labels "${localBackendOwnerLabel}"}}`,
      container,
    ]);
    if (label !== name)
      throw localBackendFailure({ reason: 'ownership', name });
    await use.docker(['rm', '--force', container]);
  }
  await use.docker(['volume', 'rm', '--force', `${name}-data`]);
  await rm(trial.directory, { recursive: true, force: true });
  process.stdout.write(
    `Discarded the trial instance ${name}, its data and ${trial.directory}.\n`,
  );
}
