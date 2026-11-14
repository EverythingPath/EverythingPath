import { z } from 'zod';
import type { BrowserContext } from '@playwright/test';
import type { Resources } from '../fixtures/catalog';
import { verifyClerkApplication, type ClerkTargets } from './clerk';
import { validateClerkKeys, type Environment } from './preflight';

// Gives a role context a current session token before its first page load,
// so Clerk's development middleware never sends the document through its
// cross-site handshake (see the README, #187). Errors name only the guard
// that failed, never a key, token or cookie value.

type Context = Pick<BrowserContext, 'cookies' | 'addCookies'>;
type Post = (url: string, secretKey: string) => Promise<unknown>;
type Verify = (targets: ClerkTargets) => Promise<void>;
type Claims = z.infer<typeof claimsSchema>;

function refuse(reason: string): never {
  throw new Error(`E2E session refresh: ${reason}`);
}

// Network and body failures are replaced by the guard's own message, so no
// provider text reaches the test error.
const postToClerk: Post = async (url, secretKey) => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (response.ok) return (await response.json()) as unknown;
  } catch {
    // Reported below without the provider's message.
  }
  return refuse('Clerk did not issue a session token');
};

const claimsSchema = z.object({
  iss: z.string(),
  sub: z.string(),
  sid: z.string().regex(/^sess_[A-Za-z0-9]+$/),
  exp: z.number(),
});
function readClaims(token: string): Claims {
  const [, payload, signature] = token.split('.');
  if (payload === undefined || signature === undefined)
    refuse('session token is malformed');
  try {
    return claimsSchema.parse(
      JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')),
    );
  } catch {
    return refuse('session token is malformed');
  }
}

// The application check (development instance, matching key pair) runs once
// per worker; the key validation and denylist run on every call.
const verified = new Map<string, Promise<void>>();
function verifyOnce(targets: ClerkTargets, verify: Verify) {
  const key = targets.resources.clerkHost;
  let pending = verified.get(key);
  if (!pending) {
    pending = verify(targets);
    pending.catch(() => verified.delete(key));
    verified.set(key, pending);
  }
  return pending;
}

// Test seam: forget which applications this worker has verified.
export function forgetVerifiedApplications() {
  verified.clear();
}

type Role = { issuer: string; userId: string; sid: string };
function belongsToRole(claims: Claims, role: Role) {
  return (
    claims.iss === role.issuer &&
    claims.sub === role.userId &&
    claims.sid === role.sid
  );
}

// The role's session cookies, all carrying one session of this role.
async function storedSession(
  context: Context,
  { host, issuer, userId }: { host: string; issuer: string; userId: string },
) {
  const cookies = (await context.cookies()).filter(
    ({ name }) => name === '__session' || name.startsWith('__session_'),
  );
  const [first] = cookies;
  if (!first) refuse('stored role has no session');
  if (cookies.some((cookie) => cookie.domain !== host))
    refuse('stored session belongs to another host');
  const role = { issuer, userId, sid: readClaims(first.value).sid };
  if (cookies.some(({ value }) => !belongsToRole(readClaims(value), role)))
    refuse('stored session does not belong to this role');
  return { cookies, role };
}

export async function refreshSessionToken(
  context: Context,
  {
    resources,
    baseURL,
    userId,
    environment = process.env,
    verify = verifyClerkApplication,
    request = postToClerk,
    now = () => Date.now() / 1000,
  }: {
    resources: Resources;
    baseURL: string;
    userId: string;
    environment?: Environment;
    verify?: Verify;
    request?: Post;
    now?: () => number;
  },
) {
  const targets = { resources, ...validateClerkKeys(environment, resources) };
  await verifyOnce(targets, verify);
  const { cookies, role } = await storedSession(context, {
    host: new URL(baseURL).hostname,
    issuer: `https://${resources.clerkHost}`,
    userId,
  });
  const issued = z
    .object({ jwt: z.string() })
    .safeParse(
      await request(
        `https://api.clerk.com/v1/sessions/${role.sid}/tokens`,
        targets.secretKey,
      ),
    );
  if (!issued.success) refuse('Clerk did not issue a session token');
  const claims = readClaims(issued.data.jwt);
  if (!belongsToRole(claims, role) || claims.exp <= now())
    refuse('issued session token does not match this role');
  await context.addCookies(
    cookies.map((cookie) => ({ ...cookie, value: issued.data.jwt })),
  );
}
