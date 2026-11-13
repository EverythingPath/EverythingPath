import { suiteLabel, suiteSchema, type Suite } from './matrix';

// Conditions the E2E harness raises itself. Each carries only fixed fields;
// `describeDiagnostic` builds the printed text from them, so no runtime
// string (message, path, file name, provider output) can reach the console.

const fixedTexts = {
  usage:
    'Usage: pnpm test:e2e --resources /absolute/resources.json [--secrets /absolute/test-secrets.env] [--backend preview|local] [--preflight] [--suite mandatory|focused|live|nightly|release ... [--group G ...] | [--suite nightly] --journey TITLE|FILE ...] [--workers N] [--budget-minutes M | --outer-deadline-epoch S] [--reuse | --discard-prepared]',
  'reuse-usage':
    '--reuse needs --backend local and a diagnostic selection: --journey, --suite nightly --journey, or --suite focused --group ... alone. Qualifying runs (mandatory, live, nightly, release, --preflight, CI, an outer deadline) always prepare afresh',
  'prepared-in-use':
    'The prepared E2E environment belongs to another run whose container is still running. Check `docker ps` and `pgrep -af e2e/run`; if no run uses it, rerun with --discard-prepared',
  deadline: 'E2E execution exceeded its time budget',
  'budget-range': 'E2E budget must be between 5 and 120 minutes',
  'outer-deadline': 'E2E outer deadline must be whole epoch seconds',
  'outer-deadline-ci':
    '--outer-deadline-epoch is only for trusted GitHub CI; use --budget-minutes',
  'time-options': 'Use --budget-minutes or --outer-deadline-epoch, not both',
  'source-changed': 'E2E source changed while preparing the test workspace',
  'preview-unbound': 'Preview callback did not bind the frontend',
  'run-file-missing':
    'Run E2E through pnpm test:e2e with an explicit resource declaration',
  port: 'Cannot allocate E2E port',
  'secrets-mode': 'E2E secrets file must have mode 600',
  'secrets-keys':
    'Secrets file may contain only the three declared service keys',
  'cohorts-distinct':
    'E2E worker cohorts must have distinct keys, organizations and identities',
  'cohorts-order':
    'E2E worker cohorts must be declared in order as worker-0, worker-1, ...',
  'clerk-request':
    'Clerk fixture verification failed; check the resource declaration and provisioned cohort',
  'clerk-instance': 'Clerk instance is not development',
  'clerk-keys':
    'Clerk secret and publishable keys belong to different applications',
  'clerk-identity': 'Clerk fixture identity drift',
  'clerk-membership':
    'Clerk fixture membership drift; provision the declared cohort before running E2E',
  'diagnostic-log': 'E2E diagnostic log could not be saved',
  'process-group': 'E2E child processes survived SIGKILL',
  'slot-lock-replaced':
    'E2E slot lock was removed or replaced during the run; any replacement was left in place',
  'slot-lock-displaced':
    'E2E slot lock at the lock path belonged to another run and the path was taken again before it could be restored; it was left beside the lock as <slot>.lock.releasing-<token> for manual review',
  'triage-usage': 'Use summarize or publish',
  'triage-current-missing': 'Current nightly run is missing',
  'triage-history-incomplete': 'Nightly history artifact is incomplete',
  'admin-key-leftover':
    'E2E preview admin key file could not be removed; delete the run directory by hand before anything else',
  'release-tmpdir':
    'E2E release runs keep the preview admin key under TMPDIR, never /tmp; run them through scripts/orchestration/e2e-branch.sh',
  'release-evidence':
    'Catalog Release qualification evidence is missing or incomplete',
} as const;
type FixedKind = keyof typeof fixedTexts;

