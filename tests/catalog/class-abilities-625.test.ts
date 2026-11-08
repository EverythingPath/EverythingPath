// @vitest-environment node
import { expect, it } from 'vitest';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import {
  bodyParagraphs,
  describeLaunchFeature,
  prdText,
} from './class-abilities-596';

// #625, MVP launch subset (#596 run A): Weapon Training, curated but held
// on owner-owed notice text and content evidence. Run B dropped the PZO9410
// and PZO9481 holds once their PCGen confirmations were reviewed.
const { candidate, entry } = describeLaunchFeature({
  batch: 625,
  name: 'Weapon Training',
  disposition: 'held',
});

const HOLDS = [
  'class-abilities-625-owner-owed-PZO9491',
  'class-abilities-625-owner-owed-PZO9493',
  'class-abilities-625-owner-owed-content',
];
const DROPPED_HOLDS = [
  'class-abilities-625-owner-owed-PZO9410',
  'class-abilities-625-owner-owed-PZO9481',
];

it('holds Weapon Training on named owner-owed notice text and content evidence, in its unresolved assessment', () => {
  expect(candidate.assessmentStatus).toBe('unresolved');
  expect(candidate.holdIds).toEqual(HOLDS);
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === candidate.externalKey,
  );
  for (const id of HOLDS) expect(assessment?.rationale).toContain(id);
  for (const id of DROPPED_HOLDS)
    expect(assessment?.rationale).not.toContain(id);
  // Content-level holds: no notice hold is added or cleared.
  const ids = new Set(heldNotices.map((row) => row.id));
  for (const id of HOLDS) expect(ids.has(id)).toBe(false);
  expect(
    Object.entries(candidate.missingEvidence ?? {}).map(([id, row]) => [
      id,
      row.book,
      row.items.length,
    ]),
  ).toEqual([
    [HOLDS[0], 'PZO9491', 7],
    [HOLDS[1], 'PZO9493', 4],
    [HOLDS[2], null, 3],
  ]);
  expect(candidate.missingEvidence?.[HOLDS[2]!]?.items).toEqual([
    'dueling sword',
    'lungshuan tamo',
    'brutal bolas',
  ]);
  expect(candidate.requiredNotices).toEqual([
    'PZO1110',
    'PZO1118',
    'PZO1123',
    'PZO1140',
    'PZO9226',
    'PZO9422',
    'PZO9455',
    'PZO9410',
    'PZO9481',
    'PZO9491',
    'PZO9493',
  ]);
  // Every recorded inherited-rule book is required.
  for (const { book } of candidate.inheritedRuleNotices)
    expect(candidate.requiredNotices).toContain(book);
  // None of the four books has a Registry identity of its own. PZO9410 and
  // PZO9481 have PCGen blocks since 2026-10-31 (their `OGL.txt` carries
  // their own line), reviewed once their confirmations' review was recorded
  // (2026-10-31), so run B dropped their holds; PZO9491 and PZO9493 still
  // have none and stay owner-owed.
  const registry = new Set(
    Object.entries(reviewedAdmission.registry).flatMap(([key, row]) => [
      key,
      ...(row.aliases ?? []),
    ]),
  );
  for (const code of ['PZO9410', 'PZO9481', 'PZO9491', 'PZO9493'])
    expect(registry.has(code), code).toBe(false);
  expect(
    ['PZO9410', 'PZO9481', 'PZO9491', 'PZO9493'].map(
      (code) => reviewedAdmission.registry[`pcgen:${code}`]?.reviewStatus,
    ),
  ).toEqual(['reviewed', 'reviewed', undefined, undefined]);
});

it('compares the rules paragraphs with the CRB and traces the added groups to their books', () => {
  const paragraphs = bodyParagraphs(candidate.mechanicsReview.descriptionText);
  const prd = candidate.prdComparison.lines.map((row) => prdText(row.text));
  expect(paragraphs[0]).toBe(prd[0]);
  expect(paragraphs[1]).toBe(prd[1]?.replace('(9th,', '(9th*,'));
  expect(paragraphs[2]?.replaceAll('’', "'")).toBe(
    prd[2]?.replace('weapons from this group.', 'weapons from his group.'),
  );
  // The Notes are the three rules paragraphs; the group lists stay in the description.
  expect(entry.situationalNotes?.map((note) => note.text)).toEqual(
    paragraphs.slice(0, 3),
  );
  expect(entry.modifiers).toEqual([]);
  // Groups the CRB doesn't have, and their PCGen origins.
  for (const group of ['Firearms', 'Siege engines', 'Tribal']) {
    expect(paragraphs.some((text) => text.startsWith(`${group}:`))).toBe(true);
    expect(prd.some((text) => text.startsWith(`${group}:`))).toBe(false);
  }
  expect(
    candidate.additionalComparisonLeads.map((row) => [
      row.book,
      row.literalRow.split('\t')[0],
    ]),
  ).toEqual([
    ['PZO1118', 'Weapon Training (Firearms)'],
    ['PZO1140', 'Weapon Training (Tribal)'],
  ]);
  // Spiked shield is CRB: the PRD's Close group lists it.
  expect(prd.find((text) => text.startsWith('Close:'))).toContain(
    'spiked shield',
  );
  expect(
    candidate.mechanicsReview.classFeatureReview.schedule
      .filter((row, index, rows) => row.value !== (rows[index - 1]?.value ?? 0))
      .map((row) => [row.level, row.value]),
  ).toEqual([
    [5, 1],
    [9, 2],
    [13, 3],
    [17, 4],
  ]);
});
