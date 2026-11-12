import { createHash } from 'node:crypto';
import type {
  EntryVerification,
  UnverifiedReason,
} from '../../src/lib/catalog/imported-entry-schema.ts';
import type { CurationGap } from './admission.ts';

/**
 * #227 slice 4: the label each released definition carries, read from the
 * launch verification projection (`campaign-mvp-v1.verification.json`) and
 * the launch inventory it projects. The label never gates admission.
 */

/** One inventory row as the label reads it. */
export type ProjectedDefinition =
  | {
      structure: 'verified';
      /** The SHA-256 of the scoped entry whose structure the projection verified. */
      entrySha256: string;
      /** Outstanding mechanisms neither proven nor a recorded prose case. */
      unproven: readonly string[];
    }
  | { structure: 'unverified' };

/** What a release reads its labels from. */
export type ReleaseVerification =
  | {
      kind: 'current';
      /** Each catalog row of the launch inventory, by its inventory key. */
      rows: ReadonlyMap<string, ProjectedDefinition>;
    }
  | { kind: 'stale'; reasons: readonly [string, ...string[]] }
  | { kind: 'absent' };

type InventoryRow = {
  key: string;
  catalogKey?: string | null;
  mechanisms: readonly { name: string; status: string }[];
};
type ProjectionRow = {
  key: string;
  verified: readonly string[];
  mechanisms: readonly string[];
  prose: readonly { mechanism: string }[];
  evidence: readonly string[];
};

const entryEvidence = 'entry:sha256:';

/**
 * The verification a current projection gives each catalog row of its
 * inventory: its structure is verified when the projection verifies it (and
 * so records the entry it verified), and a mechanism the inventory leaves
 * outstanding stays unproven unless the projection proves it or a reviewed
 * case records it as prose (the rule `inspectLaunchInventory` applies; a
 * prose-only row is verified, owner 2026-11-11 §3).
 */
export function projectedDefinitions({
  inventory,
  projection,
}: {
  inventory: readonly InventoryRow[];
  projection: readonly ProjectionRow[];
}): ReleaseVerification & { kind: 'current' } {
  const projected = new Map(projection.map((row) => [row.key, row]));
  const rows = new Map<string, ProjectedDefinition>();
  for (const row of inventory) {
    if (!row.catalogKey) continue;
    const verified = projected.get(row.key);
    const entrySha256 = verified?.evidence
      .find((item) => item.startsWith(entryEvidence))
      ?.slice(entryEvidence.length);
    if (!verified?.verified.includes('structure') || !entrySha256) {
      rows.set(row.key, { structure: 'unverified' });
      continue;
    }
    const covered = new Set([
      ...verified.mechanisms,
      ...verified.prose.map(({ mechanism }) => mechanism),
    ]);
    rows.set(row.key, {
      structure: 'verified',
      entrySha256,
      unproven: row.mechanisms
        .filter(
          ({ name, status }) => status === 'outstanding' && !covered.has(name),
        )
        .map(({ name }) => name),
    });
  }
  return { kind: 'current', rows };
}

/**
 * Labels a release's definitions. A definition is verified only when the
 * verification is current, its inventory row (its own key, or the key a
 * reviewed remap moved to it) has verified structure, it hashes to the entry
 * the projection verified, no outstanding mechanism is unproven, and the gate
 * reported no curation gap for it. Everything else is unverified with each
 * reason, including every definition outside the inventory.
 */
export function labelDefinitions({
  entries,
  remaps,
  verification,
  curationGaps,
}: {
  entries: readonly ({ externalKey: string } & object)[];
  /** Applied remaps, `from` inventory key to `to` release key. */
  remaps: readonly { from: string; to: string }[];
  verification: ReleaseVerification;
  /** The gate's curation gaps by admitted key (`AdmissionRow.unverified`). */
  curationGaps: ReadonlyMap<string, readonly CurationGap[]>;
}): Map<string, EntryVerification> {
  const remapped = new Map(remaps.map(({ from, to }) => [from, to]));
  const byReleaseKey = new Map<string, ProjectedDefinition>();
  if (verification.kind === 'current')
    for (const [key, row] of verification.rows)
      byReleaseKey.set(remapped.get(key) ?? key, row);
  const labels = new Map<string, EntryVerification>();
  for (const entry of entries) {
    const reasons: UnverifiedReason[] = [
      ...projectionReasons(verification, byReleaseKey, entry),
      ...(curationGaps.get(entry.externalKey) ?? []),
    ];
    const [first, ...rest] = reasons;
    labels.set(
      entry.externalKey,
      first === undefined
        ? { state: 'verified' }
        : { state: 'unverified', reasons: [first, ...rest] },
    );
  }
  return labels;
}

function projectionReasons(
  verification: ReleaseVerification,
  byReleaseKey: ReadonlyMap<string, ProjectedDefinition>,
  entry: { externalKey: string },
): UnverifiedReason[] {
  switch (verification.kind) {
    case 'absent':
      return ['no verification projection'];
    case 'stale':
      return ['verification projection stale'];
    case 'current': {
      const row = byReleaseKey.get(entry.externalKey);
      if (!row) return ['outside the launch inventory'];
      if (row.structure === 'unverified') return ['structure not verified'];
      return [
        // The projection hashes the scoped entry as `JSON.stringify` writes it.
        ...(sha256(JSON.stringify(entry)) === row.entrySha256
          ? []
          : (['definition differs from the verified one'] as const)),
        ...(row.unproven.length ? (['unproven mechanism'] as const) : []),
      ];
    }
  }
}

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * The verification a release reads from a projection's status
 * (`statusVerification`: its rows when current, else why it is stale).
 */
export function releaseVerificationOf({
  inventory,
  status,
}: {
  inventory: readonly InventoryRow[];
  status: { rows: readonly ProjectionRow[]; stale: readonly string[] };
}): ReleaseVerification {
  const [first, ...rest] = status.stale;
  return first === undefined
    ? projectedDefinitions({ inventory, projection: status.rows })
    : { kind: 'stale', reasons: [first, ...rest] };
}
