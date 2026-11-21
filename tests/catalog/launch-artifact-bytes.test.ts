// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  parseLaunchVerification,
  serializeLaunchVerification,
} from '../../scripts/catalog/launch-verification';

// The regenerated rebase proof (gate_core.regen_proof) compares artifacts'
// decoded content, not their form, so a regeneration that changes the
// projection's content leaves its bytes to this test: the committed file is,
// byte for byte, what its writer (serializeLaunchVerification) writes from the
// content it parses to. The writer keeps the order its two package maps
// (binding.packages.imports, parsers.dependencyVersions) are given in, so
// that order is the builder's, not this test's. The inventory documents are
// written together from the built manifest, with no writer to call on one
// file's content, and are not covered here; the keyed attribution files are
// data-files.test.ts's.
const path = 'scripts/catalog/scopes/campaign-mvp-v1.verification.json';

it('keeps the projection as its writer writes it', () => {
  const text = readFileSync(path, 'utf8');
  const written = serializeLaunchVerification(
    parseLaunchVerification(JSON.parse(text)),
  );
  expect(written === text).toBe(true);
});
