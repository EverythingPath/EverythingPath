// @vitest-environment node
import { expect, it } from 'vitest';
import { createAssessmentBinder } from '../../scripts/catalog/admission';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { fullBindingContext738 } from './full-binding-context-738';

it('binds every missed or bounded #738 assessment to its verified full-corpus content', () => {
  expect(fullBindingContext738.rootKeys).toHaveLength(99);
  const entries = new Map(
    fullBindingContext738.entries.map((entry) => [entry.externalKey, entry]),
  );
  // Every root binds against the same unchanged corpus, evidence and Registry.
  const bind = createAssessmentBinder({
    artifact: {
      catalog: fullBindingContext738,
      comparison: { records: [], packs: [] },
    },
    evidence: reviewedAdmission.evidence,
    registry: reviewedAdmission.registry,
  });
  for (const key of fullBindingContext738.rootKeys) {
    const entry = entries.get(key);
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === key,
    );
    if (!entry || !assessment) throw new Error(`Missing assessed Spell ${key}`);
    expect(assessment, entry.name).toMatchObject(
      bind({
        entry,
        requiredNotices: assessment.requiredNotices,
        evidenceIds: Object.keys(assessment.evidenceFingerprints),
      }),
    );
  }
});
