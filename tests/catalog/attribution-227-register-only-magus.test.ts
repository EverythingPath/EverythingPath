// @vitest-environment node
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import {
  attribution227PinnedCheckouts,
  freshComparisonRun,
  generateAttribution227Matches,
  isRemoteCi,
} from '../../scripts/catalog/attribution-227-generation';
import {
  matcherInputPaths,
  matchesPath,
} from '../../scripts/catalog/attribution-227-matcher';
import { importCatalog } from '../../scripts/catalog/import';
import { pcgenDataPath } from '../../scripts/catalog/operator';
import { pinnedCatalogCheckouts } from '../../scripts/catalog/party/pinned-catalog-checkouts';
import { openReleaseScope } from '../../scripts/catalog/release-scopes';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';

// Root decision P0 of 2026-11-26 (pbl-match-freeze): with the register only
// (no Attribution Assessment, no evidence), the scripted match gave Arcane
// Pool and Bonus Feats (MAG) the book PZO9493, which has no notice, and the
// party lost them, their two increments, the Magus class and Bladebound. The
// reviewed book overrides (`attribution-227-book-overrides.json`) give the
// two matched rows the books their confirmed assessments name; the increments
// follow their owner. The committed party scope at the pinned checkouts, so
// it runs where the fresh comparison runs (remote CI skips it, saying so).
const run = freshComparisonRun({
  checkouts: attribution227PinnedCheckouts,
  remoteCi: isRemoteCi(process.env),
});
if (run.kind === 'skip') process.stdout.write(`${run.note}\n`);

const magus = [
  'pf1/mpe3JHJMINddqLWr', // Arcane Pool
  'pf1/gzBR0qkMdu0KkLV0', // Bonus Feats (MAG)
  'everythingpath/magus-bonus-feats-11',
  'everythingpath/magus-bonus-feats-17',
  'pf1/xZLcyrEKYZoJPS2k', // Magus
  'everythingpath/magus-bladebound',
];

describe('the party scope’s gate on the register only', () => {
  it.skipIf(run.kind === 'skip')(
    'admits the four Magus rows, the Magus class and Bladebound',
    async () => {
      if (run.kind === 'refuse') throw new Error(run.reason);
      const read = async (path: string): Promise<unknown> =>
        JSON.parse(await readFile(path, 'utf8'));
      const checkouts = await pinnedCatalogCheckouts();
      const scope = await openReleaseScope({ version: 'campaign-party-v1' });
      const artifact = await importCatalog({
        systemPath: checkouts.system,
        contentPath: checkouts.content,
        remaps: await read('scripts/catalog/reviewed-remaps.json'),
        curation: await read('scripts/catalog/reviewed-curation.json'),
        scopeKeys: scope.importKeys,
        ...(scope.pcgenKeys &&
          checkouts.pcgen && {
            pcgen: {
              path: pcgenDataPath(checkouts.pcgen),
              scopeKeys: scope.pcgenKeys,
            },
          }),
        wholeCorpus: true,
      });
      const gate = assessCatalogAdmission({
        artifact,
        // The register alone, read directly: no per-entry proof file is read.
        registry: section15Registry,
        assessments: [],
        evidence: {},
      });
      const admitted = new Set(gate.admitted.map((row) => row.externalKey));
      expect(magus.filter((key) => !admitted.has(key))).toEqual([]);
      const reasonOf = (key: string) =>
        gate.admitted.find((row) => row.externalKey === key)?.reason;
      expect(reasonOf('pf1/mpe3JHJMINddqLWr')).toContain(
        'PZO1117, PZO1131 via reviewed book override',
      );
      expect(reasonOf('pf1/mpe3JHJMINddqLWr')).not.toContain('PZO9493');
      expect(reasonOf('pf1/gzBR0qkMdu0KkLV0')).not.toContain('PZO9493');
    },
    900_000,
  );
});

describe('a regeneration of the scripted match without the per-entry proof', () => {
  it.skipIf(run.kind === 'skip')(
    'reproduces the committed file from a root holding no legal record and no Attribution Assessment',
    async () => {
      if (run.kind === 'refuse') throw new Error(run.reason);
      // Only the files a generation reads at its root: the committed matches
      // (its frozen stored-assessment evidence), the bound inputs and the
      // reviewed remaps and curation the import reads.
      const root = await mkdtemp(join(tmpdir(), 'match-freeze-'));
      try {
        for (const path of [
          matchesPath,
          ...matcherInputPaths,
          'scripts/catalog/reviewed-remaps.json',
          'scripts/catalog/reviewed-curation.json',
        ]) {
          await mkdir(join(root, dirname(path)), { recursive: true });
          await copyFile(path, join(root, path));
        }
        const { text } = await generateAttribution227Matches(root);
        expect(text).toBe(await readFile(matchesPath, 'utf8'));
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    900_000,
  );
});
