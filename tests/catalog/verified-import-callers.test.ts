// @vitest-environment node
// stats-d2 fix r3: every caller that imports verified checkouts at the pins
// passes the one verified-input option (`wholeCorpus`), so a withholding row
// (`reviewedUnsupportedChanges`) whose record is not in the corpus fails it
// visibly. Round 3 found the launch verification, the party scope and the
// #227 matcher importing verified checkouts without it: a typo in Dance of the
// Blades' record key restored its unconditional +10 there. Round 4 found the
// gate-host Modifiers audit (`launch-modifiers-canonical.test.ts`) doing the
// same over the whole pinned checkouts; it now verifies them and imports as
// the whole corpus (`canonicalEvidence`).
//
// The checkout verification (`verifyInputs`, git at the pins) is the one
// stand-in: it reports a reduced pinned tree verified, so the tree stands in
// for the verified corpus. The tree holds every withholding row's record, so
// each failure below comes from its mutation alone. The party scope and the
// #227 matcher run as their command lines (`pnpm -s catalog:party-scope
// --check`, `pnpm -s catalog:attribution-227-matches --check`), so a change to
// their wiring that left the verified import is seen here: their checkouts
// are under the home directory, which points at a workspace whose checkouts
// link to the tree while they run.
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import type * as Os from 'node:os';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { runCatalogCuration } from '../../scripts/catalog/curate';
import type * as Operator from '../../scripts/catalog/operator';
import { buildLaunchVerification } from '../../scripts/catalog/launch-verification-build';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { runCatalogPreviewCommand } from '../../scripts/catalog/preview';
import {
  reviewedUnsupportedChanges,
  type ReviewedUnsupportedChange,
} from '../../scripts/catalog/racial-trait-rules';
import { runCatalogReleaseOperator } from '../../scripts/catalog/release-operator';
import { canonicalEvidence } from './launch-modifier-evidence';
import {
  materializePinnedTree,
  pinnedRecordFile,
  readPinned,
} from './pinned-sources';

vi.mock('../../scripts/catalog/operator', async (importOriginal) => ({
  ...(await importOriginal<typeof Operator>()),
  verifyInputs: async () => ({ status: 'verified' as const, repositories: [] }),
}));
// The #227 matcher's PCGen checkout check: the PCGen checkout is not read
// before the import refuses the row.
vi.mock('../../scripts/catalog/attribution-227-matcher', async (original) => ({
  ...(await original<object>()),
  verifyPcgenCheckout: () => undefined,
}));
const home = vi.hoisted(() => ({ path: undefined as string | undefined }));
vi.mock('node:os', async (original) => {
  const actual = await original<typeof Os>();
  return { ...actual, homedir: () => home.path ?? actual.homedir() };
});

const dance = 'pf1/3MKN05JEqEYrNx7Q';
const danceFile = await pinnedRecordFile(dance);
const files = await Promise.all(
  [...new Set(reviewedUnsupportedChanges.map((row) => row.externalKey))].map(
    pinnedRecordFile,
  ),
);
const tree = await materializePinnedTree(files);
const workspace = await mkdtemp(join(tmpdir(), 'verified-import-callers-'));
afterAll(() =>
  Promise.all([tree.dispose(), rm(workspace, { recursive: true })]),
);
const danceAt = join(tree.systemPath, danceFile.slice('pf1/'.length));
const danceText = await readPinned('pf1', danceFile.slice('pf1/'.length));

let runs = 0;
const out = () => join(workspace, `out-${++runs}`);

// The command lines' checkouts (`launchInventoryPaths`, the matcher's own):
// the Foundry checkouts link to the tree; the PCGen checkout is empty.
const checkoutsHome = join(workspace, 'home');
const checkouts = join(checkoutsHome, 'repos/everythingpath');
await mkdir(join(checkouts, 'sources'), { recursive: true });
await symlink(
  tree.systemPath,
  join(checkouts, 'sources/foundryvtt-pathfinder1'),
);
await symlink(tree.contentPath, join(checkouts, 'sources/pf1-content'));
await mkdir(
  join(
    checkouts,
    `.ep-cache/pcgen-${pcgenPin.commit.slice(0, 8)}`,
    pcgenPin.directory,
  ),
  { recursive: true },
);

/**
 * Runs a command-line script in this process, as `node --import tsx` runs it,
 * with `args` and the workspace as the home directory; each run evaluates the
 * script afresh (its own query) over the modules already loaded. A run that
 * sets a failing exit code throws what it wrote to stderr.
 */
