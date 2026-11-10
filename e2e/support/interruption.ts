/**
 * SIGINT and SIGTERM as a flag and an abort signal. The runner keeps
 * ownership while it listens: a signal only requests a stop, and it cleans up.
 */
export function watchInterruption({
  announceStop,
}: {
  announceStop: () => void;
}) {
  const controller = new AbortController();
  let isListening = false;
  const interrupt = () => {
    if (!controller.signal.aborted) announceStop();
    controller.abort();
  };
  return {
    signal: controller.signal,
    isInterrupted: () => controller.signal.aborted,
    /** Idempotent: the local backend listens earlier than Cloud mode. */
    startListening() {
      if (isListening) return;
      isListening = true;
      process.on('SIGINT', interrupt);
      process.on('SIGTERM', interrupt);
    },
    stopListening() {
      isListening = false;
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
    },
  };
}
