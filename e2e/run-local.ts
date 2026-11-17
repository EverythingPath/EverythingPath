import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runAndReport } from './support/runner';

// Keep credentials outside the checkout's source snapshot and never in /tmp.
process.env.TMPDIR = resolve('..', '.ep-tmp', 'local-e2e');
await mkdir(process.env.TMPDIR, { recursive: true, mode: 0o700 });
process.exitCode = await runAndReport([
  '--resources',
  'e2e/.private/resources.json',
  '--secrets',
  'e2e/.private/test-secrets.env',
  ...process.argv.slice(2),
  '--backend',
  'local',
]);
