import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, vi } from 'vitest';
import { committedReviewedPcgenRecords } from '../../scripts/catalog/reviewed-pcgen-records';
import { pinnedPcgenListPath } from '../../scripts/catalog/pinned-pcgen-store';
import {
  buildPartyScope,
  decodePartyScope,
  partyScopeBytes,
  partyScopePath,
  type PartyCatalogEntry,
} from '../../scripts/catalog/party/party-scope';
import { parsePartyBuilds } from '../../scripts/catalog/party/party-builds';
import { materializePinnedTree } from './pinned-sources';
import {
  absent,
  checkouts,
  reads,
  resetProbes,
  standIn,
  standInBuilds,
  standInReviewed,
} from './reviewed-line-unverified-probes';

// The fixture and command helpers the `reviewed-line-unverified-*.test.ts`
// files share. Their property (root, 2026-11-20): a reviewed-record match is
// never admitted while the gate cannot read and verify its pinned line.

export const apgClass =
  'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
export const row = 'pf1/mrJ61WiA6PuZgPTJ';
export const slow = 120_000;
export const cavalier = 'pf1/u1ed3H9xtYQXTP5v';
export const standInClass = 'pf1/StandInCavalier0';

export const loseList = () => absent.paths.add(pinnedPcgenListPath(apgClass));
export const listMissing =
  /^The pinned PCGen list tests\/fixtures\/pinned\/pcgen\/.+\/apg_abilities_class\.lst is missing from the pinned store/;

export const admittedOf = (keys: readonly string[]) =>
  keys.filter((key) => key === row || key === cavalier || key === standInClass);

type Tree = Awaited<ReturnType<typeof materializePinnedTree>>;
export type Fixture = {
  tree: Tree;
  standInTree: Tree;
  root: string;
  attribution: string;
};

export function useFixture(): Fixture {
  const fixture = {} as Fixture;
  afterEach(resetProbes);
  beforeAll(async () => {
    fixture.tree = await materializePinnedTree([
      'pf1/packs/class-abilities/master-tacitician.mrJ61WiA6PuZgPTJ.yaml',
      'pf1/packs/classes/cavalier.u1ed3H9xtYQXTP5v.yaml',
    ]);
    // Under another key, so the Cavalier's reviewed schedule (keyed by its
    // key) does not apply to the stand-in.
    fixture.standInTree = await materializePinnedTree([
      'pf1/packs/class-abilities/master-tacitician.mrJ61WiA6PuZgPTJ.yaml',
      'pf1/packs/classes/cavalier.u1ed3H9xtYQXTP5v.yaml',
    ]);
    const classes = join(fixture.standInTree.systemPath, 'packs/classes');
    const original = join(classes, 'cavalier.u1ed3H9xtYQXTP5v.yaml');
    const text = await readFile(original, 'utf8');
    const standInText = text
      .replaceAll('u1ed3H9xtYQXTP5v', standInClass.slice('pf1/'.length))
      .replace(
        /( {4}classAssociations:\n)(?: {6}- level: \d+\n {8}uuid: [^\n]+\n)+/,
        '$1      - level: 17\n        uuid: Compendium.pf1.class-abilities.Item.mrJ61WiA6PuZgPTJ\n',
      );
    expect(standInText.match(/- level:/g)).toHaveLength(1);
    await rm(original);
    await writeFile(
      join(classes, `cavalier.${standInClass.slice('pf1/'.length)}.yaml`),
      standInText,
    );
    fixture.root = await mkdtemp(join(tmpdir(), 'reviewed-line-unverified-'));
    // No assessment: the row is admitted on its book (PZO1115), which the
    // committed Registry reviews.
    fixture.attribution = join(fixture.root, 'attribution.json');
    await writeFile(
      fixture.attribution,
      JSON.stringify({
        assessments: [],
        evidence: {},
        registry: JSON.parse(
          readFileSync('src/lib/catalog/data/section15-registry.json', 'utf8'),
        ) as unknown,
      }),
    );
  });
  afterAll(async () => {
    await fixture.tree.dispose();
    await fixture.standInTree.dispose();
    await rm(fixture.root, { recursive: true, force: true });
  });
  return fixture;
}

