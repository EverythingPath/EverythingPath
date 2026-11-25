/**
 * What the review-receipts test files share: the committed receipts and the
 * P6 rules review they record, and the record step command's checkouts and
 * runs (recordStepHarness).
 */
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
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll } from 'vitest';
import { listRuleValueReviews } from '../../scripts/catalog/curation';
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
import {
  listTraitClassSkillChoiceReviews,
  parseTraitClassSkillChoiceList,
} from '../../scripts/catalog/trait-class-skill-choices';
import traitChoiceListData from '../../scripts/catalog/reviewed-trait-class-skill-choices.json';
import {
  listReviewedPcgenRecordReviews,
  parseReviewedPcgenRecords,
} from '../../scripts/catalog/reviewed-pcgen-records';
import pcgenRecordsData from '../../scripts/catalog/reviewed-pcgen-records.json';
import { pcgenPin } from '../../scripts/catalog/inventory';
import {
  committedSection15Confirmations,
  listSection15Reviews,
} from '../../scripts/catalog/legal/section15-confirmations';
import {
  findReceiptProblems,
  hashReport,
  parseReviewReceipts,
  reviewReportsDirectory,
  type ReviewedRecord,
} from '../../scripts/catalog/review-receipts';
import receiptsData from '../../scripts/catalog/review-receipts.json';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import {
  hashStructureSource,
  listStructureReviews,
} from '../../scripts/catalog/structure-curation';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';
import { readPinned } from './pinned-sources';
import { draftedSection15 } from './section15-drafted';

