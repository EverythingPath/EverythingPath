// @vitest-environment node
import path from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import {
  findStaleSuppressions,
  readSuppressedFiles,
} from '../scripts/lib/eslint-suppressions';

const root = path.resolve(__dirname, '..');
const eslint = new ESLint({ cwd: root });

describe('stale entries in eslint-suppressions.json', () => {
  it('are reported for a deleted or renamed file and a file lint never reads', async () => {
    expect(
      await findStaleSuppressions(eslint, root, [
        'convex/campaignDeletions.ts',
        'tests/eslint-host-audits.test.ts',
        'src/renamed-away.test.ts',
        'README.md',
        'convex/_generated/api.d.ts',
      ]),
    ).toEqual([
      { file: 'src/renamed-away.test.ts', reason: 'missing' },
      { file: 'README.md', reason: 'not linted' },
      { file: 'convex/_generated/api.d.ts', reason: 'not linted' },
    ]);
  }, 30_000);

  it('are absent from the committed file', async () => {
    const files = readSuppressedFiles(
      path.join(root, 'eslint-suppressions.json'),
    );

    expect(files.length).toBeGreaterThan(0);
    expect(await findStaleSuppressions(eslint, root, files)).toEqual([]);
  }, 30_000);
});
