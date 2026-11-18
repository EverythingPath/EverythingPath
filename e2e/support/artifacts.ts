import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

// Categories the fixture harness acts on (case-attempt.ts).
export const writeConflictDiagnostic =
  'Convex write conflict (the data changed while the mutation ran)';
export const isolationDiagnostic = 'E2E cohort isolation check failed';

// Only fixed diagnostic categories cross the service-log boundary. A provider
// can include opaque credentials in arbitrary prose, so regex redaction alone
// is not sufficient for raw application/CLI output.
export function safeDiagnostic(line: string): string | null {
  const categories: [RegExp, string][] = [
    [/E2E fixture access refused/i, 'fixture authorization refused'],
    [/E2E identity is not owned/i, 'identity ownership conflict'],
    // Convex's optimistic concurrency failure (docs.convex.dev/error).
    [/changed while this mutation was being run/i, writeConflictDiagnostic],
    [/exceeds cleanup limit/i, 'E2E fixture graph exceeds cleanup limit'],
    [/E2E isolation canary/i, isolationDiagnostic],
    // Not the CLI's "Schema validation complete." after a passing deploy.
    [
      /SchemaValidationError|schema validation failed/i,
      'Convex schema validation failed',
    ],
    [
      /ArgumentValidationError|argument validation/i,
      'Convex argument validation failed',
    ],
    [
      /Could not find function|function.*not found/i,
      'Convex function is missing',
    ],
    // Whole words only: a fixture's output carries random Convex document IDs,
    // and an ID can contain the letters "jwt" (#198).
    [
      /\bJWTs?\b|\bJWKS\b|token.*(?:expired|invalid)|\bissuer\b/i,
      'authentication token or issuer failure',
    ],
    [/\b401\b|unauthorized/i, 'service rejected authentication'],
    [/\b403\b|forbidden/i, 'service rejected authorization'],
    [/\b429\b|rate.limit/i, 'service rate limit reached'],
    [
      /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i,
      'service connection failed',
    ],
    [
      /\bError\b|\bfailed\b|\bfatal\b/i,
      'application or service reported an error',
    ],
  ];
  return categories.find(([pattern]) => pattern.test(line))?.[1] ?? null;
}

export { sanitizeLog } from './redaction';

type JsonObject = Record<string, unknown>;
function object(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * How a CI retry records its trace: actions only. Trace frames and snapshots
 * are not masked, so the account block or Clerk could show an email in them;
 * the masked failure screenshots show the pages instead.
 */
export const retryTraceOptions = {
  screenshots: false,
  snapshots: false,
  sources: false,
} as const;

// Retain an action timeline only. Screencast frames, network bodies, headers,
// storage, snapshots, sources, evaluations and console payloads are discarded.
export function sanitizeTrace(bytes: Uint8Array) {
  const entries = unzipSync(bytes);
  const safe: Record<string, Uint8Array> = {};
  for (const [name, entry] of Object.entries(entries)) {
    if (!/^[a-zA-Z0-9-]+\.trace$/.test(name)) continue;
    const events: JsonObject[] = [];
    for (const line of strFromU8(entry).split('\n').filter(Boolean)) {
      const value: unknown = JSON.parse(line);
      if (!object(value)) continue;
      const keep: JsonObject = {};
      if (value.type === 'context-options') {
        for (const key of [
          'version',
          'type',
          'browserName',
          'platform',
          'wallTime',
          'monotonicTime',
          'sdkLanguage',
          'contextId',
        ])
          keep[key] = value[key];
        keep.options = { viewport: { width: 1194, height: 834 } };
      } else if (value.type === 'before' || value.type === 'after') {
        for (const key of [
          'type',
          'callId',
          'startTime',
          'endTime',
          'class',
          'method',
          'apiName',
          'pageId',
          'parentId',
        ])
          if (typeof value[key] === 'string' || typeof value[key] === 'number')
            keep[key] = value[key];
        keep.params = {};
        if (value.error)
          keep.error = {
            name: 'Error',
            message:
              'Action failed; inspect the safe screenshot and domain assertion report.',
          };
      } else continue;
      events.push(keep);
    }
    safe[name] = strToU8(
      events.map((event) => JSON.stringify(event)).join('\n'),
    );
  }
  return zipSync(safe);
}
