// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  checkedProjection,
  listPath,
  loseList,
  slow,
  useFixture,
  useStatusFixture,
  verificationPath,
} from './reviewed-line-unverified-fixture';

// The property (`reviewed-line-unverified-fixture.ts`) on
// `catalog:party-scope --status` where its verification projection is not
// current: it refuses, with no status printed.

const probes = await vi.hoisted(
  () => import('./reviewed-line-unverified-probes'),
);
vi.mock('node:fs', probes.nodeFs);
vi.mock('node:fs/promises', probes.nodeFsPromises);
vi.mock('../../scripts/catalog/party/party-builds.ts', probes.partyBuilds);
vi.mock(
  '../../scripts/catalog/reviewed-data-files.ts',
  probes.reviewedDataFiles,
);
vi.mock('../../scripts/catalog/conditions.ts', probes.conditions);
vi.mock(
  '../../scripts/catalog/launch-verification-build.ts',
  probes.launchVerificationBuild,
);
vi.mock(
  '../../scripts/catalog/party/pinned-catalog-checkouts.ts',
  probes.pinnedCatalogCheckouts,
);
vi.mock(
  '../../scripts/catalog/reviewed-pcgen-records',
  probes.reviewedPcgenRecords,
);
vi.mock(
  '../../scripts/catalog/legal/attribution-227-matches.ts',
  probes.attribution227Matches,
);

const fixture = useFixture();

describe('catalog:party-scope --status', () => {
  const { status, staleRefusal } = useStatusFixture(fixture);

  it(
    'counts no admission with the list missing: it refuses the stale projection, naming the list',
    async () => {
      loseList();
      const { error, printed, progress } = await status(checkedProjection());
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(staleRefusal(listPath));
      expect(printed).toBe('');
      // Refused before the import, so before its progress line.
      expect(progress).toBe('');
    },
    slow,
  );

  it(
    'refuses the stale projection with the list missing and three earlier bound inputs changed, its error naming only the first three changed',
    async () => {
      const committed = JSON.parse(readFileSync(verificationPath, 'utf8')) as {
        binding: { inputs: Record<string, string> };
      };
      // Bound inputs that sort before the list, so the error's three named
      // paths are these and the list is the fourth, unnamed.
      const earlier = Object.keys(committed.binding.inputs)
        .filter((path) => path < listPath)
        .sort()
        .slice(0, 3);
      expect(earlier).toHaveLength(3);
      loseList();
      const { error, printed, progress } = await status(
        checkedProjection(
          Object.fromEntries(earlier.map((path) => [path, '0'.repeat(64)])),
        ),
      );
      expect(error).toBeInstanceOf(Error);
      const { message } = error as Error;
      expect(message).toMatch(
        staleRefusal(`4 bound inputs changed (${earlier.join(', ')}, …)`),
      );
      expect(message).not.toContain(listPath);
      expect(printed).toBe('');
      expect(progress).toBe('');
    },
    slow,
  );

  it(
    'refuses with no committed verification projection, as for a stale one',
    async () => {
      const { error, printed, progress } = await status(undefined);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(
        staleRefusal('no committed verification projection'),
      );
      expect(printed).toBe('');
      // Refused before the import, so before its progress line.
      expect(progress).toBe('');
    },
    slow,
  );

  it(
    'refuses after an unrelated bound input changed without regenerating, naming the input',
    async () => {
      const { error, printed } = await status(
        checkedProjection({ 'scripts/catalog/map.ts': '0'.repeat(64) }),
      );
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(
        staleRefusal('scripts/catalog/map.ts'),
      );
      expect(printed).toBe('');
    },
    slow,
  );
});
