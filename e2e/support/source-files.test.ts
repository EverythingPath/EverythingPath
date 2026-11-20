// @vitest-environment node
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { sourceFingerprint } from './source-evidence';
import { copyBuildWorkspace } from './workspace';

// The repository's file listing outgrew Node's default 1 MiB child output
// (#729: about 1.3 MB, mostly tests/fixtures), and the run stopped at its
// source snapshot. 5,000 untracked files with 240-character names list as
// about 1.2 MB.
const fileCount = 5_000;
const fileNameLength = 240;

function createLargeRepository() {
  const root = mkdtempSync(join(tmpdir(), 'source-files-'));
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  mkdirSync(join(root, 'fixtures'));
  mkdirSync(join(root, 'node_modules'));
  for (let index = 0; index < fileCount; index++)
    writeFileSync(
      join(root, 'fixtures', String(index).padStart(fileNameLength, 'f')),
      String(index),
    );
  return root;
}

test('a source listing over 1 MiB still fingerprints and copies every file', async () => {
  const root = createLargeRepository();
  try {
    expect(sourceFingerprint(root)).toMatch(/^[0-9a-f]{64}$/);
    const workspace = join(root, '..', `${root.split('/').pop()}-workspace`);
    try {
      await copyBuildWorkspace(root, workspace);
      const last = String(fileCount - 1).padStart(fileNameLength, 'f');
      expect(existsSync(join(workspace, 'fixtures', last))).toBe(true);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 60_000);
