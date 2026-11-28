import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { verifyClerkApplication } from '../../e2e/support/clerk';

/**
 * The environment local development runs with (`pnpm dev`, `pnpm
 * dev:trial`): the shell's, then `.env` and `.env.local`, which must hold
 * Clerk development keys for a reachable application. Every `CONVEX_*`
 * variable is blanked, so no deployment selector or override is inherited;
 * the backend's URL and key come only from its start.
 */
export async function readDevelopmentEnvironment() {
  const environment = { ...process.env };
  for (const file of ['.env', '.env.local']) {
    const contents = await readFile(file, 'utf8').catch((error: unknown) => {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      )
        return '';
      throw error;
    });
    Object.assign(environment, parseEnv(contents));
  }
  const publishableKey = environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
  const secretKey = environment.CLERK_SECRET_KEY ?? '';
  const clerkHost = Buffer.from(
    publishableKey.slice('pk_test_'.length),
    'base64',
  )
    .toString('utf8')
    .replace(/\$$/, '');
  if (
    !publishableKey.startsWith('pk_test_') ||
    !secretKey.startsWith('sk_test_') ||
    !/^[a-z0-9-]+\.clerk\.accounts\.dev$/.test(clerkHost)
  )
    throw new Error(
      'Local development requires Clerk development keys in .env or .env.local',
    );
  await verifyClerkApplication({ resources: { clerkHost }, secretKey });
  // Never inherit a deployment selector or override from a shell or .env file.
  for (const key of Object.keys(environment))
    if (key.startsWith('CONVEX_')) environment[key] = '';
  delete environment.E2E_RUN_FILE;
  return { environment, secretKey, clerkHost };
}
