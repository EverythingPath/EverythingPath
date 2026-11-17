import type { Page } from '@playwright/test';

type Mode = 'refuse' | 'obscure';
type Fault = {
  mode: Mode;
  udfPath: string;
  observed: boolean;
  requestId?: number;
};

function parseFrame(frame: string | Buffer): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(frame.toString());
    return value !== null && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Sheet write faults at one player's Convex socket, armed for the next write
 * of a function. `refuse` never forwards the write and answers it the way the
 * server answers a refusal (a ConvexError payload), so the sheet shows a
 * definite rejection while nothing has committed. `obscure` forwards the
 * write and replaces its acceptance with a generic failure, so the sheet
 * keeps an uncertain outcome unless it already observed the saved value.
 * Neither fault is a dropped connection, and every other frame flows as is.
 */
export async function controlSheetWrites(page: Page, convexUrl: string) {
  let fault: Fault | undefined;
  const host = new URL(convexUrl).host;
  await page.routeWebSocket(
    (url) => url.host === host,
    (socket) => {
      const server = socket.connectToServer();
      socket.onMessage((frame) => {
        const message = parseFrame(frame);
        const active = fault;
        if (
          !active ||
          active.observed ||
          message?.type !== 'Mutation' ||
          message.udfPath !== active.udfPath ||
          typeof message.requestId !== 'number'
        ) {
          server.send(frame);
          return;
        }
        active.observed = true;
        active.requestId = message.requestId;
        if (active.mode === 'obscure') {
          server.send(frame);
          return;
        }
        fault = undefined;
        socket.send(
          JSON.stringify({
            type: 'MutationResponse',
            requestId: message.requestId,
            success: false,
            result: 'Refused by the test harness',
            logLines: [],
            errorData: 'Sheet writes are refused (test)',
          }),
        );
      });
      server.onMessage((frame) => {
        const message = parseFrame(frame);
        const active = fault;
        if (
          active?.mode === 'obscure' &&
          active.observed &&
          message?.type === 'MutationResponse' &&
          message.requestId === active.requestId
        ) {
          fault = undefined;
          socket.send(
            JSON.stringify({
              type: 'MutationResponse',
              requestId: message.requestId,
              success: false,
              result: 'Reply lost (test)',
              logLines: [],
            }),
          );
          return;
        }
        socket.send(frame);
      });
    },
  );
  return {
    refuseNext(udfPath: string) {
      fault = { mode: 'refuse', udfPath, observed: false };
    },
    obscureNext(udfPath: string) {
      fault = { mode: 'obscure', udfPath, observed: false };
    },
    isArmed: () => fault !== undefined,
  };
}
