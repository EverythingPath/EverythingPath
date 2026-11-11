import { expect } from 'vitest';

/**
 * Runs a command the Write Gate should admit. The command's own checks may
 * still refuse it, for example a choice an earlier admitted command already
 * changed; a maintenance or reload refusal from the gate fails the test.
 */
export async function expectWriteGateAdmits(command: () => Promise<unknown>) {
  const error = await command().then(
    () => null,
    (reason: unknown) => reason,
  );
  if (error === null) return 'completed' as const;
  const message =
    error instanceof Error ? error.message : JSON.stringify(error);
  expect(message).not.toMatch(/MAINTENANCE|RELOAD_REQUIRED/);
  return 'refusedByCommand' as const;
}
