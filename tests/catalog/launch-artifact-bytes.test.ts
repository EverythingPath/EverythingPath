// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  parseLaunchVerification,
  serializeLaunchVerification,
} from '../../scripts/catalog/launch-verification';

// The regenerated rebase proof (gate_core.regen_proof) compares artifacts'
// decoded content, not their form, so a regeneration that changes the
// projection's content leaves its bytes to this test: the committed file's
// bytes, never decoded for the comparison, are the UTF-8 of what its writer
// (serializeLaunchVerification) writes from the content it parses to. The
// writer keeps the order its two package maps (binding.packages.imports,
// parsers.dependencyVersions) are given in, so that order is the builder's,
// not this test's. The inventory documents are compacted as one set (the
// built manifest with the other documents read from disk, sharing one records
// file) before each is serialized (catalog-launch-inventory.ts); this test
// covers only the projection. The keyed attribution files are
// data-files.test.ts's.
const path = 'scripts/catalog/scopes/campaign-mvp-v1.verification.json';

function writtenAsCommitted(bytes: Buffer) {
  const written = serializeLaunchVerification(
    parseLaunchVerification(JSON.parse(bytes.toString('utf8'))),
  );
  return Buffer.from(written, 'utf8').equals(bytes);
}

it('keeps the projection as its writer writes it', () => {
  expect(writtenAsCommitted(readFileSync(path))).toBe(true);
});

it('refuses a projection whose bytes are not the UTF-8 its writer writes', () => {
  // A Windows-1252 é inside a string: decoded, it is U+FFFD, which the writer
  // writes as three bytes where the file holds one.
  const committed = readFileSync(path);
  const marker = Buffer.from('"scopeVersion": "campaign', 'utf8');
  const found = committed.indexOf(marker);
  expect(found).toBeGreaterThanOrEqual(0);
  const at = found + marker.length;
  const bytes = Buffer.concat([
    committed.subarray(0, at),
    Buffer.from([0xe9]),
    committed.subarray(at),
  ]);
  const text = bytes.toString('utf8');
  expect(
    serializeLaunchVerification(parseLaunchVerification(JSON.parse(text))),
  ).toBe(text);
  expect(writtenAsCommitted(bytes)).toBe(false);
});
