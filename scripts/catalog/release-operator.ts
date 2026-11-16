import { isLocalConvexUrl } from '../../src/lib/local-convex-url';
import { assertLocalInstance } from '../local-convex/instance';
import { readFile, realpath, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { importCatalog } from './import.ts';
import {
  assessCatalogReleaseGates,
  createCatalogRelease,
  serializeCatalogRelease,
} from './release.ts';
import { catalogImplementationInputs } from './release-inputs.ts';
import {
  holdUntilReconciled,
  type ReconciliationHold,
} from './reconciliation-holds.ts';
import {
  builtInResourceKeys,
  isBuiltInResource,
} from '../../src/lib/catalog/release-resources.ts';
import { readCommittedReleaseVerification } from './release-verification-committed.ts';
import { authoredResourceSources } from './launch-verification.ts';
import {
  openReleaseScope,
  type OperatorScope,
  type ScopeOutcome,
} from './release-scopes.ts';
import {
  runCatalogReleaseCommand,
  type CatalogReleaseCommandAdapter,
  type CatalogReleaseStatus,
} from './release-command.ts';
import {
  runCatalogReleaseImpactCommand,
  DEFAULT_IMPACT_MAX_STEPS,
  type CatalogReleaseImpactCommandAdapter,
} from './release-impact-command.ts';
import {
  runCatalogReleaseActivationCommand,
  type CatalogReleaseActivationCommandAdapter,
} from './release-activation-command.ts';
import { createCatalogReleaseImpactRemoteAdapter } from './release-impact-remote.ts';
import {
  calculationServing,
  productionRecord,
  productionRecordReminder,
} from '../../src/lib/catalog/calculation-window.ts';
import { productionActivatedCalculationIdentity } from '../../src/lib/catalog/production-calculation-identity.ts';
import {
  runCatalogIdentityAllocationCommand,
  type CatalogIdentityAllocationCommandAdapter,
} from './release-allocation-command.ts';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import {
  pcgenDataPath,
  verifyInputs,
  resolveOutputPath,
  validateOutput,
} from './operator.ts';
import { isNamedDeploymentUrl } from './deployment-url.ts';
import { assertKeyForTarget } from './deployment-key.ts';
import {
  canonicalReleaseJson,
  parseReleaseJson,
  isObject,
  isReleaseRowKind,
  type ReleaseJson,
  type ReleaseRow,
  MAX_RELEASE_BATCH_ROWS,
  MAX_RELEASE_BATCH_BYTES,
  releaseFingerprint,
  validateCatalogReleaseArtifact,
  validateCatalogReleaseManifest,
} from '../../src/lib/catalog/release-schema.ts';
import { legalResources as defaultLegalResources } from '../../src/lib/catalog/legal-resources-data.ts';
import { reviewedAdmissionSchema } from '../../src/lib/catalog/admission-schema.ts';
import { parseReviewedAdmissionInput } from '../../src/lib/catalog/attribution-evidence-codec.ts';
import { readCommittedReviewedAdmission } from './reviewed-data-files.ts';
import { legalResourcesSchema } from '../../src/lib/catalog/legal-types.ts';

export const catalogReleaseUsage =
  'Usage: pnpm catalog:release build --number N --schema ID --calculation ID --system PATH --content PATH [--pcgen PATH] --artifact PATH [--previous PATH] [--attribution PATH] [--curation PATH] [--remaps PATH] [--legal PATH] [--rule-resources PATH] [--scope VERSION [--scope-manifest PATH]] [--allow-unverified-checkouts]\n       pnpm catalog:release prepare --artifact PATH --deployment-name NAME --deployment-url URL --target-kind KIND --admin-key-file PATH [--write-epoch N]\n       pnpm catalog:release inspect --number N --deployment-name NAME --deployment-url URL --target-kind KIND --admin-key-file PATH [--kind KIND --cursor CURSOR --limit N]\n       pnpm catalog:release allocate --number N --deployment-name NAME --deployment-url URL --target-kind KIND --admin-key-file PATH [--write-epoch N] [--production]\n       pnpm catalog:release reconcile --number N --deployment-name NAME --deployment-url URL --target-kind KIND --admin-key-file PATH [--write-epoch N] [--max-steps N] [--retry-failed]\n       pnpm catalog:release activate --number N --run-id ID --operation-id ID --schema ID --calculation ID (--fixture-only | --production) --deployment-name NAME --deployment-url URL --target-kind KIND --admin-key-file PATH [--write-epoch N]\n       pnpm catalog:release active --deployment-name NAME --deployment-url URL --target-kind KIND --admin-key-file PATH\n--pcgen emits the chosen PCGen archetypes (pcgen-owners.ts) from a PCGen checkout at its pin; with --scope, only those the scope names, and only for a scope with PCGen rows (campaign-party-v1). Preparation and reconciliation are private; activation selects only prepared evidence. Remote commands never push code.\n';

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'));
}
function positiveNumber(value: string | undefined): number {
  if (
    !value ||
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value))
  )
    throw new Error('--number must be a positive integer.');
  return Number(value);
}
function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`--${name} is required.`);
  return value;
}

