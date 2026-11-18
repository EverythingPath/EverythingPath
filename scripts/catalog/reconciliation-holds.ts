import { ConvexError } from 'convex/values';
import type { Doc } from '../../convex/_generated/dataModel';
import type { ReadCtx } from '../../convex/types';
import { storedIdentity } from '../../convex/catalogIdentityAllocation.ts';
import { candidateDefinition } from '../../convex/lib/catalogCandidateDefinition.ts';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema.ts';
import {
  acceptedImportedResourceKinds,
  isAcceptedResource,
  isBuiltInResourceKey,
} from '../../src/lib/catalog/release-resources.ts';
import {
  isObject,
  type ReleaseRow,
} from '../../src/lib/catalog/release-schema.ts';

/**
 * Root decision 2026-11-13 (G4) and party-gates: what reconciliation would
 * refuse in a scoped build's release, so the build holds it (as a review
 * hold, `admission.ts`) and the artifact it writes reconciles.
 *
 * - Resource discovery accepts the built-in resources and, of the imported
 *   ones, only companions, familiars and companion features
 *   (`isAcceptedResource`, #784), so every other imported resource
 *   (creature types, the eidolon kinds) is held, and so is any unknown
 *   `builtin:` key, whatever its payload.
 * - Each definition goes through the candidate adapter itself
 *   (`candidateDefinition`), on a fresh deployment held in memory: every
 *   definition of the release has the stored identity identity allocation
 *   gives it (`storedIdentity`), and the release's rows are its staged rows.
 *   A refusal (a `ConvexError`) holds the definition with the adapter's
 *   reason; any other error is a fault of this in-memory deployment and
 *   fails the build rather than holding a row.
 */

export type ReconciliationHold = { externalKey: string; reason: string };

const acceptedKinds = `${acceptedImportedResourceKinds.slice(0, -1).join(', ')} and ${acceptedImportedResourceKinds.at(-1)}`;

/** What a hold's reason starts with; `party-status.ts` reads it. */
export const reconciliationHoldPrefix = 'Reconciliation refuses it:';

export async function reconciliationHolds(
  rows: readonly ReleaseRow[],
): Promise<ReconciliationHold[]> {
  const holds: ReconciliationHold[] = [];
  for (const row of rows)
    if (row.kind === 'resource' && !isAcceptedResource(row.key, row.payload))
      holds.push({
        externalKey: row.key,
        reason: isBuiltInResourceKey(row.key)
          ? `${reconciliationHoldPrefix} resource discovery accepts no unknown built-in resource; a builtin: key must name one of the built-in resources (#784).`
          : `${reconciliationHoldPrefix} resource discovery accepts no imported ${entryKind(row.payload) ?? 'resource'} resource; it accepts only ${acceptedKinds} resources (#784).`,
      });
  const deployment = memoryDeployment(rows);
  for (const { definition, refusal } of deployment.definitions) {
    const reason =
      refusal ?? (await adapterRefusal(deployment, definition.ruleIdentity));
    if (reason)
      holds.push({
        externalKey: definition.ruleIdentity,
        reason: `${reconciliationHoldPrefix} ${reason}`,
      });
  }
  return holds.sort((a, b) =>
    a.externalKey < b.externalKey ? -1 : a.externalKey > b.externalKey ? 1 : 0,
  );
}

/**
 * The scoped build's hold loop (party-gates): while the gates pass, the
 * release's rows are checked, and every row reconciliation would refuse is
 * held (`hold`, which joins the import's review holds and assesses the gate
 * again), until the release holds nothing reconciliation refuses. `release`
 * gives the rows the build would write, or undefined when the gates refuse
 * the release, which the build reports.
 *
 * It ends by construction: a pass either adds a hold for a row not yet held
 * (`held`), and the rows are finite, or ends the loop. A pass whose every
 * hold is already present means a hold did not remove its row, so the loop
 * would repeat forever; it ends with an error naming those rows instead.
 */
export async function holdUntilReconciled<State>(
  initial: State,
  {
    release,
    held,
    hold,
  }: {
    release: (state: State) => Promise<readonly ReleaseRow[] | undefined>;
    held: (state: State) => readonly ReconciliationHold[];
    hold: (
      state: State,
      holds: readonly ReconciliationHold[],
    ) => Promise<State>;
  },
): Promise<State> {
  let state = initial;
  for (;;) {
    const rows = await release(state);
    if (!rows) return state;
    const holds = await reconciliationHolds(rows);
    if (!holds.length) return state;
    const present = new Set(held(state).map(({ externalKey }) => externalKey));
    const added = holds.filter(({ externalKey }) => !present.has(externalKey));
    if (!added.length)
      throw new Error(
        `Reconciliation holds did not take effect: the release still emits ${holds.map(({ externalKey }) => externalKey).join(', ')} although they are held, so the scoped build cannot remove them.`,
      );
    state = await hold(state, added);
  }
}

