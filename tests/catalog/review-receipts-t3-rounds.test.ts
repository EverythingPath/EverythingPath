// @vitest-environment node
import {
  chmod,
  cp,
  mkdir,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCuration } from '../../scripts/catalog/curation';
import ledgerData from '../../scripts/catalog/everythingpath-identities.json';
import {
  hashReport,
  reviewReportsDirectory,
} from '../../scripts/catalog/review-receipts';
import { listStructureReviews } from '../../scripts/catalog/structure-curation';
import { repo, p6Ids, recordStepHarness } from './review-receipts-harness';

/**
 * The record step command on T3 review rounds: capture, bind and --t3-run
 * at the CLI, and every record-time refusal of a changed or foreign round.
 */
describe('the record step command (catalog-record-review.ts)', () => {
  const {
    run,
    commandIn,
    command,
    writeIds,
    t3Checkout,
    t3Round,
    completedT3Fixture,
    snapshotTree,
    mixedCuration,
  } = recordStepHarness();
  it('rejects imported same-selection T3 dispatch at the CLI before creating binding artifacts', async () => {
    const { root, stage, dispatch } = await t3Checkout();
    const before = await snapshotTree(root);
    await expect(
      command('--bind-t3', stage, '--dispatch', dispatch),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('request/task correlation'),
    });
    expect(await snapshotTree(root)).toEqual(before);
  });
  it('rejects an earlier unchanged real #762 completion at initial CLI binding', async () => {
    const { root, stage, dispatch } = await t3Checkout();
    const earlier = JSON.parse(
      await readFile(
        new URL(
          '../fixtures/review-766/earlier-762-spec.json',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    await writeFile(dispatch, JSON.stringify(earlier.result));
    const before = await snapshotTree(root);
    await expect(
      command('--bind-t3', stage, '--dispatch', dispatch),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('request/task correlation'),
    });
    expect(await snapshotTree(root)).toEqual(before);
  });
  it.each([
    {
      name: 'foreign running task',
      change: { status: 'running', workState: 'working' },
    },
    {
      name: 'caller-asserted request/task identity',
      change: { clientRequestId: 'synthetic-766' },
    },
  ])(
    'rejects $name at initial CLI binding without writes',
    async ({ change }) => {
      const { root, stage, dispatch } = await t3Checkout();
      const earlier = JSON.parse(
        await readFile(
          new URL(
            '../fixtures/review-766/earlier-762-spec.json',
            import.meta.url,
          ),
          'utf8',
        ),
      );
      await writeFile(
        dispatch,
        JSON.stringify({ ...earlier.result, ...change }),
      );
      const before = await snapshotTree(root);
      await expect(
        command('--bind-t3', stage, '--dispatch', dispatch),
      ).rejects.toMatchObject({
        stderr: expect.stringContaining('request/task correlation'),
      });
      expect(await snapshotTree(root)).toEqual(before);
    },
  );
  it('refuses a previously completed uncorrelated v1 chain through CLI record and verify', async () => {
    const { root, stage, dispatch, ids } = await t3Checkout();
    // Reconstruct the earlier local v1 format in a throwaway repository only.
    // This is negative evidence: no claim of dispatch or review execution.
    const inputsSha256 = hashReport(await readFile(join(stage, 'inputs.json')));
    const binding = Buffer.from(
      JSON.stringify({
        capturedAt: new Date().toISOString(),
        inputsSha256,
        response: JSON.parse(await readFile(dispatch, 'utf8')),
      }),
    );
    const status = await readFile(dispatch);
    const report = Buffer.from('Uncorrelated fixture report');
    const completion = Buffer.from(
      JSON.stringify({
        kind: 't3-review-completed-v1',
        capturedAt: new Date().toISOString(),
        inputsSha256,
        dispatchSha256: hashReport(binding),
        statusSha256: hashReport(status),
        reportSha256: hashReport(report),
      }),
    );
    for (const [name, bytes] of [
      ['dispatch.json', binding],
      ['status.json', status],
      ['report.snapshot.md', report],
      ['completed.json', completion],
    ] as const) {
      await writeFile(join(stage, name), bytes);
      await chmod(join(stage, name), 0o444);
    }
    const before = await snapshotTree(root);
    await expect(
      command('--t3-run', stage, '--ids', ids, '--root', root),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('request/task correlation'),
    });
    expect(await snapshotTree(root)).toEqual(before);
    const runId = `t3-review-${inputsSha256}`;
    const destination = join(root, 'runs', runId);
    await cp(stage, destination, { recursive: true });
    const inputs = JSON.parse(
      await readFile(join(stage, 'inputs.json'), 'utf8'),
    );
    const seen = JSON.parse(
      await readFile(join(stage, 'reviewed-records.json'), 'utf8'),
    );
    await writeFile(
      join(root, 'scripts/catalog/review-receipts.json'),
      JSON.stringify({
        receipts: [
          {
            runId,
            reportSha256: hashReport(report),
            covers: seen,
            evidence: {
              kind: 't3',
              sha256: hashReport(completion),
              reviewedCommit: inputs.reviewedCommit,
            },
          },
        ],
      }),
    );
    await mkdir(join(root, reviewReportsDirectory), { recursive: true });
    await writeFile(join(root, reviewReportsDirectory, `${runId}.md`), report);
    const verifyBefore = await snapshotTree(root);
    await expect(
      command('--verify', '--root', root, '--runs', join(root, 'runs')),
    ).rejects.toMatchObject({
      stdout: expect.stringContaining('request/task correlation'),
    });
    expect(await snapshotTree(root)).toEqual(verifyBefore);
  });
  it('captures a separate clean fixture checkout with actual-caller tool observations through code mode', async () => {
    const { root, stage, config } = await t3Checkout();
    const { syntheticTools } = await import('./t3-code-mode-fixture');
    const { runT3ReviewCodeMode } =
      await import('../../scripts/catalog/t3-review-code-mode');
    const adapter = await syntheticTools({ dir: stage });
    const second = join(root, 'runs/second-capture');
    await runT3ReviewCodeMode({
      tools: adapter.tools,
      root: repo,
      reviewedRoot: root,
      dir: second,
      config,
      operation: 'capture',
    });
    const captured = JSON.parse(
      await readFile(join(second, 'inputs.json'), 'utf8'),
    );
    expect(captured.caller.threadId).toBe('synthetic:parent');
    expect(captured.reviewedCommit).toBe(
      (await run('git', ['-C', root, 'rev-parse', 'HEAD'])).stdout.trim(),
    );
    expect(captured.nonce).not.toBe(
      JSON.parse(await readFile(join(stage, 'inputs.json'), 'utf8')).nonce,
    );
  });
  it(
    'promotes a disposable T3 mixed selection with a byte-identical committed report and verifies after review-input cleanup',
    { timeout: t3Round },
    async () => {
      const curation = mixedCuration();
      const { root, archived, fullReport, runId } = await completedT3Fixture({
        curation,
      });
      const structures = listStructureReviews(
        parseCuration(curation).structures ?? [],
      ).map(({ id }) => id);
      await command(
        '--t3-run',
        archived,
        '--ids',
        await writeIds(root, [...p6Ids(), ...structures]),
        '--root',
        root,
      );
      expect(
        await readFile(join(root, reviewReportsDirectory, `${runId}.md`)),
      ).toEqual(fullReport);
      expect(
        parseCuration(
          JSON.parse(
            await readFile(
              join(root, 'scripts/catalog/reviewed-curation.json'),
              'utf8',
            ),
          ),
        ).structures?.[0]?.status,
      ).toBe('checked');
      await run('git', ['-C', root, 'add', '-f', 'scripts']);
      await run('git', [
        '-C',
        root,
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.test',
        'commit',
        '-qm',
        'Fixture promotion with immutable report copy',
      ]);
      expect(
        (
          await run('git', [
            '-C',
            root,
            'show',
            `HEAD:${reviewReportsDirectory}/${runId}.md`,
          ])
        ).stdout,
      ).toBe(fullReport.toString('utf8'));
      await rm(join(root, 'issue.json'));
      await rm(join(root, 'config.json'));
      await rm(join(root, 'full-review.md'));
      // Review input originals are gone; only durable captured copies are needed.
      expect(await readFile(join(archived, 'input-0'), 'utf8')).toContain(
        'Synthetic fixture',
      );
      await expect(
        command('--verify', '--root', root, '--runs', join(root, 'runs')),
      ).resolves.toMatchObject({
        stdout: expect.stringContaining('1 receipts verified.'),
      });
    },
  );
  // Fix r9, root's correction of fix r8: --t3-run started under tsx alone,
  // its disk cache on, records as on the base, and --verify then verifies in
  // both forms.
  it(
    'records a T3 round with --t3-run under tsx alone, its disk cache on, as on the base',
    { timeout: t3Round },
    async () => {
      const curation = mixedCuration();
      const { root, archived, runId } = await completedT3Fixture({ curation });
      const structures = listStructureReviews(
        parseCuration(curation).structures ?? [],
      ).map(({ id }) => id);
      const ids = [...p6Ids(), ...structures];
      const recorded = await commandIn('tsx', [
        '--t3-run',
        archived,
        '--ids',
        await writeIds(root, ids),
        '--root',
        root,
      ]);
      expect(recorded.stderr).toBe('');
      expect(recorded.stdout).toMatch(
        new RegExp(
          `^Recorded ${runId} \\(report sha256:[0-9a-f]{12}\\) as the receipt of ${ids.length} records\\.\\n$`,
        ),
      );
      const gate = ['--verify', '--root', root, '--runs', join(root, 'runs')];
      for (const form of ['tsx', 'launcher'] as const)
        await expect(commandIn(form, gate)).resolves.toMatchObject({
          stdout: '1 receipts verified.\n',
          stderr: '',
        });
    },
  );
  it(
    'rejects formatter-invalid T3 mixed promotion with every byte and directory unchanged',
    { timeout: t3Round },
    async () => {
      const curation = mixedCuration({ duplicateAlias: true });
      const { root, archived } = await completedT3Fixture({ curation });
      const structures = listStructureReviews(
        parseCuration(curation).structures ?? [],
      ).map(({ id }) => id);
      const ids = await writeIds(root, [...p6Ids(), ...structures]);
      const before = await snapshotTree(root);
      await expect(
        command('--t3-run', archived, '--ids', ids, '--root', root),
      ).rejects.toMatchObject({
        stderr: expect.stringContaining('Situation alias'),
      });
      expect(await snapshotTree(root)).toEqual(before);
    },
  );
  // Fix r12, both axes: --t3-run checks the run ID against the archive
  // entry's name as supplied, as on the base, and reads the directory that
  // entry resolves to: a correctly named link to a differently named
  // directory records, a wrongly named link to a correctly named one is
  // refused, and a plain directory is judged by its name as before.
  it.each([
    { entry: 'a link named for its run', named: true, link: true },
    { entry: 'a link named otherwise', named: false, link: true },
    { entry: 'a directory named for its run', named: true, link: false },
    { entry: 'a directory named otherwise', named: false, link: false },
  ])(
    'checks the run ID of $entry by the name supplied',
    async ({ named, link }) => {
      const { root, archived, runId, ids } = await completedT3Fixture();
      const entry = named ? archived : join(root, 'runs', 'misnamed');
      if (link) {
        // The directory itself named otherwise than the entry.
        const target = join(root, 'kept', named ? 'moved' : runId);
        await mkdir(join(root, 'kept'));
        await rename(archived, target);
        await symlink(target, entry);
      } else if (!named) await rename(archived, entry);
      const recording = command(
        '--t3-run',
        entry,
        '--ids',
        ids,
        '--root',
        root,
      );
      if (named)
        await expect(recording).resolves.toMatchObject({
          stdout: expect.stringContaining(`Recorded ${runId} `),
        });
      else
        await expect(recording).rejects.toMatchObject({
          stderr: `${entry} holds run ${runId}.\n`,
        });
    },
    t3Round,
  );
  /** A drafted copy of the ledger with one separate-identity pair changed. */
  const changeLedger = async (root: string, problem: string) => {
    const ledger = structuredClone(ledgerData);
    for (const decision of ledger.variantDecisions) {
      const { rationale, evidence } = decision.review;
      Object.assign(decision, {
        review: { status: 'drafted', rationale, evidence },
      });
    }
    const decision = ledger.variantDecisions.find(
      (value) => value.decision === 'separate-identities',
    );
    if (decision?.decision !== 'separate-identities')
      throw new Error('Missing separate-identity fixture');
    const [first, second] = decision.identities;
    if (!first || !second) throw new Error('Missing bound source fixture');
    if (problem === 'changed source') first.sourceSha256 = 'f'.repeat(64);
    else
      [first.externalKey, second.externalKey] = [
        second.externalKey,
        first.externalKey,
      ];
    await writeFile(
      join(root, 'scripts/catalog/everythingpath-identities.json'),
      JSON.stringify(ledger),
    );
  };
  const t3Problems = [
    'empty IDs',
    'duplicate IDs',
    'changed record',
    'changed source',
    'changed report',
    'changed original message',
    'changed HEAD',
  ] as const;
  /** How each problem changes a completed T3 round before its record step. */
  const t3Changes: Record<
    (typeof t3Problems)[number],
    (round: { root: string; archived: string; ids: string }) => Promise<unknown>
  > = {
    'empty IDs': ({ ids }) => writeFile(ids, ''),
    'duplicate IDs': ({ ids }) =>
      writeFile(ids, `${p6Ids()[0]}\n${p6Ids()[0]}\n`),
    'changed record': ({ root }) => changeLedger(root, 'changed record'),
    'changed source': ({ root }) => changeLedger(root, 'changed source'),
    'changed report': async ({ archived }) => {
      await chmod(join(archived, 'report.snapshot.md'), 0o644);
      await writeFile(join(archived, 'report.snapshot.md'), 'Changed report');
      await chmod(join(archived, 'report.snapshot.md'), 0o444);
    },
    'changed original message': async ({ archived }) => {
      const path = join(archived, 'dispatch.json');
      const value = JSON.parse(await readFile(path, 'utf8'));
      value.observations[0].response.structuredContent.items[0].text =
        'Foreign task';
      await chmod(path, 0o644);
      await writeFile(path, JSON.stringify(value));
      await chmod(path, 0o444);
    },
    'changed HEAD': ({ root }) =>
      run('git', [
        '-C',
        root,
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.test',
        'commit',
        '--allow-empty',
        '-qm',
        'later commit',
      ]),
  };
  it.each(t3Problems)(
    'rejects T3 %s at record time without promotion/report/receipt writes',
    async (problem) => {
      const { root, archived, ids } = await completedT3Fixture();
      await t3Changes[problem]({ root, archived, ids });
      const before = await snapshotTree(root);
      await expect(
        command('--t3-run', archived, '--ids', ids, '--root', root),
      ).rejects.toBeDefined();
      expect(await snapshotTree(root)).toEqual(before);
    },
    t3Round,
  );
});
