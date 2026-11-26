import { expect, test } from 'vitest';
import {
  evaluateCatalogActivationReadiness,
  type CatalogActivationReadiness,
} from './activation-readiness';

const readiness: CatalogActivationReadiness = {
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
  activation: { kind: 'fixture' },
};
const production = (
  scope: Extract<
    CatalogActivationReadiness['activation'],
    { kind: 'production' }
  >['scope'],
): CatalogActivationReadiness => ({
  ...readiness,
  activation: { kind: 'production', scope },
});

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

test('a production activation is ready only when its scope is QUALIFIED', () => {
  expect(
    evaluateCatalogActivationReadiness(
      production({
        kind: 'reported',
        version: 'campaign-mvp-v1',
        status: 'QUALIFIED',
      }),
    ),
  ).toEqual({ isReady: true, reasons: [] });
});

test.each([
  [
    { kind: 'reported', version: 'campaign-mvp-v1', status: 'FAILED' },
    'scope-unqualified: campaign-mvp-v1 FAILED',
  ],
  [{ kind: 'unreported' }, 'scope-unqualified: no scope report'],
] as const)(
  'a production activation refuses scope %j, naming the scope and its state',
  (scope, reason) => {
    expect(evaluateCatalogActivationReadiness(production(scope))).toEqual({
      isReady: false,
      reasons: [reason],
    });
  },
);

test.each([
  [
    { kind: 'reported', version: 'campaign-mvp-v1', status: 'FAILED' },
    'scope-unqualified: campaign-mvp-v1 FAILED (fixture-only skips the scope only on a deployment without ordinary campaigns or private Characters)',
  ],
  [
    { kind: 'unreported' },
    'scope-unqualified: no scope report (fixture-only skips the scope only on a deployment without ordinary campaigns or private Characters)',
  ],
] as const)(
  'a fixture-only activation beside ordinary data refuses scope %j, saying why the flag did not skip it',
  (scope, reason) => {
    expect(
      evaluateCatalogActivationReadiness({
        ...readiness,
        activation: { kind: 'fixture-beside-ordinary-data', scope },
      }),
    ).toEqual({ isReady: false, reasons: [reason] });
  },
);

test('a fixture-only activation beside ordinary data is ready with a QUALIFIED scope', () => {
  expect(
    evaluateCatalogActivationReadiness({
      ...readiness,
      activation: {
        kind: 'fixture-beside-ordinary-data',
        scope: {
          kind: 'reported',
          version: 'campaign-mvp-v1',
          status: 'QUALIFIED',
        },
      },
    }),
  ).toEqual({ isReady: true, reasons: [] });
});

test('a scope refusal keeps the other readiness evidence', () => {
  expect(
    evaluateCatalogActivationReadiness({
      ...production({ kind: 'unreported' }),
      hasDirtyWork: true,
    }),
  ).toEqual({
    isReady: false,
    reasons: ['pending-work', 'scope-unqualified: no scope report'],
  });
});

test('the activation kind admits only its own shape', () => {
  const shapes: CatalogActivationReadiness['activation'][] = [
    { kind: 'fixture' },
    { kind: 'production', scope: { kind: 'unreported' } },
    // @ts-expect-error A production activation must name its scope.
    { kind: 'production' },
    // @ts-expect-error A fixture activation reads no scope.
    { kind: 'fixture', scope: { kind: 'unreported' } },
    { kind: 'fixture-beside-ordinary-data', scope: { kind: 'unreported' } },
    // @ts-expect-error Beside ordinary data the flag skips no scope.
    { kind: 'fixture-beside-ordinary-data' },
    {
      kind: 'production',
      // @ts-expect-error A reported scope names its version and status.
      scope: { kind: 'reported', status: 'QUALIFIED' },
    },
  ];
  expect(shapes).toHaveLength(7);
});
