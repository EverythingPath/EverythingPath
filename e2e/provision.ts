import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { provisionCohort } from './support/bootstrap';
import { loadTargets } from './support/configuration';

try {
  const { values } = parseArgs({
    options: {
      resources: { type: 'string' },
      secrets: { type: 'string' },
      bootstrap: { type: 'boolean', default: false },
    },
    strict: true,
  });
  if (!values.resources) throw new Error('Resource declaration required');
  const targets = await loadTargets(values.resources, values.secrets);
  await mkdir('e2e/.private', { recursive: true, mode: 0o700 });
  const lock = 'e2e/.private/clerk-bootstrap.lock';
  await mkdir(lock);
  try {
    const resources = await provisionCohort(
      {
        ...process.env,
        CLERK_PUBLISHABLE_KEY: targets.publishableKey,
        CLERK_SECRET_KEY: targets.secretKey,
        CONVEX_DEPLOY_KEY: targets.previewKey,
      },
      targets.resources,
      values.bootstrap,
    );
    if (values.bootstrap) {
      const output = resolve(values.resources);
      const temporary = `${output}.bootstrap-${process.pid}`;
      try {
        await writeFile(temporary, `${JSON.stringify(resources, null, 2)}\n`, {
          flag: 'wx',
          mode: 0o600,
        });
        await rename(temporary, output);
      } finally {
        await rm(temporary, { force: true });
      }
    }
    process.stdout.write(
      values.bootstrap
        ? 'E2E bootstrap complete; declaration updated and cohort verified.\n'
        : 'E2E cohort verified without service writes.\n',
    );
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
} catch {
  // Never print provider errors, response bodies, keys, or authentication state.
  process.stderr.write(
    'E2E provisioning failed; check targets, mode-600 secrets, fixture identity and membership drift.\n',
  );
  process.exitCode = 1;
}
