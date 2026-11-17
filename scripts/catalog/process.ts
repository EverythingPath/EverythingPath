import { spawnSync } from 'node:child_process';
import {
  closeSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function runCapturedProcess({
  command,
  args,
  cwd,
}: {
  command: string;
  args: string[];
  cwd?: string;
}) {
  const capture = mkdtempSync(join(tmpdir(), 'catalog-process-'));
  const stdout = join(capture, 'stdout');
  const stderr = join(capture, 'stderr');
  const descriptors: number[] = [];
  try {
    const output = openSync(stdout, 'w');
    descriptors.push(output);
    const errors = openSync(stderr, 'w');
    descriptors.push(errors);
    const result = spawnSync(command, args, {
      cwd,
      stdio: ['ignore', output, errors],
    });
    if (result.error) throw result.error;
    return {
      status: result.status,
      stdout: readFileSync(stdout, 'utf8'),
      stderr: readFileSync(stderr, 'utf8'),
    };
  } finally {
    for (const descriptor of descriptors) closeSync(descriptor);
    rmSync(capture, { recursive: true, force: true });
  }
}
