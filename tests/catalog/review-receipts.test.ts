// @vitest-environment node
import { execFile } from 'node:child_process';
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, describe, expect, expectTypeOf, it } from 'vitest';
import { parseCuration } from '../../scripts/catalog/curation';
import {
  listLedgerReviews,
  parseIdentityLedger,
} from '../../scripts/catalog/everythingpath-identities';
import ledgerData from '../../scripts/catalog/everythingpath-identities.json';
import {
  grantedSpellMapPath,
  listGrantedSpellReviews,
  parseGrantedSpellMap,
} from '../../scripts/catalog/granted-spells';
import grantedSpellMapData from '../../scripts/catalog/reviewed-granted-spells.json';
import { pcgenPin } from '../../scripts/catalog/inventory';
import {
  committedSection15Confirmations,
  listSection15Reviews,
} from '../../scripts/catalog/legal/section15-confirmations';
import {
  describeReviewRun,
  findReceiptProblems,
  hashReport,
  parseReviewReceipts,
  recordReviewReceipt,
  reviewReportsDirectory,
  type ReviewedRecord,
  type ReviewRun,
} from '../../scripts/catalog/review-receipts';
import receiptsData from '../../scripts/catalog/review-receipts.json';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import {
  hashStructureSource,
  listStructureReviews,
  type StructureRecord,
} from '../../scripts/catalog/structure-curation';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';
import { readPinned } from './pinned-sources';
import { draftedSection15 } from './section15-drafted';

// #757 compatibility fixture: preserve P6's exact historical meta/report/ledger
// bytes. This is not renewed semantic approval of inherited rationales; the
// authentic #766 review identifies nine wording corrections for later review.
const p6RulesReview = {
  runId: 'reviewer-20261018-081620-1216172',
  reportSha256:
    '0fa467ace83783ca800b5618dbf257caf4881dd93ca4858c7dfc619380914559',
};
const repo = fileURLToPath(new URL('../../', import.meta.url));
// The commit P6's rules review read in its detached checkout.
const p6ReviewedCommit = '26f0af51900a81843ceefbe83e59897d2c19c21d';
const p6Run = new URL(
  `../fixtures/review-757/${p6RulesReview.runId}/`,
  import.meta.url,
);
const runFile = (name: string) => readFile(new URL(name, p6Run), 'utf8');
const reportsDirectory = join(repo, reviewReportsDirectory);
const reportSha256s = new Map(
  await Promise.all(
    (await readdir(reportsDirectory)).map(
      async (name) =>
        [
          name.replace(/\.md$/, ''),
          hashReport(await readFile(join(reportsDirectory, name))),
        ] as const,
    ),
  ),
);

const ledger = parseIdentityLedger(ledgerData);
const receipts = parseReviewReceipts(receiptsData);
const listLiveRecords = () => [
  ...listLedgerReviews(structuredClone(ledger)),
  ...listStructureReviews(structuredClone(reviewedCuration.structures ?? [])),
  ...listSection15Reviews({
    confirmations: structuredClone(committedSection15Confirmations),
    registry: structuredClone(section15Registry),
  }),
  ...listGrantedSpellReviews(parseGrantedSpellMap(grantedSpellMapData)),
];
// Inner Sea Intrigue p.38's Perfect Scholar and its Unchained Monk version.
const perfectScholar =
  'separate-identities everythingpath/monk-perfect-scholar + everythingpath/unchained-monk-perfect-scholar';
const p6Ids = () =>
  receipts.receipts
    .find(({ runId }) => runId === p6RulesReview.runId)
    ?.covers.map(({ id }) => id) ?? [];
function findRecord(records: readonly ReviewedRecord[], id: string) {
  const record = records.find((candidate) => candidate.id === id);
  if (!record) throw new Error(`No reviewed record ${id}.`);
  return record;
}
const findProblemsWith = ({
  edit = () => undefined,
  data = receipts,
  reports = reportSha256s,
}: {
  edit?: (records: ReviewedRecord[]) => void;
  data?: typeof receipts;
  reports?: ReadonlyMap<string, string>;
}) => {
  const records = listLiveRecords();
  edit(records);
  return findReceiptProblems({
    records,
    receipts: data,
    reportSha256s: reports,
  });
};

