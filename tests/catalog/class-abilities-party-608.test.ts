// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import { committedAttribution227 } from '../../scripts/catalog/legal/attribution-227';
import { committedAttribution227Matches } from '../../scripts/catalog/legal/attribution-227-matches';
import type { PreviewEntry } from '../../scripts/catalog/map';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { describeLaunchFeature, REVIEWER } from './class-abilities-596';

// Party batch for the #227 scripted-match holds (party-227-holds, #608's
// number): four class features Foundry gives no book, held because only their
// class association named one. Each gets a confirmed, content-bound
// Attribution Assessment in its own issue's launch-subset inventory, in the
// class-feature launch-subset form (#596, #631 waves A and F1).
const PARTY_REVIEWED_ON = '2026-11-14';
const rows = [
  {
    batch: 608,
    key: 'pf1/5lDEyC6WejFyTEho',
    name: 'Exchange Spell (Medium)',
    books: ['PZO1110', 'PZO1115', 'PZO1129', 'PZO1131', 'PZO1132'],
    classes: [
      'pf1/6GjOjO6r3R06fLwE', // Bard
      'pf1/Immo2BuSe5WGdRW9', // Hunter
      'pf1/Fv3FbmXptuDRiL5y', // Inquisitor
      'pf1/xtRbNEKYYq4cRiwI', // Medium
      'pf1/fLU25FvuRWMCSxPP', // Mesmerist
      'pf1/5uUzVl0gLZ23vY96', // Occultist
      'pf1/G2SqFdNKFxbujzbH', // Skald
      'pf1/iYAQs7zjFbgcmect', // Spiritualist
      'pf1/BrnHPJ2EVSQSyNQ8', // Summoner
      'pf1/5iDrtRQMuIhLymUA', // Summoner (Unchained)
    ],
    level: 5,
  },
  {
    batch: 618,
    key: 'pf1/IMhG1JjaWP6p9ORe',
    name: 'Grand Hex',
    books: ['PZO1115'],
    classes: ['pf1/RC4D4WFT5kRKkdqp'],
    level: 18,
  },
  {
    batch: 629,
    key: 'pf1/XfN89DtlUrwHGNrp',
    name: 'Exchange Spell (Low)',
    books: ['PZO1110', 'PZO1129'],
    classes: ['pf1/E27lMw9YNOAjS009'],
    level: 8,
  },
  {
    batch: 631,
    key: 'pf1/aZ5eCIRrsvax5CZZ',
    name: 'Major Hex',
    books: ['PZO1115'],
    classes: ['pf1/RC4D4WFT5kRKkdqp'],
    level: 10,
  },
] as const;

const described = rows.map((row) => ({
  row,
  ...describeLaunchFeature({
    batch: row.batch,
    key: row.key,
    name: row.name,
    disposition: 'admitted',
    reviewer: REVIEWER,
    reviewedOn: PARTY_REVIEWED_ON,
    books: [...row.books],
    classes: [...row.classes],
  }),
}));

const entries = described.map(({ entry }) => entry);
/** A release artifact over these entries, every upstream record in scope. */
function artifactOf(rows: PreviewEntry[]) {
  return {
    curation: { missing: [], unresolvedMechanics: [] },
    catalog: { entries: rows, resources: [] as PreviewEntry[], remaps: [] },
    comparison: {
      coverageComplete: true,
      summary: {
        upstreamRecords: rows.length,
        admitted: rows.length,
        excluded: 0,
        unassigned: 0,
        byKind: {},
      },
      packs: [],
      records: [...new Set(rows.map((entry) => entry.upstreamKey))].map(
        (upstreamKey) => ({
          repo: 'pf1',
          pack: 'class-abilities',
          path: `${upstreamKey}.yaml`,
          externalKey: upstreamKey,
          name: upstreamKey,
          status: 'admitted' as const,
          reason: 'In scope',
        }),
      ),
    },
  };
}
const partyKeys = new Set<string>(rows.map((row) => row.key));
/**
 * The gate as releases run it, the #227 rule over the committed data; or as
 * at the base, before the records: none of the four assessments, and each
 * scripted match held on its class association alone, which is what the
 * matcher reads once the stored assessment (each one's only evidence, below)
 * is gone.
 */
const gateOver = (rows: PreviewEntry[], { base = false } = {}) =>
  assessCatalogAdmission({
    artifact: artifactOf(rows),
    ...reviewedAdmission,
    assessments: base
      ? reviewedAdmission.assessments.filter(
          (row) => !partyKeys.has(row.externalKey),
        )
      : reviewedAdmission.assessments,
    attributionPath: {
      kind: 'declared-book',
      rule: committedAttribution227,
      ...(base
        ? {
            matches: {
              matches: committedAttribution227Matches.matches.map((match) =>
                partyKeys.has(match.externalKey) && match.status === 'matched'
                  ? {
                      externalKey: match.externalKey,
                      name: match.name,
                      kind: match.kind,
                      status: 'held' as const,
                      hold: {
                        kind: 'association-only' as const,
                        classes: match.classes as [
                          (typeof match.classes)[number],
                          ...(typeof match.classes)[number][],
                        ],
                      },
                    }
                  : match,
              ),
            },
          }
        : {}),
    },
  });

