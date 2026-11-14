type Definition = {
  _id: string;
  ruleIdentity: string;
  detail: { kind: string };
};
type Entry =
  | { kind: 'classLevel'; state: { classEntryId: string | null } }
  | {
      kind: string;
      catalogEntryId?: string;
      grantKey?: unknown;
    };
type Snapshot = {
  entries: readonly Entry[];
  catalogEntries: readonly Definition[];
  catalogView?: { heldDefinitionIds?: readonly string[] };
};

/** The muted note on a picker choice the catalog retired (#411). */
export const retiredChoiceReason =
  'Retired from the catalog. Only Characters already using it keep it.';

const continuingUses = new Set(['class', 'race', 'archetype', 'racialTrait']);

/**
 * #411: whether this Character already uses the definition's rule identity in
 * a way it may continue: more levels of its class, or its own race, Archetype
 * or alternate trait. Mirrors the server's existing-use check.
 */
function isExistingUse(snapshot: Snapshot, definition: Definition) {
  if (!continuingUses.has(definition.detail.kind)) return false;
  const identityOf = (id: string | null | undefined) =>
    snapshot.catalogEntries.find((row) => row._id === id)?.ruleIdentity;
  return snapshot.entries.some((entry) => {
    if (definition.detail.kind === 'class')
      return (
        entry.kind === 'classLevel' &&
        'state' in entry &&
        identityOf(entry.state.classEntryId) === definition.ruleIdentity
      );
    return (
      entry.kind === definition.detail.kind &&
      'catalogEntryId' in entry &&
      !entry.grantKey &&
      identityOf(entry.catalogEntryId) === definition.ruleIdentity
    );
  });
}

/**
 * #411: why a picker choice is unavailable, or null. Retired content stays
 * choosable only where the Character already uses it; the server refuses
 * every other new choice.
 */
export function describeRetiredChoice(
  snapshot: Snapshot | null | undefined,
  definition: Definition,
) {
  if (!snapshot?.catalogView?.heldDefinitionIds?.includes(definition._id))
    return null;
  return isExistingUse(snapshot, definition) ? null : retiredChoiceReason;
}