describe('review receipts (#757)', () => {
  it('binds every checked record to a recorded review whose report the repo holds', () => {
    expect(findProblemsWith({})).toEqual([]);
  });

  it('records the #716 P6 rules review over its 31 separate-identities decisions', () => {
    const receipt = receipts.receipts.find(
      ({ runId }) => runId === p6RulesReview.runId,
    );
    expect(receipt?.reportSha256).toBe(p6RulesReview.reportSha256);
    const covered = receipt?.covers.map(({ id }) => id) ?? [];
    expect(covered).toHaveLength(31);
    const underP6 = listLiveRecords().filter(
      ({ review }) =>
        review.status === 'checked' && review.receipt === p6RulesReview.runId,
    );
    expect(underP6.map(({ id }) => id).sort()).toEqual([...covered].sort());
    expect(findRecord(underP6, perfectScholar).sources).toEqual([
      {
        subject:
          'pcgen:campaign_setting/inner_sea_intrigue/isi_abilities_class.lst#monk archetype ~ perfect scholar',
        sourceSha256:
          '785b97b0f293b00880af753b2bd1470a3dfa639be7fb285e720251ec2338e9c4',
      },
      {
        subject:
          'pcgen:campaign_setting/inner_sea_intrigue/support/isi_abilities_class_pu.lst#unchained monk archetype ~ perfect scholar',
        sourceSha256:
          'd6c577c773ea2fa0067ecc05acdd53e38aba598222150ad6e950a1834d6724d8',
      },
    ]);
  });

  it('commits the report byte for byte as the run wrote it', async () => {
    expect(
      await readFile(join(reportsDirectory, `${p6RulesReview.runId}.md`)),
    ).toEqual(await readFile(new URL('report.md', p6Run)));
  });

  it('fails a receipt whose report copy is missing or differs', () => {
    // P6's copy only; every other receipt keeps its committed copy.
    const reportsWithP6 = (sha256?: string) => {
      const reports = new Map(reportSha256s);
      if (sha256 === undefined) reports.delete(p6RulesReview.runId);
      else reports.set(p6RulesReview.runId, sha256);
      return reports;
    };
    expect(findProblemsWith({ reports: reportsWithP6() })).toEqual([
      `Review ${p6RulesReview.runId} has no report copy in ${reviewReportsDirectory}.`,
    ]);
    expect(
      findProblemsWith({
        reports: reportsWithP6(hashReport('A forged report.')),
      }),
    ).toEqual([
      `Review ${p6RulesReview.runId}'s report copy does not match its receipt.`,
    ]);
  });

  it('refuses a checked decision without a receipt', () => {
    const withoutReceipt = structuredClone(ledgerData);
    const [decision] = withoutReceipt.variantDecisions;
    if (decision) Reflect.deleteProperty(decision.review, 'receipt');
    expect(() => parseIdentityLedger(withoutReceipt)).toThrow();
  });

  it('fails a receipt that names a review no receipt records', () => {
    expect(
      findProblemsWith({
        edit: (records) => {
          const record = findRecord(records, perfectScholar);
          if (record.review.status === 'checked')
            record.review = {
              ...record.review,
              receipt: 'reviewer-20261018-081620-1216173',
            };
        },
      }),
    ).toEqual([
      `${perfectScholar} names review reviewer-20261018-081620-1216173, which review-receipts.json doesn't record.`,
    ]);
  });

  it('fails a receipt that does not cover the decision', () => {
    // P6's receipt without Perfect Scholar; every other receipt as committed.
    const data = {
      receipts: receipts.receipts.map((receipt) =>
        receipt.runId === p6RulesReview.runId
          ? {
              ...receipt,
              covers: receipt.covers.filter(({ id }) => id !== perfectScholar),
            }
          : receipt,
      ),
    };
    expect(findProblemsWith({ data })).toEqual([
      `Review ${p6RulesReview.runId} doesn't cover ${perfectScholar}.`,
    ]);
  });

  it('fails a decision whose source hashes or payload changed since its review', () => {
    // As if a pin bump re-bound Perfect Scholar to its Unchained row's hash.
    expect(
      findProblemsWith({
        edit: (records) => {
          const [original, unchained] = findRecord(
            records,
            perfectScholar,
          ).sources;
          if (original && unchained)
            original.sourceSha256 = unchained.sourceSha256;
        },
      }),
    ).toEqual([
      `Review ${p6RulesReview.runId} saw ${perfectScholar} with other source hashes than it holds now.`,
    ]);
    // As if the two keys swapped records after the review.
    const swapped = structuredClone(ledger);
    const decision = swapped.variantDecisions.find(
      (candidate) =>
        candidate.decision === 'separate-identities' &&
        candidate.identities[0]?.externalKey ===
          'everythingpath/monk-perfect-scholar',
    );
    if (decision?.decision === 'separate-identities') {
      const [first, second] = decision.identities;
      if (first && second)
        [first.externalKey, second.externalKey] = [
          second.externalKey,
          first.externalKey,
        ];
    }
    expect(
      findReceiptProblems({
        records: listLedgerReviews(swapped),
        receipts,
        reportSha256s,
      }),
    ).toEqual([
      `Review ${p6RulesReview.runId} saw ${perfectScholar} with another decision than it holds now.`,
    ]);
  });

  // #716 P10a: a Section 15 confirmation, checked as the record step would
  // check it after Sol's attribution review. The run is a stand-in.
  describe('a Section 15 confirmation', () => {
    const id = 'section15-confirmation PZO9451';
    const run = {
      runId: 'reviewer-20261020-000000-1',
      reportSha256: hashReport('A stand-in attribution review.'),
    };
    /** The drafted confirmations with PZO9451 checked under the run, after `edit`. */
    const problemsOf = ({
      edit = () => undefined,
      recorded = true,
    }: {
      edit?: (confirmation: { waivedHoldIds: string[] }) => void;
      recorded?: boolean;
    }) => {
      const { confirmations, registry } = draftedSection15();
      const seen = findRecord(
        listSection15Reviews({ confirmations, registry }),
        id,
      );
      const confirmation = confirmations.find(({ code }) => code === 'PZO9451');
      if (!confirmation) throw new Error('No PZO9451 confirmation.');
      confirmation.review = {
        status: 'checked',
        reviewedBy: 'Sol (AI review) for the owner',
        reviewedOn: '2026-10-20',
        receipt: run.runId,
      };
      edit(confirmation);
      return findReceiptProblems({
        records: listSection15Reviews({ confirmations, registry }),
        receipts: {
          receipts: recorded
            ? [
                {
                  ...run,
                  covers: [
                    {
                      id,
                      sources: seen.sources,
                      payloadSha256: seen.payloadSha256,
                    },
                  ],
                },
              ]
            : [],
        },
        reportSha256s: new Map([[run.runId, run.reportSha256]]),
      });
    };

    it('passes while its receipt covers it as reviewed', () => {
      expect(problemsOf({})).toEqual([]);
    });

    it('fails without a recorded receipt', () => {
      expect(problemsOf({ recorded: false })).toEqual([
        `${id} names review ${run.runId}, which review-receipts.json doesn't record.`,
      ]);
    });

    it('fails once its payload changed since the review', () => {
      expect(
        problemsOf({
          edit: (confirmation) => {
            confirmation.waivedHoldIds = confirmation.waivedHoldIds.slice(1);
          },
        }),
      ).toEqual([
        `Review ${run.runId} saw ${id} with another decision than it holds now.`,
      ]);
    });
  });

  it('refuses a receipt without its report hash', () => {
    expect(() =>
      parseReviewReceipts({
        receipts: [{ runId: p6RulesReview.runId, covers: [] }],
      }),
    ).toThrow();
  });
});