function parseStatus(value: unknown): CatalogReleaseStatus {
  if (
    !isObject(value) ||
    !('manifest' in value) ||
    !('state' in value) ||
    !('releaseNumber' in value) ||
    !('baseReleaseNumber' in value) ||
    !('nextBatchIndex' in value) ||
    !('batchCount' in value) ||
    !('stagedRows' in value)
  )
    throw new Error('Invalid remote release status.');
  const {
    state,
    releaseNumber,
    baseReleaseNumber,
    nextBatchIndex,
    batchCount,
    stagedRows,
  } = value;
  if (
    (state !== 'preparing' && state !== 'prepared') ||
    typeof releaseNumber !== 'number' ||
    (baseReleaseNumber !== null && typeof baseReleaseNumber !== 'number') ||
    typeof nextBatchIndex !== 'number' ||
    typeof batchCount !== 'number' ||
    typeof stagedRows !== 'number' ||
    ![releaseNumber, nextBatchIndex, batchCount, stagedRows].every(
      Number.isSafeInteger,
    )
  )
    throw new Error('Invalid remote release status fields.');
  return {
    releaseNumber,
    state,
    baseReleaseNumber,
    nextBatchIndex,
    batchCount,
    stagedRows,
    manifest: validateCatalogReleaseManifest(value.manifest),
  };
}
type AdministrativeHttpClient = {
  setAdminAuth(key: string): void;
  function(
    reference: ReturnType<typeof makeFunctionReference>,
    componentPath: undefined,
    args: Record<string, ReleaseJson>,
  ): Promise<unknown>;
};
function isAdministrativeHttpClient(
  client: unknown,
): client is AdministrativeHttpClient {
  // Convex strips these internal CLI methods from the public declaration file.
  // Validate the installed runtime before crossing the same admin seam as its CLI.
  return (
    isObject(client) &&
    'setAdminAuth' in client &&
    typeof client.setAdminAuth === 'function' &&
    'function' in client &&
    typeof client.function === 'function'
  );
}
export async function createRemoteAdapter(values: {
  deploymentName: string;
  deploymentUrl: string;
  adminKeyFile: string;
  targetKind: string;
}): Promise<
  CatalogReleaseCommandAdapter & {
    impact: CatalogReleaseImpactCommandAdapter;
    activation: CatalogReleaseActivationCommandAdapter;
    allocation: CatalogIdentityAllocationCommandAdapter;
    invoke: (
      module: string,
      endpoint: string,
      args: unknown,
    ) => Promise<unknown>;
  }
> {
  if (
    !['preview', 'development', 'production', 'local'].includes(
      values.targetKind,
    )
  )
    throw new Error(
      '--target-kind must be preview, development, production or local.',
    );
  if (
    !(values.targetKind === 'local'
      ? /^ep-(?:dev-[a-f0-9]{12}|e2e-[a-f0-9-]{36})$/.test(
          values.deploymentName,
        ) && isLocalConvexUrl(values.deploymentUrl)
      : isNamedDeploymentUrl({
          name: values.deploymentName,
          url: values.deploymentUrl,
        }))
  )
    throw new Error(
      'Deployment URL must match the explicitly named deployment.',
    );
  if (values.targetKind === 'local') {
    await assertLocalInstance({
      url: values.deploymentUrl,
      name: values.deploymentName,
    });
  }
  const keyPath = await realpath(resolve(values.adminKeyFile));
  if (keyPath.split(/[\\/]/).some((part) => part.startsWith('.env')))
    throw new Error('Admin key file must not be an environment file.');
  const key = (await readFile(keyPath, 'utf8')).trim();
  if (!key) throw new Error('Admin key file is empty.');
  assertKeyForTarget(key, {
    kind: values.targetKind,
    name: values.deploymentName,
  });
  const client = new ConvexHttpClient(values.deploymentUrl, { logger: false });
  if (!isAdministrativeHttpClient(client))
    throw new Error(
      'Installed Convex client does not support administrative commands.',
    );
  const adminClient: AdministrativeHttpClient = client;
  adminClient.setAdminAuth(key);
  async function invokeEndpoint(
    module: string,
    endpoint: string,
    args: unknown,
  ) {
    const parsed = parseReleaseJson(args);
    if (!isObject(parsed))
      throw new Error('Invalid release command arguments.');
    return await adminClient.function(
      makeFunctionReference(`${module}:${endpoint}`),
      undefined,
      parsed,
    );
  }
  const invokeReleaseEndpoint = (endpoint: string, args: unknown) =>
    invokeEndpoint('catalogRelease', endpoint, args);
  return {
    invoke: invokeEndpoint,
    allocation: {
      allocate: (args) =>
        invokeEndpoint('catalogIdentityAllocation', 'allocate', args),
    },
    activation: {
      activate: (args) =>
        invokeEndpoint('catalogReleaseActivation', 'activate', args),
      status: (args) =>
        invokeEndpoint('catalogReleaseActivation', 'status', args),
    },
    impact: createCatalogReleaseImpactRemoteAdapter((endpoint, args) =>
      invokeEndpoint('catalogReleaseImpact', endpoint, args),
    ),
    begin: async (args) =>
      parseStatus(await invokeReleaseEndpoint('begin', args)),
    writeBatch: async (args) =>
      parseStatus(await invokeReleaseEndpoint('writeBatch', args)),
    finalize: async (args) =>
      parseStatus(await invokeReleaseEndpoint('finalize', args)),
    inspect: async (args) =>
      parseStatus(await invokeReleaseEndpoint('inspect', args)),
    inspectRows: (args) => invokeReleaseEndpoint('inspectRows', args),
  };
}

