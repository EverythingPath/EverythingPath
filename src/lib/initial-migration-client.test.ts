import { ConvexError } from 'convex/values';
import { expect, test, vi } from 'vitest';
import { createMigrationSession } from './initial-migration-client';
import { classifyWriteFailure } from './write-outcome';

test.each([
  [
    'loading',
    'EDITING_STATUS_LOADING',
    'Checking whether editing is available.',
  ],
  [
    'unavailable',
    'EDITING_STATUS_UNAVAILABLE',
    'Editing availability could not be checked. Saved information remains available. Reload to try again.',
  ],
] as const)(
  'a %s status rejects saving with its own reason',
  async (kind, code, message) => {
    const session = createMigrationSession();
    if (kind === 'unavailable') session.unavailable();
    const send = vi.fn();
    const error = await session
      .write(send, {})
      .catch((error: unknown) => error);
    expect(error).toMatchObject({ data: { code, message } });
    expect(classifyWriteFailure(error)).toEqual({ kind: 'rejected', message });
    expect(send).not.toHaveBeenCalled();
  },
);

test('maintenance rejects new commands and reopening requires reload without replaying old commands', async () => {
  const session = createMigrationSession();
  const send = vi.fn().mockResolvedValue('saved');
  await expect(session.write(send, { name: 'Before status' })).rejects.toThrow(
    'Checking',
  );
  session.observe({ status: 'ready', epoch: 0 });
  await expect(session.write(send, { name: 'Accepted' })).resolves.toBe(
    'saved',
  );
  expect(send).toHaveBeenLastCalledWith({ name: 'Accepted', writeEpoch: 0 });
  session.observe({ status: 'maintenance', epoch: 1 });
  await expect(
    session.write(send, { name: 'During maintenance' }),
  ).rejects.toThrow('maintenance');
  session.observe({ status: 'ready', epoch: 2 });
  expect(session.getSnapshot().kind).toBe('reload_required');
  await expect(
    session.write(send, { name: 'After reopening' }),
  ).rejects.toThrow('Reload');
  expect(send).toHaveBeenCalledTimes(1);
});

test('a fresh page after reopening can save, while unavailable reads fail closed', async () => {
  const session = createMigrationSession();
  const changed = vi.fn();
  const unsubscribe = session.subscribe(changed);
  session.observe({ status: 'ready', epoch: 2 });
  const send = vi.fn().mockResolvedValue(null);
  await session.write(send, { name: 'Fresh choice' });
  expect(send).toHaveBeenCalledWith({ name: 'Fresh choice', writeEpoch: 2 });
  session.unavailable();
  await expect(session.write(send, {})).rejects.toThrow('could not be checked');
  expect(send).toHaveBeenCalledTimes(1);
  expect(changed).toHaveBeenCalledTimes(2);
  unsubscribe();
  session.observe({ status: 'ready', epoch: 2 });
  expect(changed).toHaveBeenCalledTimes(2);
});

test('a command already sent keeps its original token when the window closes', async () => {
  const session = createMigrationSession();
  session.observe({ status: 'ready', epoch: 4 });
  let complete: (() => void) | undefined;
  const send = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  const result = session.write(send, { name: 'Before closure' });
  session.observe({ status: 'maintenance', epoch: 5 });
  session.observe({ status: 'ready', epoch: 6 });
  complete?.();
  await result;
  expect(send).toHaveBeenCalledExactlyOnceWith({
    name: 'Before closure',
    writeEpoch: 4,
  });
  expect(session.getSnapshot().kind).toBe('reload_required');
});

test('a page opened during maintenance cannot silently enable edits when maintenance ends', () => {
  const session = createMigrationSession();
  session.observe({ status: 'maintenance', epoch: 1 });
  session.observe({ status: 'ready', epoch: 2 });
  expect(session.getSnapshot()).toMatchObject({
    kind: 'reload_required',
  });
});

test('an authoritative rejection immediately locks writes without waiting for the status subscription', async () => {
  const session = createMigrationSession();
  session.observe({ status: 'ready', epoch: 2 });
  const error = new ConvexError({
    code: 'RELOAD_REQUIRED',
    message: 'private diagnostics',
  });
  const send = vi.fn().mockRejectedValue(error);
  await expect(session.write(send, {})).rejects.toBe(error);
  expect(session.getSnapshot()).toMatchObject({
    kind: 'reload_required',
  });
  session.observe({ status: 'ready', epoch: 2 });
  await expect(session.write(send, {})).rejects.toThrow('Reload');
  expect(send).toHaveBeenCalledTimes(1);
});
