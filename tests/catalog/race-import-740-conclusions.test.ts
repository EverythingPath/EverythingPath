// @vitest-environment node
import { createHash } from 'node:crypto';
import historical from '../fixtures/race-import-740/historical-conclusions.json';
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolvePreviewReferences } from '../fixtures/preview-references';
import proposals from '../../scripts/catalog/race-import-740-proposals.json';
import review from '../../scripts/catalog/legal/races-328.json';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { reviewedAdmissionSchema } from '../../src/lib/catalog/admission-schema';
import {
  resolveAssessmentRationale,
  resolveAttributionEvidenceContent,
  resolveDiagnosticConclusion,
} from '../../src/lib/catalog/diagnostic-conclusions';

test('every proposal and rationale resolves its own canonical conclusion without storing expanded paragraphs again', () => {
  for (const candidate of review.candidates) {
    if (!('reassessment' in candidate) || !candidate.reassessment) continue;
    const reference = candidate.reassessment.conclusionRef;
    const paragraphs = resolveDiagnosticConclusion({
      reference,
      evidence: reviewedAdmission.evidence,
    });
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    if (!assessment) throw new Error('Missing assessment');
    // #328 S4-A confirms Human, Dwarf and Half-Orc. Their assessments still
    // bind the extraction evidence, but no longer append its "remain held"
    // conclusion to the rationale.
    if (assessment.status === 'confirmed') {
      expect(assessment.conclusionRef).toBeUndefined();
      expect(assessment.evidenceFingerprints).toHaveProperty(
        reference.evidenceId,
      );
      expect(
        resolveAssessmentRationale({
          assessment,
          evidence: reviewedAdmission.evidence,
        }),
      ).toBe(assessment.rationale);
    } else
      expect(
        resolveAssessmentRationale({
          assessment,
          evidence: reviewedAdmission.evidence,
        }),
      ).toContain(paragraphs.join(' '));
    expect(
      resolveAttributionEvidenceContent({
        evidenceId: reference.evidenceId,
        evidence: reviewedAdmission.evidence,
      }),
    ).toContain(paragraphs.join(' '));
    for (const proposal of candidate.reassessment.diagnosticProposals) {
      expect(proposal).not.toHaveProperty('diagnostics');
      expect(
        resolveDiagnosticConclusion({
          reference: proposal.conclusionRef,
          evidence: reviewedAdmission.evidence,
        }),
      ).toEqual(paragraphs);
    }
    expect(candidate.reassessment).not.toHaveProperty('diagnostics');
    expect(assessment.rationale).not.toContain(paragraphs.join(' '));
  }
});

test('missing, wrong-subject and unbound evidence references are rejected', () => {
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.conclusionRef,
  );
  if (!assessment?.conclusionRef)
    throw new Error('Missing referenced assessment');
  for (const ref of [
    { ...assessment.conclusionRef, evidenceId: 'missing' },
    { ...assessment.conclusionRef, externalKey: 'pf1/wrong-subject' },
  ]) {
    expect(() =>
      resolveDiagnosticConclusion({
        reference: ref,
        evidence: reviewedAdmission.evidence,
      }),
    ).toThrow('Missing or mismatched');
    expect(
      reviewedAdmissionSchema.safeParse({
        ...reviewedAdmission,
        assessments: [{ ...assessment, conclusionRef: ref }],
      }).success,
    ).toBe(false);
  }
  expect(
    reviewedAdmissionSchema.safeParse({
      ...reviewedAdmission,
      assessments: [{ ...assessment, evidenceFingerprints: {} }],
    }).success,
  ).toBe(false);
});

test('source proposals remain drafted, resolve their own conclusions and cannot borrow another subject', () => {
  expect(proposals.status).toBe('drafted');
  expect(proposals.proposals).toHaveLength(11);
  for (const proposal of proposals.proposals) {
    expect(proposal.status).toBe('drafted');
    expect(proposal.conclusionRef.externalKey).toBe(proposal.externalKey);
    expect(
      resolveDiagnosticConclusion({
        reference: proposal.conclusionRef,
        evidence: reviewedAdmission.evidence,
      }).length,
    ).toBeGreaterThan(0);
    expect(() =>
      resolveDiagnosticConclusion({
        reference: { ...proposal.conclusionRef, externalKey: 'pf1/wrong' },
        evidence: reviewedAdmission.evidence,
      }),
    ).toThrow('mismatched');
  }
});

test('referenced fixture bodies reject missing identities, changed fingerprints and duplicates', () => {
  const raw = JSON.parse(
    readFileSync('tests/fixtures/racial-traits-395/preview.json', 'utf8'),
  );
  const ref = raw.closureRefs[0];
  expect(
    resolvePreviewReferences({ raw }).closure.some(
      (entry) => entry.externalKey === 'pf1-content/BFszTUJLlDS1ZDB8',
    ),
  ).toBe(true);
  for (const closureRefs of [
    [{ ...ref, externalKey: 'pf1/missing' }],
    [{ ...ref, fingerprint: '0'.repeat(64) }],
    [ref, ref],
  ])
    expect(() =>
      resolvePreviewReferences({ raw: { ...raw, closureRefs } }),
    ).toThrow('preview reference');
});

test('the representation change preserves independent historical diagnostics and histories across current conclusion corrections', () => {
  const hashJson = (value: unknown) =>
    createHash('sha256').update(JSON.stringify(value)).digest('hex');
  expect(historical.records).toHaveLength(9);
  expect(
    review.candidates
      .filter(
        (row) =>
          'reassessment' in row &&
          row.reassessment &&
          row.name !== 'Svirfneblin',
      )
      .map((row) => row.externalKey),
  ).toEqual(historical.records.map((row) => row.externalKey));
  for (const candidate of review.candidates) {
    if (
      !('reassessment' in candidate) ||
      !candidate.reassessment ||
      candidate.name === 'Svirfneblin'
    )
      continue;
    const original = historical.records.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    if (!original)
      throw new Error('Missing independent historical expectation');
    const paragraphs = [
      ...resolveDiagnosticConclusion({
        reference: candidate.reassessment.conclusionRef,
        evidence: reviewedAdmission.evidence,
      }),
    ];
    if (
      [
        'pf1/cCepRrfH5SalFfT4',
        'pf1/dCAXgdA6Db1Z3ccz',
        'pf1/e6IaBxKgMxy1yKlr',
      ].includes(candidate.externalKey)
    ) {
      // F1 corrects only the current first paragraph. Reconstruct its historical
      // predecessor for the original independent hash; keep that fixture frozen.
      expect(paragraphs[0]).not.toContain('derived fixed ability traits');
      paragraphs[0] =
        'Extraction rechecked against the pinned Foundry bytes: standard Racial Trait Grants, supported skill targets, size and derived fixed ability traits are present. The historical pre-#719/pre-#720 absence diagnosis is obsolete.';
    }
    expect(hashJson(paragraphs)).toBe(original.diagnosticsSha256);
    expect(hashJson(candidate.assessmentHistory)).toBe(
      original.assessmentHistorySha256,
    );
  }
});
