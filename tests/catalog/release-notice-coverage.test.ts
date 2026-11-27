// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AttributionPath } from '../../scripts/catalog/admission';
import {
  committedAttribution227Matches,
  matchesSha256,
  type Attribution227Match,
} from '../../scripts/catalog/legal/attribution-227-matches';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';
import { cleaveReleases } from './cleave-release-fixture';

// Per-book licensing (owner, 2026-11-25; pbl-register-only): a release admits
// an entry only when every book it comes from, and every notice its stored
// assessment required, has a reviewed notice in the register, as the gate
// decides it on the register and stored notices alone.

/** Cleave with no declared book, its scripted match giving `books`. */
async function cleaveOnMatch(books: readonly [string, ...string[]] | null) {
  const cleave = await cleaveReleases();
  const { buildAssessmentBinding } =
    await import('../../scripts/catalog/admission');
  const entry = { ...cleave.entry, sources: [] };
  const artifact = {
    ...cleave.artifact,
    catalog: { ...cleave.artifact.catalog, entries: [entry] },
  };
  const evidence = { comparison: cleave.comparison };
  // A confirmed assessment naming CRB admits it on the assessment path.
  const attribution = {
    evidence,
    registry: cleave.registry,
    assessments: [
      {
        externalKey: entry.externalKey,
        status: 'confirmed' as const,
        ...buildAssessmentBinding({
          entry,
          artifact,
          evidence,
          registry: cleave.registry,
          requiredNotices: ['CRB'],
          evidenceIds: ['comparison'],
        }),
        requiredNotices: ['CRB'],
        rationale: 'The whole definition matches CRB p. 119.',
        reviewedBy: 'Catalog reviewer',
        reviewedOn: '2026-10-07',
      },
    ],
  };
  const matches: Attribution227Match[] = books
    ? [
        {
          externalKey: entry.externalKey,
          name: entry.name,
          kind: entry.detail.kind,
          status: 'matched',
          evidence: [
            {
              kind: 'reviewed-override',
              books,
              assessment: {
                externalKey: entry.externalKey,
                status: 'confirmed',
                reviewedOn: '2026-10-07',
              },
            },
          ],
          classes: [],
        },
      ]
    : [];
  const attributionPath: AttributionPath = {
    kind: 'declared-book',
    rule: { exceptions: [] },
    matches: {
      binding: {
        ...committedAttribution227Matches.binding,
        matchesSha256: matchesSha256(matches),
      },
      matches,
    },
  };
  return {
    ...cleave,
    release: () =>
      cleave.createCatalogRelease({
        ...cleave.options,
        artifact,
        attribution,
        attributionPath,
        releaseNumber: 1,
      }),
  };
}

describe('a release on the register', () => {
  it('admits Cleave on its declared book with no assessment or evidence', async () => {
    const { createCatalogRelease, options, registry, entry, row } =
      await cleaveReleases();
    const release = await createCatalogRelease({
      ...options,
      attribution: { registry, assessments: [], evidence: {} },
      releaseNumber: 1,
    });
    expect(row(release, entry.externalKey)).toMatchObject({ name: 'Cleave' });
    expect(row(release, 'requiredNotices')).toEqual(['CRB']);
  });

  it('refuses a row an assessment admits whose book has no reviewed notice', async () => {
    // The scripted match gives Cleave PZO9493, which the register lacks: the
    // gate on the register alone holds it, so the release refuses it.
    const uncovered = await cleaveOnMatch(['PZO9493']);
    await expect(uncovered.release()).rejects.toThrow(
      'Catalog Release notice coverage failed: pf1/Cleave (no reviewed notice: PZO9493).',
    );
    // Neither its record nor a match names a book; its assessment's stored
    // notice CRB is covered (the register alone holds it, for want of a book).
    const noBook = await cleaveOnMatch(null);
    expect(noBook.row(await noBook.release(), 'pf1/Cleave')).toMatchObject({
      name: 'Cleave',
    });
    // On a book the register covers, the same assessment's release builds.
    const covered = await cleaveOnMatch(['CRB']);
    const release = await covered.release();
    expect(covered.row(release, 'pf1/Cleave')).toMatchObject({
      name: 'Cleave',
    });
  });

  it('refuses a row an assessment admits whose stored notice has no reviewed notice', async () => {
    // Stored notices that disagree with the assessments (a stale frozen file):
    // the assessment admits Cleave on CRB, the stored PZO9999 is not in the
    // register, so the gate on the register alone holds it.
    const { createCatalogRelease, options, original } = await cleaveReleases();
    await expect(
      createCatalogRelease({
        ...options,
        attribution: {
          ...original,
          storedNotices: { 'pf1/Cleave': ['CRB', 'PZO9999'] },
        },
        releaseNumber: 1,
      }),
    ).rejects.toThrow(
      'Catalog Release notice coverage failed: pf1/Cleave (no reviewed notice: PZO9999).',
    );
  });

  it('requires and credits a stored notice, and holds its row while the register lacks it', async () => {
    const { createCatalogRelease, options, registry, entry, row } =
      await cleaveReleases();
    const { PZO1116: bestiary2 } = section15Registry;
    if (!bestiary2) throw new Error('The Registry has no PZO1116 record.');
    const credited = await createCatalogRelease({
      ...options,
      attribution: {
        registry: { ...registry, PZO1116: bestiary2 },
        assessments: [],
        evidence: {},
        storedNotices: { [entry.externalKey]: ['PZO1116'] },
      },
      releaseNumber: 1,
    });
    expect(row(credited, entry.externalKey)).toMatchObject({ name: 'Cleave' });
    expect(row(credited, 'requiredNotices')).toEqual(['CRB', 'PZO1116']);
    expect(row(credited, 'permanentNoticeSuperset')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'registry:PZO1116',
          text: bestiary2.notice,
        }),
      ]),
    );
    // Without its record, the row is held and nothing requires PZO1116.
    const held = await createCatalogRelease({
      ...options,
      attribution: {
        registry,
        assessments: [],
        evidence: {},
        storedNotices: { [entry.externalKey]: ['PZO1116'] },
      },
      releaseNumber: 1,
    });
    expect(row(held, entry.externalKey)).toBeUndefined();
    expect(row(held, 'requiredNotices')).toEqual([]);
  });
});
