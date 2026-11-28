// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import {
  attribution227PinnedCheckouts,
  freshComparisonRun,
  isRemoteCi,
} from '../../scripts/catalog/attribution-227-generation';
import { importCatalog } from '../../scripts/catalog/import';
import { pcgenDataPath } from '../../scripts/catalog/operator';
import { pinnedCatalogCheckouts } from '../../scripts/catalog/party/pinned-catalog-checkouts';
import { importPinnedCatalog } from '../../scripts/catalog/pinned-import';
import { readCommittedRegisterAdmission } from '../../scripts/catalog/register-admission';
import { runCatalogReleaseOperator } from '../../scripts/catalog/release-operator';
import { openReleaseScope } from '../../scripts/catalog/release-scopes';
import { readCommittedReviewedAdmission } from '../../scripts/catalog/reviewed-data-files';
import { currentCalculationIdentity } from '../../src/lib/catalog/calculation-identities';
import {
  validateCatalogReleaseArtifact,
  type ReleaseRow,
} from '../../src/lib/catalog/release-schema';

// Per-book licensing (owner decision of 2026-11-25; pbl-register-only): the
// release step and the catalog commands feed the gate the notice register
// and the frozen stored notices (`stored-required-notices.json`), no
// Attribution Assessment and no evidence. For both committed scopes and the
// whole-corpus preview at the pinned checkouts, it admits, holds, omits and
// fails exactly the keys it does with the committed assessments and evidence,
// and requires the same notices, but for the one this test names. Remote CI
// has no pinned checkouts and skips, saying so.
const run = freshComparisonRun({
  checkouts: attribution227PinnedCheckouts,
  remoteCi: isRemoteCi(process.env),
});
if (run.kind === 'skip') process.stdout.write(`${run.note}\n`);

const starknife = 'pf1/tjuTlbdI85ClQhf6';
// Each import's counts with the assessments (failures counted by reason).
const imports: {
  version: string;
  counts: Record<
    'admitted' | 'held' | 'dependentOmissions' | 'failures',
    number
  >;
  // Notices the register alone requires that the assessments did not.
  gainedNotices: string[];
}[] = [
  {
    version: 'campaign-party-v1',
    counts: { admitted: 934, held: 13, dependentOmissions: 8, failures: 0 },
    // Smite Evil and its six increments: today admitted on an assessment
    // naming PZO1110 and PZO1131, on the register on their scripted match,
    // which also names Paladin lines of PZO9478 (reviewed).
    gainedNotices: ['pcgen:PZO9478'],
  },
  {
    version: 'campaign-mvp-v1',
    counts: { admitted: 5737, held: 642, dependentOmissions: 39, failures: 99 },
    gainedNotices: [],
  },
  {
    version: 'whole-corpus',
    counts: {
      admitted: 19851,
      held: 7923,
      dependentOmissions: 359,
      failures: 784,
    },
    gainedNotices: [],
  },
];

