// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import {
  canonicalPersistenceFixtureCall,
  CommandFailure,
  fixtureCall,
  isolateCases,
  refreshWriteEpoch,
  runSchema,
} from './process';
import { describeDiagnostic, HarnessFailure } from './diagnostics';
import { resources } from './test-data';

// A fake installed Convex CLI. Like the server's Write Gate
// (convex/lib/writeGate.ts), it rejects a fixture write whose `writeEpoch` is
// not the deployment's current epoch; fixture writes never move the epoch.
// Every invocation is appended to `calls` as `<function> <writeEpoch|->`.
const fakeCli = (directory: string) => `const fs = require('node:fs');
const [, name, serialized, ...selection] = process.argv.slice(2);
if (JSON.stringify(selection.slice(0, 3)) !== JSON.stringify(${JSON.stringify(['--preview-name', resources.previewName, '--env-file'])}) || !selection[3].startsWith(${JSON.stringify(directory)}) || selection.length !== 4) process.exit(1);
const args = JSON.parse(serialized);
fs.appendFileSync('calls', name + ' ' + (args.writeEpoch ?? '-') + '\\n');
const epoch = Number(fs.readFileSync('epoch', 'utf8'));
const failing = fs.existsSync('failing') ? fs.readFileSync('failing', 'utf8').split('\\n') : [];
if (failing.includes('kill ' + name)) process.kill(process.pid, 'SIGKILL');
if (failing.includes(name)) process.exit(3);
if (name === 'initialMigration:clientStatus') {
  process.stdout.write(JSON.stringify({ status: 'ready', epoch }));
} else {
  const inspect = ['e2eFixtures:inspectCase', 'e2eFixtures:inspectMoves', 'canonicalPersistenceFixtures:inspect'].includes(name);
  if (inspect ? 'writeEpoch' in args : args.writeEpoch !== epoch) process.exit(2);
  if (!/:(seedIdentityProjection|cleanupCase|loseMembership|close)$/.test(name)) process.stdout.write(JSON.stringify(args));
}`;

