import { z } from 'zod';
import { roleKeys } from '../fixtures/catalog';
import { HarnessFailure } from './diagnostics';
import type { SafeTargets } from './preflight';

type ReadJson = (url: string, secret?: string) => Promise<unknown>;
const readJson: ReadJson = async (url, secret) => {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
  if (!response.ok) throw new HarnessFailure({ kind: 'clerk-request' });
  return (await response.json()) as unknown;
};
const jwks = z.object({
  keys: z
    .array(
      z.object({
        kid: z.string(),
        kty: z.string(),
        n: z.string(),
        e: z.string(),
      }),
    )
    .min(1),
});

// What the application check needs: the declaration and the secret key.
export type ClerkTargets = {
  resources: Pick<SafeTargets['resources'], 'clerkHost'>;
  secretKey: string;
};

export async function verifyClerkApplication(
  targets: ClerkTargets,
  get: ReadJson = readJson,
) {
  const { resources, secretKey } = targets;
  const instance = z
    .object({ environment_type: z.literal('development') })
    .safeParse(await get('https://api.clerk.com/v1/instance', secretKey));
  if (!instance.success) throw new HarnessFailure({ kind: 'clerk-instance' });
  const publicKeys = jwks.parse(
    await get(`https://${resources.clerkHost}/.well-known/jwks.json`),
  );
  const privateKeys = jwks.parse(
    await get('https://api.clerk.com/v1/jwks', secretKey),
  );
  if (
    !publicKeys.keys.some((publicKey) =>
      privateKeys.keys.some(
        (key) =>
          key.kid === publicKey.kid &&
          key.n === publicKey.n &&
          key.e === publicKey.e,
      ),
    )
  ) {
    throw new HarnessFailure({ kind: 'clerk-keys' });
  }
}

export async function verifyClerkCohorts(
  targets: SafeTargets,
  get: ReadJson = readJson,
) {
  await verifyClerkApplication(targets, get);
  const { resources, secretKey } = targets;
  for (const worker of resources.workers) {
    for (const role of roleKeys) {
      const identity = worker[role];
      const user = z
        .object({
          id: z.string(),
          email_addresses: z.array(z.object({ email_address: z.string() })),
        })
        .parse(
          await get(
            `https://api.clerk.com/v1/users/${identity.userId}`,
            secretKey,
          ),
        );
      if (
        user.id !== identity.userId ||
        !user.email_addresses.some(
          (email) =>
            email.email_address.toLowerCase() === identity.email.toLowerCase(),
        )
      )
        throw new HarnessFailure({ kind: 'clerk-identity' });
      const memberships = z
        .object({
          data: z.array(
            z.object({
              role: z.string(),
              organization: z.object({ id: z.string() }),
            }),
          ),
          total_count: z.number(),
        })
        .parse(
          await get(
            `https://api.clerk.com/v1/users/${identity.userId}/organization_memberships?limit=100`,
            secretKey,
          ),
        );
      const expectedOrg =
        role === 'outsider'
          ? worker.outsiderOrganizationId
          : worker.organizationId;
      // Persistent test users have exactly the declared membership. Drift must be
      // repaired in the separate resource bootstrap, never during a normal run.
      if (
        memberships.total_count !== 1 ||
        memberships.data.length !== 1 ||
        memberships.data[0]?.organization.id !== expectedOrg ||
        memberships.data[0].role !==
          (role === 'gm' ? 'org:admin' : 'org:member')
      )
        throw new HarnessFailure({ kind: 'clerk-membership' });
    }
  }
}