describe('the four #227 scripted-match holds of the party', () => {
  it('records each as a launch-subset row held from its grant level through 20th, on its classes’ books', () => {
    for (const { row, candidate } of described) {
      const review = candidate.mechanicsReview.classFeatureReview;
      expect(review.level).toBe(row.level);
      expect(
        review.schedule.filter((step) => step.value).map((step) => step.level),
      ).toEqual(
        Array.from({ length: 21 - row.level }, (_, index) => row.level + index),
      );
      expect(candidate.requiredNotices).toEqual(row.books);
      expect(row.books).toContain(candidate.comparison.book);
    }
  });

  it('holds each on its class association alone without its assessment, and admits it on the assessment with it', () => {
    const without = gateOver(entries, { base: true });
    expect(without.admitted).toEqual([]);
    expect(without.held.map((row) => row.externalKey).sort()).toEqual(
      [...partyKeys].sort(),
    );
    for (const held of without.held)
      expect(held.reason).toMatch(
        /^Held under #227: scripted match held: no PCGen match or stored assessment; only its class association names a book: /,
      );

    const result = gateOver(entries);
    expect(result.failures).toEqual([]);
    expect(result.held).toEqual([]);
    expect(result.dependentOmissions).toEqual([]);
    for (const row of rows)
      expect(
        result.admitted.find((admitted) => admitted.externalKey === row.key),
      ).toMatchObject({ requiredNotices: row.books, missingNotices: [] });
  });

  it('lists each in the committed scripted match on its stored assessment, so no class row is omitted for it', () => {
    for (const { row, candidate } of described) {
      const match = committedAttribution227Matches.matches.find(
        (item) => item.externalKey === row.key,
      );
      expect(match?.status).toBe('matched');
      expect(
        match?.status === 'matched'
          ? match.evidence.filter((item) => item.kind === 'stored-assessment')
          : [],
      ).toEqual([
        {
          kind: 'stored-assessment',
          notices: [...row.books].sort(),
          batch: `scripts/catalog/legal/class-abilities-${row.batch}.json`,
          comparison: {
            file: candidate.comparison.path.replace(
              'data/pathfinder/paizo/',
              '',
            ),
            line: candidate.comparison.line,
          },
        },
      ]);
    }
  });
});

// The dependent classes: Bard, Bloodrager and Witch with their full-corpus
// closures (the before preview's entries, the four rows aside). At the base
// each was a dependent omission of these rows alone.
const dependents = z
  .object({ entries: z.array(importedCatalogEntrySchema) })
  .parse(
    JSON.parse(
      readFileSync(
        'tests/fixtures/class-abilities-party-608/dependents.json',
        'utf8',
      ),
    ),
  ).entries as unknown as PreviewEntry[];
const dependentClasses = {
  'pf1/6GjOjO6r3R06fLwE': ['pf1/5lDEyC6WejFyTEho'], // Bard
  'pf1/E27lMw9YNOAjS009': ['pf1/XfN89DtlUrwHGNrp'], // Bloodrager
  'pf1/RC4D4WFT5kRKkdqp': ['pf1/IMhG1JjaWP6p9ORe', 'pf1/aZ5eCIRrsvax5CZZ'], // Witch
};

describe('the classes the four rows omitted', () => {
  const closure = [...dependents, ...entries];

  it('omits Bard, Bloodrager and Witch for these rows alone without their assessments', () => {
    const result = gateOver(closure, { base: true });
    expect(result.failures).toEqual([]);
    expect(result.held.map((row) => row.externalKey).sort()).toEqual(
      [...partyKeys].sort(),
    );
    expect(
      Object.fromEntries(
        result.dependentOmissions.map((row) => [row.externalKey, row.reason]),
      ),
    ).toEqual(
      Object.fromEntries(
        Object.entries(dependentClasses).map(([key, causes]) => [
          key,
          `Dependent omission: ${causes.join(', ')}.`,
        ]),
      ),
    );
  });

  it('admits them and their whole closures with the assessments', () => {
    const result = gateOver(closure);
    expect(result.failures).toEqual([]);
    expect(result.held).toEqual([]);
    expect(result.dependentOmissions).toEqual([]);
    expect(result.admitted.map((row) => row.externalKey).sort()).toEqual(
      closure.map((entry) => entry.externalKey).sort(),
    );
    for (const key of Object.keys(dependentClasses))
      expect(result.admitted.map((row) => row.externalKey)).toContain(key);
  });
});
