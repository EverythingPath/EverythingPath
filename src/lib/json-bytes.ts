/** UTF-8 size of the same JSON representation used by migration candidates. */
export function jsonBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
