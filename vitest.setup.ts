import '@testing-library/jest-dom/vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeEach } from 'vitest';
import {
  installReaderGuard,
  readerGuardViolations,
} from './tests/light-lane-reader-guard';

// The light landing lane's reader guard (tests/light-lane-reader-guard.ts): a
// read of a lane-eligible file throws, and fails the test even when the test
// caught the error. Reads while the file loads fail its first test, or the
// file when it has none.
installReaderGuard(path.dirname(fileURLToPath(import.meta.url)));
let guardedReads = readerGuardViolations().length;
function failNewGuardedReads() {
  const reads = readerGuardViolations();
  const fresh = reads.slice(guardedReads);
  guardedReads = reads.length;
  if (fresh.length > 0) {
    throw new Error(
      `light lane reader guard: this test read ${fresh.join(', ')}; see tests/light-lane-reader-guard.ts`,
    );
  }
}
afterEach(failNewGuardedReads);
afterAll(failNewGuardedReads);

// Testing Library only unmounts automatically when a global afterEach exists,
// and Vitest globals are off. Files that opt into the node or edge-runtime
// environment have no document, so they skip React entirely.
if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(cleanup);
}

// The duration budget (tests/duration-budget-reporter.ts) compares each test's
// duration with its own timeout, which JSON reports otherwise leave out.
beforeEach(({ task }) => {
  task.meta.timeout = task.timeout;
});