function parseOperatorArguments(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    strict: true,
    allowPositionals: true,
    options: {
      number: { type: 'string' },
      schema: { type: 'string' },
      calculation: { type: 'string' },
      system: { type: 'string' },
      content: { type: 'string' },
      pcgen: { type: 'string' },
      artifact: { type: 'string' },
      previous: { type: 'string' },
      attribution: { type: 'string' },
      curation: { type: 'string' },
      remaps: { type: 'string' },
      legal: { type: 'string' },
      'rule-resources': { type: 'string' },
      scope: { type: 'string' },
      'scope-manifest': { type: 'string' },
      'deployment-name': { type: 'string' },
      'deployment-url': { type: 'string' },
      'admin-key-file': { type: 'string' },
      'target-kind': { type: 'string' },
      'write-epoch': { type: 'string' },
      kind: { type: 'string' },
      cursor: { type: 'string' },
      limit: { type: 'string' },
      'max-steps': { type: 'string' },
      'retry-failed': { type: 'boolean' },
      'run-id': { type: 'string' },
      'operation-id': { type: 'string' },
      'fixture-only': { type: 'boolean' },
      production: { type: 'boolean' },
      'allow-unverified-checkouts': { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  return { values, positionals };
}
type OperatorValues = ReturnType<typeof parseOperatorArguments>['values'];

function parseWriteEpoch(value: string | undefined) {
  const writeEpoch = value === undefined ? 0 : Number(value);
  if (
    value !== undefined &&
    (!/^\d+$/.test(value) || !Number.isSafeInteger(writeEpoch))
  )
    throw new Error('--write-epoch must be a nonnegative integer.');
  return writeEpoch;
}

function parseImpactMaxSteps(value: string | undefined) {
  if (value === undefined) return DEFAULT_IMPACT_MAX_STEPS;
  const maxSteps = Number(value);
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(maxSteps))
    throw new Error('--max-steps must be a positive integer.');
  return maxSteps;
}

async function reconcileRelease(
  values: OperatorValues,
  impactAdapter: CatalogReleaseImpactCommandAdapter | undefined,
  writeEpoch: number,
) {
  const releaseNumber = positiveNumber(values.number);
  const maxSteps = parseImpactMaxSteps(values['max-steps']);
  const selectedAdapter =
    impactAdapter ??
    (
      await createRemoteAdapter({
        deploymentName: required(values['deployment-name'], 'deployment-name'),
        deploymentUrl: required(values['deployment-url'], 'deployment-url'),
        adminKeyFile: required(values['admin-key-file'], 'admin-key-file'),
        targetKind: required(values['target-kind'], 'target-kind'),
      })
    ).impact;
  return runCatalogReleaseImpactCommand({
    releaseNumber,
    adapter: selectedAdapter,
    writeEpoch,
    maxSteps,
    retryFailed: values['retry-failed'],
  });
}

/**
 * #413 F1: allocates the prepared release's missing stable identities before
 * reconciliation, while the gate is open (design A step 4). It refuses
 * production before any credential or remote I/O unless `--production` is
 * passed with `--target-kind production` (#413 F6c).
 */
async function allocateIdentities(
  values: OperatorValues,
  adapter: CatalogIdentityAllocationCommandAdapter | undefined,
  writeEpoch: number,
) {
  if (values['target-kind'] === 'production' && values.production !== true)
    throw new Error(
      'Catalog identity allocation is limited to fixture deployments unless --production is passed.',
    );
  const releaseNumber = positiveNumber(values.number);
  const selectedAdapter =
    adapter ??
    (
      await createRemoteAdapter({
        deploymentName: required(values['deployment-name'], 'deployment-name'),
        deploymentUrl: required(values['deployment-url'], 'deployment-url'),
        adminKeyFile: required(values['admin-key-file'], 'admin-key-file'),
        targetKind: required(values['target-kind'], 'target-kind'),
      })
    ).allocation;
  return runCatalogIdentityAllocationCommand({
    releaseNumber,
    writeEpoch,
    adapter: selectedAdapter,
  });
}

function refuseMisplacedProduction(
  values: OperatorValues,
  command: string | undefined,
) {
  if (values.production !== true) return;
  if (
    (command !== 'allocate' && command !== 'activate') ||
    values['target-kind'] !== 'production'
  )
    throw new Error(
      '--production applies only to allocate or activate with --target-kind production.',
    );
  if (values['fixture-only'] === true)
    throw new Error('--production cannot be combined with --fixture-only.');
}

async function resolveRemoteAdapter(
  values: OperatorValues,
  adapter: CatalogReleaseCommandAdapter | undefined,
) {
  if (adapter) return adapter;
  return createRemoteAdapter({
    deploymentName: required(values['deployment-name'], 'deployment-name'),
    deploymentUrl: required(values['deployment-url'], 'deployment-url'),
    adminKeyFile: required(values['admin-key-file'], 'admin-key-file'),
    targetKind: required(values['target-kind'], 'target-kind'),
  });
}

export async function runCatalogReleaseOperator({
  args,
  adapter,
  impactAdapter,
  activationAdapter,
  allocationAdapter,
  productionCalculationRecord,
}: {
  args: string[];
  adapter?: CatalogReleaseCommandAdapter;
  impactAdapter?: CatalogReleaseImpactCommandAdapter;
  activationAdapter?: CatalogReleaseActivationCommandAdapter;
  allocationAdapter?: CatalogIdentityAllocationCommandAdapter;
  /** The recorded production identity; tests inject it. */
  productionCalculationRecord?: string | null;
}): Promise<unknown> {
  const { values, positionals } = parseOperatorArguments(args);
  if (values.help) return { usage: catalogReleaseUsage };
  if (
    positionals.length !== 1 ||
    ![
      'build',
      'prepare',
      'inspect',
      'allocate',
      'reconcile',
      'activate',
      'active',
    ].includes(positionals[0] ?? '')
  )
    throw new Error(catalogReleaseUsage);
  const writeEpoch = parseWriteEpoch(values['write-epoch']);
  const command = positionals[0];
  refuseMisplacedProduction(values, command);
  if (command === 'activate' || command === 'active')
    return activateRelease({
      values,
      command,
      adapter: activationAdapter,
      writeEpoch,
      productionCalculationRecord: recordedProductionIdentity(
        productionCalculationRecord,
      ),
    });
  const remoteSteps: Partial<Record<string, () => Promise<unknown>>> = {
    allocate: () => allocateIdentities(values, allocationAdapter, writeEpoch),
    reconcile: () => reconcileRelease(values, impactAdapter, writeEpoch),
    inspect: () => inspectRelease(values, adapter),
  };
  const remoteStep = remoteSteps[command ?? ''];
  if (remoteStep) return remoteStep();
  const artifactPath = await resolveOutputPath(
    resolve(required(values.artifact, 'artifact')),
  );
  if (command === 'prepare')
    return prepareRelease(values, artifactPath, adapter, writeEpoch);
  return buildReleaseArtifact(values, artifactPath);
}

async function activateRelease({
  values,
  command,
  adapter,
  writeEpoch,
  productionCalculationRecord,
}: {
  values: OperatorValues;
  command: 'activate' | 'active';
  adapter: CatalogReleaseActivationCommandAdapter | undefined;
  writeEpoch: number;
  productionCalculationRecord: string | null;
}) {
  // #413 F8a: production takes --production (refuseMisplacedProduction
  // already refused it with --fixture-only or another target); every other
  // target still requires --fixture-only.
  const target = values.production === true ? 'production' : 'fixture';
  if (command === 'activate') {
    if (values['target-kind'] === 'production' && target !== 'production')
      throw new Error(
        'Catalog activation is limited to fixture deployments unless --production is passed.',
      );
    if (target === 'fixture' && values['fixture-only'] !== true)
      throw new Error(
        'Catalog activation requires --fixture-only on an isolated fixture deployment.',
      );
  }
  const selectedAdapter =
    adapter ??
    (
      await createRemoteAdapter({
        deploymentName: required(values['deployment-name'], 'deployment-name'),
        deploymentUrl: required(values['deployment-url'], 'deployment-url'),
        adminKeyFile: required(values['admin-key-file'], 'admin-key-file'),
        targetKind: required(values['target-kind'], 'target-kind'),
      })
    ).activation;
  const selection = await runCatalogReleaseActivationCommand({
    command:
      command === 'active'
        ? { kind: 'status' }
        : {
            kind: 'activate',
            target,
            releaseNumber: positiveNumber(values.number),
            runId: required(values['run-id'], 'run-id'),
            activationId: required(values['operation-id'], 'operation-id'),
            schemaIdentity: required(values.schema, 'schema'),
            calculationIdentity: required(values.calculation, 'calculation'),
            writeEpoch,
          },
    adapter: selectedAdapter,
  });
  return (
    selection &&
    reportServing(
      selection,
      productionReport({
        target,
        command,
        targetKind: values['target-kind'],
        productionCalculationRecord,
      }),
    )
  );
}

/** The recorded production identity, unless a test injects one. */
function recordedProductionIdentity(injected: string | null | undefined) {
  return injected === undefined
    ? productionActivatedCalculationIdentity
    : injected;
}

/** Which production report a selection carries (#413 F8 fix r1). */
function productionReport({
  target,
  command,
  targetKind,
  productionCalculationRecord,
}: {
  target: 'fixture' | 'production';
  command: 'activate' | 'active';
  targetKind: string | undefined;
  productionCalculationRecord: string | null;
}): ProductionReport {
  if (target === 'production') return { kind: 'reminder' };
  if (command === 'active' && targetKind === 'production')
    return { kind: 'record', productionCalculationRecord };
  return { kind: 'none' };
}

type ProductionReport =
  | { kind: 'none' }
  | { kind: 'reminder' }
  | { kind: 'record'; productionCalculationRecord: string | null };

/**
 * #413 F8b: the status line, how this checkout serves the selection's
 * calculation identity (current, prior or outside its window). #413 F8 fix r1:
 * the rotation guard follows only the recorded production identity, so a
 * production activation says what to record, and `active` on production says
 * when the record differs. Both only report.
 */
function reportServing<Selection extends { calculationIdentity: string }>(
  selection: Selection,
  report: ProductionReport,
) {
  const serving = {
    ...selection,
    calculationServing: calculationServing(selection.calculationIdentity),
  };
  if (report.kind === 'none') return serving;
  if (report.kind === 'reminder')
    return {
      ...serving,
      operatorReminder: productionRecordReminder(selection.calculationIdentity),
    };
  return {
    ...serving,
    productionRecord: productionRecord(
      selection.calculationIdentity,
      report.productionCalculationRecord,
    ),
  };
}

async function inspectRelease(
  values: OperatorValues,
  adapter: CatalogReleaseCommandAdapter | undefined,
) {
  const selectedAdapter = await resolveRemoteAdapter(values, adapter);
  const releaseNumber = positiveNumber(values.number);
  if (values.kind === undefined)
    return runCatalogReleaseCommand({
      command: { kind: 'inspect', releaseNumber },
      adapter: selectedAdapter,
    });
  const kind = parseRowKind(values.kind);
  const numItems =
    values.limit === undefined
      ? MAX_RELEASE_BATCH_ROWS
      : positiveNumber(values.limit);
  if (numItems > MAX_RELEASE_BATCH_ROWS)
    throw new Error('--limit exceeds the inspection row limit.');
  if (!selectedAdapter.inspectRows)
    throw new Error('Adapter does not support release row inspection.');
  return selectedAdapter.inspectRows({
    releaseNumber,
    kind,
    paginationOpts: {
      cursor: values.cursor ?? null,
      numItems,
      maximumRowsRead: MAX_RELEASE_BATCH_ROWS,
      maximumBytesRead: MAX_RELEASE_BATCH_BYTES,
    },
  });
}

async function prepareRelease(
  values: OperatorValues,
  artifactPath: string,
  adapter: CatalogReleaseCommandAdapter | undefined,
  writeEpoch: number,
) {
  const artifact = await validateCatalogReleaseArtifact(
    await readJson(artifactPath),
  );
  return runCatalogReleaseCommand({
    command: { kind: 'prepare', artifact },
    writeEpoch,
    adapter: await resolveRemoteAdapter(values, adapter),
  });
}

async function resolveBuildInputPaths(
  values: OperatorValues,
  artifactPath: string,
  scopeReportPath: string | undefined,
) {
  const system = await realpath(resolve(required(values.system, 'system')));
  const content = await realpath(resolve(required(values.content, 'content')));
  const pcgen =
    values.pcgen === undefined
      ? undefined
      : await realpath(resolve(values.pcgen));
  const remapPath = await realpath(
    values.remaps
      ? resolve(values.remaps)
      : new URL('./reviewed-remaps.json', import.meta.url),
  );
  const curationPath = await realpath(
    values.curation
      ? resolve(values.curation)
      : new URL('./reviewed-curation.json', import.meta.url),
  );
  const externalPaths = await Promise.all(
    [
      values.attribution,
      values.legal,
      values.previous,
      values['rule-resources'],
      values['scope-manifest'],
    ]
      .filter((path): path is string => path !== undefined)
      .map((path) => realpath(resolve(path))),
  );
  await validateOutput({
    output: dirname(artifactPath),
    sources: [
      system,
      content,
      ...(pcgen ? [pcgen] : []),
      remapPath,
      curationPath,
      ...externalPaths,
    ],
    reports: [artifactPath, scopeReportPath]
      .filter((path): path is string => path !== undefined)
      .map((path) => path.slice(dirname(artifactPath).length + 1)),
  });
  const inputVerification = await verifyInputs({
    system,
    content,
    pcgen,
    allowUnverified: values['allow-unverified-checkouts'] === true,
  });
  return {
    system,
    content,
    pcgen,
    remapPath,
    curationPath,
    inputVerification,
  };
}

async function readBuildInputs(
  values: OperatorValues,
  paths: Awaited<ReturnType<typeof resolveBuildInputPaths>>,
  scope: OperatorScope | undefined,
) {
  const { system, content, pcgen, remapPath, curationPath } = paths;
  const remaps = await readJson(remapPath);
  const curation = await readJson(curationPath);
  const artifact = await importCatalog({
    systemPath: system,
    contentPath: content,
    remaps,
    curation,
    scopeKeys: scope?.importKeys,
    ...(pcgen && {
      pcgen: { path: pcgenDataPath(pcgen), scopeKeys: scope?.pcgenKeys },
    }),
  });
  // The committed reviewed attribution data holds 93 MB of encoded evidence,
  // so only a build without --attribution reads it.
  const attribution = values.attribution
    ? reviewedAdmissionSchema.parse(
        parseReviewedAdmissionInput(
          await readFile(resolve(values.attribution), 'utf8'),
        ),
      )
    : await readCommittedReviewedAdmission();
  const legalResources = values.legal
    ? legalResourcesSchema.parse(await readJson(resolve(values.legal)))
    : defaultLegalResources;
  const previous = values.previous
    ? await validateCatalogReleaseArtifact(
        await readJson(resolve(values.previous)),
      )
    : undefined;
  const implementation = await catalogImplementationInputs();
  const suppliedResources = values['rule-resources']
    ? parseAuthoredResources(await readJson(resolve(values['rule-resources'])))
    : [];
  return {
    remaps,
    curation,
    artifact,
    attribution,
    legalResources,
    previous,
    implementation,
    suppliedResources,
  };
}

async function buildReleaseArtifact(
  values: OperatorValues,
  artifactPath: string,
) {
  const releaseNumber = positiveNumber(values.number);
  const compatibility = {
    schema: required(values.schema, 'schema'),
    calculation: required(values.calculation, 'calculation'),
  };
  if (values['scope-manifest'] !== undefined && values.scope === undefined)
    throw new Error('--scope-manifest requires --scope.');
  const scopeReportPath =
    values.scope === undefined
      ? undefined
      : `${artifactPath.replace(/\.json$/, '')}.scope.json`;
  const paths = await resolveBuildInputPaths(
    values,
    artifactPath,
    scopeReportPath,
  );
  const { inputVerification } = paths;
  const scope =
    values.scope === undefined
      ? undefined
      : await openBuildScope(values, values.scope);
  const prepare = () =>
    prepareReleaseOptions({
      values,
      paths,
      scope,
      releaseNumber,
      compatibility,
    });
  if (scope && scopeReportPath)
    return buildScopedRelease({
      prepare,
      values,
      scope,
      artifactPath,
      scopeReportPath,
      inputVerification,
    });
  const release = await createCatalogRelease(await prepare());
  await saveImmutableArtifact(artifactPath, release);
  return { artifactPath, manifest: release.manifest, inputVerification };
}

/**
 * The scope a build names. #716 E1: a scoped build emits PCGen owners only
 * for the PCGen rows its scope names (the party scope's archetypes), so
 * `--pcgen` is refused for a scope without them.
 */
async function openBuildScope(values: OperatorValues, version: string) {
  const scope = await openReleaseScope({
    version,
    manifestPath:
      values['scope-manifest'] === undefined
        ? undefined
        : resolve(values['scope-manifest']),
  });
  if (values.pcgen !== undefined && !scope.pcgenKeys)
    throw new Error(
      `--pcgen applies only to a scope with PCGen rows; ${scope.version} has none.`,
    );
  return scope;
}

/** The release inputs a build reads: import, attribution, legal, base and resources. */
async function prepareReleaseOptions({
  values,
  paths,
  scope,
  releaseNumber,
  compatibility,
}: {
  values: OperatorValues;
  paths: Awaited<ReturnType<typeof resolveBuildInputPaths>>;
  scope: OperatorScope | undefined;
  releaseNumber: number;
  compatibility: { schema: string; calculation: string };
}) {
  const { inputVerification } = paths;
  const {
    remaps,
    curation,
    artifact,
    attribution,
    legalResources,
    previous,
    implementation,
    suppliedResources,
  } = await readBuildInputs(values, paths, scope);
  return {
    artifact,
    attribution,
    legalResources,
    previous,
    releaseNumber,
    compatibility,
    // #227 slice 4: each released definition's label, from the committed
    // verification projection (unverified throughout when it is stale).
    verification: await readCommittedReleaseVerification(),
    authoredResources: [
      ...suppliedResources,
      {
        key: 'builtin:casting-tables',
        payload: {
          definitions: implementation.ruleResources.castingTables.definitions,
          sourceFingerprint: await releaseFingerprint(
            implementation.ruleResources.castingTables.source,
          ),
          compatibility,
        },
      },
      {
        key: 'builtin:representative-class-catalog',
        payload: {
          definitions:
            implementation.ruleResources.representativeClassCatalog.definitions,
          featureSchedules:
            implementation.ruleResources.representativeClassCatalog
              .featureSchedules,
          counterparts:
            implementation.ruleResources.representativeClassCatalog
              .counterparts,
          sourceFingerprint: await releaseFingerprint(
            implementation.ruleResources.representativeClassCatalog.source,
          ),
          compatibility,
        },
      },
      {
        key: 'builtin:representative-selection-catalog',
        payload: {
          definitions:
            implementation.ruleResources.representativeSelectionCatalog
              .definitions,
          sourceFingerprint: await releaseFingerprint(
            implementation.ruleResources.representativeSelectionCatalog.source,
          ),
          compatibility,
        },
      },
      {
        key: 'builtin:representative-archetype-catalog',
        payload: {
          definitions:
            implementation.ruleResources.representativeArchetypeCatalog
              .definitions,
          sourceFingerprint: await releaseFingerprint(
            implementation.ruleResources.representativeArchetypeCatalog.source,
          ),
          compatibility,
        },
      },
      {
        key: 'builtin:representative-spellcasting-catalog',
        payload: {
          definitions:
            implementation.ruleResources.representativeSpellcastingCatalog
              .definitions,
          sourceFingerprint: await releaseFingerprint(
            implementation.ruleResources.representativeSpellcastingCatalog
              .source,
          ),
          compatibility,
        },
      },
      {
        key: 'builtin:representative-race-catalog',
        payload: {
          definitions:
            implementation.ruleResources.representativeRaceCatalog.definitions,
          sourceFingerprint: await releaseFingerprint(
            implementation.ruleResources.representativeRaceCatalog.source,
          ),
          compatibility,
        },
      },
    ],
    inputValues: {
      ...implementation,
      remaps,
      curation,
      localData: [],
      ruleResources: {
        builtIn: implementation.ruleResources,
        supplied: suppliedResources,
      },
      upstreamVerification: inputVerification,
    },
  };
}

type ReleaseOptions = Awaited<ReturnType<typeof prepareReleaseOptions>>;

/**
 * #770: a scoped build always writes its scope report, writes the artifact
 * only when the existing gates pass, and fails unless the scope qualifies.
 * A refusal while reading the release inputs (selection, import, attribution,
 * comparison base, supplied rule resources or gate assessment) or while
 * holding what reconciliation refuses is reported too.
 */
async function buildScopedRelease({
  prepare,
  values,
  scope,
  artifactPath,
  scopeReportPath,
  inputVerification,
}: {
  prepare: () => Promise<ReleaseOptions>;
  values: Pick<OperatorValues, 'attribution' | 'legal'>;
  scope: OperatorScope;
  artifactPath: string;
  scopeReportPath: string;
  inputVerification: unknown;
}) {
  let options: ReleaseOptions;
  let gate: Awaited<ReturnType<typeof assessCatalogReleaseGates>>;
  try {
    ({ options, gate } = await holdWhatReconciliationRefuses(await prepare()));
  } catch (error) {
    const reason = errorMessage(error);
    const report = scope.refuse(reason);
    await writeScopeReport(scopeReportPath, report, {
      refused: reason.slice(0, 2000),
    });
    throw scopeFailure({
      report,
      scope,
      outcome: `no artifact written.\nRelease inputs refused: ${reason.slice(0, 300)}`,
      scopeReportPath,
    });
  }
  const resourceSources = await builtResourceSources(options, values);
  const account = (refusal?: string) =>
    scope.account({
      artifact: options.artifact,
      gate,
      authoredResources: options.authoredResources.map(({ key }) => key),
      resourceSources,
      previous: options.previous,
      refusal,
    });
  let report = account();
  let release: Awaited<ReturnType<typeof createCatalogRelease>> | undefined;
  let refusal: string | undefined;
  try {
    release = await createCatalogRelease({
      ...options,
      scope: report.content,
    });
    await saveImmutableArtifact(artifactPath, release);
  } catch (error) {
    release = undefined;
    refusal = errorMessage(error);
    report = account(refusal);
  }
  await writeScopeReport(
    scopeReportPath,
    report,
    release
      ? {
          artifactFingerprint: release.manifest.artifactFingerprint,
          coverageComplete: options.artifact.comparison.coverageComplete,
          corpus: options.artifact.comparison.corpus,
        }
      : {
          // A gate refusal quotes the whole curation report; each row's
          // outcome already carries its own gate reason.
          refused: refusal?.slice(0, 2000),
          gateFailures: gate.failures.length,
          curationPassed: options.artifact.curation.passed,
          coverageComplete: options.artifact.comparison.coverageComplete,
          corpus: options.artifact.comparison.corpus,
        },
  );
  if (!release || report.report.qualification.status !== 'QUALIFIED')
    throw scopeFailure({
      report,
      scope,
      outcome: [
        release ? `artifact ${artifactPath}.` : 'no artifact written.',
        ...corpusCoverageLine(options.artifact.comparison),
        ...(refusal === undefined
          ? []
          : [`Release refused: ${refusal.slice(0, 300)}`]),
      ].join('\n'),
      scopeReportPath,
    });
  return {
    artifactPath,
    manifest: release.manifest,
    inputVerification,
    scopeReport: scopeReportPath,
    qualification: report.report.qualification.status,
    corpus: options.artifact.comparison.corpus,
  };
}

/**
 * party-gates: a scoped build holds what reconciliation would refuse
 * (`reconciliation-holds.ts`), so the artifact it writes reconciles. Every
 * refused key joins the import's review holds, so the gate holds it and
 * omits what depends on it, and the gate is assessed again
 * (`holdUntilReconciled`, which ends with an error when a hold removes no
 * row). A release the gates refuse is left to the build, which reports the
 * refusal.
 */
async function holdWhatReconciliationRefuses(initial: ReleaseOptions) {
  return holdUntilReconciled(
    { options: initial, gate: await assessCatalogReleaseGates(initial) },
    {
      release: async ({ options }) => {
        try {
          return (await createCatalogRelease(options)).batches.flat();
        } catch {
          return undefined;
        }
      },
      held: ({ options }) => options.artifact.curation.reviewHolds ?? [],
      hold: async ({ options }, holds) => {
        const next = {
          ...options,
          artifact: withReviewHolds(options.artifact, holds),
        };
        return { options: next, gate: await assessCatalogReleaseGates(next) };
      },
    },
  );
}

function withReviewHolds(
  artifact: ReleaseOptions['artifact'],
  holds: readonly ReconciliationHold[],
): ReleaseOptions['artifact'] {
  return {
    ...artifact,
    curation: {
      ...artifact.curation,
      reviewHolds: [...(artifact.curation.reviewHolds ?? []), ...holds],
    },
  };
}

/** A scoped build's corpus-wide record coverage, beside its own (G1). */
function corpusCoverageLine({
  coverageComplete,
  corpus,
}: ReleaseOptions['artifact']['comparison']) {
  return corpus
    ? [
        `Record coverage over the import set: ${coverageComplete ? 'complete' : 'incomplete'}; over the corpus: ${corpus.coverageComplete ? 'complete' : 'incomplete'}, ${corpus.unassigned} unassigned records.`,
      ]
    : [];
}

/**
 * The source texts a build read for the resources it emits, so the scope's
 * verification can bind them to the inventory's resource rows. A supplied
 * attribution or legal file replaces the committed registry or resources, so
 * its committed bytes are not bound.
 */
async function builtResourceSources(
  options: ReleaseOptions,
  values: Pick<OperatorValues, 'attribution' | 'legal'>,
) {
  const committed = (name: string) =>
    readFile(
      new URL(`../../src/lib/catalog/data/${name}.json`, import.meta.url),
      'utf8',
    );
  return {
    authored: authoredResourceSources(
      options.inputValues.ruleResources.builtIn,
    ),
    ...(values.attribution === undefined
      ? { registry: await committed('section15-registry') }
      : {}),
    ...(values.legal === undefined
      ? { legalResources: await committed('resources') }
      : {}),
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function writeScopeReport(
  path: string,
  { report }: ScopeOutcome,
  release: Record<string, unknown>,
) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, canonicalReleaseJson({ ...report, release }) + '\n');
}

function scopeFailure({
  report,
  scope,
  outcome,
  scopeReportPath,
}: {
  report: ScopeOutcome;
  scope: OperatorScope;
  outcome: string;
  scopeReportPath: string;
}) {
  return new Error(
    [
      `Scoped qualification ${report.report.qualification.status} for ${scope.version}; ${outcome}`,
      report.describe(),
      `Scope report: ${scopeReportPath}`,
    ].join('\n'),
  );
}

async function saveImmutableArtifact(
  artifactPath: string,
  release: Awaited<ReturnType<typeof createCatalogRelease>>,
) {
  const serialized = serializeCatalogRelease(release);
  await mkdir(dirname(artifactPath), { recursive: true });
  try {
    await writeFile(artifactPath, serialized, { flag: 'wx' });
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !('code' in error) ||
      error.code !== 'EEXIST'
    )
      throw error;
    const existing = await validateCatalogReleaseArtifact(
      await readJson(artifactPath),
    );
    if (
      existing.manifest.artifactFingerprint !==
      release.manifest.artifactFingerprint
    )
      throw new Error(
        'Artifact path is already bound to changed release inputs/output; increment the number and choose a new path.',
      );
  }
}

