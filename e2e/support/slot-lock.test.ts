// @vitest-environment node
import type * as FsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HarnessFailure } from './diagnostics';
import {
  acquireSlotLock,
  failureReport,
  releaseSlotLock,
  SetupFailure,
  slotLockPath,
} from './setup-failure';
import { resources } from './test-data';

// One-shot interposers run just before the lock code's own fs call, so a test
// can act in the gap between two of its steps.
const interpose: {
  rm?: () => Promise<void>;
  mkdir?: () => Promise<void>;
  // Replaces the write; the lock code only ever writes to string paths.
  writeFile?: (path: string) => Promise<void>;
} = {};
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>();
  return {
    ...actual,
    rm: async (...args: Parameters<typeof actual.rm>) => {
      const step = interpose.rm;
      interpose.rm = undefined;
      await step?.();
      return actual.rm(...args);
    },
    mkdir: async (...args: Parameters<typeof actual.mkdir>) => {
      const step = interpose.mkdir;
      interpose.mkdir = undefined;
      await step?.();
      return actual.mkdir(...args);
    },
    writeFile: async (...args: Parameters<typeof actual.writeFile>) => {
      const step = interpose.writeFile;
      interpose.writeFile = undefined;
      if (step) return step(args[0] as string);
      return actual.writeFile(...args);
    },
  };
});
const actual = await vi.importActual<typeof FsPromises>('node:fs/promises');

let directory: string;
let path: string;
beforeEach(async () => {
  directory = await actual.mkdtemp(join(tmpdir(), 'e2e-slot-lock-'));
  path = slotLockPath(directory, resources.previewName);
});
afterEach(async () => {
  interpose.rm = interpose.mkdir = interpose.writeFile = undefined;
  await actual.rm(directory, { recursive: true, force: true });
});

const foreign = {
  owner: '11111111-2222-4333-8444-555555555555',
  createdAt: '2026-09-30T06:00:00.000Z',
};
// Another run's lock at the lock path, replacing whatever was there.
async function replaceLock(owner = foreign) {
  await actual.rm(path, { recursive: true, force: true });
  await actual.mkdir(path);
  await actual.writeFile(join(path, 'owner.json'), JSON.stringify(owner));
}
async function ownerAt(lockPath: string) {
  return JSON.parse(
    await actual.readFile(join(lockPath, 'owner.json'), 'utf8'),
  ) as unknown;
}
async function exists(target: string) {
  return actual.stat(target).then(
    () => true,
    () => false,
  );
}

it('keeps a replacement made after the owner check and before the delete (hook)', async () => {
  const lock = await acquireSlotLock(directory, resources.previewName);
  await releaseSlotLock(lock, { beforeRemove: () => replaceLock() });
  expect(await ownerAt(path)).toEqual(foreign);
});

it('keeps a replacement made just before the delete, whatever the release steps are', async () => {
  const lock = await acquireSlotLock(directory, resources.previewName);
  interpose.rm = () => replaceLock();
  await releaseSlotLock(lock).catch(() => undefined);
  expect(await ownerAt(path)).toEqual(foreign);
  expect((await actual.readdir(directory)).sort()).toEqual([
    `${resources.previewName}.lock`,
  ]);
});

it('puts a foreign lock back, or leaves it beside the path when that is taken', async () => {
  const lock = await acquireSlotLock(directory, resources.previewName);
  await replaceLock();
  await expect(releaseSlotLock(lock)).rejects.toMatchObject({
    diagnostic: { kind: 'slot-lock-replaced' },
  });
  expect(await ownerAt(path)).toEqual(foreign);

  const second = await acquireSlotLock(
    await actual.mkdtemp(join(directory, 'second-')),
    resources.previewName,
  );
  const third = { ...foreign, owner: '22222222-3333-4444-8555-666666666666' };
  await replaceLockAt(second.path, foreign);
  // A third run takes the free path before the foreign lock is restored.
  interpose.mkdir = () => replaceLockAt(second.path, third);
  const failure = await releaseSlotLock(second).then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(failure).toBeInstanceOf(HarnessFailure);
  expect(failureReport(failure).join('\n')).toContain(
    '<slot>.lock.releasing-<token>',
  );
  expect(await ownerAt(second.path)).toEqual(third);
  expect(await ownerAt(`${second.path}.releasing-${second.owner}`)).toEqual(
    foreign,
  );
});
async function replaceLockAt(lockPath: string, owner: typeof foreign) {
  await actual.rm(lockPath, { recursive: true, force: true });
  await actual.mkdir(lockPath);
  await actual.writeFile(join(lockPath, 'owner.json'), JSON.stringify(owner));
}

it('reports a lock that disappeared during the run and creates nothing', async () => {
  const lock = await acquireSlotLock(directory, resources.previewName);
  await actual.rm(path, { recursive: true });
  await expect(releaseSlotLock(lock)).rejects.toMatchObject({
    diagnostic: { kind: 'slot-lock-replaced' },
  });
  expect(await actual.readdir(directory)).toEqual([]);
});

it('removes its own lock when the owner record write crashes half-way', async () => {
  interpose.writeFile = async (target) => {
    // A partial record, then the write fails.
    await actual.writeFile(target, '{"owner":"');
    throw Object.assign(new Error('no space'), { code: 'ENOSPC' });
  };
  const failure = await acquireSlotLock(directory, resources.previewName).then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(failure).toBeInstanceOf(SetupFailure);
  expect(failure).toMatchObject({ stage: 'slot-lock', errorClass: 'ENOSPC' });
  expect(await exists(path)).toBe(false);
  // The slot is usable again.
  const lock = await acquireSlotLock(directory, resources.previewName);
  await releaseSlotLock(lock);
  expect(await exists(path)).toBe(false);
});

it('flags a lock whose owner record is missing or partial, and never removes it', async () => {
  for (const [file, content] of [
    ['owner.json.tmp-crashed', '{"owner":"1'],
    ['owner.json', '{"owner":"1'],
  ] as const) {
    await actual.rm(path, { recursive: true, force: true });
    await actual.mkdir(path);
    await actual.writeFile(join(path, file), content);
    const lines = failureReport(
      await acquireSlotLock(directory, resources.previewName).then(
        () => undefined,
        (error: unknown) => error,
      ),
    );
    expect(lines[0]).toBe(
      'E2E setup failed: slot already locked (active or stale)',
    );
    expect(lines[2]).toBe(
      'Its owner record is missing or unreadable, so a run probably crashed while acquiring it.',
    );
    expect(await actual.readFile(join(path, file), 'utf8')).toBe(content);
  }
});