// Safe Shot, APG p.104: the owned feature's own PCGen row, not Archer's owner.
const apg = 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
const apgLines = (
  await readPinned('pcgen', `${pcgenPin.directory}/${apg}`)
).split(/\r?\n/);

const safeShotSha256 = hashStructureSource([
  {
    source: {
      source: 'pcgen',
      locator: { file: apg, line: 2121, key: 'Fighter Archer ~ Safe Shot' },
    },
    text: apgLines[2120] ?? '',
  },
]);

describe('a structure record (#716 plan §6)', () => {
  const safeShotId = `structure everythingpath/fighter-archer-safe-shot [] sha256:${safeShotSha256}`;
  const safeShot = (review: Record<string, string>, settles = 'Safe Shot') =>
    parseCuration({
      records: [],
      structures: [
        {
          externalKey: 'everythingpath/fighter-archer-safe-shot',
          sourceSha256: safeShotSha256,
          fields: {},
          noMechanics: true,
          resolves: [
            {
              kind: 'ownedFeature',
              id: `pcgen:${apg}#Fighter Archer ~ ${settles}`,
            },
          ],
          rationale:
            'APG p.104: not provoking attacks of opportunity with a bow is not calculated on the sheet.',
          ...review,
        },
      ],
    }).structures ?? [];
  const checked = {
    status: 'checked',
    reviewedBy: 'Sol (AI review) for the owner',
    reviewedOn: '2026-10-18',
    receipt: p6RulesReview.runId,
  };

  it('is identified by its entry, fields and source hash', () => {
    const [record] = listStructureReviews(safeShot({ status: 'drafted' }));
    expect(record).toMatchObject({
      id: safeShotId,
      sources: [
        {
          subject: 'everythingpath/fighter-archer-safe-shot',
          sourceSha256: safeShotSha256,
        },
      ],
      review: { status: 'drafted' },
    });
  });

  it('binds what it settles: another settled item invalidates its receipt', () => {
    const [record] = listStructureReviews(safeShot({ status: 'drafted' }));
    if (!record) throw new Error('No record.');
    const covers = [
      {
        id: record.id,
        sources: record.sources,
        payloadSha256: record.payloadSha256,
      },
    ];
    const data = {
      receipts: [{ ...p6RulesReview, covers }],
    };
    const problemsOf = (settles: string) =>
      findReceiptProblems({
        records: listStructureReviews(safeShot(checked, settles)),
        receipts: data,
        reportSha256s,
      });
    expect(problemsOf('Safe Shot')).toEqual([]);
    expect(problemsOf('Trick Shot')).toEqual([
      `Review ${p6RulesReview.runId} saw ${safeShotId} with another decision than it holds now.`,
    ]);
  });

  it('carries a receipt exactly when checked', () => {
    expect(() => safeShot({ ...checked, receipt: 'not a run' })).toThrow();
    expect(() =>
      safeShot({
        status: 'checked',
        reviewedBy: checked.reviewedBy,
        reviewedOn: checked.reviewedOn,
      }),
    ).toThrow(/"path": \[\s*"structures",\s*0,\s*"receipt"\s*\]/);
    expect(() =>
      safeShot({ status: 'drafted', receipt: p6RulesReview.runId }),
    ).toThrow('Unrecognized key: \\"receipt\\"');
  });

  it('types the receipt as required exactly when checked', () => {
    type Checked = Extract<StructureRecord, { status: 'checked' }>;
    type Drafted = Extract<StructureRecord, { status: 'drafted' }>;
    expectTypeOf<Checked['receipt']>().toEqualTypeOf<string>();
    expectTypeOf<Drafted>().not.toHaveProperty('receipt');
    expectTypeOf<Extract<ReviewRun, { kind: 'legacy' }>>().not.toHaveProperty(
      'evidence',
    );
    expectTypeOf<
      Extract<ReviewRun, { kind: 't3' }>['evidence']
    >().not.toEqualTypeOf<undefined>();
  });
});

