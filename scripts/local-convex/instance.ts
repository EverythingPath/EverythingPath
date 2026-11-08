import { isLocalConvexUrl } from '../../src/lib/local-convex-url';

/** The service answered successfully, with another instance's name. */
export class LocalInstanceMismatch extends Error {
  constructor() {
    super(
      'Local Convex instance does not match the explicitly named deployment.',
    );
    this.name = 'LocalInstanceMismatch';
  }
}

/**
 * Check the loopback service's identity before sending administrative keys.
 * A timeout or abort rejects with the request's own error, never a mismatch.
 */
export async function assertLocalInstance({
  url,
  name,
  timeoutMs = 5_000,
  signal,
}: {
  url: string;
  name: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}) {
  if (!isLocalConvexUrl(url)) throw new Error('Invalid local Convex URL');
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await fetch(`${url}/instance_name`, {
    redirect: 'error',
    signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
  });
  // An unsuccessful response says nothing about identity: it is unreachable.
  if (!response.ok)
    throw new Error(`Local Convex instance check failed (${response.status})`);
  if ((await response.text()) !== name) throw new LocalInstanceMismatch();
}
