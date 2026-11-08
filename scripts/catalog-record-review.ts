import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { z } from 'zod';
import {
  bindT3Dispatch,
  captureT3Inputs,
  completeT3Review,
  readT3Review,
} from './catalog/t3-review-evidence.ts';
import { parseCuration } from './catalog/curation.ts';
import { catalogDataFiles, formatCatalogData } from './catalog/data-files.ts';
import {
  identityLedgerSchema,
  listLedgerReviews,
  parseIdentityLedger,
} from './catalog/everythingpath-identities.ts';
import {
  describeReviewRun,
  findReceiptProblems,
  hashReport,
  legacyReviewRuns,
  parseReviewedCovers,
  parseReviewReceipts,
  recordReviewReceipt,
  reviewReportsDirectory,
  type ReviewedCover,
  type ReviewReceipts,
  type ReviewRun,
} from './catalog/review-receipts.ts';
import {
  confirmationsPath,
  findSection15RegistryProblems,
  listSection15Reviews,
  readPinnedPcgenSha256At,
  section15ConfirmationsSchema,
} from './catalog/legal/section15-confirmations.ts';
import { reviewedAdmissionSchema } from '../src/lib/catalog/admission-schema.ts';
import { listStructureReviews } from './catalog/structure-curation.ts';
import {
  grantedSpellMapPath,
  grantedSpellMapSchema,
  listGrantedSpellReviews,
  parseGrantedSpellMap,
} from './catalog/granted-spells.ts';

/**
 * The orchestrator's record step (#757; runbook "Record the review"): the
 * only writer of review receipts and the only way a record becomes checked.
 */
const usage = `Usage:
  node --import tsx scripts/catalog-record-review.ts --list [--json] [--root <dir>]
  node --import tsx scripts/catalog-record-review.ts --run <run dir> --ids <file> [--root <dir>]
  node --import tsx scripts/catalog-record-review.ts --capture-t3 <new durable dir> --config <json> --caller-json <tool response> [--root <dir>]
  node --import tsx scripts/catalog-record-review.ts --bind-t3 <dir> --dispatch <delegate_task response json>
  node --import tsx scripts/catalog-record-review.ts --complete-t3 <dir> --status <task_status response json> --report <full report>
  node --import tsx scripts/catalog-record-review.ts --t3-run <archived dir> --ids <file> [--root <dir>]
  node --import tsx scripts/catalog-record-review.ts --verify [--runs <dir>] [--root <dir>]
--list prints every record a review receipt can cover: its status, its receipt
  and its ID. --json prints each record as a review sees it (its ID, source
  hashes and payload hash); the retired spawn.sh saved that as a reviewer
  run's reviewed-records.json when the review started.
--run records a finished cross-model review (an existing run directory of the
  retired spawn.sh reviewer; no new one can start) as the receipt of the
  drafted records whose IDs <file> lists,
  one per line, marks them checked and commits a copy of its report snapshot under
  ${reviewReportsDirectory}. Each record must be as the run's
  reviewed-records.json saw it, and the ledger must be consistent once they
  are checked; otherwise nothing is written.
--verify checks every receipt's committed report copy, and its run's meta and
  report snapshot (default $EP_ORCH/runs, else ../ep-orch/runs). It fails when
  any is missing, unreadable or differs; only a pinned pre-snapshot run
  (legacyReviewRuns) is checked by its committed copy alone.
--capture-t3 freezes a fresh nonce-bearing request. Use the capture-owned code-mode
  dispatch helper; imported task JSON alone cannot authorize binding. See
  docs/agents/orchestration/t3-reviews.md for the required sequence and config.
--root is the checkout whose data files to read and write (default: this one).
`;
const ledgerPath = 'scripts/catalog/everythingpath-identities.json';
const receiptsPath = 'scripts/catalog/review-receipts.json';
const curationPath = catalogDataFiles.curation;
const registryPath = catalogDataFiles.registry;

const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, 'utf8'));
const formatJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const reportCopyOf = ({ root, runId }: { root: string; runId: string }) =>
  join(root, reviewReportsDirectory, `${runId}.md`);

/**
 * Whether the schema accepts the value unchanged: its output equals the
 * value, so the file's own objects (and their key order) have its type.
 */
const isUnchangedBy = <T>(schema: z.ZodType<T>, value: unknown): value is T => {
  const parsed = schema.safeParse(value);
  return parsed.success && isDeepStrictEqual(parsed.data, value);
};

