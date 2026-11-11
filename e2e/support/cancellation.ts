// Waiting and cancellation shared by the fixture retries (process.ts) and the
// cleanup retries (case-attempt.ts).

/** Waits `ms`, or less if `signal` aborts first. */
export function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

/**
 * Aborts on SIGINT or SIGTERM to this process, as the command supervisor
 * stops its child (process-group.ts), until released.
 */
export function processStopSignal() {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  return {
    signal: controller.signal,
    release: () => {
      process.removeListener('SIGINT', stop);
      process.removeListener('SIGTERM', stop);
    },
  };
}
