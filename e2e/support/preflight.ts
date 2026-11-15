import {
  convexCloudUrlPattern,
  resourceSchema,
  type Resources,
} from '../fixtures/catalog';
import {
  HarnessFailure,
  inheritedSelectors,
  type PreflightReason,
} from './diagnostics';

export type Environment = Record<string, string | undefined>;
export type SafeTargets = {
  resources: Resources;
  publishableKey: string;
  secretKey: string;
  previewKey: string;
};

/**
 * CI on GitHub Actions, from a trusted event and a non-bot actor, testing
 * the reviewed commit. In CI, preflight refuses anything else; outside it,
 * CI-only options are refused (deadline.ts).
 */
export function isTrustedGitHubRun(environment: Environment) {
  return (
    Boolean(environment.CI) &&
    environment.GITHUB_ACTIONS === 'true' &&
    ['push', 'workflow_dispatch', 'pull_request', 'schedule'].includes(
      environment.GITHUB_EVENT_NAME ?? '',
    ) &&
    !environment.GITHUB_ACTOR?.endsWith('[bot]') &&
    Boolean(environment.GITHUB_SHA) &&
    environment.E2E_REVIEWED_SHA === environment.GITHUB_SHA
  );
}

function reject(reason: PreflightReason): never {
  throw new HarnessFailure({ kind: 'preflight', reason });
}

export function validateE2ETargets(
  environment: Environment,
  declaration: unknown,
  backend: 'preview' | 'local' = 'preview',
): SafeTargets {
  const parsed = resourceSchema.safeParse(declaration);
  if (!parsed.success) reject('invalid resource declaration');
  const resources = parsed.data;
  if (environment.E2E_TRUSTED_EXECUTION !== 'true')
    reject('trusted execution must be explicitly enabled');
  if (environment.CI && !isTrustedGitHubRun(environment))
    reject('CI requires a trusted workflow for the reviewed commit');
  for (const name of inheritedSelectors)
    if (environment[name]) reject(`${name} must not be inherited`);
  const { publishableKey, secretKey } = validateClerkKeys(
    environment,
    resources,
  );
  const previewKey = environment.CONVEX_DEPLOY_KEY ?? '';
  if (backend === 'local' && !previewKey)
    return { resources, publishableKey, secretKey, previewKey: '' };
  if (
    !/^preview:[a-z0-9-]+:[a-z0-9-]+\|[^\s|]+$/.test(previewKey) ||
    !previewKey.startsWith(`preview:${resources.team}:${resources.project}|`)
  ) {
    reject(
      'Convex credential must be a preview creation key for the declared project',
    );
  }
  return {
    resources,
    publishableKey,
    secretKey,
    previewKey: backend === 'local' ? '' : previewKey,
  };
}

// The Clerk part of the preflight: trusted execution, test keys for the
// declared development host, and the production denylist. Test workers
// re-check it before using the secret key; inherited selectors are the
// runner's check, and the harness sets some for its own child processes.
export function validateClerkKeys(
  environment: Environment,
  resources: Resources,
) {
  if (environment.E2E_TRUSTED_EXECUTION !== 'true')
    reject('trusted execution must be explicitly enabled');
  const publishableKey = environment.CLERK_PUBLISHABLE_KEY ?? '';
  const secretKey = environment.CLERK_SECRET_KEY ?? '';
  const encoded = /^pk_test_([A-Za-z0-9+/]+={0,2})$/.exec(publishableKey)?.[1];
  if (
    !encoded ||
    Buffer.from(encoded, 'base64').toString('utf8') !==
      `${resources.clerkHost}$` ||
    Buffer.from(`${resources.clerkHost}$`)
      .toString('base64')
      .replace(/=+$/, '') !== encoded.replace(/=+$/, '')
  ) {
    reject('Clerk publishable key must encode the declared development host');
  }
  if (!/^sk_test_[A-Za-z0-9]+$/.test(secretKey))
    reject('Clerk secret key must be a test key');
  if (
    environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== publishableKey
  ) {
    reject('frontend Clerk key does not match the declared test key');
  }
  if (resources.production.clerkHosts.includes(resources.clerkHost))
    reject('Clerk target is production');
  return { publishableKey, secretKey };
}

// Called inside Convex's --cmd callback; the URL comes from preview creation,
// never from inherited frontend configuration or a guessed deployment hostname.
export function validatePreviewBinding(resources: Resources, url: string) {
  if (
    !convexCloudUrlPattern.test(url) ||
    resources.production.convexUrls.includes(url)
  ) {
    reject('resolved Convex URL is malformed or production');
  }
  return url;
}

export async function runE2EPreflight<T>(
  environment: Environment,
  declaration: unknown,
  firstWrite: (targets: SafeTargets) => T | Promise<T>,
) {
  return await firstWrite(validateE2ETargets(environment, declaration));
}
