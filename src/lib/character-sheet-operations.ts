'use client';

let sessionPrefix: string | undefined;

export function createCharacterSheetOperationId() {
  sessionPrefix ??= `${crypto.randomUUID()}:`;
  return `${sessionPrefix}${crypto.randomUUID()}`;
}

export function isOwnCharacterSheetOperation(
  operationId: string | null | undefined,
) {
  return (
    sessionPrefix !== undefined &&
    operationId?.startsWith(sessionPrefix) === true
  );
}
