// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importCatalog } from '../../scripts/catalog/import';
import { pcgenPin, pins } from '../../scripts/catalog/inventory';
import feats331 from '../../scripts/catalog/legal/feats-331.json';
import feats334 from '../../scripts/catalog/legal/feats-334.json';
import {
  materializePinnedTree,
  pcgenCheckout,
  pcgenCheckoutIsAtPin,
  pinnedPath,
  pinnedStore,
  readPinned,
} from './pinned-sources';

const ticketFiles = [
  'pf1/packs/feats/alertness.Q1cY8r0Pvb66pMG0.yaml',
  'pf1/packs/feats/dodge.JreaiTHdyWFNj3Tb.yaml',
  'pf1-content/src/pf-feats/Abeyance_0DDCq2L7ZsDwc2a3.yaml',
] as const;
const disposers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(disposers.splice(0).map((dispose) => dispose()));
});
async function materialize(...args: Parameters<typeof materializePinnedTree>) {
  const tree = await materializePinnedTree(...args);
  disposers.push(tree.dispose);
  return tree;
}
const listSubdirectories = async (path: string) =>
  (await readdir(path, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

describe('pinned source store', () => {
  it('reads a pinned file by its original upstream path', async () => {
    const text = await readPinned(
      'pf1',
      'packs/feats/alertness.Q1cY8r0Pvb66pMG0.yaml',
    );
    expect(text).toMatch(/^_id: Q1cY8r0Pvb66pMG0\n/);
    expect(text).toContain('\nname: Alertness\n');
  });

  it.each([
    ['../pf1-content/module.json'],
    ['packs/../../pf1-content/module.json'],
    ['/etc/passwd'],
    [''],
    ['packs\\feats\\alertness.Q1cY8r0Pvb66pMG0.yaml'],
  ])('rejects the unsafe path %j', (path) => {
    expect(() => pinnedPath('pf1', path)).toThrow(/unsafe pinned path/i);
  });

  it('rejects a repository that has no pin', () => {
    expect(() => pinnedPath('aon' as 'pf1', 'Archetypes.aspx')).toThrow(
      /no pin/i,
    );
  });

  it('reads a pinned PCGen file by its path in the PCGen repository', async () => {
    const text = await readPinned(
      'pcgen',
      `${pcgenPin.directory}/roleplaying_game/core_rulebook/core_rulebook.pcc`,
    );
    expect(text).toContain('\nSOURCELONG:Core Rulebook\n');
  });

  it('refuses to resolve a file the store lacks', () => {
    expect(() => pinnedPath('pf1', 'packs/feats/missing.yaml')).toThrow(
      'Pinned store lacks pf1/packs/feats/missing.yaml.',
    );
  });

  it('names the missing file when the store lacks it', async () => {
    await expect(readPinned('pf1', 'packs/feats/missing.yaml')).rejects.toThrow(
      'pf1/packs/feats/missing.yaml',
    );
  });
});

describe('materializePinnedTree', () => {
  it('builds both checkouts outside the repository with every declared pack', async () => {
    const tree = await materialize(ticketFiles);
    expect(relative(tmpdir(), tree.systemPath)).not.toMatch(/^\.\./);
    const systemPacks = await listSubdirectories(
      join(tree.systemPath, 'packs'),
    );
    const contentPacks = await listSubdirectories(
      join(tree.contentPath, 'src'),
    );
    expect(systemPacks).toHaveLength(21);
    expect(systemPacks).toEqual(
      expect.arrayContaining(['feats', 'spells', 'races', 'rules']),
    );
    expect(contentPacks).toHaveLength(35);
    expect(contentPacks).toEqual(
      expect.arrayContaining(['pf-feats', 'pf-traits', 'harrow-deck']),
    );
  });

  it('copies the manifests and listed files byte for byte from the store', async () => {
    const tree = await materialize(ticketFiles);
    const roots = { pf1: tree.systemPath, 'pf1-content': tree.contentPath };
    for (const file of [
      'pf1/public/system.json',
      'pf1-content/module.json',
      ...ticketFiles,
    ]) {
      const [repo, ...rest] = file.split('/') as ['pf1' | 'pf1-content'];
      const path = rest.join('/');
      expect(await readFile(join(roots[repo], path)), file).toEqual(
        await readFile(pinnedPath(repo, path)),
      );
    }
    expect(
      (await readdir(join(tree.systemPath, 'packs/feats'))).sort(),
    ).toEqual([
      'alertness.Q1cY8r0Pvb66pMG0.yaml',
      'dodge.JreaiTHdyWFNj3Tb.yaml',
    ]);
    expect(await readdir(join(tree.systemPath, 'packs/spells'))).toEqual([]);
  });

  it('removes the tree on dispose', async () => {
    const tree = await materializePinnedTree(ticketFiles);
    await tree.dispose();
    expect(existsSync(tree.systemPath)).toBe(false);
    expect(existsSync(tree.contentPath)).toBe(false);
  });

  it('builds a PCGen data folder holding only the listed PCGen files', async () => {
    const files = [
      'pcgen/data/pathfinder/paizo/player_companion/agents_of_evil/_agents_of_evil.pcc',
      'pcgen/data/pathfinder/paizo/player_companion/agents_of_evil/support/aoe_abilities_class_pu.lst',
    ];
    const tree = await materialize(files);
    expect(tree.pcgenPath.endsWith(pcgenPin.directory)).toBe(true);
    for (const file of files) {
      const path = file.slice('pcgen/'.length);
      expect(
        await readFile(
          join(tree.pcgenPath, path.slice(pcgenPin.directory.length + 1)),
        ),
        file,
      ).toEqual(await readFile(pinnedPath('pcgen', path)));
    }
    expect(
      await readdir(join(tree.pcgenPath, 'player_companion/agents_of_evil')),
    ).toEqual(['_agents_of_evil.pcc', 'support']);
  });
});

describe('materializePinnedTree input checks', () => {
  // Trees go to a temp directory this test owns, so other processes' trees
  // can't affect the cleanup checks.
  let ownedTmpdir = '';
  beforeEach(async () => {
    ownedTmpdir = await mkdtemp(join(tmpdir(), 'pinned-sources-test-'));
    vi.stubEnv('TMPDIR', ownedTmpdir);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(ownedTmpdir, { recursive: true, force: true });
  });

  it.each([
    ['pf1/public/system.json'],
    ['pf1/packs/../public/system.json'],
    ['pf1/packs/feats.yaml'],
    ['pf1-content/packs/pf-feats/Abeyance_0DDCq2L7ZsDwc2a3.yaml'],
    ['pcgen/data/pathfinder/pcgen/renamer/x.lst'],
    ['pcgen/data/pathfinder/paizo/core.lst'],
    ['/pf1/packs/feats/alertness.Q1cY8r0Pvb66pMG0.yaml'],
  ])('rejects %j without leaving a tree behind', async (file) => {
    await expect(materializePinnedTree([file])).rejects.toThrow(
      /unsafe pinned path|no pin/i,
    );
    expect(await readdir(ownedTmpdir)).toEqual([]);
  });

  it('accepts the digests a legal inventory records for its sources', async () => {
    const digest = (
      inventory: typeof feats331 | typeof feats334,
      key: string,
    ) => {
      const { source } = inventory.candidates.find(
        (candidate) => candidate.externalKey === key,
      )!;
      return [`${source.repo}/${source.path}`, source.sha256] as const;
    };
    const sha256 = Object.fromEntries([
      digest(feats331, 'pf1/Q1cY8r0Pvb66pMG0'),
      digest(feats334, 'pf1-content/0DDCq2L7ZsDwc2a3'),
    ]);
    expect(Object.keys(sha256)).toEqual([ticketFiles[0], ticketFiles[2]]);
    await expect(materialize(ticketFiles, { sha256 })).resolves.toBeDefined();
  });

  it('rejects a digest mismatch and a digest for an unlisted file', async () => {
    await expect(
      materializePinnedTree(ticketFiles, {
        sha256: { [ticketFiles[1]]: '0'.repeat(64) },
      }),
    ).rejects.toThrow(`sha256 mismatch for ${ticketFiles[1]}`);
    await expect(
      materializePinnedTree(ticketFiles.slice(0, 1), {
        sha256: { [ticketFiles[1]]: '0'.repeat(64) },
      }),
    ).rejects.toThrow(/not listed/);
    expect(await readdir(ownedTmpdir)).toEqual([]);
  });

  it('names a listed file the store lacks', async () => {
    await expect(
      materializePinnedTree(['pf1/packs/feats/missing.yaml']),
    ).rejects.toThrow('pf1/packs/feats/missing.yaml');
  });
});

describe('importing a materialized tree', () => {
  it('imports exactly the listed records with complete pack coverage', async () => {
    const tree = await materialize(ticketFiles);
    const result = await importCatalog({
      systemPath: tree.systemPath,
      contentPath: tree.contentPath,
      remaps: [],
    });
    expect(result.comparison.coverageComplete).toBe(true);
    expect(result.comparison.packs).toHaveLength(21 + 35);
    expect(result.catalog.entries).toHaveLength(3);
    expect(
      result.catalog.entries.map(({ externalKey, name, detail }) => ({
        externalKey,
        name,
        kind: detail.kind,
      })),
    ).toEqual(
      expect.arrayContaining([
        { externalKey: 'pf1/JreaiTHdyWFNj3Tb', name: 'Dodge', kind: 'feat' },
        {
          externalKey: 'pf1/Q1cY8r0Pvb66pMG0',
          name: 'Alertness',
          kind: 'feat',
        },
        {
          externalKey: 'pf1-content/0DDCq2L7ZsDwc2a3',
          name: 'Abeyance',
          kind: 'feat',
        },
      ]),
    );
    expect(result.catalog.inputs).toEqual([
      expect.objectContaining({ repo: 'pf1', tag: 'v11.11', version: '11.11' }),
      expect.objectContaining({
        repo: 'pf1-content',
        tag: '11.4.0',
        version: '11.4.0',
      }),
    ]);
  });
});

const repositories = Object.keys(pins) as (keyof typeof pins)[];
// Pinned upstream files outside the packs that catalog tests read, such as
// Foundry's book list for the PCGen book crosswalk (#716) and the enricher and
// inline-roll sources of the description corrections' grammar (#328 Step B).
const pinnedReferenceFiles: Record<keyof typeof pins, string[]> = {
  pf1: [
    'module/registry/sources.mjs',
    'module/chat/text-enrichers.mjs',
    'module/utils/lib.mjs',
  ],
  'pf1-content': [],
};
const listStoreFiles = async (repo: keyof typeof pins | 'pcgen') =>
  (
    await readdir(join(pinnedStore, repo), {
      recursive: true,
      withFileTypes: true,
    })
  )
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(join(pinnedStore, repo), join(entry.parentPath, entry.name)),
    )
    .sort();

describe('the store itself', () => {
  it('holds only pinned repositories and the README', async () => {
    const allowed = [
      ...repositories,
      'pcgen',
      'prd',
      // The PRD supplement, under its own pin (owner, 2026-10-31).
      'prd-supplement',
      'README.md',
    ];
    for (const entry of await readdir(pinnedStore))
      expect(allowed, entry).toContain(entry);
  });

  it('holds manifests at the pinned versions', async () => {
    for (const repo of repositories)
      expect(
        JSON.parse(await readPinned(repo, pins[repo].manifest)).version,
        repo,
      ).toBe(pins[repo].version);
    expect(pins.pf1.version).toBe('11.11');
    expect(pins['pf1-content'].version).toBe('11.4.0');
  });

  it('keeps every pack file inside a pack directory', async () => {
    for (const repo of repositories)
      for (const path of await listStoreFiles(repo))
        if (
          path !== pins[repo].manifest &&
          !pinnedReferenceFiles[repo].includes(path)
        )
          expect(path).toMatch(
            new RegExp(`^${pins[repo].directory}/[\\w-]+/.+\\.ya?ml$`),
          );
  });

  it('keeps every PCGen file inside the pinned Pathfinder data', async () => {
    for (const path of await listStoreFiles('pcgen'))
      expect(path.startsWith(`${pcgenPin.directory}/`), path).toBe(true);
  });
});

const checkouts = {
  pf1: join(homedir(), 'repos/everythingpath/sources/foundryvtt-pathfinder1'),
  'pf1-content': join(homedir(), 'repos/everythingpath/sources/pf1-content'),
};
const runGit = (repo: keyof typeof pins, ...args: string[]) =>
  execFileSync('git', ['-C', checkouts[repo], ...args], {
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
const isAtPin = (repo: keyof typeof pins) => {
  try {
    return (
      runGit(repo, 'rev-parse', 'HEAD').toString().trim() === pins[repo].commit
    );
  } catch {
    return false;
  }
};

describe('the store against the pinned checkouts', () => {
  it.skipIf(!repositories.every(isAtPin))(
    'matches every store file to its blob at the pinned commit',
    async () => {
      for (const repo of repositories)
        for (const path of await listStoreFiles(repo))
          expect(
            await readFile(pinnedPath(repo, path)),
            `${repo}/${path}`,
          ).toEqual(
            runGit(repo, 'cat-file', 'blob', `${pins[repo].commit}:${path}`),
          );
    },
    // One git process per store file: the append-only store grows with every
    // batch, so this check outgrew the default 15-second CI timeout.
    120_000,
  );
});

const runPcgenGit = (...args: string[]) =>
  execFileSync('git', ['-C', pcgenCheckout, ...args], {
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });

describe('the PCGen store against the pinned PCGen checkout', () => {
  it.skipIf(!pcgenCheckoutIsAtPin())(
    'matches every PCGen store file to its blob at the pinned commit',
    async () => {
      const files = await listStoreFiles('pcgen');
      expect(files.length).toBeGreaterThan(0);
      for (const path of files)
        expect(
          await readFile(pinnedPath('pcgen', path)),
          `pcgen/${path}`,
        ).toEqual(
          runPcgenGit('cat-file', 'blob', `${pcgenPin.commit}:${path}`),
        );
    },
    120_000,
  );
});
