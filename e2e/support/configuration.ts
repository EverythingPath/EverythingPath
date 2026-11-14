import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { HarnessFailure } from './diagnostics';
import { validateE2ETargets } from './preflight';

export async function loadTargets(
  resourcesPath: string,
  secretsPath?: string,
  backend: 'preview' | 'local' = 'preview',
) {
  const declaration: unknown = JSON.parse(
    await readFile(resolve(resourcesPath), 'utf8'),
  );
  let secrets: Record<string, string | undefined> = {};
  if (secretsPath) {
    const file = await stat(resolve(secretsPath));
    if (!file.isFile() || (file.mode & 0o777) !== 0o600)
      throw new HarnessFailure({ kind: 'secrets-mode' });
    secrets = parseEnv(await readFile(resolve(secretsPath), 'utf8'));
    for (const key of Object.keys(secrets))
      if (
        ![
          'CLERK_PUBLISHABLE_KEY',
          'CLERK_SECRET_KEY',
          'CONVEX_DEPLOY_KEY',
        ].includes(key)
      )
        throw new HarnessFailure({ kind: 'secrets-keys' });
  }
  return validateE2ETargets(
    { ...process.env, ...secrets },
    declaration,
    backend,
  );
}