// #757 compatibility fixture: preserve P6's exact historical meta/report/ledger
// bytes. This is not renewed semantic approval of inherited rationales; the
// authentic #766 review identifies nine wording corrections for later review.
export const p6RulesReview = {
  runId: 'reviewer-20261018-081620-1216172',
  reportSha256:
    '0fa467ace83783ca800b5618dbf257caf4881dd93ca4858c7dfc619380914559',
};
export const repo = fileURLToPath(new URL('../../', import.meta.url));
// The commit P6's rules review read in its detached checkout.
export const p6ReviewedCommit = '26f0af51900a81843ceefbe83e59897d2c19c21d';
export const p6Run = new URL(
  `../fixtures/review-757/${p6RulesReview.runId}/`,
  import.meta.url,
);
export const runFile = (name: string) => readFile(new URL(name, p6Run), 'utf8');
export const reportsDirectory = join(repo, reviewReportsDirectory);
export const reportSha256s = new Map(
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

export const ledger = parseIdentityLedger(ledgerData);
export const receipts = parseReviewReceipts(receiptsData);
export const listLiveRecords = () => [
  ...listLedgerReviews(structuredClone(ledger)),
  ...listStructureReviews(structuredClone(reviewedCuration.structures ?? [])),
  ...listRuleValueReviews(structuredClone(reviewedCuration.ruleValues ?? [])),
  ...listSection15Reviews({
    confirmations: structuredClone(committedSection15Confirmations),
    registry: structuredClone(section15Registry),
  }),
  ...listGrantedSpellReviews(parseGrantedSpellMap(grantedSpellMapData)),
  ...listTraitClassSkillChoiceReviews(
    parseTraitClassSkillChoiceList(traitChoiceListData),
  ),
  ...listReviewedPcgenRecordReviews(
    parseReviewedPcgenRecords(pcgenRecordsData),
  ),
];
// Inner Sea Intrigue p.38's Perfect Scholar and its Unchained Monk version.
export const perfectScholar =
  'separate-identities everythingpath/monk-perfect-scholar + everythingpath/unchained-monk-perfect-scholar';
export const p6Ids = () =>
  receipts.receipts
    .find(({ runId }) => runId === p6RulesReview.runId)
    ?.covers.map(({ id }) => id) ?? [];
export function findRecord(records: readonly ReviewedRecord[], id: string) {
  const record = records.find((candidate) => candidate.id === id);
  if (!record) throw new Error(`No reviewed record ${id}.`);
  return record;
}
export const findProblemsWith = ({
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

// Safe Shot, APG p.104: the owned feature's own PCGen row, not Archer's owner.
export const apg =
  'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
export const apgLines = (
  await readPinned('pcgen', `${pcgenPin.directory}/${apg}`)
).split(/\r?\n/);

export const safeShotSha256 = hashStructureSource([
  {
    source: {
      source: 'pcgen',
      locator: { file: apg, line: 2121, key: 'Fighter Archer ~ Safe Shot' },
    },
    text: apgLines[2120] ?? '',
  },
]);
/**
 * The record step command's helpers, made inside a describe: the checkouts
 * they make are removed after it.
 */
export function recordStepHarness() {
  const run = promisify(execFile);
  const scratch: string[] = [];
  afterAll(() =>
    Promise.all(scratch.map((path) => rm(path, { recursive: true }))),
  );
  /**
   * The commands' system temporary directory, a directory of its own beside
   * the checkouts: a round command declines a TMPDIR that contains the round
   * it operates on, and every checkout here lies in the test's TMPDIR.
   */
  let temporary: string | undefined;
  const temporaryDirectory = async () => {
    if (temporary === undefined) {
      temporary = await mkdtemp(join(tmpdir(), 'record-step-tmp-'));
      scratch.push(temporary);
    }
    return temporary;
  };
  /** The record step's two command forms: through the launcher, or under tsx. */
  const forms = {
    launcher: [
      'scripts/catalog/start-without-tsx-cache.mjs',
      'scripts/catalog-record-review.ts',
    ],
    tsx: ['--import', 'tsx', 'scripts/catalog-record-review.ts'],
  };
  /**
   * Runs the record step as the base gate did: tsx's disk cache on (the
   * switch absent), in the documented form or under tsx alone.
   */
  const commandIn = async (
    form: keyof typeof forms,
    args: string[],
    {
      tmp,
      epOrch,
    }: {
      tmp?: string;
      // EP_ORCH for the command: this process's (absent), set (a value) or
      // unset (null).
      epOrch?: string | null;
    } = {},
  ) => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      TMPDIR: tmp ?? (await temporaryDirectory()),
    };
    delete env.TSX_DISABLE_CACHE;
    if (epOrch === null) delete env.EP_ORCH;
    else if (epOrch !== undefined) env.EP_ORCH = epOrch;
    return run(process.execPath, [...forms[form], ...args], {
      cwd: repo,
      env,
      maxBuffer: 1 << 26,
    });
  };
  // The round commands start through their launcher, as documented.
  const command = (...args: string[]) =>
    commandIn(
      /^--(?:capture-t3|bind-t3|complete-t3|t3-run|verify)$/.test(args[0] ?? '')
        ? 'launcher'
        : 'tsx',
      args,
    );

  // A ledger record's review as its implementer wrote it, before any review.
  type LedgerReview = {
    review: { rationale: string; evidence: string; receipt?: string };
  };
  const draftReview = (record: LedgerReview) => {
    const { rationale, evidence } = record.review;
    Object.assign(record, {
      review: { status: 'drafted', rationale, evidence },
    });
  };
  const ledgerReviews = (data: typeof ledgerData): LedgerReview[] => [
    ...data.variantDecisions,
    ...data.heldSources,
  ];
  // A checkout whose ledger has the 31 P6 decisions drafted, as the
  // implementer wrote them, so its merges and same-KEY splits are unchecked.
  // Its held sources are drafted too, as they were at P6: a later review
  // checked the USH one (records-backlog-1), and this checkout's receipts
  // are empty, so leaving it checked would make the ledger inconsistent.
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
    for (const record of ledgerReviews(drafted)) draftReview(record);
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
  // Each test on a completed T3 round builds it with real bridge processes
  // and runs --t3-run (and --verify) through the launcher, tsx's cache off:
  // over 5 s each locally (nine timed out at Vitest's local default), so they
  // take the limit CI gives them (vitest.config.ts), locally too.
  const t3Round = 120_000;
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

  // #716 P10a: the Advanced Class Origins confirmation, drafted, with its
  // pcgen:PZO9451 block, and no other #716 book's.
  const aco = 'player_companion/advanced_class_origins/OGL.txt';
  const withConfirmation = async (root: string) => {
    const { confirmations, registry } = draftedSection15();
    await mkdir(
      dirname(
        join(root, 'scripts/catalog/legal/section15-confirmations-716.json'),
      ),
      { recursive: true },
    );
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
  return {
    run,
    scratch,
    temporaryDirectory,
    forms,
    commandIn,
    command,
    draftReview,
    ledgerReviews,
    snapshotRun,
    draftedCheckout,
    writeIds,
    t3Checkout,
    t3Round,
    completedT3Fixture,
    snapshotTree,
    mixedCuration,
    recordedCheckout,
    aco,
    withConfirmation,
    chaosDomain,
    draftedMap,
    writeMap,
    grantedSpellCheckout,
  };
}
