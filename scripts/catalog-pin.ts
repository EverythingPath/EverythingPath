import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { currentCalculationIdentity } from '../src/lib/catalog/calculation-identities.ts';
import { catalogCalculationV1Files } from '../src/lib/catalog/runtime-compatibility.ts';

// Same algorithm as tests/catalogRuntimeCompatibility.test.ts: hash each path, a NUL byte,
// its exact file bytes and a NUL byte, in the closure's order. Run from the repository root.
const fingerprint = createHash('sha256');
for (const path of catalogCalculationV1Files) {
  fingerprint.update(`${path}\0`);
  fingerprint.update(readFileSync(path));
  fingerprint.update('\0');
}
const identity = `sha256:${fingerprint.digest('hex')}`;
process.stdout.write(`${identity}\n`);
if (identity !== currentCalculationIdentity) {
  process.stderr.write(
    `The calculation closure no longer matches ${currentCalculationIdentity}.\n` +
      'Before first activation, rotate the identities in src/lib/catalog/calculation-identities.ts ' +
      'and update the independent literal in tests/catalogRuntimeCompatibility.test.ts. ' +
      'See docs/catalog-import/releases.md.\n',
  );
  process.exitCode = 1;
}
