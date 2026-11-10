import { z } from 'zod';
import {
  militiaSetupFieldsSchema,
  militiaSetupSchema,
  type MilitiaSetup,
} from './canonical-setup';
import { SETUP_STEP_KEYS, type SetupStepKey } from './setup-steps';

// Browser resume for an unfinished Militia Setup (#173). The form's raw
// values, open step and start-attempt identity are kept in this browser only,
// under the signed-in account, organization and campaign. Nothing here is
// shared or sent to the server.
//
// The shape is versioned so a change can migrate stored envelopes instead of
// discarding players' unfinished setups. Version 2 (#180) holds PC or NPC
// roster kinds; an envelope of any other version is discarded (#198).
// Hit Dice overrides keep their nullable shape: since #196 a blank uses the
// record's level. Once records are loaded, Setup mirrors each roster person's
// current record kind and facts (`withCurrentCharacters`).
export const SETUP_ENVELOPE_VERSION = 2;

export type SetupScope = {
  accountId: string;
  organizationId: string;
  campaignId: string;
};
// Where the form is: its raw values (malformed or empty numbers included),
// the open step and the steps already visited.
export type SetupProgress = {
  values: MilitiaSetup;
  step: SetupStepKey;
  visited: SetupStepKey[];
};
export type SetupEnvelope = SetupProgress & {
  version: typeof SETUP_ENVELOPE_VERSION;
  scope: SetupScope;
  /** Reused by every start attempt, so an unacknowledged start is retried idempotently. */
  initializationId: string;
  /**
   * The source of a start sent from this browser whose result never arrived,
   * e.g. because the page reloaded. It may have been accepted.
   */
  submitted: MilitiaSetup | null;
};
export type SetupStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type SetupRestore =
  | { kind: 'fresh' }
  | { kind: 'restored'; envelope: SetupEnvelope }
  /** Something was stored but cannot be used; retire it. */
  | { kind: 'discarded' }
  /** This browser refuses storage; setup still works without resume. */
  | { kind: 'unavailable' };

export function setupEnvelopeKey({
  accountId,
  organizationId,
  campaignId,
}: SetupScope) {
  return `everythingpath:militia-setup:${[accountId, organizationId, campaignId]
    .map(encodeURIComponent)
    .join(':')}`;
}

export function browserSetupStorage(): SetupStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

// Safe cast: SETUP_SECTIONS is a non-empty literal, so its keys are a non-empty
// tuple.
const stepSchema = z.enum(SETUP_STEP_KEYS as [SetupStepKey, ...SetupStepKey[]]);
const envelopeSchema = z.strictObject({
  version: z.literal(SETUP_ENVELOPE_VERSION),
  scope: z.strictObject({
    accountId: z.string(),
    organizationId: z.string(),
    campaignId: z.string(),
  }),
  values: z.unknown(),
  step: stepSchema,
  visited: z.array(stepSchema),
  initializationId: z.string().trim().min(1).max(200),
  submitted: z.unknown(),
});

export function parseSetupEnvelope(
  raw: unknown,
  scope: SetupScope,
): SetupEnvelope | null {
  const parsed = envelopeSchema.safeParse(raw);
  if (
    !parsed.success ||
    setupEnvelopeKey(parsed.data.scope) !== setupEnvelopeKey(scope) ||
    !isEditableSetup(parsed.data.values)
  )
    return null;
  // An unreadable submitted source is forgotten, not fatal: the server
  // still refuses a different source under an accepted identity.
  const submitted = militiaSetupSchema.safeParse(parsed.data.submitted);
  return {
    ...parsed.data,
    // Read through the narrowed reference: the spread keeps it unknown.
    values: parsed.data.values,
    submitted: submitted.success ? submitted.data : null,
  };
}

// Reading never changes storage, so a repeated render reads the same result.
export function readSetupEnvelope(
  storage: SetupStorage | null,
  scope: SetupScope,
): SetupRestore {
  const stored = storedEnvelope(storage, scope);
  if (stored === undefined) return { kind: 'unavailable' };
  if (stored === null) return { kind: 'fresh' };
  const envelope = parseStored(stored, scope);
  return envelope ? { kind: 'restored', envelope } : { kind: 'discarded' };
}
// The stored text, null when there is none, or undefined when storage refuses.
function storedEnvelope(storage: SetupStorage | null, scope: SetupScope) {
  try {
    return storage ? storage.getItem(setupEnvelopeKey(scope)) : undefined;
  } catch {
    return undefined;
  }
}
function parseStored(stored: string, scope: SetupScope) {
  try {
    return parseSetupEnvelope(JSON.parse(stored), scope);
  } catch {
    return null;
  }
}

/** Returns false when this browser refused to keep the envelope. */
export function writeSetupEnvelope(
  storage: SetupStorage | null,
  envelope: SetupEnvelope,
) {
  if (!storage) return false;
  try {
    storage.setItem(setupEnvelopeKey(envelope.scope), JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

/** Once setup has started, its unfinished envelope must never return. */
export function retireSetupEnvelope(
  storage: SetupStorage | null,
  scope: SetupScope,
) {
  try {
    storage?.removeItem(setupEnvelopeKey(scope));
  } catch {
    // Nothing more can be done; a later read discards it again.
  }
}

// Stored values must have the form's shape: every group and list where the
// editors expect it, and only choices the editors offer. Leaves may be
// unfinished (empty, malformed or out of range) because the form keeps such
// input for repair; cross-reference problems are the form's to show.
const repairableCodes = new Set([
  'too_small',
  'too_big',
  'not_multiple_of',
  'invalid_format',
]);
const leafTypes = new Set(['number', 'string', 'boolean']);
function isLeaf(value: unknown) {
  return value === null || typeof value !== 'object';
}
function valueAt(root: unknown, path: readonly PropertyKey[]) {
  // Safe cast: value is a non-null object here; a missing key reads undefined.
  return path.reduce<unknown>(
    (value, key) =>
      value !== null && typeof value === 'object'
        ? (value as Record<PropertyKey, unknown>)[key]
        : undefined,
    root,
  );
}
function isEditableSetup(values: unknown): values is MilitiaSetup {
  const parsed = militiaSetupFieldsSchema.safeParse(values);
  return (
    parsed.success ||
    parsed.error.issues.every((issue) => {
      if (issue.code === 'custom') return true;
      if (!isLeaf(valueAt(values, issue.path))) return false;
      return issue.code === 'invalid_type'
        ? leafTypes.has(issue.expected)
        : repairableCodes.has(issue.code);
    })
  );
}
