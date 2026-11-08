// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { launchMechanismProofs } from '../../scripts/catalog/launch-mechanism-proofs';
import {
  currentMechanismProofs,
  repositoryFileSha256,
} from '../../scripts/catalog/launch-verification';

// The mechanism proof registry as a whole. This is the only test that pins
// the list of families: each family's own test checks its entry by name, so a
// new family adds one line to the sorted list below and touches no other
// family's test.
const repository = (path: string) => repositoryFileSha256('.', path);
const families = launchMechanismProofs.map(({ family }) => family);
/** The families whose current entry names a test of this path. */
const naming = (path: string) =>
  launchMechanismProofs
    .filter(({ tests }) => tests.some((test) => test.path === path))
    .map(({ family }) => family);
/** The current families after one test file's bytes change. */
const currentWithout = (path: string) =>
  currentMechanismProofs({
    registry: launchMechanismProofs,
    sha256Of: (other) => (other === path ? 'e'.repeat(64) : repository(other)),
  }).map(({ family }) => family);

describe('the mechanism proof registry', () => {
  it('holds each family once', () => {
    expect([...families].sort()).toEqual([
      'plain-modifiers',
      'rank-modifiers',
      'source-body',
      'source-prerequisites',
      'spell-class-list',
      'spell-granted-levels',
    ]);
    expect(new Set(families).size).toBe(families.length);
  });

  it('is current, and changing one test file’s bytes drops exactly the families naming it', () => {
    expect(
      currentMechanismProofs({
        registry: launchMechanismProofs,
        sha256Of: repository,
      }).map(({ family }) => family),
    ).toEqual(families);
    // Two families name the class-list proof.
    expect(
      naming('convex/characterSheetSpellClassList.integration.test.ts'),
    ).toEqual(['spell-class-list', 'spell-granted-levels']);
    const paths = [
      ...new Set(
        launchMechanismProofs.flatMap(({ tests }) =>
          tests.map(({ path }) => path),
        ),
      ),
    ];
    for (const path of paths) {
      const dropped = naming(path);
      expect(dropped.length, path).toBeGreaterThan(0);
      expect(currentWithout(path), path).toEqual(
        families.filter((family) => !dropped.includes(family)),
      );
    }
  });
});
