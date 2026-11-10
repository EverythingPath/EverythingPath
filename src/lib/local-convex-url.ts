/** Only an explicit IPv4 loopback origin, with a port and no URL extras. */
export function isLocalConvexUrl(value: string) {
  const match = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/.exec(value);
  return Boolean(match && Number(match[1]) <= 65535);
}

export function convexWebSocketOrigin(value: string) {
  const url = new URL(value);
  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
  return url.origin;
}