export const inheritedSelectors = [
  'CONVEX_DEPLOYMENT',
  'CONVEX_SELF_HOSTED_URL',
  'CONVEX_SELF_HOSTED_ADMIN_KEY',
  'CONVEX_ACCESS_TOKEN',
  'CONVEX_OVERRIDE_ACCESS_TOKEN',
  'CONVEX_OVERRIDE_DEPLOY_KEY',
  'CONVEX_OVERRIDE_URL',
  'CONVEX_URL',
  'NEXT_PUBLIC_CONVEX_URL',
  'CLERK_API_URL',
  'CLERK_FAPI',
  'CLERK_TESTING_TOKEN',
  'CLERK_FRONTEND_API_URL',
  'NEXT_PUBLIC_CLERK_PROXY_URL',
  'NEXT_PUBLIC_CLERK_DOMAIN',
] as const;
export const preflightReasons = [
  'invalid resource declaration',
  'trusted execution must be explicitly enabled',
  'CI requires a trusted workflow for the reviewed commit',
  ...inheritedSelectors.map((name) => `${name} must not be inherited` as const),
  'Convex credential must be a preview creation key for the declared project',
  'Clerk publishable key must encode the declared development host',
  'Clerk secret key must be a test key',
  'frontend Clerk key does not match the declared test key',
  'Clerk target is production',
  'resolved Convex URL is malformed or production',
] as const;
export type PreflightReason = (typeof preflightReasons)[number];

// The bindings Convex generates; any other name prints as a fixed phrase.
const generatedFiles = [
  'api.d.ts',
  'api.js',
  'dataModel.d.ts',
  'server.d.ts',
  'server.js',
] as const;

// Why the preview admin key exchange (preview-admin-key.ts) failed closed.
const adminKeyReasons = {
  'cli-version':
    'the installed Convex CLI is not the version the exchange is pinned to',
  'preview-key': 'the credential is not a preview deploy key for this preview',
  request: 'the request did not complete',
  http: 'the exchange refused the request',
  'response-json': 'the response is not JSON',
  'response-schema': 'the response does not have the expected fields',
  'response-deployment-type': 'the response is not a preview deployment',
  'response-url': "the response is not this run's preview URL",
} as const;
export type AdminKeyReason = keyof typeof adminKeyReasons;
/**
 * What a failed response looked like, without any value from it: its
 * top-level key names, each schema issue as `path:code`, a known
 * deploymentType, and three facts about its URL. Every field is re-checked
 * against a fixed pattern when printed.
 */
export type AdminKeyResponseShape = {
  keys?: readonly string[];
  issues?: readonly string[];
  deploymentType?: string;
  url?: {
    equal: boolean;
    plain: boolean;
    regional: boolean;
  };
};
export const knownDeploymentTypes = [
  'prod',
  'dev',
  'preview',
  'custom',
  'local',
] as const;
// What a schema issue may name: the adapter's own schema paths and Zod's
// issue codes. Nothing else from a response ever prints.
const issuePaths = [
  '(root)',
  'adminKey',
  'deploymentName',
  'deploymentType',
  'url',
] as const;
const issueCodes = [
  'invalid_type',
  'too_big',
  'too_small',
  'invalid_format',
  'not_multiple_of',
  'unrecognized_keys',
  'invalid_union',
  'invalid_key',
  'invalid_element',
  'invalid_value',
  'custom',
] as const;
function describeIssue(issue: string) {
  const separator = issue.lastIndexOf(':');
  const path = issue.slice(0, separator);
  const code = issue.slice(separator + 1);
  return (issuePaths as readonly string[]).includes(path) &&
    (issueCodes as readonly string[]).includes(code)
    ? `${path}:${code}`
    : 'other';
}
// The fields of the installed CLI's `DeploymentAuthResponse`
// (node_modules/convex/src/cli/lib/api.ts). Any other key name could be a
// value, even the credential, so it is only counted.
const knownResponseKeys = [
  'adminKey',
  'deploymentName',
  'deploymentType',
  'isDefault',
  'reference',
  'url',
] as const;

