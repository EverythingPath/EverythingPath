// #413 F8b: the calculation identity of the Catalog Release last activated in
// production, or null before the first production activation. Root commits it
// after each production activation: the first one (the initial migration's
// activation, whose identity `catalog:release active` reports) and every later
// one, from the `calculationIdentity` that `pnpm catalog:release activate
// --production` prints (the owner's runbook step,
// docs/catalog-import/releases.md "After a deploy that rotates the calculation
// identity"). tests/catalog/calculation-window.test.ts fails any rotation of
// src/lib/catalog/calculation-identities.ts whose supported window drops it.
// Outside the calculation closure: recording it never rotates the identity.
export const productionActivatedCalculationIdentity: string | null = null;
