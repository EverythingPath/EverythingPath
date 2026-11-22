// @vitest-environment node
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reviewReportsDirectory } from '../../scripts/catalog/review-receipts';
import {
  p6RulesReview,
  repo,
  p6Run,
  p6Ids,
  recordStepHarness,
} from './review-receipts-harness';

/**
 * The record step's verification: the base gate's exact form, its TMPDIR
 * rule, report snapshots, and every way a recorded run fails to verify.
 */
describe('the record step command (catalog-record-review.ts)', () => {
  const {
    scratch,
    temporaryDirectory,
    commandIn,
    command,
    snapshotRun,
    draftedCheckout,
    writeIds,
    recordedCheckout,
  } = recordStepHarness();

  // Fix r9, root's correction of fix r8: the base gate (0158082f,
  // scripts/orchestration/gate_operator.py, verify_records) runs the
  // candidate's record verification in the candidate checkout as
  // `node --import tsx scripts/catalog-record-review.ts --verify --root WT
  // --runs ORCH/runs`, tsx's disk cache on; it verifies as on the base, where
  // this checkout prints '1 receipts verified.' and exits 0, and as the
  // launcher form does.
  it("verifies in the base gate's exact form, tsx's disk cache on, as on the base and as through the launcher", async () => {
    const { root, runDir } = await draftedCheckout({ runId: snapshotRun });
    await command(
      '--run',
      runDir,
      '--ids',
      await writeIds(root, p6Ids()),
      '--root',
      root,
    );
    const gate = ['--verify', '--root', root, '--runs', join(root, 'runs')];
    const verified = { stdout: '1 receipts verified.\n', stderr: '' };
    await expect(commandIn('tsx', gate)).resolves.toMatchObject(verified);
    await expect(commandIn('launcher', gate)).resolves.toMatchObject(verified);
  });
  // Fix r9, standards 2, and fix r10, both axes: --verify declines a TMPDIR
  // that is, is inside or contains an archive it verifies or the runs
  // directory it is given (beside the archive there: another round), by real
  // path, and nothing else: an unrelated directory elsewhere holding a
  // manifest.json (the reviewer's case) or a round's other files is no round
  // it operates on.
  it.each([
    { where: 'the archive it verifies', declined: true },
    { where: 'a subdirectory of the archive', declined: true },
    { where: 'the runs directory', declined: true },
    { where: 'the checkout holding the runs directory', declined: true },
    {
      where: 'an unrelated directory holding a manifest.json',
      declined: false,
    },
    {
      where: "an unrelated directory holding a round's three files",
      declined: false,
    },
    { where: 'beside the archive, in the runs directory', declined: true },
  ])(
    'verifies or declines with TMPDIR at $where, in both forms',
    async ({ where, declined }) => {
      const { root, runDir } = await draftedCheckout({ runId: snapshotRun });
      await command(
        '--run',
        runDir,
        '--ids',
        await writeIds(root, p6Ids()),
        '--root',
        root,
      );
      const unrelated = await temporaryDirectory();
      const at: Record<string, string> = {
        'the archive it verifies': runDir,
        'a subdirectory of the archive': join(runDir, 'tmp'),
        'the runs directory': join(root, 'runs'),
        'the checkout holding the runs directory': root,
        'an unrelated directory holding a manifest.json': join(
          unrelated,
          'manifest',
        ),
        "an unrelated directory holding a round's three files": join(
          unrelated,
          'round',
        ),
        'beside the archive, in the runs directory': join(root, 'runs', 'tmp'),
      };
      const tmp = at[where] ?? '';
      await mkdir(tmp, { recursive: true });
      if (where.includes('manifest.json'))
        await writeFile(join(tmp, 'manifest.json'), '');
      if (where.includes('three files'))
        for (const name of ['manifest.json', 'request.json', 'completed.json'])
          await writeFile(join(tmp, name), '{}\n');
      const gate = ['--verify', '--root', root, '--runs', join(root, 'runs')];
      for (const form of ['launcher', 'tsx'] as const)
        if (declined)
          await expect(commandIn(form, gate, tmp)).rejects.toMatchObject({
            stdout: '',
            stderr: expect.stringContaining(
              where.startsWith('beside')
                ? `The system temporary directory (TMPDIR, ${tmp}) is the runs directory this verifies (${join(root, 'runs')}), inside it or contains it; nothing done.`
                : `The system temporary directory (TMPDIR, ${tmp}) is an archive this verifies (${runDir}), inside it or contains it; nothing done.`,
            ),
          });
        else
          await expect(commandIn(form, gate, tmp)).resolves.toMatchObject({
            stdout: '1 receipts verified.\n',
          });
    },
  );

  it('records and verifies the report snapshot, never the --report path or report.md', async () => {
    const { root, runDir, named } = await draftedCheckout({
      runId: snapshotRun,
    });
    // A Claude reviewer's final message can differ from the file it wrote,
    // and a later run can write its report to the same --report path.
    await writeFile(join(runDir, 'report.md'), 'A different final message.\n');
    await writeFile(named, "A later run's report, at the same path.\n");
    await command(
      '--run',
      runDir,
      '--ids',
      await writeIds(root, p6Ids()),
      '--root',
      root,
    );
    const copy = `${reviewReportsDirectory}/${snapshotRun}.md`;
    expect(await readFile(join(root, copy))).toEqual(
      await readFile(new URL('report.md', p6Run)),
    );
    await expect(
      command('--verify', '--root', root, '--runs', join(root, 'runs')),
    ).resolves.toMatchObject({ stdout: '1 receipts verified.\n' });
    // A tampered snapshot no longer matches its hash, and the run is refused.
    const other = await draftedCheckout({ runId: snapshotRun });
    await chmod(join(other.runDir, 'report.snapshot.md'), 0o644);
    await writeFile(join(other.runDir, 'report.snapshot.md'), 'Edited.\n');
    await chmod(join(other.runDir, 'report.snapshot.md'), 0o444);
    await expect(
      command(
        '--run',
        other.runDir,
        '--ids',
        await writeIds(other.root, p6Ids()),
        '--root',
        other.root,
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        'report snapshot does not match its hash',
      ),
    });
  });

  it('fails verification when a run directory or its meta is gone', async () => {
    const gone = await recordedCheckout();
    await rm(join(gone.root, 'runs'), { recursive: true, force: true });
    await expect(gone.verify()).rejects.toMatchObject({
      stdout: expect.stringContaining(
        `FAIL ${gone.runDir} has no readable meta.`,
      ),
    });
    const metaless = await recordedCheckout();
    await rm(join(metaless.runDir, 'meta'));
    await expect(metaless.verify()).rejects.toMatchObject({
      stdout: expect.stringContaining(
        `FAIL ${metaless.runDir} has no readable meta.`,
      ),
    });
  });

  it('fails verification when an existing run has a missing, tampered or writable snapshot', async () => {
    const fails = async (
      edit: (runDir: string) => Promise<void>,
      problem: string,
    ) => {
      const { runDir, verify } = await recordedCheckout();
      await edit(runDir);
      await expect(verify()).rejects.toMatchObject({
        stdout: expect.stringContaining(`FAIL ${runDir}${problem}`),
      });
    };
    const snapshot = (runDir: string) => join(runDir, 'report.snapshot.md');
    await fails(
      (runDir) => rm(snapshot(runDir), { force: true }),
      ' has no report snapshot',
    );
    await fails(async (runDir) => {
      await chmod(snapshot(runDir), 0o644);
      await writeFile(snapshot(runDir), 'Edited.\n');
      await chmod(snapshot(runDir), 0o444);
    }, "'s report snapshot does not match its hash");
    await fails(
      (runDir) => chmod(snapshot(runDir), 0o644),
      "'s report snapshot is writable",
    );
  });

  it('fails a run off the allowlist whose meta is faked to predate snapshots', async () => {
    const { runDir, verify } = await recordedCheckout();
    const meta = await readFile(join(runDir, 'meta'), 'utf8');
    await writeFile(
      join(runDir, 'meta'),
      meta.replace(/^reviewed_commit=.*\n/m, ''),
    );
    await rm(join(runDir, 'report.snapshot.md'), { force: true });
    await expect(verify()).rejects.toMatchObject({
      stdout: expect.stringContaining(
        `FAIL ${runDir}'s meta names no reviewed_commit.`,
      ),
    });
  });

  it('lets only the allowlisted P6 run go without a run directory, while its copy has the pinned hash', async () => {
    const { root, verify } = await recordedCheckout({
      runId: p6RulesReview.runId,
    });
    await rm(join(root, 'runs'), { recursive: true, force: true });
    await expect(verify()).resolves.toMatchObject({
      stdout: `${p6RulesReview.runId}: a pre-snapshot run on the allowlist; its committed copy has the pinned hash\n1 receipts verified.\n`,
    });
    await writeFile(
      join(root, reviewReportsDirectory, `${p6RulesReview.runId}.md`),
      'A forged report.\n',
    );
    await expect(verify()).rejects.toMatchObject({
      stdout: expect.stringContaining(
        `FAIL ${p6RulesReview.runId}: its committed copy or receipt doesn't have the allowlist's pinned hash.`,
      ),
    });
  });

  it('refuses to record a run without meta or reviewed_commit', async () => {
    const record = (checkout: { root: string; runDir: string }) =>
      command(
        '--run',
        checkout.runDir,
        '--ids',
        join(checkout.root, 'ids.txt'),
        '--root',
        checkout.root,
      );
    const metaless = await draftedCheckout({ runId: snapshotRun });
    await writeIds(metaless.root, p6Ids());
    await rm(join(metaless.runDir, 'meta'));
    await expect(record(metaless)).rejects.toMatchObject({
      stderr: expect.stringContaining('has no readable meta'),
    });
    const faked = await draftedCheckout({ runId: snapshotRun });
    await writeIds(faked.root, p6Ids());
    const meta = await readFile(join(faked.runDir, 'meta'), 'utf8');
    await writeFile(
      join(faked.runDir, 'meta'),
      meta.replace(/^reviewed_commit=.*\n/m, ''),
    );
    await expect(record(faked)).rejects.toMatchObject({
      stderr: expect.stringContaining('names no reviewed_commit'),
    });
  });

  it('refuses a run without a report snapshot', async () => {
    const { root, runDir } = await draftedCheckout();
    await rm(join(runDir, 'report.snapshot.md'));
    await expect(
      command(
        '--run',
        runDir,
        '--ids',
        await writeIds(root, p6Ids()),
        '--root',
        root,
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('has no report snapshot'),
    });
  });

  it('fails verification when a report copy is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'review-757-'));
    scratch.push(root);
    for (const path of [
      'scripts/catalog/everythingpath-identities.json',
      'scripts/catalog/review-receipts.json',
      'scripts/catalog/reviewed-curation.json',
    ])
      await cp(join(repo, path), join(root, path));
    await expect(
      command('--verify', '--root', root, '--runs', join(root, 'runs')),
    ).rejects.toMatchObject({
      stdout: expect.stringContaining(
        `FAIL Review ${p6RulesReview.runId} has no report copy`,
      ),
    });
  });
});
