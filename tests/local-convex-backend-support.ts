import { HarnessFailure } from '../e2e/support/diagnostics';

/** The harness failure `promise` rejects with; anything else fails the test. */
export async function failure(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  if (!(error instanceof HarnessFailure)) throw new Error('expected failure');
  return error;
}
