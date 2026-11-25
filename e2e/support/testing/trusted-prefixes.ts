// Every prefix the runner's old allowlist printed verbatim (before #198's
// typed diagnostics). Boundary tests start hostile messages with each one.
export const trustedPrefixes = [
  'E2E ',
  'Clerk ',
  'Convex generated',
  'This harness',
  'Secrets file',
  'Usage:',
  'preview deployment',
  'Chromium tablet',
  'Preview callback',
] as const;
