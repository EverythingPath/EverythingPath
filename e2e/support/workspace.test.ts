// @vitest-environment node
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { refreshSpecFiles } from './workspace';

// A reused prepared workspace (#754) gets exactly the checkout's current
// top-level specs, whatever was edited, deleted or renamed since.
test('a spec refresh makes the workspace specs exactly the source specs', async () => {
  const root = mkdtempSync(join(tmpdir(), 'spec-refresh-'));
  const source = join(root, 'source');
  const workspace = join(root, 'workspace');
  try {
    mkdirSync(join(source, 'e2e', 'support'), { recursive: true });
    mkdirSync(join(workspace, 'e2e', 'support'), { recursive: true });
    execFileSync('git', ['init', '--quiet'], { cwd: source });
    writeFileSync(join(source, 'e2e', 'kept.spec.ts'), 'edited');
    writeFileSync(join(source, 'e2e', 'renamed-to.spec.ts'), 'moved');
    writeFileSync(join(source, 'e2e', 'support', 'helper.ts'), 'source');
    writeFileSync(join(workspace, 'e2e', 'kept.spec.ts'), 'original');
    writeFileSync(join(workspace, 'e2e', 'renamed-from.spec.ts'), 'moved');
    writeFileSync(join(workspace, 'e2e', 'deleted.spec.ts'), 'gone');
    writeFileSync(join(workspace, 'e2e', 'support', 'helper.ts'), 'prepared');
    await refreshSpecFiles(source, workspace);
    expect(readdirSync(join(workspace, 'e2e')).sort()).toEqual([
      'kept.spec.ts',
      'renamed-to.spec.ts',
      'support',
    ]);
    expect(readFileSync(join(workspace, 'e2e', 'kept.spec.ts'), 'utf8')).toBe(
      'edited',
    );
    // Anything else is part of the preparation and stays as prepared.
    expect(
      readFileSync(join(workspace, 'e2e', 'support', 'helper.ts'), 'utf8'),
    ).toBe('prepared');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
