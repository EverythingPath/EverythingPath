import { createRequire } from 'node:module';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { convexDeploymentUrlPattern } from '../../scripts/catalog/deployment-url.ts';
import {
  HarnessFailure,
  knownDeploymentTypes,
  type AdminKeyReason,
  type AdminKeyResponseShape,
} from './diagnostics';

/**
 * The preview admin key, obtained once per release-qualification run (#753)
 * through the exchange the installed Convex CLI makes before every
 * `convex run --preview-name` call: `POST /api/deployment/authorize_preview`
 * with the preview deploy key the harness already holds
 * (node_modules/convex/src/cli/lib/api.ts `handlePreview`). Convex doesn't
 * document the endpoint; the owner accepted that for previews only
 * (2026-10-15). Production keys (#413) never come from here.
 *
 * The exchange is pinned to the installed CLI version and fails closed on
 * anything unexpected. No failure carries the key, the deploy key or the
 * response body: every error is a `HarnessFailure` with a fixed reason.
 */
export const pinnedConvexVersion = '1.45.0';
// The CLI's `BIG_BRAIN_URL` without its `CONVEX_PROVISION_HOST` override:
// the harness never takes a provisioning host from its environment.
export const authorizePreviewEndpoint =
  'https://api.convex.dev/api/deployment/authorize_preview';
const exchangeTimeoutMs = 30_000;
const maximumAdminKeyLength = 4096;

export type PreviewDeployment = {
  deploymentName: string;
  deploymentUrl: string;
  adminKey: string;
};

const fail = (
  reason: AdminKeyReason,
  details: { status?: number; shape?: AdminKeyResponseShape } = {},
): never => {
  throw new HarnessFailure({ kind: 'admin-key', reason, ...details });
};

// The fields the CLI's `DeploymentAuthResponse` declares and the operator
// needs. Other fields are ignored and never read.
const responseSchema = z.object({
  deploymentName: z.string().regex(/^[a-z0-9-]+$/),
  adminKey: z
    .string()
    .min(1)
    .max(maximumAdminKeyLength)
    .regex(/^[\x21-\x7e]+$/),
  url: z.string(),
  // The CLI never checks it; absent is accepted, any other type refused.
  deploymentType: z.string().optional(),
});

/** The version of the `convex` package installed for this checkout. */
export async function readInstalledConvexVersion(root: string) {
  const packagePath = createRequire(join(root, 'package.json')).resolve(
    'convex/package.json',
  );
  return z
    .object({ version: z.string() })
    .parse(JSON.parse(await readFile(packagePath, 'utf8'))).version;
}

export async function authorizePreview({
  previewKey,
  previewName,
  expectedUrl,
  installedVersion,
  fetch = globalThis.fetch,
}: {
  previewKey: string;
  previewName: string;
  /** The URL this run's preview creation bound (`run.fixture.convexUrl`). */
  expectedUrl: string;
  installedVersion: string;
  fetch?: typeof globalThis.fetch;
}): Promise<PreviewDeployment> {
  if (installedVersion !== pinnedConvexVersion) fail('cli-version');
  // The CLI's `getTeamAndProjectFromPreviewAdminKey`: preview:<team>:<project>|…
  const slugs = /^preview:([a-z0-9-]+):([a-z0-9-]+)\|[^\s|]+$/.exec(previewKey);
  if (!slugs || !/^e2e-[a-z0-9-]+$/.test(previewName)) fail('preview-key');
  const [, teamSlug, projectSlug] = slugs ?? [];
  let response: Response;
  try {
    response = await fetch(authorizePreviewEndpoint, {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${previewKey}`,
        'Convex-Client': `npm-cli-${pinnedConvexVersion}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        previewName,
        projectSelection: {
          kind: 'teamAndProjectSlugs',
          teamSlug,
          projectSlug,
        },
      }),
      signal: AbortSignal.timeout(exchangeTimeoutMs),
    });
  } catch {
    return fail('request');
  }
  if (response.status !== 200) {
    // Drain without reading: an error body may echo the request.
    await response.body?.cancel().catch(() => undefined);
    return fail('http', { status: response.status });
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return fail('response-json');
  }
  const keys =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? Object.keys(body).sort()
      : [];
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success)
    return fail('response-schema', {
      shape: {
        keys,
        issues: parsed.error.issues.map(
          ({ path, code }) => `${path.join('.') || '(root)'}:${code}`,
        ),
      },
    });
  const { deploymentName, adminKey, url, deploymentType } = parsed.data;
  if (deploymentType !== undefined && deploymentType !== 'preview')
    return fail('response-deployment-type', {
      shape: {
        keys,
        deploymentType: (knownDeploymentTypes as readonly string[]).includes(
          deploymentType,
        )
          ? deploymentType
          : 'other',
      },
    });
  // The binding guarantee: exactly the URL this run's preview creation bound,
  // under the deployment's own name, in the form the operator accepts.
  const host = convexDeploymentUrlPattern.exec(url);
  const isRegional = host?.[2] !== undefined;
  if (url !== expectedUrl || host?.[1] !== deploymentName)
    return fail('response-url', {
      shape: {
        keys,
        url: {
          equal: url === expectedUrl,
          plain: Boolean(host) && !isRegional,
          regional: isRegional,
        },
      },
    });
  return { deploymentName, deploymentUrl: url, adminKey };
}

/** Where a run keeps the key while the operator runs: its private directory. */
export function releaseAdminKeyPath(privateDirectory: string) {
  return join(privateDirectory, 'release-admin.key');
}

/** Writes the key mode 600, refusing to replace a file already there. */
export async function writeAdminKeyFile({
  path,
  adminKey,
}: {
  path: string;
  adminKey: string;
}) {
  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, adminKey, { mode: 0o600, flag: 'wx' });
    if (((await stat(path)).mode & 0o777) !== 0o600) throw new Error('mode');
  } catch {
    throw new HarnessFailure({ kind: 'admin-key-leftover' });
  }
}

/** Deletes the key file, then proves it is gone; safe to call repeatedly. */
export async function removeAdminKeyFile(path: string) {
  try {
    await rm(path, { force: true });
  } catch {
    // Reported below by the absence check.
  }
  try {
    await stat(path);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    )
      return;
  }
  throw new HarnessFailure({ kind: 'admin-key-leftover' });
}
