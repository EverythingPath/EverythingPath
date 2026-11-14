import { importedCatalogEntrySchema } from './imported-entry-schema';

/**
 * The built-in resources `catalog:release build` captures (#321, #415).
 * The `builtin:` namespace is reserved for them: no other key in it is
 * accepted, whatever its payload.
 */
export const builtInResourceKeys = [
  'builtin:casting-tables',
  'builtin:representative-class-catalog',
  'builtin:representative-race-catalog',
  'builtin:representative-archetype-catalog',
  'builtin:representative-selection-catalog',
  'builtin:representative-spellcasting-catalog',
] as const;

/**
 * #784: the imported resources release discovery accepts besides the
 * built-in ones. The sheet reads none of them and no definition has an edge
 * to one, so an accepted resource is no impact reason and no calculation
 * input. Creature types, the eidolon kinds and anything else stay refused.
 */
export const acceptedImportedResourceKinds = [
  'companion',
  'familiar',
  'companionFeature',
] as const;

const builtIns: ReadonlySet<string> = new Set(builtInResourceKeys);
const accepted: ReadonlySet<string> = new Set(acceptedImportedResourceKinds);

/** Whether `key` is in the namespace reserved for the built-in resources. */
export const isBuiltInResourceKey = (key: string) => key.startsWith('builtin:');

/** Whether `key` is one of the built-in resources. */
export const isBuiltInResource = (key: string) => builtIns.has(key);

/**
 * The one rule release discovery (`convex/catalogReleaseImpact.ts`) and a
 * scoped build's holds (`scripts/catalog/reconciliation-holds.ts`) share: a
 * `builtin:` key is accepted only when it is one of the built-in resources,
 * whatever its payload; any other key only when its payload parses as an
 * imported entry of an accepted kind.
 */
export function isAcceptedResource(key: string, payload: unknown) {
  if (isBuiltInResourceKey(key)) return isBuiltInResource(key);
  const entry = importedCatalogEntrySchema.safeParse(payload);
  return entry.success && accepted.has(entry.data.detail.kind);
}