export const verificationPath =
  'scripts/catalog/scopes/campaign-mvp-v1.verification.json';
export const listPath = pinnedPcgenListPath(apgClass);
// Read before any case loses the list.
const listSha256 = createHash('sha256')
  .update(readFileSync(listPath))
  .digest('hex');
/**
 * The committed verification projection with the pinned list bound and a
 * synthetic row for the record; `inputs` overrides bound hashes.
 */
export function checkedProjection(inputs: Record<string, string> = {}) {
  const committed = JSON.parse(readFileSync(verificationPath, 'utf8')) as {
    binding: { inputs: Record<string, string>; packages: unknown };
    rows: { key: string }[];
  };
  const rows = [
    ...committed.rows,
    {
      key: row,
      verified: ['admission', 'structure'],
      mechanisms: [],
      prose: [],
      evidence: [],
    },
  ].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return {
    ...committed,
    binding: {
      ...committed.binding,
      inputs: Object.fromEntries(
        Object.entries({
          ...committed.binding.inputs,
          [listPath]: listSha256,
          ...inputs,
        }).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      ),
    },
    rows,
  };
}
const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');

export async function runScript(
  load: () => Promise<unknown>,
  argv: string[] = [],
) {
  const saved = process.argv;
  const savedExitCode = process.exitCode;
  process.argv = [saved[0] ?? 'node', 'script', ...argv];
  let printed = '';
  let progress = '';
  const write = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      printed += String(chunk);
      return true;
    });
  const writeProgress = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      progress += String(chunk);
      return true;
    });
  const exited = new Error('exit 0');
  const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw code === 0 || code === undefined
      ? exited
      : new Error(`exit ${String(code)}`);
  });
  // Evaluated afresh each run, as a command is.
  vi.resetModules();
  try {
    const error = await load().then(
      () => undefined,
      (failure: unknown) => (failure === exited ? undefined : failure),
    );
    return { error, printed, progress };
  } finally {
    write.mockRestore();
    writeProgress.mockRestore();
    exit.mockRestore();
    process.argv = saved;
    process.exitCode = savedExitCode;
  }
}

export type Gate = Record<
  'admitted' | 'held' | 'dependentOmissions' | 'failures',
  { externalKey: string }[]
>;
export type Report = {
  total: Record<'admitted' | 'held' | 'omitted' | 'failed', number>;
};

/**
 * `catalog:party-scope --status` run as its script, with the row's tree for
 * the pinned checkouts, which remote CI lacks.
 */
