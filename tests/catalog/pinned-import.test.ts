// @vitest-environment node
// cavalier-master-tactician fix r15: the party scope (its --check and its
// --status) and the #227 matcher import the pinned catalog through one shared
// import (`pinned-import.ts`), which reads the reviewed remaps and curation at
// the repository root it is given (by default this checkout) and imports a
// verified checkout as the whole corpus. The import itself (`importCatalog`)
// is the stand-in: it records what it receives and stops, so no corpus is
// read. The checkout verification (`verifyInputs`, git at the pins) reports
// verified, and the checkouts are empty folders under a stand-in home.
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import type * as Os from 'node:os';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Import from '../../scripts/catalog/import';
import type * as Operator from '../../scripts/catalog/operator';
import type * as PinnedCheckouts from '../../scripts/catalog/pinned-checkouts';
import type * as PinnedImport from '../../scripts/catalog/pinned-import';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { matchesPath } from '../../scripts/catalog/attribution-227-matcher';

const stop = 'stopped: the import received its inputs';
const recorded = vi.hoisted(() => ({
  imports: [] as Record<string, unknown>[],
  shared: 0,
}));
vi.mock('../../scripts/catalog/import', async (original) => ({
  ...(await original<typeof Import>()),
  importCatalog: async (options: Record<string, unknown>) => {
    recorded.imports.push(options);
    throw new Error(stop);
  },
}));
vi.mock('../../scripts/catalog/pinned-import', async (original) => {
  const actual = await original<typeof PinnedImport>();
  return {
    ...actual,
    importPinnedCatalog: (
      ...args: Parameters<typeof actual.importPinnedCatalog>
    ) => {
      recorded.shared += 1;
      return actual.importPinnedCatalog(...args);
    },
  };
});
vi.mock('../../scripts/catalog/operator', async (original) => ({
  ...(await original<typeof Operator>()),
  verifyInputs: async () => ({ status: 'verified' as const, repositories: [] }),
}));
vi.mock('../../scripts/catalog/pinned-checkouts', async (original) => {
  const actual = await original<typeof PinnedCheckouts>();
  return {
    ...actual,
    verifyPinnedCheckout: (checkout: PinnedCheckouts.PinnedCheckout) =>
      checkout.name === 'PCGen'
        ? undefined
        : actual.verifyPinnedCheckout(checkout),
  };
});
const home = vi.hoisted(() => ({ path: undefined as string | undefined }));
vi.mock('node:os', async (original) => {
  const actual = await original<typeof Os>();
  return { ...actual, homedir: () => home.path ?? actual.homedir() };
});

const workspace = await mkdtemp(join(tmpdir(), 'pinned-import-'));
afterAll(() => rm(workspace, { recursive: true }));
home.path = join(workspace, 'home');
const checkouts = join(home.path, 'repos/everythingpath');
await Promise.all(
  [
    'sources/foundryvtt-pathfinder1',
    'sources/pf1-content',
    join(`.ep-cache/pcgen-${pcgenPin.commit.slice(0, 8)}`, pcgenPin.directory),
  ].map((path) => mkdir(join(checkouts, path), { recursive: true })),
);
const { generateAttribution227Matches } =
  await import('../../scripts/catalog/attribution-227-generation');

beforeEach(() => {
  recorded.imports = [];
  recorded.shared = 0;
});

/** The committed overlays at this checkout, as JSON. */
const committed = async (name: string): Promise<unknown> =>
  JSON.parse(await readFile(join('scripts/catalog', name), 'utf8'));

/** What the stopped import received, of the inputs the callers share. */
const shared = (options: Record<string, unknown>) => ({
  remaps: options.remaps,
  curation: options.curation,
  wholeCorpus: options.wholeCorpus,
});

let runs = 0;
/** Runs a command-line script in this process, as `node --import tsx` runs it, with `args`. */
async function runScript(script: string, args: string[]) {
  const { argv } = process;
  const errors = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  process.argv = [argv[0]!, script, ...args];
  try {
    await import(/* @vite-ignore */ `${script}?run=${++runs}`);
  } finally {
    process.argv = argv;
    errors.mockRestore();
    output.mockRestore();
  }
}

describe('the shared pinned import', () => {
  it("reads the reviewed remaps and curation of the generation's root, not of the executing checkout", async () => {
    const root = join(workspace, 'other-tree');
    await mkdir(join(root, 'scripts/catalog'), { recursive: true });
    const remaps = [{ planted: 'a remap only the other tree has' }];
    const curation = { records: [], planted: 'the other tree’s curation' };
    await writeFile(
      join(root, 'scripts/catalog/reviewed-remaps.json'),
      JSON.stringify(remaps),
    );
    await writeFile(
      join(root, 'scripts/catalog/reviewed-curation.json'),
      JSON.stringify(curation),
    );
    // The generation reads its root's committed matches first, for their
    // frozen stored-assessment evidence (pbl-match-freeze fix r2).
    await mkdir(dirname(join(root, matchesPath)), { recursive: true });
    await copyFile(matchesPath, join(root, matchesPath));
    await expect(generateAttribution227Matches(root)).rejects.toThrow(stop);
    expect(recorded.imports.map(shared)).toEqual([
      { remaps, curation, wholeCorpus: true },
    ]);
  });

  it('gives the party scope, its status and the matcher the same inputs for the same root', async () => {
    const callers = {
      'catalog:party-scope --check': () =>
        runScript('../../scripts/catalog-party-scope.ts', ['--check']),
      'catalog:party-scope --status': () =>
        runScript('../../scripts/catalog-party-scope.ts', ['--status']),
      'catalog:attribution-227-matches --check': () =>
        runScript('../../scripts/catalog-attribution-227-matches.ts', [
          '--check',
        ]),
    };
    const received: Record<string, unknown> = {};
    for (const [name, run] of Object.entries(callers)) {
      recorded.imports = [];
      recorded.shared = 0;
      await expect(run()).rejects.toThrow(stop);
      expect(recorded.shared, name).toBe(1);
      expect(recorded.imports, name).toHaveLength(1);
      received[name] = shared(recorded.imports[0]!);
    }
    const expected = {
      remaps: await committed('reviewed-remaps.json'),
      curation: await committed('reviewed-curation.json'),
      wholeCorpus: true,
    };
    expect(received).toEqual(
      Object.fromEntries(Object.keys(callers).map((name) => [name, expected])),
    );
  }, 60_000);
});
