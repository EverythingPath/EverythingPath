// @vitest-environment node
import { expect, it, vi } from 'vitest';
import {
  buildAssessmentBinding,
  computeFingerprint,
} from '../../scripts/catalog/admission';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { bindingPreview, spells } from '../fixtures/spells-530/data';

it('fingerprints only the requested evidence while binding the complete published Resistance body', () => {
  const spell = spells.find((row) => row.name === 'Resistance');
  const other = spells.find((row) => row.name === 'Dispel Magic');
  const entry = bindingPreview.entries.find(
    (row) => row.externalKey === spell?.externalKey,
  );
  if (!spell || !other || !entry)
    throw new Error('Missing published Spell fixture');
  if (entry.detail.kind !== 'spell') throw new Error('Expected Spell');
  const requested = reviewedAdmission.evidence[spell.evidenceId];
  const unrelated = reviewedAdmission.evidence[other.evidenceId];
  if (!requested || !unrelated) throw new Error('Missing reviewed evidence');
  const readUnrelated = vi.fn(() => unrelated);
  const evidence = { [spell.evidenceId]: requested };
  Object.defineProperty(evidence, other.evidenceId, {
    enumerable: true,
    get: readUnrelated,
  });
  const inputs = {
    entry: { ...entry, detail: entry.detail },
    artifact: {
      catalog: {
        entries: [{ ...entry, detail: entry.detail }],
        resources: [],
        remaps: [],
      },
      comparison: { records: [], packs: [] },
    },
    registry: reviewedAdmission.registry,
    evidence,
    requiredNotices: spell.requiredNotices,
    evidenceIds: [spell.evidenceId],
  };
  const binding = buildAssessmentBinding(inputs);
  expect(binding.contentFingerprint).toBe(spell.binding.contentFingerprint);
  expect(binding.evidenceFingerprints).toEqual({
    [spell.evidenceId]: computeFingerprint(requested),
  });
  expect(readUnrelated).not.toHaveBeenCalled();
  const revoked = { ...requested, revoked: true };
  expect(
    buildAssessmentBinding({
      ...inputs,
      evidence: { [spell.evidenceId]: revoked },
    }).evidenceFingerprints[spell.evidenceId],
  ).toBe(computeFingerprint(revoked));
  expect(computeFingerprint(revoked)).not.toBe(
    binding.evidenceFingerprints[spell.evidenceId],
  );
  expect(
    buildAssessmentBinding({ ...inputs, evidence: {} }).evidenceFingerprints,
  ).toEqual({ [spell.evidenceId]: computeFingerprint(null) });
});

function resistanceBindingInputs() {
  const spell = spells.find((row) => row.name === 'Resistance');
  const entry = bindingPreview.entries.find(
    (row) => row.externalKey === spell?.externalKey,
  );
  if (!spell || entry?.detail.kind !== 'spell')
    throw new Error('Missing published Resistance fixture');
  const requested = reviewedAdmission.evidence[spell.evidenceId];
  if (!requested) throw new Error('Missing reviewed Resistance evidence');
  return {
    spell,
    requested,
    inputs: {
      entry: { ...entry, detail: entry.detail },
      artifact: {
        catalog: {
          entries: [{ ...entry, detail: entry.detail }],
          resources: [],
          remaps: [],
        },
        comparison: { records: [], packs: [] },
      },
      registry: reviewedAdmission.registry,
      requiredNotices: spell.requiredNotices,
    },
  };
}

it.each(['constructor', 'toString', '__proto__'])(
  'fingerprints missing evidence %s as null for the published Resistance body',
  (id) => {
    const { spell, inputs } = resistanceBindingInputs();
    const binding = buildAssessmentBinding({
      ...inputs,
      evidence: {},
      evidenceIds: [id],
    });
    expect(binding.contentFingerprint).toBe(spell.binding.contentFingerprint);
    expect(binding.evidenceFingerprints).toEqual({
      [id]: computeFingerprint(null),
    });
  },
);

it.each(['constructor', 'toString', '__proto__'])(
  'fingerprints explicitly owned evidence %s for the published Resistance body',
  (id) => {
    const { spell, requested, inputs } = resistanceBindingInputs();
    const evidence = Object.fromEntries([[id, requested]]);
    expect(Object.hasOwn(evidence, id)).toBe(true);
    const binding = buildAssessmentBinding({
      ...inputs,
      evidence,
      evidenceIds: [id],
    });
    expect(binding.contentFingerprint).toBe(spell.binding.contentFingerprint);
    expect(binding.evidenceFingerprints).toEqual({
      [id]: computeFingerprint(requested),
    });
    expect(binding.evidenceFingerprints[id]).not.toBe(computeFingerprint(null));
  },
);

it('keeps non-enumerable evidence outside the JSON dictionary boundary', () => {
  const { inputs, requested } = resistanceBindingInputs();
  const readEvidence = vi.fn(() => requested);
  const evidence = {};
  Object.defineProperty(evidence, 'constructor', {
    enumerable: false,
    get: readEvidence,
  });
  expect(
    buildAssessmentBinding({
      ...inputs,
      evidence,
      evidenceIds: ['constructor'],
    }).evidenceFingerprints,
  ).toEqual({ constructor: computeFingerprint(null) });
  expect(readEvidence).not.toHaveBeenCalled();
});