async function scopedImport(version: string) {
  const read = async (path: string): Promise<unknown> =>
    JSON.parse(await readFile(path, 'utf8'));
  const checkouts = await pinnedCatalogCheckouts();
  if (version === 'whole-corpus')
    return (await importPinnedCatalog({ checkouts })).artifact;
  const scope = await openReleaseScope({ version });
  return importCatalog({
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
}

const keys = (rows: readonly { externalKey: string }[]) =>
  [...new Set(rows.map(({ externalKey }) => externalKey))].sort();

async function check({
  version,
  counts,
  gainedNotices,
}: (typeof imports)[number]) {
  if (run.kind === 'refuse') throw new Error(run.reason);
  const artifact = await scopedImport(version);
  const today = assessCatalogAdmission({
    artifact,
    ...(await readCommittedReviewedAdmission()),
  });
  const register = assessCatalogAdmission({
    artifact,
    ...(await readCommittedRegisterAdmission()),
  });
  // No key is newly admitted, none dropped, none moves between classes.
  expect(keys(register.admitted)).toEqual(keys(today.admitted));
  expect(keys(register.held)).toEqual(keys(today.held));
  expect(keys(register.dependentOmissions)).toEqual(
    keys(today.dependentOmissions),
  );
  expect(keys(register.failures)).toEqual(keys(today.failures));
  expect({
    admitted: register.admitted.length,
    held: register.held.length,
    dependentOmissions: register.dependentOmissions.length,
    failures: register.failures.length,
  }).toEqual(counts);
  // The same notices, none lost.
  expect(
    today.requiredNotices.filter(
      (code) => !register.requiredNotices.includes(code),
    ),
  ).toEqual([]);
  expect(
    register.requiredNotices.filter(
      (code) => !today.requiredNotices.includes(code),
    ),
  ).toEqual(gainedNotices);
  // Starknife stays held on its stored notice PZO9000-2S, which the register lacks.
  if (version !== 'campaign-party-v1')
    expect(
      register.held.find(({ externalKey }) => externalKey === starknife),
    ).toMatchObject({ missingNotices: ['PZO9000-2S'] });
}

describe('the gate on the register and stored notices only', () => {
  it.skipIf(run.kind === 'skip')(
    'campaign-party-v1: decides as with the assessments and requires the same notices',
    () => check(imports[0]!),
    900_000,
  );
  it.skipIf(run.kind === 'skip')(
    'campaign-mvp-v1: decides as with the assessments and requires the same notices',
    () => check(imports[1]!),
    900_000,
  );
  it.skipIf(run.kind === 'skip')(
    'the whole-corpus preview: decides as with the assessments and requires the same notices',
    () => check(imports[2]!),
    900_000,
  );
});

describe('a from-scratch build of the party scope', () => {
  it.skipIf(run.kind === 'skip')(
    'qualifies as before and requires every notice today’s gate requires',
    async () => {
      if (run.kind === 'refuse') throw new Error(run.reason);
      const checkouts = await pinnedCatalogCheckouts();
      const directory = await mkdtemp(join(tmpdir(), 'register-only-party-'));
      try {
        const artifactPath = join(directory, 'release.json');
        const failure = await runCatalogReleaseOperator({
          args: [
            'build',
            '--number',
            '1',
            '--schema',
            'character-sheet-v1',
            '--calculation',
            currentCalculationIdentity,
            '--system',
            checkouts.system,
            '--content',
            checkouts.content,
            '--pcgen',
            checkouts.pcgen ?? '',
            '--artifact',
            artifactPath,
            '--scope',
            'campaign-party-v1',
          ],
        }).then(
          () => undefined,
          (error: unknown) => String(error),
        );
        // The party's 25 failing rows (unmatched names, open races, held and
        // omitted rows) leave it unqualified, as before; the artifact is written.
        expect(failure).toContain(
          'Scoped qualification FAILED for campaign-party-v1; artifact',
        );
        const report = JSON.parse(
          await readFile(join(directory, 'release.scope.json'), 'utf8'),
        ) as {
          qualification: {
            counts: Record<string, unknown>;
            characters: { id: string; served: boolean }[];
          };
        };
        expect(report.qualification.counts).toMatchObject({
          rows: 955,
          included: 934,
          excepted: 2,
          failed: 25,
          failedByCause: {
            'dependent-omitted': 8,
            held: 13,
            'race-open': 1,
            unmatched: 3,
            'unreviewed-notice': 0,
          },
        });
        expect(
          report.qualification.characters
            .filter(({ served }) => served)
            .map(({ id }) => id),
        ).toEqual(['3', '4c', '10', '13']);
        const release = await validateCatalogReleaseArtifact(
          JSON.parse(await readFile(artifactPath, 'utf8')),
        );
        const requiredNotices = release.batches
          .flat()
          .find(
            (row: ReleaseRow) =>
              row.kind === 'legal' && row.key === 'requiredNotices',
          )?.payload as string[];
        const today = assessCatalogAdmission({
          artifact: await scopedImport('campaign-party-v1'),
          ...(await readCommittedReviewedAdmission()),
        });
        expect(
          today.requiredNotices.filter(
            (code) => !requiredNotices.includes(code),
          ),
        ).toEqual([]);
        expect(
          requiredNotices.filter(
            (code) => !today.requiredNotices.includes(code),
          ),
        ).toEqual(imports[0]!.gainedNotices);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
    900_000,
  );
});
