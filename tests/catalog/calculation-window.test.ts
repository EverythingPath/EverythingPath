import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  isInCalculationWindow,
  outsideCalculationWindowMessage,
} from '../../src/lib/catalog/calculation-dispatch';
import {
  currentCalculationIdentity,
  priorCalculationIdentity,
  supersededCalculationIdentities,
} from '../../src/lib/catalog/calculation-identities';
import {
  calculationServing,
  productionWindowRefusal,
} from '../../src/lib/catalog/calculation-window';
import { productionActivatedCalculationIdentity } from '../../src/lib/catalog/production-calculation-identity';

// #413 F8b: a deploy that rotates the calculation identity keeps serving the
// release activated for the previous identity, through the same calculator,
// until a resolver-only release for the new identity is activated. A second
// rotation before that activation drops the active identity from the window
// and every sheet read fails closed.
const window = { current: 'sha256:c', prior: 'sha256:b' };

it.each([
  ['sha256:c', 'current'],
  ['sha256:b', 'prior'],
  ['sha256:a', 'outside-window'],
] as const)('classifies %s as %s', (identity, serving) => {
  expect(calculationServing(identity, window)).toBe(serving);
});

it("agrees with the dispatcher's supported window", () => {
  for (const identity of [
    currentCalculationIdentity,
    priorCalculationIdentity,
    ...supersededCalculationIdentities,
  ])
    expect(calculationServing(identity) !== 'outside-window').toBe(
      isInCalculationWindow(identity),
    );
  expect(calculationServing(currentCalculationIdentity)).toBe('current');
  expect(calculationServing(priorCalculationIdentity)).toBe('prior');
});

it('says what recovers a release outside the window', () => {
  const [twoBack] = supersededCalculationIdentities;
  expect(outsideCalculationWindowMessage(twoBack)).toBe(
    `Catalog Release calculation identity ${twoBack} is outside this deploy's calculation window ` +
      `(current ${currentCalculationIdentity}, prior ${priorCalculationIdentity}). ` +
      `Redeploy code whose window includes ${twoBack}, then activate a resolver-only release for the deployed identity ` +
      '(docs/catalog-import/releases.md#after-a-deploy-that-rotates-the-calculation-identity).',
  );
  // The anchor the message names is the runbook step's heading.
  expect(readFileSync('docs/catalog-import/releases.md', 'utf8')).toContain(
    '\n### After a deploy that rotates the calculation identity\n',
  );
});

it('refuses only a window that drops the identity activated in production', () => {
  expect(productionWindowRefusal(null, window)).toBeNull();
  expect(productionWindowRefusal('sha256:c', window)).toBeNull();
  // One rotation after the activation: still served as the prior identity.
  expect(productionWindowRefusal('sha256:b', window)).toBeNull();
  // A second rotation before a resolver-only release was activated.
  expect(productionWindowRefusal('sha256:a', window)).toBe(
    'This calculation identity rotation drops sha256:a, the calculation identity activated in production, ' +
      'from the supported window (current sha256:c, prior sha256:b): after its deploy every sheet read fails closed. ' +
      'First activate in production a resolver-only release for sha256:b, the identity this rotation replaces ' +
      '(docs/catalog-import/releases.md, "After a deploy that rotates the calculation identity"), and record it in ' +
      'src/lib/catalog/production-calculation-identity.ts.',
  );
});

it('keeps the calculation identity activated in production inside the supported window', () => {
  // Fails a rotation, in CI before it lands and so before any deploy, whose
  // window would drop the recorded production identity. Until the first
  // production activation nothing is recorded and it passes.
  expect(
    productionWindowRefusal(productionActivatedCalculationIdentity),
  ).toBeNull();
});