/**
 * Reads the data files' records a receipt can cover. The ledger is checked
 * against its schema only: its consistency checks require merges and
 * same-KEY splits to be checked already, which drafted ones aren't yet.
 */
async function loadReviewedData({ root }: { root: string }) {
  const ledger = await readJson(join(root, ledgerPath));
  if (!isUnchangedBy(identityLedgerSchema, ledger))
    throw new Error(
      `${ledgerPath}: ${identityLedgerSchema.safeParse(ledger).error?.message ?? 'not in its canonical form'}`,
    );
  const curationFile = z
    .record(z.string(), z.unknown())
    .parse(await readJson(join(root, curationPath)));
  const { structures = [] } = parseCuration(curationFile);
  const section15 = await loadSection15({ root });
  const grantedSpells = await loadGrantedSpells({ root });
  const records = [
    ...listLedgerReviews(ledger),
    ...listStructureReviews(structures),
    ...(section15
      ? listSection15Reviews({
          confirmations: section15.confirmations.confirmations,
          registry: section15.registry,
        })
      : []),
    ...(grantedSpells ? listGrantedSpellReviews(grantedSpells) : []),
  ];
  return {
    ledger,
    curationFile,
    structures,
    section15,
    grantedSpells,
    records,
  };
}
/**
 * Granted-levels S1b: the granted-spell map, when the checkout has it, in its
 * canonical form, so the record step writes back only the records it checks.
 */
async function loadGrantedSpells({ root }: { root: string }) {
  const path = join(root, grantedSpellMapPath);
  const isPresent = await stat(path).then(
    () => true,
    () => false,
  );
  if (!isPresent) return undefined;
  const map = await readJson(path);
  if (!isUnchangedBy(grantedSpellMapSchema, map))
    throw new Error(
      `${grantedSpellMapPath}: ${grantedSpellMapSchema.safeParse(map).error?.message ?? 'not in its canonical form'}`,
    );
  parseGrantedSpellMap(map);
  return map;
}
/**
 * #716 P10a: the Section 15 confirmations and the Registry, when the checkout
 * has them. Checking a confirmation also makes its `pcgen:<code>` block
 * reviewed (`listSection15Reviews`).
 */
async function loadSection15({ root }: { root: string }) {
  const path = join(root, confirmationsPath);
  const isPresent = await stat(path).then(
    () => true,
    () => false,
  );
  if (!isPresent) return undefined;
  const confirmations = await readJson(path);
  const registry = z
    .record(
      z.string(),
      z.object({ reviewStatus: z.string(), checkedOn: z.string() }).loose(),
    )
    .parse(await readJson(join(root, registryPath)));
  return {
    confirmations: section15ConfirmationsSchema.parse(confirmations),
    registry,
  };
}
async function loadReceipts({ root }: { root: string }) {
  return parseReviewReceipts(await readJson(join(root, receiptsPath)));
}

/**
 * Records a finished review as the receipt of the records `idsFile` lists:
 * reads the run, promotes the records, then writes every file. Nothing is
 * written unless the run and every promoted record check out.
 */
async function recordRun({
  root,
  runDir,
  idsFile,
  t3 = false,
}: {
  root: string;
  runDir: string;
  idsFile: string;
  t3?: boolean;
}) {
  const { run, report, seen } = t3
    ? await readT3Review({ dir: runDir })
    : await readFinishedReview({ runDir });
  if (run.kind === 't3' && gitCommit(root) !== run.evidence.reviewedCommit)
    throw new Error('Current HEAD differs from the T3 reviewed commit.');
  if (basename(resolve(runDir)) !== run.runId)
    throw new Error(`${runDir} holds run ${run.runId}.`);
  const ids = await readRecordIds({ idsFile });
  const promoted = await promoteRecords({ root, run, ids, seen });
  await writeRecordedReview({ root, run, report, ids, ...promoted });
  process.stdout.write(
    `Recorded ${run.runId} (report sha256:${run.reportSha256.slice(0, 12)}) as the receipt of ${ids.length} records.\n`,
  );
}

/**
 * A finished reviewer run as the record step reads it: the run its meta, exit
 * and report snapshot describe (the directory must be named for it), its
 * report, and the records it saw when it started.
 */
