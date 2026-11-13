// Only Catalog Entry document IDs belong here. Prerequisite clauses and Grant
// keys hold durable rule identities; selection-slot positions hold sheet IDs.
const referenceFields = new Set([
  'catalogEntryId',
  'classEntryId',
  'castingClassId',
  'favoredClassIds',
  'racialTraits',
  'raceEntryIds',
  'classEntryIds',
  'replaces',
  'counterpartOf',
  'duplicateUpgrade',
  'feats',
  'whileActive',
  'option',
  'options',
  // A specific magic item's Base Item; Item Abilities use `catalogEntryId`.
  'baseItem',
]);

/** Change content references without changing provenance or durable identities. */
export function remapCatalogReferences<Value>(
  value: Value,
  originalId: string,
  copyId: string,
): Value {
  const result = structuredClone(value);
  function visit(input: unknown, references = false): unknown {
    if (typeof input === 'string')
      return references && input === originalId ? copyId : input;
    if (Array.isArray(input)) return input.map((row) => visit(row, references));
    if (input && typeof input === 'object')
      for (const key of Object.keys(input))
        Reflect.set(
          input,
          key,
          visit(Reflect.get(input, key), referenceFields.has(key)),
        );
    return input;
  }
  visit(result);
  return result;
}

export type CatalogReference = {
  id: string;
  kind: 'definition' | 'class' | 'condition';
};

/** The same reference fields drive dependency discovery and ID remapping. */
export function listCatalogReferences(value: unknown): CatalogReference[] {
  const result: CatalogReference[] = [];
  function visit(input: unknown, field?: string) {
    if (typeof input === 'string' && field && referenceFields.has(field)) {
      result.push({
        id: input,
        kind:
          field === 'counterpartOf' ||
          field === 'classEntryIds' ||
          field === 'classEntryId' ||
          field === 'castingClassId' ||
          field === 'favoredClassIds'
            ? 'class'
            : field === 'whileActive' ||
                field === 'option' ||
                field === 'options'
              ? 'condition'
              : 'definition',
      });
    } else if (Array.isArray(input)) {
      for (const row of input) visit(row, field);
    } else if (input && typeof input === 'object') {
      for (const [key, child] of Object.entries(input)) visit(child, key);
    }
  }
  visit(value);
  return result;
}

const dependencyKeyFields = new Set(['classTag', 'castingClass', 'list']);

/** Actual keyed fields shared by closure discovery and scoped-key remapping. */
export function listCatalogDependencyKeys(value: unknown): string[] {
  const keys = new Set<string>();
  function visit(input: unknown) {
    if (Array.isArray(input)) {
      for (const child of input) visit(child);
    } else if (input && typeof input === 'object') {
      for (const [field, child] of Object.entries(input)) {
        if (dependencyKeyFields.has(field) && typeof child === 'string')
          keys.add(child);
        else visit(child);
      }
    }
  }
  visit(value);
  return [...keys];
}

/** Spell level maps offer list membership; casting and prompt keys consume it. */
export function listCatalogKeyedListMemberships(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  const detail: unknown = Reflect.get(value, 'detail');
  if (
    !detail ||
    typeof detail !== 'object' ||
    Reflect.get(detail, 'kind') !== 'spell'
  )
    return [];
  const levels: unknown = Reflect.get(detail, 'levels');
  return levels && typeof levels === 'object' ? Object.keys(levels) : [];
}

export function isCatalogKeyedListMember(
  value: unknown,
  keys: ReadonlySet<string>,
): boolean {
  return listCatalogKeyedListMemberships(value).some((key) => keys.has(key));
}

/** Remap scoped ID keys without rewriting durable names or formula text. */
export function remapCatalogDependencyKeys<Value>(
  value: Value,
  originalId: string,
  copyId: string,
): Value {
  const result = structuredClone(value);
  function visit(input: unknown, field?: string) {
    if (Array.isArray(input)) {
      for (const child of input) visit(child, field);
    } else if (input && typeof input === 'object') {
      for (const [key, child] of Object.entries(input)) {
        if (field === 'levels' && key === originalId) {
          Reflect.deleteProperty(input, key);
          Reflect.set(input, copyId, child);
        } else if (dependencyKeyFields.has(key) && child === originalId)
          Reflect.set(input, key, copyId);
        else visit(child, key);
      }
    }
  }
  visit(result);
  return result;
}
