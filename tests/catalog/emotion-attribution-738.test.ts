// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { assessedBuffs as buffs548 } from '../fixtures/pf-buffs-548/data';
import { assessedBuffs as buffs549 } from '../fixtures/pf-buffs-549/data';
import { readPinned } from './pinned-sources';

it('keeps the newly imported Emotion attribution open on all six affected buff closures', async () => {
  const rules = await readPinned(
    'pf1',
    'packs/rules/schools-of-magic-and-descriptors.7fYYPFNPVJUrWRfA.yaml',
  );
  expect(createHash('sha256').update(rules).digest('hex')).toBe(
    '2569646cc38a3177720cd7ee6d191efafc15dcb51a8ff83c78b32057c43d5920',
  );
  expect(rules).toMatch(
    /<h2>Emotion<\/h2><p><strong>Source<\/strong> Ultimate\s+Magic/,
  );
  for (const id of [
    '6k7GsF01oeTNRdHn',
    '93oIrx2wLSx0jMkM',
    'Pet3yM3SB2VfqgPy',
    'cCD0u4e8iVPQiEEB',
    'kkDzmQdg0RjnwSLj',
    'lpBAgRhDew61Vmzo',
  ]) {
    const key = `pf1-content/${id}`;
    const row = [...buffs548, ...buffs549].find(
      (entry) => entry.externalKey === key,
    );
    const assessment = reviewedAdmission.assessments.find(
      (entry) => entry.externalKey === key,
    );
    expect(row, key).toMatchObject({
      assessmentStatus: 'unresolved',
      disposition: 'held',
      noticeRequirementsComplete: false,
    });
    expect(row?.requiredNotices, key).toContain('PZO1117');
    expect(row?.holdIds, key).toContainEqual(
      expect.stringContaining('emotion-attribution'),
    );
    expect(row?.noticeHoldIds, key).toContainEqual(
      expect.stringContaining('notice-PZO1117-complete-chain'),
    );
    expect(assessment, key).toMatchObject({
      status: 'unresolved',
      rationale: row?.rationale,
    });
    expect(assessment?.requiredNotices, key).toEqual(row?.requiredNotices);
  }
});
