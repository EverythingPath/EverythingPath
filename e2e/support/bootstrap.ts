import { z } from 'zod';
import { resourceSchema, roleKeys, type Resources } from '../fixtures/catalog';
import { verifyClerkApplication, verifyClerkCohorts } from './clerk';
import { validateE2ETargets, type Environment } from './preflight';

export type ClerkRequest = (
  path: string,
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body?: Record<string, unknown>,
) => Promise<unknown>;

export function clerkRequest(secret: string): ClerkRequest {
  return async (path, method = 'GET', body) => {
    const response = await fetch(`https://api.clerk.com/v1${path}`, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 404 && method === 'GET') return null;
    if (!response.ok) throw new Error('E2E bootstrap Clerk request failed');
    return (await response.json()) as unknown;
  };
}

const objectId = z.object({
  id: z.string().regex(/^(user|org)_[a-zA-Z0-9]+$/),
});
const userSchema = objectId.extend({
  email_addresses: z.array(z.object({ email_address: z.string() })),
});
const membershipSchema = z.object({
  data: z.array(z.object({ role: z.string(), organization: objectId })),
  total_count: z.number(),
});

// The declaration is the explicit scope of repair. It must name synthetic test
// users; an ID/email mismatch is never repaired by altering the unrelated user.
export async function provisionCohort(
  environment: Environment,
  declaration: unknown,
  bootstrap: boolean,
  request?: ClerkRequest,
  readPublic: (url: string) => Promise<unknown> = async (url) => {
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      throw new Error('E2E bootstrap public key verification failed');
    return (await response.json()) as unknown;
  },
): Promise<Resources> {
  const targets = validateE2ETargets(environment, declaration);
  const api = request ?? clerkRequest(targets.secretKey);
  const get = (url: string) =>
    url.startsWith('https://api.clerk.com/v1/')
      ? api(url.slice('https://api.clerk.com/v1'.length))
      : readPublic(url);
  if (!bootstrap) {
    await verifyClerkCohorts(targets, get);
    return targets.resources;
  }
  if (environment.CI) throw new Error('E2E bootstrap is local-only');
  await verifyClerkApplication(targets, get);
  const resources = structuredClone(targets.resources);
  for (const worker of resources.workers) {
    for (const role of roleKeys) {
      const identity = worker[role];
      if (!identity.email.split('@')[0]?.endsWith('+clerk_test'))
        throw new Error(
          'E2E bootstrap requires synthetic +clerk_test addresses',
        );
      const existing = await api(`/users/${identity.userId}`);
      if (existing !== null) {
        const user = userSchema.parse(existing);
        if (
          user.id !== identity.userId ||
          !user.email_addresses.some(
            (entry) =>
              entry.email_address.toLowerCase() ===
              identity.email.toLowerCase(),
          )
        )
          throw new Error('E2E bootstrap refuses an ID/email mismatch');
      }
    }
  }
  for (const worker of resources.workers) {
    for (const role of roleKeys) {
      const identity = worker[role];
      if ((await api(`/users/${identity.userId}`)) !== null) continue;
      const matches = z
        .array(userSchema)
        .parse(
          await api(
            `/users?email_address=${encodeURIComponent(identity.email)}&limit=2`,
          ),
        );
      if (matches.length > 1)
        throw new Error('E2E bootstrap found ambiguous users');
      const user =
        matches[0] ??
        userSchema.parse(
          await api('/users', 'POST', {
            email_address: [identity.email],
            skip_password_requirement: true,
          }),
        );
      if (
        !user.email_addresses.some(
          (entry) =>
            entry.email_address.toLowerCase() === identity.email.toLowerCase(),
        )
      )
        throw new Error('E2E bootstrap refuses an email mismatch');
      identity.userId = user.id;
    }
    for (const field of ['organizationId', 'outsiderOrganizationId'] as const) {
      if ((await api(`/organizations/${worker[field]}`)) !== null) continue;
      const marker = `everythingpath-e2e:${resources.project}:${worker.key}:${field}`;
      // Metadata lookup also recovers a successful creation whose response or
      // local output was lost. Slugs are optional in newer Clerk applications.
      const organizations = [];
      for (let offset = 0; ; offset += 100) {
        const page = z
          .object({
            data: z.array(
              objectId.extend({
                private_metadata: z.record(z.string(), z.unknown()),
              }),
            ),
            total_count: z.number(),
          })
          .parse(await api(`/organizations?limit=100&offset=${offset}`));
        organizations.push(
          ...page.data.filter(
            (org) => org.private_metadata.e2e_cohort === marker,
          ),
        );
        if (offset + page.data.length >= page.total_count) break;
        if (!page.data.length)
          throw new Error('E2E bootstrap organization pagination failed');
      }
      if (organizations.length > 1)
        throw new Error('E2E bootstrap found ambiguous organizations');
      worker[field] = (
        organizations[0] ??
        objectId.parse(
          await api('/organizations', 'POST', {
            name: `E2E ${resources.project} ${worker.key} ${field === 'organizationId' ? 'members' : 'outsiders'}`,
            private_metadata: { e2e_cohort: marker },
          }),
        )
      ).id;
    }
    for (const role of roleKeys) {
      const userId = worker[role].userId;
      const expectedOrg =
        role === 'outsider'
          ? worker.outsiderOrganizationId
          : worker.organizationId;
      const expectedRole = role === 'gm' ? 'org:admin' : 'org:member';
      const memberships = membershipSchema.parse(
        await api(`/users/${userId}/organization_memberships?limit=100`),
      );
      if (memberships.total_count !== memberships.data.length)
        throw new Error('E2E bootstrap refuses truncated memberships');
      // Repair only the declared organizations. Unexpected memberships need
      // manual adjudication, rather than deleting access to an unrelated org.
      if (
        memberships.data.some(
          (entry) =>
            ![worker.organizationId, worker.outsiderOrganizationId].includes(
              entry.organization.id,
            ),
        )
      )
        throw new Error(
          'E2E bootstrap refuses memberships outside the declared cohort',
        );
      const expected = memberships.data.find(
        (entry) => entry.organization.id === expectedOrg,
      );
      if (!expected)
        await api(`/organizations/${expectedOrg}/memberships`, 'POST', {
          user_id: userId,
          role: expectedRole,
        });
      else if (expected.role !== expectedRole)
        await api(
          `/organizations/${expectedOrg}/memberships/${userId}`,
          'PATCH',
          { role: expectedRole },
        );
      for (const entry of memberships.data)
        if (entry.organization.id !== expectedOrg)
          await api(
            `/organizations/${entry.organization.id}/memberships/${userId}`,
            'DELETE',
          );
    }
  }
  const result = resourceSchema.parse(resources);
  await verifyClerkCohorts({ ...targets, resources: result }, get);
  return result;
}