function entryKind(payload: unknown) {
  return isObject(payload) &&
    isObject(payload.detail) &&
    typeof payload.detail.kind === 'string'
    ? payload.detail.kind
    : undefined;
}

type MemoryDocument = Record<string, unknown> & { _id: string };
type MemoryDeployment = ReturnType<typeof memoryDeployment>;

const releaseId = 'catalogRelease:1';

/**
 * A fresh deployment after preparation and identity allocation: the release
 * rows staged under one release, and each definition's stored identity, or
 * the reason allocation gives none.
 */
function memoryDeployment(rows: readonly ReleaseRow[]) {
  const tables = new Map<string, MemoryDocument[]>([
    ['catalogReleaseRow', []],
    ['catalogEntry', []],
  ]);
  const insert = (table: string, document: Record<string, unknown>) => {
    const documents = tables.get(table) ?? [];
    const stored = {
      ...document,
      _id: `${table}:${documents.length}`,
      _creationTime: 0,
    };
    documents.push(stored);
    tables.set(table, documents);
    return stored;
  };
  for (const row of rows)
    insert('catalogReleaseRow', {
      releaseId,
      kind: row.kind,
      key: row.key,
      payload: row.payload,
    });
  const definitions: {
    definition: { ruleIdentity: string };
    refusal?: string;
  }[] = [];
  for (const row of rows) {
    if (row.kind !== 'definition') continue;
    const body = importedCatalogEntrySchema.safeParse(row.payload);
    if (!body.success) {
      definitions.push({
        definition: { ruleIdentity: row.key },
        refusal: 'identity allocation: Unsupported release body',
      });
      continue;
    }
    const shape = storedIdentity(body.data);
    if (shape.kind === 'unsupported') {
      definitions.push({
        definition: { ruleIdentity: row.key },
        refusal: `identity allocation: ${shape.reason}`,
      });
      continue;
    }
    insert('catalogEntry', shape.identity);
    definitions.push({ definition: { ruleIdentity: row.key } });
  }
  return { tables, definitions, ctx: memoryReadContext(tables) };
}

/**
 * The reads `candidateDefinition` makes, over the documents above: an index
 * range of equalities read with `take` or `unique`, and ID normalization for
 * the stored validator. Any other read is not served and throws a plain
 * error, which fails the build instead of holding a row.
 */
function memoryReadContext(tables: ReadonlyMap<string, MemoryDocument[]>) {
  const db = {
    query: (table: string) => ({
      withIndex: (
        _index: string,
        range: (q: {
          eq: (field: string, value: unknown) => unknown;
        }) => unknown,
      ) => {
        const equalities: [string, unknown][] = [];
        const builder = {
          eq: (field: string, value: unknown) => {
            equalities.push([field, value]);
            return builder;
          },
        };
        range(builder);
        const matches = (tables.get(table) ?? []).filter((document) =>
          equalities.every(([field, value]) => document[field] === value),
        );
        return {
          take: (count: number) => Promise.resolve(matches.slice(0, count)),
          unique: () => {
            if (matches.length > 1)
              throw new Error(`In-memory ${table} lookup is not unique`);
            return Promise.resolve(matches[0] ?? null);
          },
        };
      },
    }),
    normalizeId: (table: string, id: unknown) =>
      typeof id === 'string' && id.startsWith(`${table}:`) ? id : null,
    system: { normalizeId: () => null },
  };
  const context: unknown = { db };
  // Safe cast: the adapter's reads above are all it makes; the rest of a
  // Convex context is never reached (an unserved read throws, see above).
  return context as ReadCtx;
}

/** The adapter's refusal of one definition, or undefined when it converts. */
async function adapterRefusal(
  deployment: MemoryDeployment,
  ruleIdentity: string,
) {
  const stored = deployment.tables
    .get('catalogEntry')
    ?.find(
      (document) =>
        document.scope === 'global' && document.ruleIdentity === ruleIdentity,
    );
  if (!stored) throw new Error(`No in-memory identity for ${ruleIdentity}`);
  const release: unknown = { _id: releaseId };
  const definition: unknown = stored;
  try {
    await candidateDefinition(
      deployment.ctx,
      // Safe cast: the adapter reads only the release's `_id`, to look up
      // its staged rows in the in-memory deployment.
      release as Doc<'catalogRelease'>,
      // Safe cast: the stored identity `storedIdentity` gives, with an ID
      // and creation time, as allocation inserts it.
      definition as Doc<'catalogEntry'>,
    );
    return undefined;
  } catch (error) {
    if (error instanceof ConvexError) return String(error.data);
    throw error;
  }
}
