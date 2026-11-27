// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  launchVerificationSchema,
  serializeLaunchVerification,
} from '../../scripts/catalog/launch-verification';
import { mvpStatus } from '../../scripts/mvp-status';
import {
  admittedOf,
  checkedProjection,
  listMissing,
  listPath,
  loseList,
  row,
  runScript,
  slow,
  standInClass,
  useFixture,
  verificationPath,
} from './reviewed-line-unverified-fixture';

// The property (`reviewed-line-unverified-fixture.ts`) on
// `catalog:launch-inventory --verify`, `catalog:conditions` and `mvp:status`,
// each with the list missing beside its control with the list present.

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
const { standIn, verificationBuild, conditionsTree } = probes;

// The real build's own read of the list is tested in
// `attribution-227-matches.test.ts`.
describe('catalog:launch-inventory --verify', () => {
  async function verify(mode: '--check' | '--write', committed: string) {
    standIn.files.set(verificationPath, committed);
    verificationBuild.calls = 0;
    verificationBuild.document = () =>
      launchVerificationSchema.parse(checkedProjection());
    return runScript(
      () => import('../../scripts/catalog-launch-inventory.ts'),
      ['--verify', mode],
    );
  }
  const built = () =>
    serializeLaunchVerification(
      launchVerificationSchema.parse(checkedProjection()),
    );

  it(
    '--check builds, finds the projection current and prints its summary with the list present',
    async () => {
      const { error, printed } = await verify('--check', built());
      expect(error).toBeUndefined();
      expect(verificationBuild.calls).toBe(1);
      expect(printed).toContain('"allObservationsVerified"');
      expect(standIn.written.size).toBe(0);
    },
    slow,
  );

  it(
    '--check stops before it builds with the list missing, and prints nothing',
    async () => {
      loseList();
      const { error, printed } = await verify('--check', built());
      expect((error as Error | undefined)?.message).toMatch(listMissing);
      expect(verificationBuild.calls).toBe(0);
      expect(printed).toBe('');
    },
    slow,
  );

  it(
    '--write writes the projection, which verifies the row, with the list present',
    async () => {
      const { error, printed } = await verify('--write', 'committed\n');
      expect(error).toBeUndefined();
      const written = standIn.written.get(verificationPath);
      expect(written).toBe(built());
      expect(
        (JSON.parse(written ?? '{}') as { rows: { key: string }[] }).rows.some(
          ({ key }) => key === row,
        ),
      ).toBe(true);
      expect(printed).toContain('"allObservationsVerified"');
    },
    slow,
  );

  it(
    '--write stops before it builds with the list missing, and writes and prints nothing',
    async () => {
      loseList();
      const { error, printed } = await verify('--write', 'committed\n');
      expect((error as Error | undefined)?.message).toMatch(listMissing);
      expect(verificationBuild.calls).toBe(0);
      expect(standIn.written.size).toBe(0);
      expect(printed).toBe('');
    },
    slow,
  );
});

describe('catalog:conditions', () => {
  async function report() {
    conditionsTree.paths = fixture.standInTree;
    return runScript(() => import('../../scripts/catalog-conditions.ts'));
  }

  it(
    'admits the row and its class in its report with the list present',
    async () => {
      const { error, printed } = await report();
      expect(error).toBeUndefined();
      const { admission } = JSON.parse(printed) as {
        admission: { admitted: { externalKey: string }[] };
      };
      expect(
        admittedOf(
          admission.admitted.map(({ externalKey }) => externalKey),
        ).sort(),
      ).toEqual([row, standInClass].sort());
    },
    slow,
  );

  it(
    'gives no report with the list missing',
    async () => {
      loseList();
      const { error, printed } = await report();
      expect((error as Error | undefined)?.message).toMatch(listMissing);
      expect(printed).toBe('');
    },
    slow,
  );
});

describe('mvp:status', () => {
  it(
    'applies the projection’s row for the record (its synthetic observations) with the list present',
    async () => {
      const { verification } = await mvpStatus(checkedProjection());
      expect(verification.stale).toEqual([]);
      expect(verification.rows.map(({ key }) => key)).toContain(row);
    },
    slow,
  );

  it(
    'applies no projection row with the list missing: the projection is stale',
    async () => {
      loseList();
      const { verification, lines } = await mvpStatus(checkedProjection());
      expect(verification.stale.join('; ')).toContain(listPath);
      expect(verification.rows).toEqual([]);
      expect(lines.join('\n')).toContain('Verification stale');
    },
    slow,
  );
});