/**
 * `--rule-resources`, for scoped and unscoped builds alike. A supplied key
 * must name one of the built-in resources: release discovery accepts no
 * other `builtin:` key, and the build emits every supplied resource whatever
 * it holds, so a mistyped key is an authoring error refused here, before a
 * scoped build's hold loop, rather than a hold that could never remove it.
 */
function parseAuthoredResources(
  value: unknown,
): { key: string; payload: ReleaseJson }[] {
  if (!Array.isArray(value))
    throw new Error(
      'Rule resources must be an array of {key,payload} records.',
    );
  return value.map((resource: unknown) => {
    if (
      !isObject(resource) ||
      typeof resource.key !== 'string' ||
      !resource.key.startsWith('builtin:') ||
      !('payload' in resource)
    )
      throw new Error(
        'Rule resource keys must be stable builtin: identifiers.',
      );
    if (!isBuiltInResource(resource.key))
      throw new Error(
        `Rule resource ${resource.key} is no built-in resource; a supplied rule resource must be one of ${builtInResourceKeys.join(', ')}.`,
      );
    return { key: resource.key, payload: parseReleaseJson(resource.payload) };
  });
}

function parseRowKind(value: string): ReleaseRow['kind'] {
  if (!isReleaseRowKind(value))
    throw new Error(
      '--kind must be definition, resource, report, remap or legal.',
    );
  return value;
}
