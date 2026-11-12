import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { ESLint } from 'eslint';

export type StaleSuppression = {
  file: string;
  reason: 'missing' | 'not linted';
};

export function readSuppressedFiles(suppressionsPath: string) {
  // Safe cast: ESLint writes this file as an object keyed by file path.
  const suppressions = JSON.parse(
    readFileSync(suppressionsPath, 'utf8'),
  ) as Record<string, unknown>;
  return Object.keys(suppressions);
}

// ESLint checks suppressions only against the files it lints, so an entry for
// a deleted, renamed or ignored file never shows as unused. lint:eslint:app
// and lint:eslint:convex together lint every file the config matches and
// does not ignore.
export async function findStaleSuppressions(
  eslint: ESLint,
  root: string,
  files: string[],
) {
  const stale: StaleSuppression[] = [];
  for (const file of files) {
    const absolute = path.resolve(root, file);
    if (!existsSync(absolute)) stale.push({ file, reason: 'missing' });
    else if (
      (await eslint.isPathIgnored(absolute)) ||
      !(await eslint.calculateConfigForFile(absolute))
    )
      stale.push({ file, reason: 'not linted' });
  }
  return stale;
}