function describeResponseShape(shape: AdminKeyResponseShape | undefined) {
  if (!shape) return '';
  const parts: string[] = [];
  if (shape.issues)
    parts.push(
      `issues: ${shape.issues.map(describeIssue).join(', ') || 'none'}`,
    );
  if (shape.deploymentType !== undefined)
    parts.push(
      `deploymentType: ${
        (knownDeploymentTypes as readonly string[]).includes(
          shape.deploymentType,
        )
          ? shape.deploymentType
          : 'other'
      }`,
    );
  if (shape.url) {
    const { equal, plain, regional } = shape.url;
    parts.push(
      `url: equal=${equal === true} plain=${plain === true} regional=${regional === true}`,
    );
  }
  if (shape.keys) {
    const isKnown = (key: string) =>
      (knownResponseKeys as readonly string[]).includes(key);
    const known = knownResponseKeys.filter((key) => shape.keys?.includes(key));
    const others = shape.keys.filter((key) => !isKnown(key)).length;
    parts.push(
      `keys: ${known.join(',') || 'none'}${others ? `; other keys: ${others}` : ''}`,
    );
  }
  return parts.length ? ` (${parts.join('; ')})` : '';
}
// Why the local Docker Convex backend (scripts/local-convex/backend.ts) could
// not start, check or stop. The development texts name the exact recovery.
const localBackendReasons = {
  interrupted:
    'Local Convex setup was interrupted; any container it created was removed, and any it started was stopped',
  timeout: 'Local Convex setup ran out of time before the run deadline',
  'docker-unavailable':
    'Docker is not reachable; start the Docker daemon and retry',
  image:
    'The pinned local Convex backend image is missing and could not be pulled; check Docker and network access to ghcr.io',
  docker: 'A Docker command for local Convex failed',
  ownership:
    'A Docker container with the local Convex name exists but was not created by this checkout',
  ports: 'The local Convex container does not publish its ports on 127.0.0.1',
  'image-changed': 'The local Convex container uses a different backend image',
  start:
    'The new local Convex container could not start (often a port collision); it was removed, so a retry picks new ports',
  'start-existing':
    'The local Convex container could not start, often because another service now uses its port',
  readiness: 'Local Convex did not become ready',
  instance: 'Local Convex answered with a different instance name',
  'instance-unreachable':
    'Local Convex stopped answering during its instance check',
  'admin-key': 'Local Convex returned an invalid admin key',
  credentials: 'Local Convex credentials could not be written',
  stop: 'The local Convex container could not be stopped or removed; check `docker ps -a --filter label=dev.everythingpath.local-convex` ("Local Convex on this machine" in e2e/README.md)',
  'stop-after-failure':
    'The local Convex container could not be stopped or removed after the failure above',
  missing: 'The prepared local Convex container no longer exists',
} as const;
export type LocalBackendReason = keyof typeof localBackendReasons;
// The development container's data stays in its named volume, so removing
// the container is always the recovery for these. An E2E container is
// removed with its anonymous volume.
const developmentRemoval =
  'Remove it with `docker rm -f {name}` (its data volume {name}-data is kept).';
const e2eRemoval = 'Remove it with `docker rm -f -v {name}`.';
const developmentRecoveries: Partial<Record<LocalBackendReason, string>> = {
  stop: developmentRemoval,
  'stop-after-failure': developmentRemoval,
  ownership:
    'Inspect it with `docker inspect {name}`; if it is not needed, remove it with `docker rm {name}`, then rerun.',
  ports:
    'Remove the container with `docker rm {name}` (its data volume {name}-data is kept), then rerun.',
  'image-changed':
    'Remove the container with `docker rm {name}` (its data volume {name}-data is kept), then rerun.',
  'start-existing':
    'Free the port, or remove the container with `docker rm {name}` (its data volume {name}-data is kept) so the next run picks new ports, then rerun.',
};
const e2eRecoveries: Partial<Record<LocalBackendReason, string>> = {
  stop: e2eRemoval,
  'stop-after-failure': e2eRemoval,
};
const developmentName = /^ep-dev-[a-f0-9]{12}$/;
const e2eName =
  /^ep-e2e-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

