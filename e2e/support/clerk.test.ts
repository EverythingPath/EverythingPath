// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { verifyClerkCohorts } from './clerk';
import { resources, safeEnvironment } from './test-data';
import { validateE2ETargets } from './preflight';

const targets = validateE2ETargets(safeEnvironment, resources);
const publicKeys = {
  keys: [{ kid: 'test-key', kty: 'RSA', n: 'modulus', e: 'AQAB' }],
};
async function get(url: string): Promise<unknown> {
  if (url.endsWith('/instance')) return { environment_type: 'development' };
  if (url.includes('jwks')) return publicKeys;
  for (const role of ['gm', 'player', 'outsider'] as const) {
    const identity = resources.workers[0]![role];
    if (!url.includes(`/users/${identity.userId}`)) continue;
    if (url.includes('organization_memberships'))
      return {
        total_count: 1,
        data: [
          {
            role: role === 'gm' ? 'org:admin' : 'org:member',
            organization: {
              id: role === 'outsider' ? 'org_outsiders' : 'org_members',
            },
          },
        ],
      };
    return {
      id: identity.userId,
      email_addresses: [{ email_address: identity.email }],
    };
  }
  throw new Error('Unexpected read');
}
describe('read-only Clerk cohort verification', () => {
  it('verifies the development instance, matching keys, role identities and memberships', async () => {
    const read = vi.fn(get);
    await expect(verifyClerkCohorts(targets, read)).resolves.toBeUndefined();
    expect(read.mock.calls.every(([url]) => url.startsWith('https://'))).toBe(
      true,
    );
  });
  it.each(['production', 'key mismatch', 'membership drift', 'identity drift'])(
    'refuses %s',
    async (kind) => {
      await expect(
        verifyClerkCohorts(targets, async (url) => {
          if (kind === 'production' && url.endsWith('/instance'))
            return { environment_type: 'production' };
          if (kind === 'key mismatch' && url.includes('/v1/jwks'))
            return {
              keys: [{ kid: 'other', kty: 'RSA', n: 'other', e: 'AQAB' }],
            };
          if (
            kind === 'membership drift' &&
            url.includes('organization_memberships')
          )
            return { total_count: 0, data: [] };
          if (kind === 'identity drift' && url.endsWith('/users/user_gm'))
            return { id: 'user_wrong', email_addresses: [] };
          return await get(url);
        }),
      ).rejects.toThrow();
    },
  );
});