export function useStatusFixture(fixture: Fixture) {
  let scope: string;
  let fixtureReviewed: string;
  const builds = JSON.stringify({
    schemaVersion: 1,
    scopeVersion: 'campaign-party-v1',
    note: 'Fixture.',
    characters: [
      {
        id: '3',
        kind: 'character',
        race: { kind: 'open', note: 'Fixture.' },
        levels: {
          kind: 'written',
          build: {
            now: [{ class: 'Cavalier', level: 17 }],
            next: {
              kind: 'known',
              classes: [{ class: 'Cavalier', level: 18 }],
            },
          },
        },
        keys: {
          classes: [{ kind: 'matched', key: cavalier, name: 'Cavalier' }],
          classFeatures: [
            { kind: 'matched', key: row, name: 'Master Tacitician' },
          ],
        },
      },
    ],
  });
  async function previewNow() {
    const out = await mkdtemp(join(fixture.root, 'status-preview-'));
    standInReviewed.text = fixtureReviewed;
    vi.resetModules();
    const { runCatalogPreviewCommand } =
      await import('../../scripts/catalog/preview');
    try {
      const outcome = await runCatalogPreviewCommand({
        args: [
          '--system',
          fixture.tree.systemPath,
          '--content',
          fixture.tree.contentPath,
          '--allow-unverified-checkouts',
          '--out',
          out,
        ],
      });
      return { outcome, out };
    } finally {
      standInReviewed.text = undefined;
    }
  }
  async function makePreview() {
    const { outcome, out } = await previewNow();
    expect(outcome.stdout).toContain('Admission:');
    return out;
  }
  const readGate = async (preview: string) =>
    JSON.parse(await readFile(join(preview, 'admission.json'), 'utf8')) as Gate;
  function scopeStates(gate: Gate) {
    const keys = decodePartyScope(JSON.parse(scope)).rows.map(({ key }) => key);
    const has = (rows: { externalKey: string }[], key: string) =>
      rows.some(({ externalKey }) => externalKey === key);
    return Object.fromEntries(
      keys.map((key) => [
        key,
        has(gate.failures, key)
          ? 'failed'
          : has(gate.held, key)
            ? 'held'
            : has(gate.dependentOmissions, key)
              ? 'omitted'
              : has(gate.admitted, key)
                ? 'admitted'
                : 'absent',
      ]),
    );
  }
  const counted = (states: Record<string, string>) => ({
    admitted: Object.values(states).filter((state) => state === 'admitted')
      .length,
    held: Object.values(states).filter((state) => state === 'held').length,
    omitted: Object.values(states).filter((state) => state === 'omitted')
      .length,
    failed: Object.values(states).filter((state) => state === 'failed').length,
  });
  beforeAll(async () => {
    fixtureReviewed = await readFile(fixture.attribution, 'utf8');
    const preview = await makePreview();
    const catalog = JSON.parse(
      await readFile(join(preview, 'catalog.json'), 'utf8'),
    ) as { entries: PartyCatalogEntry[]; resources: PartyCatalogEntry[] };
    scope = partyScopeBytes(
      buildPartyScope({
        builds: parsePartyBuilds(JSON.parse(builds)),
        buildsBytes: builds,
        catalog: {
          entries: [...catalog.entries, ...catalog.resources],
          upstream: [],
        },
      }),
    );
  }, slow);

  async function status(
    projection: unknown,
    { json = true, args = [] as string[], buildsBytes = builds } = {},
  ) {
    standIn.files.set(partyScopePath, scope);
    if (projection === undefined) absent.paths.add(verificationPath);
    else standIn.files.set(verificationPath, JSON.stringify(projection));
    standInBuilds.bytes = buildsBytes;
    standInReviewed.text = fixtureReviewed;
    checkouts.tree = fixture.tree;
    reads.paths.length = 0;
    return runScript(
      () => import('../../scripts/catalog-party-scope.ts'),
      ['--status', ...(json ? ['--json'] : []), ...args],
    );
  }
  async function statusBesideFresh(projection: unknown) {
    const run = await status(projection);
    expect(run.error).toBeUndefined();
    const fresh = scopeStates(await readGate(await makePreview()));
    return { report: JSON.parse(run.printed) as Report, fresh };
  }
  const reportCounts = ({ total }: Report) => ({
    admitted: total.admitted,
    held: total.held,
    omitted: total.omitted,
    failed: total.failed,
  });
  const staleRefusal = (input: string) =>
    new RegExp(
      `^The committed verification projection is stale \\(.*${escapeRegExp(input)}.*no status is printed`,
    );
  function edited(path: string, edit: (text: string) => string) {
    const text = edit(readFileSync(path, 'utf8'));
    return {
      text,
      sha256: createHash('sha256').update(text).digest('hex'),
    };
  }
  const changedLine = () =>
    edited(listPath, (text) => {
      const [record] = committedReviewedPcgenRecords;
      const lines = text.split('\n');
      const index = lines.findIndex((line) =>
        line.split('\t').includes(`KEY:${record?.pcgen.key ?? ''}`),
      );
      expect(index).toBeGreaterThan(0);
      lines[index] = `${lines[index] ?? ''}\tDESC:Changed.`;
      return lines.join('\n');
    });
  async function savedAdmittingPreview() {
    const saved = await makePreview();
    expect(scopeStates(await readGate(saved))[row]).toBe('admitted');
    return saved;
  }
  const readNothingOf = (preview: string) =>
    expect(reads.paths.filter((path) => path.startsWith(preview))).toEqual([]);

  return {
    builds,
    previewNow,
    makePreview,
    readGate,
    scopeStates,
    counted,
    status,
    statusBesideFresh,
    reportCounts,
    staleRefusal,
    edited,
    changedLine,
    savedAdmittingPreview,
    readNothingOf,
  };
}