describe('recording a review (runbook, drafted to checked)', () => {
  const p6RunState = {
    kind: 'legacy' as const,
    ...p6RulesReview,
    reviewedBy: 'Sol (AI review) for the owner',
    reviewedOn: '2026-10-18',
  };

  it('reads the reviewer run: its id, report hash, reviewer and date', async () => {
    expect(
      describeReviewRun({
        meta: await runFile('meta'),
        exit: await runFile('exit'),
        report: await runFile('report.md'),
      }),
    ).toEqual(p6RunState);
  });

  it('refuses a run that is no finished cross-model review', async () => {
    const meta = await runFile('meta');
    const report = await runFile('report.md');
    expect(() =>
      describeReviewRun({
        meta: meta.replace('role=reviewer', 'role=implementer'),
        exit: '0\n',
        report,
      }),
    ).toThrow('is not a reviewer run');
    expect(() => describeReviewRun({ meta, exit: '1\n', report })).toThrow(
      'did not finish with exit 0',
    );
    expect(() => describeReviewRun({ meta, exit: '0\n', report: '' })).toThrow(
      'has no report',
    );
  });

  // The P6 decisions as an implementer writes them: drafted.
  const listDraftedRecords = () => {
    const drafted = structuredClone(ledger);
    for (const decision of drafted.variantDecisions)
      if (decision.review.status === 'checked') {
        const { rationale, evidence } = decision.review;
        decision.review = { status: 'drafted', rationale, evidence };
      }
    return listLedgerReviews(drafted);
  };
  const record = ({
    records = listDraftedRecords(),
    ids = [perfectScholar],
    seen = listDraftedRecords(),
    recorded = { receipts: [] },
    run = p6RunState,
  }: {
    records?: ReviewedRecord[];
    ids?: string[];
    seen?: ReviewedRecord[];
    recorded?: typeof receipts;
    run?: typeof p6RunState;
  }) => recordReviewReceipt({ records, receipts: recorded, run, ids, seen });

  it('flips a drafted decision to checked under the run', () => {
    const records = listDraftedRecords();
    record({ records });
    expect(findRecord(records, perfectScholar).review).toEqual({
      status: 'checked',
      reviewedBy: 'Sol (AI review) for the owner',
      reviewedOn: '2026-10-18',
      receipt: p6RulesReview.runId,
    });
  });

  it('adds a record the review covered to its receipt later', () => {
    const records = listDraftedRecords();
    const rest = p6Ids().filter((id) => id !== perfectScholar);
    const first = record({ records, ids: rest });
    const later = record({ records, recorded: first });
    const byId = new Map(
      receipts.receipts[0]?.covers.map((cover) => [cover.id, cover]),
    );
    expect(later).toEqual({
      receipts: [
        {
          ...p6RulesReview,
          covers: [...rest, perfectScholar].map((id) => byId.get(id)),
        },
      ],
    });
    expect(() =>
      record({
        recorded: first,
        run: { ...p6RunState, reportSha256: hashReport('Another report.') },
      }),
    ).toThrow(`Review ${p6RulesReview.runId} is recorded with another report.`);
  });

  it('refuses an unknown record, a checked one, or one changed since the review saw it', () => {
    expect(() =>
      record({ ids: ['separate-identities everythingpath/none'] }),
    ).toThrow('No reviewed record separate-identities everythingpath/none.');
    expect(() => record({ records: listLiveRecords() })).toThrow(
      `${perfectScholar} is already checked under review ${p6RulesReview.runId}.`,
    );
    expect(() => record({ seen: [] })).toThrow(
      `Review ${p6RulesReview.runId} didn't see ${perfectScholar}.`,
    );
    const seen = listDraftedRecords();
    const [original, unchained] = findRecord(seen, perfectScholar).sources;
    if (original && unchained) original.sourceSha256 = unchained.sourceSha256;
    expect(() => record({ seen })).toThrow(
      `${perfectScholar} has other source hashes than review ${p6RulesReview.runId} saw.`,
    );
  });
});