async function readFinishedReview({ runDir }: { runDir: string }) {
  const meta = await readReviewedMeta({ runDir });
  const report = await readReportSnapshot({ runDir });
  const run = describeReviewRun({
    meta,
    exit: await readFile(join(runDir, 'exit'), 'utf8'),
    report,
  });
  if (basename(resolve(runDir)) !== run.runId)
    throw new Error(`${runDir} holds run ${run.runId}.`);
  const seen = await readJson(join(runDir, 'reviewed-records.json')).catch(
    () => {
      throw new Error(
        `${run.runId} has no reviewed-records.json; spawn.sh saved it when a review started.`,
      );
    },
  );
  return { run, report, seen: parseReviewedCovers(seen) };
}

/** The record IDs a file lists, one per line; `#` lines are comments. */
async function readRecordIds({ idsFile }: { idsFile: string }) {
  const ids = (await readFile(idsFile, 'utf8'))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  if (!ids.length) throw new Error(`${idsFile} lists no record.`);
  return ids;
}

/**
 * Marks the named records checked under the run in the data files as read,
 * and checks the ledger and curation are consistent once they are. Returns
 * the files' new contents; writes nothing.
 */
async function promoteRecords({
  root,
  run,
  ids,
  seen,
}: {
  root: string;
  run: ReviewRun;
  ids: readonly string[];
  seen: readonly ReviewedCover[];
}) {
  const data = await loadReviewedData({ root });
  const receipts = recordReviewReceipt({
    records: data.records,
    receipts: await loadReceipts({ root }),
    run,
    ids,
    seen,
  });
  // Consistency once the records are checked: a merge or split needs its decision.
  parseIdentityLedger(data.ledger);
  const curation = { ...data.curationFile, structures: data.structures };
  parseCuration(curation);
  if (data.section15) {
    const registry = reviewedAdmissionSchema.shape.registry.parse(
      data.section15.registry,
    );
    // The selected checkout's pinned OGL.txt files, not this script's.
    const [problem] = findSection15RegistryProblems({
      registry,
      confirmations: data.section15.confirmations.confirmations,
      currentSha256: readPinnedPcgenSha256At(root),
    });
    if (problem) throw new Error(problem);
  }
  if (data.grantedSpells) parseGrantedSpellMap(data.grantedSpells);
  return {
    ledger: data.ledger,
    curation,
    section15: data.section15,
    grantedSpells: data.grantedSpells,
    receipts,
  };
}

/**
 * Writes a promotion: the report copy (refused if one with another report is
 * there), the ledger, the curation when a structure record was checked, the
 * granted-spell map when one of its records was, and the receipts.
 */
async function writeRecordedReview({
  root,
  run,
  report,
  ids,
  ledger,
  curation,
  section15,
  grantedSpells,
  receipts,
}: {
  root: string;
  run: ReviewRun;
  report: Uint8Array;
  ids: readonly string[];
  ledger: unknown;
  curation: Record<string, unknown>;
  section15: Awaited<ReturnType<typeof loadSection15>>;
  grantedSpells: Awaited<ReturnType<typeof loadGrantedSpells>>;
  receipts: ReviewReceipts;
}) {
  const copy = reportCopyOf({ root, runId: run.runId });
  const existing = await readFile(copy).catch(() => undefined);
  if (existing && hashReport(existing) !== run.reportSha256)
    throw new Error(`${copy} holds another report.`);
  // Materialize every output before creating even the report directory. Parsing
  // curation alone does not check the formatter's shared-alias invariant.
  const outputs: { path: string; bytes: string | Uint8Array }[] = [
    { path: copy, bytes: report },
    { path: join(root, ledgerPath), bytes: formatJson(ledger) },
  ];
  if (ids.some((id) => id.startsWith('structure ')))
    outputs.push({
      path: join(root, curationPath),
      bytes: formatCatalogData('curation', curation),
    });
  if (section15 && ids.some((id) => id.startsWith('section15-confirmation ')))
    outputs.push(
      {
        path: join(root, confirmationsPath),
        bytes: formatJson(
          section15ConfirmationsSchema.parse(section15.confirmations),
        ),
      },
      {
        path: join(root, registryPath),
        bytes: formatCatalogData('registry', section15.registry),
      },
    );
  if (grantedSpells && ids.some((id) => id.startsWith('granted-spells ')))
    outputs.push({
      path: join(root, grantedSpellMapPath),
      bytes: formatJson(grantedSpells),
    });
  outputs.push({ path: join(root, receiptsPath), bytes: formatJson(receipts) });
  await mkdir(join(root, reviewReportsDirectory), { recursive: true });
  for (const { path, bytes } of outputs) await writeFile(path, bytes);
}

