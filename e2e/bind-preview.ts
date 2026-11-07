import { join } from 'node:path';
import {
  createDeploymentFixture,
  serializeFixtureConfig,
} from './support/capabilities';
import {
  command,
  deploymentArguments,
  loadRun,
  savePrivate,
} from './support/process';
import { validatePreviewBinding } from './support/preflight';
import { isLocalConvexUrl } from '../src/lib/local-convex-url';

const run = await loadRun();
const resolvedUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? '';
const local = run.localDeployment;
if (
  run.backend === 'local' &&
  (!local ||
    !isLocalConvexUrl(resolvedUrl) ||
    resolvedUrl !== local.url ||
    run.resources.production.convexUrls.includes(resolvedUrl))
)
  throw new Error('Local E2E deployment binding refused');
const convexUrl =
  run.backend === 'local'
    ? resolvedUrl
    : validatePreviewBinding(run.resources, resolvedUrl);
// A fresh session and one fresh capability per cohort the run uses.
run.fixture = createDeploymentFixture({
  resources: run.resources,
  convexUrl,
  workers: run.workers,
});
if (run.backend === 'local') run.fixture.localInstance = local!.name;
const settingsFile = join(run.privateDirectory, 'fixture-settings.env');
const fixtureConfigFile = join(run.privateDirectory, 'fixture-config.json');
await savePrivate(fixtureConfigFile, serializeFixtureConfig(run.fixture));
await savePrivate(
  settingsFile,
  [
    'E2E_ENABLED=true',
    `CLERK_FRONTEND_API_URL=https://${run.resources.clerkHost}`,
    ...(run.backend === 'local' ? [`E2E_LOCAL_INSTANCE=${local!.name}`] : []),
  ].join('\n'),
);
await command(
  'bind preview fixture environment',
  [
    'exec',
    'convex',
    'env',
    'set',
    '--from-file',
    settingsFile,
    '--force',
    ...deploymentArguments(run),
  ],
  { cwd: run.workspace },
);
await command(
  'bind preview fixture capabilities',
  [
    'exec',
    'convex',
    'env',
    'set',
    'E2E_FIXTURE_CONFIG',
    '--from-file',
    fixtureConfigFile,
    ...deploymentArguments(run),
  ],
  { cwd: run.workspace },
);
await savePrivate(process.env.E2E_RUN_FILE!, JSON.stringify(run));
// A reused environment (#754) is deployed and built already: it only gets
// this run's session and capabilities.
if (!process.argv.includes('--bind-only'))
  await command('production web build', ['build:web'], {
    cwd: run.workspace,
    timeoutMs: 480_000,
  });