/** The recovery step for a validated instance name, or none. */
function describeLocalBackendRecovery({
  reason,
  name,
}: {
  reason: LocalBackendReason;
  name?: string;
}) {
  if (name === undefined) return '';
  const recovery = developmentName.test(name)
    ? developmentRecoveries[reason]
    : e2eName.test(name)
      ? e2eRecoveries[reason]
      : undefined;
  return recovery ? `. ${recovery.replaceAll('{name}', name)}` : '';
}

// Which release-qualification check (release-qualification.ts) failed.
const releaseSteps = {
  mode: 'it runs only in a release-mode run on a bound preview',
  case: 'the release case is not provisioned for the first cohort',
  pin: 'the calculation identity is not the pinned one',
  work: 'the seeded Character holding the admitted feat was not reconciled',
} as const;
export type ReleaseStep = keyof typeof releaseSteps;

// The release CLI's steps the qualification runs (release-qualification.ts).
export const releaseOperatorSteps = [
  'build',
  'prepare',
  'reconcile',
  'activate',
  'active',
] as const;
export type ReleaseOperatorStep = (typeof releaseOperatorSteps)[number];
// Every phase of the qualification, its operator steps among them.
export const releasePhases = [
  'initialization',
  'case',
  'source',
  'pin',
  'epoch',
  'credential',
  ...releaseOperatorSteps,
  'key cleanup',
  'evidence',
] as const;
export type ReleasePhase = (typeof releasePhases)[number];

export type Diagnostic =
  | { kind: FixedKind }
  | {
      kind: 'release-operator';
      step: ReleasePhase;
      failure:
        | 'exit'
        | 'terminated'
        | 'invalid-output'
        | 'harness-error'
        | 'not-ready'
        | 'mismatch';
      exitCode?: number;
    }
  | {
      kind: 'admin-key';
      reason: AdminKeyReason;
      status?: number;
      shape?: AdminKeyResponseShape;
    }
  | { kind: 'release-step'; step: ReleaseStep }
  | { kind: 'local-backend'; reason: LocalBackendReason; name?: string }
  | { kind: 'preflight'; reason: PreflightReason }
  | { kind: 'workers-range'; cohorts: number }
  | { kind: 'generated-drift'; file: string }
  | { kind: 'results'; suite: Suite }
  | {
      kind: 'write-epoch';
      stage: string;
      read: number;
      now: number;
      outcome: 'write' | 'cleaned' | 'cleanup-failed';
    };

// What an unexpected Write Gate epoch change did to the fixture call that
// found it (`fixtureWrite` in process.ts).
const writeEpochOutcomes = {
  write:
    'the preview was migrated or reopened mid-run, so this worker fails its later fixture writes',
  cleaned: 'the case was cleaned up with the new epoch',
  'cleanup-failed':
    'cleanup with the new epoch also failed, so other tests in its cohort fail the isolation check until the case is reset',
} as const;
const epochText = (epoch: number) =>
  Number.isSafeInteger(epoch) && epoch >= 0
    ? String(epoch)
    : 'an unknown epoch';