/**
 * A reviewer run's meta, which must name the commit the review read: the
 * retired spawn.sh wrote `reviewed_commit` for every reviewer run that has a
 * snapshot.
 */
async function readReviewedMeta({ runDir }: { runDir: string }) {
  const meta = await readFile(join(runDir, 'meta'), 'utf8').catch(() => {
    throw new Error(`${runDir} has no readable meta.`);
  });
  if (!/^reviewed_commit=[0-9a-f]{40}$/m.test(meta))
    throw new Error(`${runDir}'s meta names no reviewed_commit.`);
  return meta;
}

/**
 * The report as the run finished: the retired spawn.sh's `report.snapshot.md`
 * (the --report file the reviewer wrote, else its final message) and the hash
 * it took then. Neither the --report path nor `report.md` is read, since either
 * can hold other bytes later.
 */
async function readReportSnapshot({ runDir }: { runDir: string }) {
  const snapshot = await readFile(join(runDir, 'report.snapshot.md')).catch(
    () => {
      throw new Error(
        `${runDir} has no report snapshot it can read; spawn.sh saved report.snapshot.md when a review finished.`,
      );
    },
  );
  const { mode } = await stat(join(runDir, 'report.snapshot.md'));
  if (mode & 0o222) throw new Error(`${runDir}'s report snapshot is writable.`);
  const taken = (
    await readFile(join(runDir, 'report.snapshot.sha256'), 'utf8').catch(
      () => '',
    )
  ).trim();
  if (hashReport(snapshot) !== taken)
    throw new Error(`${runDir}'s report snapshot does not match its hash.`);
  return snapshot;
}

/** The SHA-256 of each committed report copy, by run id. */
async function hashReportCopies({ root }: { root: string }) {
  const directory = join(root, reviewReportsDirectory);
  const names = await readdir(directory).catch(() => []);
  return new Map(
    await Promise.all(
      names
        .filter((name) => name.endsWith('.md'))
        .map(
          async (name) =>
            [
              name.slice(0, -'.md'.length),
              hashReport(await readFile(join(directory, name))),
            ] as const,
        ),
    ),
  );
}

