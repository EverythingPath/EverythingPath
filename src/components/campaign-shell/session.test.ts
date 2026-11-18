import { describe, expect, test } from 'vitest';
import { classifySession } from './session';

const organization = { id: 'org', name: 'Thursday table' };
// The state a failed Clerk load leaves behind: nothing ever loads.
const unloaded = {
  auth: { isLoaded: false },
  organization: { isLoaded: false },
  convexAuth: { isLoading: true, isAuthenticated: false },
};
const signedInMember = {
  auth: { isLoaded: true, isSignedIn: true },
  organization: { isLoaded: true, organization },
  convexAuth: { isLoading: false, isAuthenticated: true },
};

describe('the session', () => {
  test('is unreachable once sign-in itself failed, even though nothing has loaded', () => {
    expect(classifySession({ clerkStatus: 'error', ...unloaded })).toEqual({
      kind: 'unreachable',
    });
  });

  test('keeps resolving while sign-in is still starting', () => {
    expect(classifySession({ clerkStatus: 'loading', ...unloaded })).toEqual({
      kind: 'resolving',
    });
  });

  test('still settles a member while sign-in runs degraded', () => {
    expect(
      classifySession({ clerkStatus: 'degraded', ...signedInMember }),
    ).toEqual({ kind: 'member', organization });
  });

  test('distinguishes signed out from having no organization', () => {
    expect(
      classifySession({
        clerkStatus: 'ready',
        auth: { isLoaded: true, isSignedIn: false },
        organization: { isLoaded: true, organization: null },
        convexAuth: { isLoading: false, isAuthenticated: false },
      }),
    ).toEqual({ kind: 'signed_out' });
    expect(
      classifySession({
        clerkStatus: 'ready',
        ...signedInMember,
        organization: { isLoaded: true, organization: null },
      }),
    ).toEqual({ kind: 'no_organization' });
  });
});
