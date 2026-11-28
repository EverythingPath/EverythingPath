// @vitest-environment node
import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  checkedProjection,
  listPath,
  row,
  slow,
  useFixture,
  useStatusFixture,
  verificationPath,
  type Gate,
} from './reviewed-line-unverified-fixture';

// The property (`reviewed-line-unverified-fixture.ts`) on
// `catalog:party-scope --status` beside a saved preview the gate does not
// stand behind now: it reports the row held, as a fresh preview holds it.

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
const { inMemory, replaced } = probes;

describe('catalog:party-scope --status', () => {
  const {
    makePreview,
    readGate,
    scopeStates,
    counted,
    statusBesideFresh,
    reportCounts,
    changedLine,
    savedAdmittingPreview,
    readNothingOf,
  } = useStatusFixture(fixture);

  it(
    'round 11 probe: a preview made while the checked record was loaded, the record drafted again on disk: it reports the row held, as a fresh preview does',
    async () => {
      const saved = await savedAdmittingPreview();
      inMemory.checked = false;
      const { report, fresh } = await statusBesideFresh(
        JSON.parse(readFileSync(verificationPath, 'utf8')),
      );
      readNothingOf(saved);
      expect(fresh[row]).toBe('held');
      expect(reportCounts(report)).toEqual(counted(fresh));
      expect(report.total.held).toBe(1);
    },
    slow,
  );

  it(
    'round 11 probe: a saved preview edited by hand after the reviewed line changed, the projection current: it reports the row held, as a fresh preview does',
    async () => {
      const saved = await savedAdmittingPreview();
      const path = join(saved, 'admission.json');
      const admission = JSON.parse(await readFile(path, 'utf8')) as Record<
        string,
        unknown
      >;
      // The incomplete binding round 11 found passing: the pinned list's
      // hash omitted.
      const { binding } = checkedProjection();
      const { [listPath]: omitted, ...inputs } = binding.inputs;
      expect(omitted).toBeDefined();
      await writeFile(
        path,
        `${JSON.stringify({ ...admission, gateBinding: { inputs, packages: binding.packages, replacedInputs: [] } }, null, 2)}\n`,
      );
      const line = changedLine();
      replaced.files.set(listPath, line.text);
      const { report, fresh } = await statusBesideFresh(
        checkedProjection({ [listPath]: line.sha256 }),
      );
      readNothingOf(saved);
      expect(fresh[row]).toBe('held');
      expect(reportCounts(report)).toEqual(counted(fresh));
    },
    slow,
  );

  it(
    'a planted preview claiming an admission the gate does not give is not reported: the row is held, as a fresh preview holds it',
    async () => {
      inMemory.checked = false;
      const planted = await makePreview();
      const path = join(planted, 'admission.json');
      const gate = JSON.parse(await readFile(path, 'utf8')) as Gate &
        Record<string, unknown>;
      const claimed = gate.held.find(({ externalKey }) => externalKey === row);
      expect(claimed).toBeDefined();
      await writeFile(
        path,
        `${JSON.stringify(
          {
            ...gate,
            admitted: [...gate.admitted, { externalKey: row }],
            held: gate.held.filter(({ externalKey }) => externalKey !== row),
          },
          null,
          2,
        )}\n`,
      );
      expect(scopeStates(await readGate(planted))[row]).toBe('admitted');
      const { report, fresh } = await statusBesideFresh(
        JSON.parse(readFileSync(verificationPath, 'utf8')),
      );
      readNothingOf(planted);
      expect(fresh[row]).toBe('held');
      expect(reportCounts(report)).toEqual(counted(fresh));
      expect(report.total.admitted).toBe(0);
    },
    slow,
  );
});