async function verify({ root, runs }: { root: string; runs: string }) {
  const receipts = await loadReceipts({ root });
  const { records } = await loadReviewedData({ root });
  const copies = await hashReportCopies({ root });
  const problems = findReceiptProblems({
    records,
    receipts,
    reportSha256s: copies,
  });
  for (const receipt of receipts.receipts) {
    const { runId, reportSha256 } = receipt;
    const pinned = legacyReviewRuns.get(runId);
    if (pinned !== undefined) {
      if (copies.get(runId) === pinned && reportSha256 === pinned)
        process.stdout.write(
          `${runId}: a pre-snapshot run on the allowlist; its committed copy has the pinned hash\n`,
        );
      else
        problems.push(
          `${runId}: its committed copy or receipt doesn't have the allowlist's pinned hash.`,
        );
      continue;
    }
    try {
      const runDir = join(runs, runId);
      if ('evidence' in receipt) {
        const review = await readT3Review({ dir: runDir });
        if (
          review.run.runId !== runId ||
          review.run.reportSha256 !== reportSha256 ||
          !isDeepStrictEqual(review.run.evidence, receipt.evidence)
        )
          throw new Error(`${runId}: T3 evidence differs from its receipt.`);
        execFileSync(
          'git',
          ['cat-file', '-e', `${receipt.evidence.reviewedCommit}^{commit}`],
          { cwd: root, stdio: 'pipe' },
        );
        for (const cover of receipt.covers) {
          const saw = review.seen.find(({ id }) => id === cover.id);
          if (!isDeepStrictEqual(saw, cover))
            throw new Error(
              `${runId}: T3 pre-dispatch cover differs for ${cover.id}.`,
            );
        }
        continue;
      }
      await readReviewedMeta({ runDir });
      if (hashReport(await readReportSnapshot({ runDir })) !== reportSha256)
        problems.push(
          `${runId}: the run's report snapshot differs from its receipt.`,
        );
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
  }
  for (const problem of problems) process.stdout.write(`FAIL ${problem}\n`);
  const hasProblems = problems.length > 0;
  if (hasProblems) process.exitCode = 1;
  else process.stdout.write(`${receipts.receipts.length} receipts verified.\n`);
}

async function listRecords({ root, json }: { root: string; json: boolean }) {
  const { records } = await loadReviewedData({ root });
  process.stdout.write(
    json
      ? formatJson(
          records.map(({ id, sources, payloadSha256 }) => ({
            id,
            sources,
            payloadSha256,
          })),
        )
      : records
          .map(({ id, review }) =>
            [
              review.status,
              review.status === 'checked' ? review.receipt : '-',
              id,
            ].join('\t'),
          )
          .map((line) => `${line}\n`)
          .join(''),
  );
}

function gitCommit(root: string) {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
}
export async function captureReviewInputs({
  root,
  dir,
  config,
  caller,
}: {
  root: string;
  dir: string;
  config: unknown;
  caller: unknown;
}) {
  const reviewedCommit = gitCommit(root);
  if (
    execFileSync('git', ['status', '--porcelain'], {
      cwd: root,
      encoding: 'utf8',
    }).trim()
  )
    throw new Error('Commit the reviewed checkout before capturing T3 inputs.');
  const { records } = await loadReviewedData({ root });
  return captureT3Inputs({
    dir,
    config,
    caller,
    reviewedCommit,
    seen: records.map(({ id, sources, payloadSha256 }) => ({
      id,
      sources,
      payloadSha256,
    })),
  });
}
async function main() {
  const { values } = parseArgs({
    options: {
      'capture-t3': { type: 'string' },
      config: { type: 'string' },
      'caller-json': { type: 'string' },
      'bind-t3': { type: 'string' },
      dispatch: { type: 'string' },
      'complete-t3': { type: 'string' },
      status: { type: 'string' },
      report: { type: 'string' },
      't3-run': { type: 'string' },
      list: { type: 'boolean' },
      json: { type: 'boolean' },
      run: { type: 'string' },
      ids: { type: 'string' },
      verify: { type: 'boolean' },
      runs: { type: 'string' },
      root: { type: 'string' },
      help: { type: 'boolean' },
    },
    strict: true,
    allowPositionals: false,
  });
  const actions = [
    'capture-t3',
    'bind-t3',
    'complete-t3',
    't3-run',
    'run',
    'list',
    'verify',
  ] as const;
  if (actions.filter((key) => values[key]).length > 1)
    throw new Error('Choose exactly one record/capture/verify action.');
  const root = values.root
    ? resolve(values.root)
    : fileURLToPath(new URL('../', import.meta.url));
  if (values['capture-t3'] && values.config && values['caller-json']) {
    const { sha256 } = await captureReviewInputs({
      root,
      dir: resolve(values['capture-t3']),
      config: await readJson(values.config),
      caller: JSON.parse(values['caller-json']),
    });
    process.stdout.write(
      `T3 inputs captured; archive completed evidence as t3-review-${sha256} under $EP_ORCH/runs. Use the capture-owned code-mode dispatch helper.\n`,
    );
  } else if (values['bind-t3'] && values.dispatch) {
    await bindT3Dispatch({
      dir: values['bind-t3'],
      response: await readJson(values.dispatch),
    });
  } else if (values['complete-t3'] && values.status && values.report) {
    const { run } = await completeT3Review({
      dir: values['complete-t3'],
      response: await readJson(values.status),
      report: await readFile(values.report),
    });
    process.stdout.write(
      `${run.runId} frozen; archive this directory under $EP_ORCH/runs/${run.runId} before --t3-run and --verify.\n`,
    );
  } else if (values['t3-run'] && values.ids) {
    await recordRun({
      root,
      runDir: values['t3-run'],
      idsFile: values.ids,
      t3: true,
    });
  } else if (values.list)
    await listRecords({ root, json: values.json ?? false });
  else if (values.run && values.ids)
    await recordRun({ root, runDir: values.run, idsFile: values.ids });
  else if (values.verify) {
    const orch = process.env.EP_ORCH ?? resolve(root, '../ep-orch');
    await verify({ root, runs: values.runs ?? join(orch, 'runs') });
  } else {
    process.stdout.write(usage);
    if (!values.help) process.exitCode = 2;
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
