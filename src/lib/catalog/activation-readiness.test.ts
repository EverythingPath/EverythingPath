import { expect, test } from 'vitest';
import { evaluateCatalogActivationReadiness } from './activation-readiness';

const readiness = {
  isPrepared: true,
  isBaseCurrent: true,
  isCandidateCurrent: true,
  isRunCurrent: true,
  isDiscoveryComplete: true,
  hasDiscoveryFailed: false,
  hasDirtyWork: false,
  hasFailedWork: false,
  hasPassedGates: true,
  isCompatible: true,
};

test.each([
  ['isPrepared', false, 'not-prepared'],
  ['isBaseCurrent', false, 'base-changed'],
  ['isCandidateCurrent', false, 'candidate-superseded'],
  ['isRunCurrent', false, 'run-superseded'],
  ['isDiscoveryComplete', false, 'discovery-incomplete'],
  ['hasDiscoveryFailed', true, 'discovery-failed'],
  ['hasDirtyWork', true, 'pending-work'],
  ['hasFailedWork', true, 'failed-work'],
  ['hasPassedGates', false, 'gates-incomplete'],
  ['isCompatible', false, 'incompatible'],
] as const)(
  'activation refuses %s without losing the other readiness evidence',
  (key, value, reason) => {
    expect(
      evaluateCatalogActivationReadiness({ ...readiness, [key]: value }),
    ).toEqual({
      isReady: false,
      reasons: [reason],
    });
  },
);

test('activation accepts a complete compatible preparation', () => {
  expect(evaluateCatalogActivationReadiness(readiness)).toEqual({
    isReady: true,
    reasons: [],
  });
});