async function runScript(script: string, args: string[]) {
  const { argv, exitCode } = process;
  let stderr = '';
  const errors = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      stderr += String(chunk);
      return true;
    });
  const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  process.argv = [argv[0]!, script, ...args];
  process.exitCode = undefined;
  home.path = checkoutsHome;
  try {
    await import(/* @vite-ignore */ `${script}?run=${++runs}`);
    if (process.exitCode) throw new Error(stderr);
  } finally {
    process.argv = argv;
    process.exitCode = exitCode;
    home.path = undefined;
    errors.mockRestore();
    output.mockRestore();
  }
}

/** Each caller of the import that reads verified checkouts, run over the tree. */
const callers: Record<string, () => Promise<unknown>> = {
  'catalog:preview': async () => {
    const result = await runCatalogPreviewCommand({
      args: [
        '--system',
        tree.systemPath,
        '--content',
        tree.contentPath,
        '--out',
        out(),
      ],
    });
    if (result.status !== 0) throw new Error(result.stderr);
  },
  'catalog:release build': () =>
    runCatalogReleaseOperator({
      args: [
        'build',
        '--number',
        '1',
        '--schema',
        'character-sheet-v1',
        '--calculation',
        'facts-v1',
        '--system',
        tree.systemPath,
        '--content',
        tree.contentPath,
        '--artifact',
        join(out(), 'release.json'),
      ],
    }),
  'catalog:launch-inventory --verify': () =>
    buildLaunchVerification({
      repoRoot: process.cwd(),
      systemPath: tree.systemPath,
      contentPath: tree.contentPath,
    }),
  'catalog:party-scope': () =>
    runScript('../../scripts/catalog-party-scope.ts', ['--check']),
  'catalog:attribution-227-matches': () =>
    runScript('../../scripts/catalog-attribution-227-matches.ts', ['--check']),
  'the launch-modifiers-canonical host audit': () =>
    canonicalEvidence({
      systemPath: tree.systemPath,
      contentPath: tree.contentPath,
    }),
  'catalog:curate': async () => {
    const result = await runCatalogCuration({
      args: [
        '--system',
        tree.systemPath,
        '--content',
        tree.contentPath,
        '--out',
        out(),
      ],
    });
    if (result.status !== 0) throw new Error(result.stderr);
  },
};

const rows = reviewedUnsupportedChanges as ReviewedUnsupportedChange[];
const danceRow = rows.findIndex((row) => row.externalKey === dance);

/** Each way a withholding row can lose its record, applied in memory and undone. */
const mutations: Record<
  string,
  { apply: () => Promise<void>; undo: () => Promise<void>; refusal: string }
> = {
  'a typo in the record key': {
    apply: async () => {
      rows[danceRow] = { ...rows[danceRow]!, externalKey: `${dance}x` };
    },
    undo: async () => {
      rows[danceRow] = { ...rows[danceRow]!, externalKey: dance };
    },
    refusal: `The pinned corpus has no record ${dance}x.`,
  },
  'the record removed': {
    apply: () => rm(danceAt),
    undo: () => writeFile(danceAt, danceText),
    refusal: `The pinned corpus has no record ${dance}.`,
  },
  'the raw change edited': {
    apply: async () => {
      const moved = danceText.replace(
        /formula: '10'\n(\s+)target: landSpeed/,
        "formula: '20'\n$1target: landSpeed",
      );
      expect(moved).not.toBe(danceText);
      await writeFile(danceAt, moved);
    },
    undo: () => writeFile(danceAt, danceText),
    refusal: `${dance} has no raw change landSpeed 10 (base); its landSpeed changes are 20 (base).`,
  },
};

describe.each(Object.keys(callers))('%s over verified checkouts', (name) => {
  const run = callers[name]!;

  it('finds every withholding row on its record', async () => {
    await expect(
      run().then(
        () => '',
        (error: unknown) => String(error),
      ),
    ).resolves.not.toContain('no longer matches its record');
  });

  it.each(Object.keys(mutations))(
    'fails naming the row with %s',
    async (mutation) => {
      const { apply, undo, refusal } = mutations[mutation]!;
      await apply();
      try {
        await expect(run()).rejects.toThrow(
          `The reviewed unsupported change no longer matches its record: ${refusal}`,
        );
      } finally {
        await undo();
      }
    },
  );
});
