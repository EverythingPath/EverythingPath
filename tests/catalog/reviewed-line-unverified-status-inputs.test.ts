// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  checkedProjection,
  listMissing,
  listPath,
  loseList,
  row,
  slow,
  useFixture,
  useStatusFixture,
} from './reviewed-line-unverified-fixture';

// The property (`reviewed-line-unverified-fixture.ts`) on
// `catalog:party-scope --status` after its inputs changed: it admits what a
// fresh preview admits.

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
const { replaced } = probes;

describe('catalog:party-scope --status', () => {
  const {
    previewNow,
    counted,
    status,
    statusBesideFresh,
    reportCounts,
    edited,
    changedLine,
    savedAdmittingPreview,
    readNothingOf,
  } = useStatusFixture(fixture);

  it(
    'round 10 probe: with the reviewed line changed and the projection regenerated, it reports the row held, as a fresh preview does, though a saved preview admits it',
    async () => {
      const saved = await savedAdmittingPreview();
      const line = changedLine();
      replaced.files.set(listPath, line.text);
      const { report, fresh } = await statusBesideFresh(
        checkedProjection({ [listPath]: line.sha256 }),
      );
      readNothingOf(saved);
      expect(fresh[row]).toBe('held');
      expect(reportCounts(report)).toEqual(counted(fresh));
      expect(report.total.held).toBe(1);
    },
    slow,
  );

  it(
    'round 10 probe: with the list lost and the projection current without it, it admits nothing, as a fresh preview admits nothing',
    async () => {
      const saved = await savedAdmittingPreview();
      loseList();
      const { [listPath]: _list, ...withoutList } =
        checkedProjection().binding.inputs;
      expect(_list).toBeDefined();
      const projection = checkedProjection();
      const { error, printed } = await status({
        ...projection,
        binding: { ...projection.binding, inputs: withoutList },
      });
      readNothingOf(saved);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(listMissing);
      expect(printed).toBe('');
      const { outcome } = await previewNow();
      expect(outcome.stderr).toMatch(listMissing);
    },
    slow,
  );

  it(
    "after an unrelated reviewed record's rationale changed (Glorious Heat's), with the projection regenerated, it reports what a fresh preview reports (the row admitted)",
    async () => {
      const records = 'scripts/catalog/reviewed-curation.json';
      const unrelated = 'pf1-content/01MUL5N0meygR4Am';
      const change = edited(records, (text) => {
        const from =
          '"rationale": "#334 independent mechanical review of Glorious Heat';
        expect(text.split(from)).toHaveLength(2);
        return text.replace(
          from,
          '"rationale": "Edited. #334 independent mechanical review of Glorious Heat',
        );
      });
      type Records = { records: { externalKey: string; rationale: string }[] };
      const before = (JSON.parse(readFileSync(records, 'utf8')) as Records)
        .records;
      const after = (JSON.parse(change.text) as Records).records;
      const changed = after.flatMap((record, index) =>
        JSON.stringify(record) === JSON.stringify(before[index])
          ? []
          : [record],
      );
      expect(changed.map(({ externalKey }) => externalKey)).toEqual([
        unrelated,
      ]);
      expect(changed[0]?.rationale).toMatch(/^Edited\. #334 /);
      expect(after).toHaveLength(before.length);
      replaced.files.set(records, change.text);
      const { report, fresh } = await statusBesideFresh(
        checkedProjection({ [records]: change.sha256 }),
      );
      expect(fresh[row]).toBe('admitted');
      expect(reportCounts(report)).toEqual(counted(fresh));
    },
    slow,
  );
});