// Re-validates every field at print time, so even a mistyped value maps to
// fixed text.
export function describeDiagnostic(diagnostic: Diagnostic): string {
  switch (diagnostic.kind) {
    case 'preflight':
      return `E2E preflight: ${
        (preflightReasons as readonly string[]).includes(diagnostic.reason)
          ? diagnostic.reason
          : 'target validation failed'
      }`;
    case 'workers-range':
      return `E2E workers must be between 1 and the ${
        Number.isSafeInteger(diagnostic.cohorts) && diagnostic.cohorts >= 0
          ? diagnostic.cohorts
          : 'declared number of'
      } declared cohorts`;
    case 'generated-drift': {
      const file =
        diagnostic.file === 'file list' ||
        (generatedFiles as readonly string[]).includes(diagnostic.file)
          ? diagnostic.file
          : 'another generated file';
      return `Convex generated-code drift (${file}); regenerate and review before E2E`;
    }
    case 'results': {
      const suite = suiteSchema.safeParse(diagnostic.suite);
      return `E2E ${
        suite.success ? suiteLabel(suite.data) : 'selected'
      } results are incomplete or unsuccessful`;
    }
    case 'release-operator': {
      const step = (releasePhases as readonly string[]).includes(
        diagnostic.step,
      )
        ? diagnostic.step
        : 'step';
      const { failure, exitCode } = diagnostic;
      const outcome =
        failure === 'exit' &&
        exitCode !== undefined &&
        Number.isInteger(exitCode) &&
        exitCode >= 1 &&
        exitCode <= 255
          ? `refused or failed (exit ${exitCode})`
          : failure === 'invalid-output'
            ? 'invalid output'
            : failure === 'harness-error'
              ? 'harness error'
              : failure === 'not-ready'
                ? 'not ready'
                : failure === 'mismatch'
                  ? 'mismatch'
                  : 'terminated';
      return `catalog release ${step}: ${outcome}`;
    }
    case 'local-backend': {
      const reason = Object.hasOwn(localBackendReasons, diagnostic.reason)
        ? diagnostic.reason
        : 'docker';
      return `${localBackendReasons[reason]}${describeLocalBackendRecovery({
        reason,
        name: diagnostic.name,
      })}`;
    }
    case 'release-step':
      return `Catalog Release qualification failed: ${
        Object.hasOwn(releaseSteps, diagnostic.step)
          ? releaseSteps[diagnostic.step]
          : 'a qualification check failed'
      }`;
    case 'admin-key': {
      const reason = Object.hasOwn(adminKeyReasons, diagnostic.reason)
        ? adminKeyReasons[diagnostic.reason]
        : adminKeyReasons['response-schema'];
      const { status } = diagnostic;
      const statusText =
        diagnostic.reason === 'http' &&
        status !== undefined &&
        Number.isInteger(status) &&
        status >= 100 &&
        status <= 599
          ? ` (HTTP ${status})`
          : '';
      return `E2E preview admin key exchange failed closed: ${reason}${statusText}${describeResponseShape(diagnostic.shape)}`;
    }
    case 'write-epoch': {
      const stage = /^(?:canonical persistence )?fixture [A-Za-z]+$/.test(
        diagnostic.stage,
      )
        ? diagnostic.stage
        : 'a fixture call';
      const outcome = Object.hasOwn(writeEpochOutcomes, diagnostic.outcome)
        ? writeEpochOutcomes[diagnostic.outcome]
        : writeEpochOutcomes.write;
      return `E2E fixture write epoch changed during the session (${stage}: read ${epochText(
        diagnostic.read,
      )}, now ${epochText(diagnostic.now)}); ${outcome}`;
    }
    default:
      return Object.hasOwn(fixedTexts, diagnostic.kind)
        ? fixedTexts[diagnostic.kind]
        : 'E2E harness check failed';
  }
}

export class HarnessFailure extends Error {
  constructor(
    readonly diagnostic: Diagnostic,
    /** The release step it ended, when it ended one (#753). */
    readonly step?: Diagnostic,
    /** A cleanup that also failed (#753). */
    readonly also?: Diagnostic,
  ) {
    super(describeDiagnostic(diagnostic));
    this.name = 'HarnessFailure';
  }
}

/** A harness failure's printed lines: its diagnostic, step and cleanup. */
export function describeHarnessFailure(error: HarnessFailure) {
  return [error.diagnostic, error.step, error.also]
    .filter((diagnostic) => diagnostic !== undefined)
    .map(describeDiagnostic);
}

// A failure that happened while handling another one (for example the
// `stages.log` write after a command failed). The primary error stays the one
// that is thrown; the secondary is only classified when reporting.
const secondaryFailures = new WeakMap<object, unknown>();
export function recordSecondaryFailure(primary: unknown, secondary: unknown) {
  if (typeof primary === 'object' && primary !== null)
    secondaryFailures.set(primary, secondary);
}
export function secondaryFailure(primary: unknown) {
  return typeof primary === 'object' && primary !== null
    ? secondaryFailures.get(primary)
    : undefined;
}