const directories: string[] = [];
afterEach(async () => {
  isolateCases([]);
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

// One deployment; each `session()` is a separate worker's view of it (its own
// env file, so its own session, as a separate Playwright worker process is).
async function deployment(epoch: number) {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-fixture-epoch-'));
  directories.push(directory);
  const packageDirectory = join(directory, 'node_modules', 'convex');
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(packageDirectory, 'package.json'),
    JSON.stringify({ name: 'convex', bin: 'fixture.cjs' }),
  );
  await writeFile(join(directory, 'epoch'), String(epoch));
  await writeFile(join(packageDirectory, 'fixture.cjs'), fakeCli(directory));
  let sessions = 0;
  const calls = async () =>
    (await readFile(join(directory, 'calls'), 'utf8').catch(() => ''))
      .split('\n')
      .filter(Boolean);
  const session = async () => {
    const run = runSchema.parse({
      resources,
      workspace: directory,
      sourceRoot: directory,
      privateDirectory: directory,
      artifactDirectory: join(directory, 'artifacts'),
      envFile: join(directory, `convex-${sessions++}.env`),
      baseURL: 'http://127.0.0.1:49123',
    });
    await writeFile(run.envFile, '');
    return run;
  };
  return {
    session,
    moveEpoch: (next: number) =>
      writeFile(join(directory, 'epoch'), String(next)),
    fail: (...names: string[]) =>
      writeFile(join(directory, 'failing'), names.join('\n')),
    calls,
    epochReads: async () =>
      (await calls()).filter((line) =>
        line.startsWith('initialMigration:clientStatus'),
      ).length,
  };
}

const scope = { caseKey: 'smoke' } as const;

it('reads the write epoch once per session and passes it with every fixture write', async () => {
  const target = await deployment(2);
  const run = await target.session();
  isolateCases(['existingMilitia']);
  expect(await fixtureCall(run, 'resetCase', scope)).toEqual({
    caseKey: 'smoke',
    isolatedWith: ['smoke', 'existingMilitia'],
    writeEpoch: 2,
  });
  expect(await fixtureCall(run, 'seedIdentityProjection', {})).toBeNull();
  expect(await fixtureCall(run, 'cleanupCase', scope)).toBeNull();
  expect(await fixtureCall(run, 'loseMembership', {})).toBeNull();
  expect(
    await canonicalPersistenceFixtureCall(run, 'resetAndInitialize', {
      scope,
    }),
  ).toEqual({
    scope,
    isolatedWith: ['smoke', 'existingMilitia'],
    writeEpoch: 2,
  });
  expect(await canonicalPersistenceFixtureCall(run, 'close', {})).toBeNull();
  // Inspections stay read-only: no epoch.
  expect(await fixtureCall(run, 'inspectCase', scope)).toEqual(scope);
  expect(await fixtureCall(run, 'inspectMoves', scope)).toEqual(scope);
  expect(
    await canonicalPersistenceFixtureCall(run, 'inspect', { campaignId: 'c' }),
  ).toEqual({ campaignId: 'c' });
  expect(await target.calls()).toEqual([
    'initialMigration:clientStatus -',
    'e2eFixtures:resetCase 2',
    'e2eFixtures:seedIdentityProjection 2',
    'e2eFixtures:cleanupCase 2',
    'e2eFixtures:loseMembership 2',
    'canonicalPersistenceFixtures:resetAndInitialize 2',
    'canonicalPersistenceFixtures:close 2',
    'e2eFixtures:inspectCase -',
    'e2eFixtures:inspectMoves -',
    'canonicalPersistenceFixtures:inspect -',
  ]);
});

it('shares one epoch read between concurrent first calls and reads again after a failed read', async () => {
  const target = await deployment(4);
  const run = await target.session();
  await target.fail('initialMigration:clientStatus');
  await expect(fixtureCall(run, 'resetCase', scope)).rejects.toBeInstanceOf(
    CommandFailure,
  );
  await target.fail();
  const results = await Promise.all([
    fixtureCall(run, 'resetCase', scope),
    fixtureCall(run, 'seedIdentityProjection', {}),
    canonicalPersistenceFixtureCall(run, 'initialize', {}),
  ]);
  expect(results).toEqual([
    { caseKey: 'smoke', isolatedWith: ['smoke'], writeEpoch: 4 },
    null,
    { writeEpoch: 4 },
  ]);
  expect(await target.epochReads()).toBe(2);
});

it('fails the session clearly when the epoch moves, without retrying the write', async () => {
  const target = await deployment(2);
  const run = await target.session();
  await fixtureCall(run, 'resetCase', scope);
  await target.moveEpoch(5);
  const failure = await fixtureCall(run, 'resetCase', scope).catch(
    (error: unknown) => error,
  );
  expect(failure).toBeInstanceOf(HarnessFailure);
  expect((failure as Error).message).toBe(
    'E2E fixture write epoch changed during the session (fixture resetCase: read 2, now 5); the preview was migrated or reopened mid-run, so this worker fails its later fixture writes',
  );
  // Later writes in the session fail at once, naming their own stage.
  await expect(
    canonicalPersistenceFixtureCall(run, 'initializeUpkeep', {}),
  ).rejects.toThrow(
    'E2E fixture write epoch changed during the session (canonical persistence fixture initializeUpkeep: read 2, now 5)',
  );
  // Inspection still works.
  expect(await fixtureCall(run, 'inspectCase', scope)).toEqual(scope);
  expect(await target.calls()).toEqual([
    'initialMigration:clientStatus -',
    'e2eFixtures:resetCase 2',
    'e2eFixtures:resetCase 2',
    'initialMigration:clientStatus -',
    'e2eFixtures:inspectCase -',
  ]);
});

it('cleans up with the moved epoch once and still fails the attempt clearly', async () => {
  const target = await deployment(2);
  const run = await target.session();
  await fixtureCall(run, 'resetCase', scope);
  await target.moveEpoch(3);
  await expect(fixtureCall(run, 'cleanupCase', scope)).rejects.toThrow(
    'E2E fixture write epoch changed during the session (fixture cleanupCase: read 2, now 3); the case was cleaned up with the new epoch',
  );
  expect((await target.calls()).slice(2)).toEqual([
    'e2eFixtures:cleanupCase 2',
    'initialMigration:clientStatus -',
    'e2eFixtures:cleanupCase 3',
  ]);
  // The session stays failed for writes; a later cleanup uses the new epoch.
  await expect(fixtureCall(run, 'resetCase', scope)).rejects.toThrow(
    'fixture resetCase: read 2, now 3',
  );
  expect(await fixtureCall(run, 'cleanupCase', scope)).toBeNull();
  expect((await target.calls()).slice(5)).toEqual([
    'e2eFixtures:cleanupCase 3',
  ]);
});

it('reports a cleanup that fails again with the moved epoch, after one retry', async () => {
  const target = await deployment(2);
  const run = await target.session();
  await fixtureCall(run, 'resetCase', scope);
  await target.moveEpoch(6);
  await target.fail('e2eFixtures:cleanupCase');
  await expect(fixtureCall(run, 'cleanupCase', scope)).rejects.toThrow(
    'E2E fixture write epoch changed during the session (fixture cleanupCase: read 2, now 6); cleanup with the new epoch also failed, so other tests in its cohort fail the isolation check until the case is reset',
  );
  expect((await target.calls()).slice(2)).toEqual([
    'e2eFixtures:cleanupCase 2',
    'initialMigration:clientStatus -',
    'e2eFixtures:cleanupCase 6',
  ]);
});

it('keeps an ordinary write failure when the epoch has not moved', async () => {
  const target = await deployment(2);
  const run = await target.session();
  await fixtureCall(run, 'resetCase', scope);
  await target.fail('e2eFixtures:cleanupCase', 'e2eFixtures:resetCase');
  for (const operation of ['cleanupCase', 'resetCase'] as const) {
    const failure = await fixtureCall(run, operation, scope).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(CommandFailure);
    expect(failure).toMatchObject({
      stage: `fixture ${operation}`,
      exitCode: 3,
    });
  }
  // The session is still healthy.
  await target.fail();
  expect(await fixtureCall(run, 'resetCase', scope)).toMatchObject({
    writeEpoch: 2,
  });
  expect((await target.calls()).slice(2)).toEqual([
    'e2eFixtures:cleanupCase 2',
    'initialMigration:clientStatus -',
    'e2eFixtures:resetCase 2',
    'initialMigration:clientStatus -',
    'e2eFixtures:resetCase 2',
  ]);
});

it('starts no epoch check after a write ended by a signal', async () => {
  const target = await deployment(2);
  const run = await target.session();
  await fixtureCall(run, 'resetCase', scope);
  await target.moveEpoch(3);
  await target.fail('kill e2eFixtures:cleanupCase');
  const failure = await fixtureCall(run, 'cleanupCase', scope).catch(
    (error: unknown) => error,
  );
  expect(failure).toBeInstanceOf(CommandFailure);
  expect(failure).toMatchObject({ exitCode: null });
  expect(await target.epochReads()).toBe(1);
});

it('adopts an epoch a test changes on purpose when it refreshes explicitly', async () => {
  const target = await deployment(2);
  const run = await target.session();
  await fixtureCall(run, 'resetCase', scope);
  await target.moveEpoch(7);
  expect(await refreshWriteEpoch(run)).toBe(7);
  expect(await fixtureCall(run, 'resetCase', scope)).toMatchObject({
    writeEpoch: 7,
  });
  expect(await fixtureCall(run, 'cleanupCase', scope)).toBeNull();
  // A refresh also clears a session that had seen an unexpected change.
  await target.moveEpoch(8);
  await expect(fixtureCall(run, 'resetCase', scope)).rejects.toThrow(
    'read 7, now 8',
  );
  expect(await refreshWriteEpoch(run)).toBe(8);
  expect(await fixtureCall(run, 'resetCase', scope)).toMatchObject({
    writeEpoch: 8,
  });
});

it('lets every worker clean its own case after the epoch moves under both', async () => {
  const target = await deployment(1);
  const [first, second] = [await target.session(), await target.session()];
  await Promise.all([
    fixtureCall(first, 'resetCase', scope),
    fixtureCall(second, 'resetCase', { caseKey: 'isolation' }),
  ]);
  expect(await target.epochReads()).toBe(2);
  await target.moveEpoch(2);
  const outcomes = await Promise.allSettled([
    fixtureCall(first, 'resetCase', scope).finally(() =>
      fixtureCall(first, 'cleanupCase', scope),
    ),
    fixtureCall(second, 'cleanupCase', { caseKey: 'isolation' }),
  ]);
  expect(
    outcomes.map((outcome) =>
      outcome.status === 'rejected' ? (outcome.reason as Error).message : '',
    ),
  ).toEqual([
    expect.stringContaining('(fixture resetCase: read 1, now 2)'),
    expect.stringContaining(
      '(fixture cleanupCase: read 1, now 2); the case was cleaned up',
    ),
  ]);
  const cleanups = (await target.calls()).filter((line) =>
    line.startsWith('e2eFixtures:cleanupCase'),
  );
  // Both workers' cases end cleaned with the new epoch.
  expect(cleanups.filter((line) => line.endsWith(' 2'))).toHaveLength(2);
});

it('prints only fixed text and validated numbers for an epoch failure', () => {
  expect(
    describeDiagnostic({
      kind: 'write-epoch',
      stage: 'fixture resetCase; token=opaque-secret-value',
      read: 1,
      now: Number.NaN,
      outcome: 'write',
    }),
  ).toBe(
    'E2E fixture write epoch changed during the session (a fixture call: read 1, now an unknown epoch); the preview was migrated or reopened mid-run, so this worker fails its later fixture writes',
  );
});