describe('the record step command (catalog-record-review.ts)', () => {
  const run = promisify(execFile);
  const command = (...args: string[]) =>
    run(
      process.execPath,
      ['--import', 'tsx', 'scripts/catalog-record-review.ts', ...args],
      { cwd: repo, maxBuffer: 1 << 26 },
    );
  const scratch: string[] = [];
  afterAll(() =>
    Promise.all(scratch.map((path) => rm(path, { recursive: true }))),
  );

  // A checkout whose ledger has the 31 P6 decisions drafted, as the
  // implementer wrote them, so its merges and same-KEY splits are unchecked.
  // A run after report snapshots: the same review as spawn.sh would run it
  // today, under a run id the legacy allowlist doesn't pin.
  const snapshotRun = 'reviewer-20261018-081620-1216999';
  async function draftedCheckout({
    runId = p6RulesReview.runId,
    before = async () => undefined,
    curation = { records: [], situations: [] },
  }: {
    runId?: string;
    before?: (root: string) => Promise<void>;
    curation?: unknown;
  } = {}) {
    const root = await mkdtemp(join(tmpdir(), 'review-757-'));
    scratch.push(root);
    await before(root);
    const drafted = structuredClone(ledgerData);
    for (const decision of drafted.variantDecisions) {
      const { rationale, evidence } = decision.review;
      Object.assign(decision, {
        review: { status: 'drafted', rationale, evidence },
      });
    }
    await mkdir(join(root, 'scripts/catalog'), { recursive: true });
    await writeFile(
      join(root, 'scripts/catalog/everythingpath-identities.json'),
      `${JSON.stringify(drafted, null, 2)}\n`,
    );
    await writeFile(
      join(root, 'scripts/catalog/review-receipts.json'),
      `${JSON.stringify({ receipts: [] }, null, 2)}\n`,
    );
    await writeFile(
      join(root, 'scripts/catalog/reviewed-curation.json'),
      `${JSON.stringify(curation)}\n`,
    );
    // The P6 run, with what spawn.sh saves: the records as the review
    // starts, and the report's bytes and hash as it finishes. Its --report
    // file lives outside the run, as the review brief named it.
    const runDir = join(root, 'runs', runId);
    await cp(fileURLToPath(p6Run), runDir, { recursive: true });
    const named = join(root, 'briefs/716-p6-review-rules.out.md');
    const report = await readFile(join(runDir, 'report.md'));
    await mkdir(join(root, 'briefs'));
    await writeFile(named, report);
    const meta = await readFile(join(runDir, 'meta'), 'utf8');
    await writeFile(
      join(runDir, 'meta'),
      meta
        .replace(/^id=.*$/m, `id=${runId}`)
        .replace(/^report=.*$/m, `report=${named}`)
        .replace(
          /^review_wt=/m,
          `reviewed_commit=${p6ReviewedCommit}\nreview_wt=`,
        ),
    );
    await writeFile(join(runDir, 'report.snapshot.md'), report);
    await writeFile(
      join(runDir, 'report.snapshot.sha256'),
      `${hashReport(report)}\n`,
    );
    for (const name of ['report.snapshot.md', 'report.snapshot.sha256'])
      await chmod(join(runDir, name), 0o444);
    const { stdout } = await command('--list', '--json', '--root', root);
    await writeFile(join(runDir, 'reviewed-records.json'), stdout);
    return { root, runDir, named };
  }
  const writeIds = async (root: string, ids: readonly string[]) => {
    const path = join(root, 'ids.txt');
    await writeFile(path, `${ids.join('\n')}\n`);
    return path;
  };

  // Synthetic T3 API metadata over a throwaway copy of real P6 decisions.
  // Captures inputs only: current imported-response binding is blocked.
  async function t3Checkout({ curation }: { curation?: unknown } = {}) {
    const checkout = await draftedCheckout({ curation });
    const { root } = checkout;
    const git = (...args: string[]) => run('git', ['-C', root, ...args]);
    await git('init', '-q');
    await writeFile(join(root, '.git/info/exclude'), '*\n');
    await git('add', '-f', 'scripts');
    await git(
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.test',
      'commit',
      '-qm',
      'synthetic reviewed checkout',
    );
    const commit = (await git('rev-parse', 'HEAD')).stdout.trim();
    const selection = {
      providerInstanceId: 'codex',
      model: 'gpt-6-astra',
      options: { reasoningEffort: 'high', serviceTier: 'default' },
    };
    const response = {
      taskId: 'synthetic:task',
      childThreadId: 'synthetic:thread',
      childNodeId: 'synthetic:node',
      childRunId: 'synthetic:run:1',
      ...selection,
      options: Object.entries(selection.options).map(([id, value]) => ({
        id,
        value,
      })),
      status: 'completed',
      workState: 'result_available',
      hasPendingChildRuns: false,
      hasPendingQuestion: false,
      pendingApproval: null,
      latestTerminalRunId: 'synthetic:run:1',
      latestTerminalStatus: 'completed',
      waitTimedOut: false,
      summary: 'Synthetic confirmation of P6 decisions.',
      resultContextTransferId: 'synthetic:result',
    };
    const issue = join(root, 'issue.json');
    await writeFile(issue, '{"number":766,"body":"Synthetic fixture"}');
    const stage = join(root, 'runs/staging');
    const config = join(root, 'config.json');
    await writeFile(
      config,
      JSON.stringify({
        author: { ...selection, model: 'gpt-6.1-sol' },
        request: {
          role: 'review',
          mode: 'async',
          task: `Review frozen ${commit}. Synthetic fixture review.`,
          target: selection,
        },
        inputs: [
          {
            kind: 'issue',
            identity: 'synthetic:766',
            fetchedAt: new Date().toISOString(),
            path: issue,
          },
        ],
      }),
    );
    await command(
      '--capture-t3',
      stage,
      '--config',
      config,
      '--caller-json',
      JSON.stringify({ threadId: 'synthetic:parent' }),
      '--root',
      root,
    );
    const dispatch = join(root, 'dispatch.json');
    await writeFile(dispatch, JSON.stringify({ structuredContent: response }));
    const ids = await writeIds(root, p6Ids());
    return { ...checkout, stage, dispatch, ids, config };
  }
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
  async function completedT3Fixture({ curation }: { curation?: unknown } = {}) {
    const checkout = await t3Checkout({ curation });
    const { syntheticTools } = await import('./t3-code-mode-fixture');
    const adapter = await syntheticTools({ dir: checkout.stage });
    await adapter.execute('dispatch');
    const fullReport = Buffer.from(
      'Synthetic disposable mixed-record review.\nAll named fixture records confirmed.\n',
    );
    const reportPath = join(checkout.root, 'full-review.md');
    await writeFile(reportPath, fullReport);
    const { runId } = await adapter.execute('complete', reportPath);
    const archived = join(checkout.root, 'runs', String(runId));
    const { rename } = await import('node:fs/promises');
    await rename(checkout.stage, archived);
    return { ...checkout, archived, runId: String(runId), fullReport };
  }
  it('promotes a disposable T3 mixed selection with a byte-identical committed report and verifies after review-input cleanup', async () => {
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
  });
  it('rejects formatter-invalid T3 mixed promotion with every byte and directory unchanged', async () => {
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
  });
  it.each([
    'empty IDs',
    'duplicate IDs',
    'changed record',
    'changed source',
    'changed report',
    'changed original message',
    'changed HEAD',
  ])(
    'rejects T3 %s at record time without promotion/report/receipt writes',
    async (problem) => {
      const { root, archived, ids } = await completedT3Fixture();
      if (problem === 'empty IDs') await writeFile(ids, '');
      if (problem === 'duplicate IDs')
        await writeFile(ids, `${p6Ids()[0]}\n${p6Ids()[0]}\n`);
      if (problem === 'changed record' || problem === 'changed source') {
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
      }
      if (problem === 'changed report') {
        await chmod(join(archived, 'report.snapshot.md'), 0o644);
        await writeFile(join(archived, 'report.snapshot.md'), 'Changed report');
        await chmod(join(archived, 'report.snapshot.md'), 0o444);
      }
      if (problem === 'changed original message') {
        const path = join(archived, 'dispatch.json');
        const value = JSON.parse(await readFile(path, 'utf8'));
        value.observations[0].response.structuredContent.items[0].text =
          'Foreign task';
        await chmod(path, 0o644);
        await writeFile(path, JSON.stringify(value));
        await chmod(path, 0o444);
      }
      if (problem === 'changed HEAD')
        await run('git', [
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
        ]);
      const before = await snapshotTree(root);
      await expect(
        command('--t3-run', archived, '--ids', ids, '--root', root),
      ).rejects.toBeDefined();
      expect(await snapshotTree(root)).toEqual(before);
    },
  );
  it('promotes the drafted P6 decisions into exactly the committed ledger, receipt and report', async () => {
    const { root, runDir } = await draftedCheckout();
    const { stdout: listed } = await command('--list', '--root', root);
    expect(listed).toContain(`drafted\t-\t${perfectScholar}\n`);
    await command(
      '--run',
      runDir,
      '--ids',
      await writeIds(root, p6Ids()),
      '--root',
      root,
    );
    const at = (path: string) => readFile(join(root, path));
    const committed = (path: string) => readFile(join(repo, path));
    for (const path of [
      'scripts/catalog/everythingpath-identities.json',
      `${reviewReportsDirectory}/${p6RulesReview.runId}.md`,
    ])
      expect(await at(path)).toEqual(await committed(path));
    // The committed receipts hold later reviews' too: the rebuild is the
    // committed file, as the record step writes it, with P6's receipt alone.
    const receiptsPath = 'scripts/catalog/review-receipts.json';
    const format = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
    const committedReceipts = (await committed(receiptsPath)).toString('utf8');
    const { receipts: all } = JSON.parse(committedReceipts) as {
      receipts: { runId: string }[];
    };
    expect(format({ receipts: all })).toBe(committedReceipts);
    expect((await at(receiptsPath)).toString('utf8')).toBe(
      format({
        receipts: all.filter(({ runId }) => runId === p6RulesReview.runId),
      }),
    );
    await expect(
      command('--verify', '--root', root, '--runs', join(root, 'runs')),
    ).resolves.toMatchObject({
      stdout: expect.stringContaining('1 receipts verified.\n'),
    });
  });

  // Snapshot every directory and byte, including the absence of report copies.
  async function snapshotTree(root: string): Promise<Record<string, string>> {
    const entries: Record<string, string> = {};
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        entries[`${entry.name}/`] = '';
        for (const [path, bytes] of Object.entries(
          await snapshotTree(join(root, entry.name)),
        ))
          entries[`${entry.name}/${path}`] = bytes;
      } else
        entries[entry.name] = (await readFile(join(root, entry.name))).toString(
          'base64',
        );
    }
    return entries;
  }
  function mixedCuration({ duplicateAlias = false } = {}) {
    // Safe Shot uses the feature key/hash and exact source locator (#716).
    const drafted = {
      externalKey: 'everythingpath/fighter-archer-safe-shot',
      sourceSha256: safeShotSha256,
      fields: {},
      noMechanics: true,
      resolves: [
        { kind: 'ownedFeature', id: `pcgen:${apg}#Fighter Archer ~ Safe Shot` },
      ],
      rationale:
        'APG p.104: not provoking attacks of opportunity with a bow is not calculated on the sheet.',
      status: 'drafted',
    };
    const situations = reviewedCuration.situations
      .slice(0, 2)
      .map((entry) => ({ ...entry }));
    const [first, second] = situations;
    if (!first || !second)
      throw new Error('Missing published Situation fixtures');
    if (duplicateAlias) second.aliases = [...first.aliases];
    return { records: [], structures: [drafted], situations };
  }
  it('settles the actual mapped Safe Shot feature in the mixed fixture', async () => {
    const { readPcgenFixtureTree } = await import('./pcgen-716-tree');
    const { buildEffectiveView } =
      await import('../../scripts/catalog/pcgen/effective');
    const { mapArchetypeFeature } =
      await import('../../scripts/catalog/pcgen/archetypes');
    const { applyStructureCuration } =
      await import('../../scripts/catalog/structure-curation');
    const tree = await readPcgenFixtureTree([apg]);
    const effective = [...buildEffectiveView(tree).records.values()].find(
      ({ record }) => record.locator.key === 'Fighter Archer ~ Safe Shot',
    );
    if (!effective) throw new Error('No pinned Safe Shot feature.');
    const subject = mapArchetypeFeature({
      effective,
      externalKey: 'everythingpath/fighter-archer-safe-shot',
    });
    const data = parseCuration(mixedCuration());
    const checked = {
      ...data,
      structures: data.structures?.map((record) => ({
        ...record,
        status: 'checked' as const,
        reviewedBy: 'Synthetic fixture',
        reviewedOn: '2026-10-23',
        receipt: p6RulesReview.runId,
      })),
    };
    const reportOf = (data: ReturnType<typeof parseCuration>) =>
      applyStructureCuration({
        subjects: [subject],
        items: [],
        ownedFeatures: [
          {
            externalKey: subject.entry.externalKey,
            sourceSha256: subject.sourceSha256,
            locator: subject.locator,
            owner: `pcgen:${apg}#Fighter Archetype ~ Archer`,
          },
        ],
        data,
        variantDecisions: [],
      });
    const report = reportOf(checked);
    expect(report.passed).toBe(true);
    expect(report.unreviewedFeatures).toEqual([]);
    expect(report.held).toEqual([]);
    expect(subject.locator).toBe(`pcgen:${apg}#Fighter Archer ~ Safe Shot`);
    expect(data.structures?.[0]?.sourceSha256).toBe(subject.sourceSha256);
    const ownerPart = (line: number) => ({
      source: {
        source: 'pcgen' as const,
        locator: { file: apg, line, key: 'Fighter Archetype ~ Archer' },
      },
      text: apgLines[line - 1] ?? '',
    });
    const ownerHash = hashStructureSource([ownerPart(2102), ownerPart(3667)]);
    for (const changes of [
      { externalKey: 'everythingpath/fighter-archer' },
      { sourceSha256: ownerHash },
      {
        resolves: [
          {
            kind: 'ownedFeature' as const,
            id: `pcgen:${apg}#Archer ~ Safe Shot`,
          },
        ],
      },
    ]) {
      const rejected = reportOf({
        ...checked,
        structures: checked.structures?.map((record) => ({
          ...record,
          ...changes,
        })),
      });
      expect(rejected.passed).toBe(false);
      expect(
        rejected.unreviewedFeatures.map((feature) => feature.locator),
      ).toEqual([subject.locator]);
      expect(rejected.held).toEqual([
        'everythingpath/fighter-archer-safe-shot',
      ]);
    }
  });
  it('rejects formatter-invalid mixed ledger/structure promotion without changing any byte or directory', async () => {
    const curation = mixedCuration({ duplicateAlias: true });
    // Structural validation accepts this; the writer's alias invariant rejects it.
    expect(() => parseCuration(curation)).not.toThrow();
    const { root, runDir } = await draftedCheckout({ curation });
    const structureIds = listStructureReviews(
      parseCuration(curation).structures ?? [],
    ).map(({ id }) => id);
    const ids = await writeIds(root, [...p6Ids(), ...structureIds]);
    const before = await snapshotTree(root);
    await expect(
      command('--run', runDir, '--ids', ids, '--root', root),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('Situation alias'),
    });
    expect(await snapshotTree(root)).toEqual(before);
  });
  it('successfully records a valid mixed ledger/structure selection', async () => {
    const curation = mixedCuration();
    const { root, runDir } = await draftedCheckout({ curation });
    const structureIds = listStructureReviews(
      parseCuration(curation).structures ?? [],
    ).map(({ id }) => id);
    await command(
      '--run',
      runDir,
      '--ids',
      await writeIds(root, [...p6Ids(), ...structureIds]),
      '--root',
      root,
    );
    const recorded = parseReviewReceipts(
      JSON.parse(
        await readFile(
          join(root, 'scripts/catalog/review-receipts.json'),
          'utf8',
        ),
      ),
    );
    expect(recorded.receipts[0]?.covers.map(({ id }) => id)).toEqual([
      ...p6Ids(),
      ...structureIds,
    ]);
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
    await expect(
      command('--verify', '--root', root, '--runs', join(root, 'runs')),
    ).resolves.toMatchObject({
      stdout: expect.stringContaining('1 receipts verified.'),
    });
  });
  it.each([
    { name: 'empty', ids: [], error: 'lists no record' },
    {
      name: 'duplicate',
      ids: [perfectScholar, perfectScholar],
      error: 'nonempty and unique',
    },
  ])(
    'rejects $name selected IDs without any writes',
    async ({ ids, error }) => {
      const { root, runDir } = await draftedCheckout();
      const idsFile = await writeIds(root, ids);
      const before = await snapshotTree(root);
      await expect(
        command('--run', runDir, '--ids', idsFile, '--root', root),
      ).rejects.toMatchObject({ stderr: expect.stringContaining(error) });
      expect(await snapshotTree(root)).toEqual(before);
    },
  );

  it('writes nothing when the ledger is inconsistent once the records are checked', async () => {
    const { root, runDir } = await draftedCheckout();
    const before = await readFile(
      join(root, 'scripts/catalog/everythingpath-identities.json'),
    );
    await expect(
      command(
        '--run',
        runDir,
        '--ids',
        await writeIds(root, [perfectScholar]),
        '--root',
        root,
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        'no checked separate-identities decision',
      ),
    });
    expect(
      await readFile(
        join(root, 'scripts/catalog/everythingpath-identities.json'),
      ),
    ).toEqual(before);
    await expect(readdir(join(root, reviewReportsDirectory))).rejects.toThrow();
  });

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

  // A recorded checkout, and --verify against its runs directory.
  async function recordedCheckout({
    runId = snapshotRun,
  }: { runId?: string } = {}) {
    const checkout = await draftedCheckout({ runId });
    await command(
      '--run',
      checkout.runDir,
      '--ids',
      await writeIds(checkout.root, p6Ids()),
      '--root',
      checkout.root,
    );
    const verify = () =>
      command(
        '--verify',
        '--root',
        checkout.root,
        '--runs',
        join(checkout.root, 'runs'),
      );
    return { ...checkout, verify };
  }

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

  // #716 P10a: the Advanced Class Origins confirmation, drafted, with its
  // pcgen:PZO9451 block, and no other #716 book's.
  const aco = 'player_companion/advanced_class_origins/OGL.txt';
  const withConfirmation = async (root: string) => {
    const { confirmations, registry } = draftedSection15();
    await mkdir(join(root, 'scripts/catalog/legal'), { recursive: true });
    await writeFile(
      join(root, 'scripts/catalog/legal/section15-confirmations-716.json'),
      `${JSON.stringify(
        {
          confirmations: confirmations.filter(({ code }) => code === 'PZO9451'),
        },
        null,
        2,
      )}\n`,
    );
    await mkdir(join(root, 'src/lib/catalog/data'), { recursive: true });
    await writeFile(
      join(root, 'src/lib/catalog/data/section15-registry.json'),
      `${JSON.stringify(
        Object.fromEntries(
          Object.entries(registry).filter(
            ([key]) => !key.startsWith('pcgen:') || key === 'pcgen:PZO9451',
          ),
        ),
        null,
        2,
      )}\n`,
    );
  };

  it('verifies a confirmation against the OGL.txt of the checkout it records into', async () => {
    const { root, runDir } = await draftedCheckout({
      runId: snapshotRun,
      before: withConfirmation,
    });
    // The committed ledger, whose P6 decisions are checked, so the ledger is
    // consistent once the confirmation alone is recorded.
    await cp(
      join(repo, 'scripts/catalog/everythingpath-identities.json'),
      join(root, 'scripts/catalog/everythingpath-identities.json'),
    );
    const recordAco = async () =>
      command(
        '--run',
        runDir,
        '--ids',
        await writeIds(root, ['section15-confirmation PZO9451']),
        '--root',
        root,
      );
    // This checkout pins the file; the selected one doesn't.
    await expect(recordAco()).rejects.toMatchObject({
      stderr: expect.stringContaining("pcgen:PZO9451's confirmation is stale."),
    });
    const pinned = join(
      root,
      'tests/fixtures/pinned/pcgen',
      pcgenPin.directory,
      aco,
    );
    await mkdir(join(pinned, '..'), { recursive: true });
    await writeFile(pinned, 'Another OGL.txt.\n');
    await expect(recordAco()).rejects.toMatchObject({
      stderr: expect.stringContaining("pcgen:PZO9451's confirmation is stale."),
    });
    await cp(
      join(repo, 'tests/fixtures/pinned/pcgen', pcgenPin.directory, aco),
      pinned,
    );
    await recordAco();
    const recorded = JSON.parse(
      await readFile(
        join(root, 'scripts/catalog/legal/section15-confirmations-716.json'),
        'utf8',
      ),
    );
    expect(recorded.confirmations[0].review).toMatchObject({
      status: 'checked',
      receipt: snapshotRun,
    });
    const registry = JSON.parse(
      await readFile(
        join(root, 'src/lib/catalog/data/section15-registry.json'),
        'utf8',
      ),
    );
    expect(registry['pcgen:PZO9451'].reviewStatus).toBe('reviewed');
  });

  // Granted-levels S1b: the committed map with every record drafted, as the
  // curator wrote it, whether or not the record step has checked it since.
  const chaosDomain = 'pf1/Mh85MGrAFDPWHI3m';
  const draftedMap = () => {
    const map = structuredClone(grantedSpellMapData);
    for (const record of [...map.features, ...map.optionOwners]) {
      for (const field of ['reviewedBy', 'reviewedOn', 'receipt'])
        delete (record as Record<string, unknown>)[field];
      record.status = 'drafted';
    }
    return map;
  };
  const writeMap = async (root: string, map: unknown) => {
    await mkdir(join(root, 'scripts/catalog'), { recursive: true });
    await writeFile(
      join(root, grantedSpellMapPath),
      `${JSON.stringify(map, null, 2)}\n`,
    );
  };
  // The committed ledger, whose P6 decisions are checked, so the ledger is
  // consistent once a map record alone is recorded.
  const grantedSpellCheckout = async () => {
    const checkout = await draftedCheckout({
      runId: snapshotRun,
      before: (root) => writeMap(root, draftedMap()),
    });
    await cp(
      join(repo, 'scripts/catalog/everythingpath-identities.json'),
      join(checkout.root, 'scripts/catalog/everythingpath-identities.json'),
    );
    return checkout;
  };

  it('promotes a drafted granted-spell record and writes only its review into the map', async () => {
    const { root, runDir } = await grantedSpellCheckout();
    const before = parseGrantedSpellMap(draftedMap());
    const [record] = listGrantedSpellReviews(before).filter(({ id }) =>
      id.startsWith(`granted-spells ${chaosDomain} `),
    );
    if (!record) throw new Error('No Chaos Domain map record.');
    await command(
      '--run',
      runDir,
      '--ids',
      await writeIds(root, [record.id]),
      '--root',
      root,
    );
    const recorded = parseGrantedSpellMap(
      JSON.parse(await readFile(join(root, grantedSpellMapPath), 'utf8')),
    );
    const checked = recorded.features.filter(
      ({ status }) => status === 'checked',
    );
    expect(checked.map(({ featureKey }) => featureKey)).toEqual([chaosDomain]);
    expect(checked[0]).toMatchObject({ receipt: snapshotRun });
    // The rest of the map is as it was.
    expect(
      recorded.features.filter(({ featureKey }) => featureKey !== chaosDomain),
    ).toEqual(
      before.features.filter(({ featureKey }) => featureKey !== chaosDomain),
    );
    expect(recorded.optionOwners).toEqual(before.optionOwners);
  });

  it('refuses a granted-spell record whose body hash moved since the review started', async () => {
    const { root, runDir } = await grantedSpellCheckout();
    const map = draftedMap();
    const [first] = map.features;
    if (!first) throw new Error('The committed map has no record.');
    const id = `granted-spells ${first.featureKey} sha256:${first.bodySha256}`;
    first.bodySha256 = 'f'.repeat(64);
    await writeMap(root, map);
    await expect(
      command(
        '--run',
        runDir,
        '--ids',
        await writeIds(root, [id]),
        '--root',
        root,
      ),
    ).rejects.toMatchObject({ stderr: expect.stringContaining(id) });
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
