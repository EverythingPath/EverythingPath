import type {
  CharacterSheetInput,
  ResolveOptions,
} from '~/lib/character-sheet';
import { calculateCharacterSheetForRelease } from '~/lib/catalog/calculation-dispatch';
import { catalogRuntimeCompatibility } from '~/lib/catalog/runtime-compatibility';
import { reviewedCastingTablesSchema } from '~/lib/character-sheet-casting-tables';
import type { CharacterSheetSnapshot } from './use-character-sheet';

/** Saved totals and local previews use the same selected calculation behavior. */
export function calculateCharacterSheetPreview(
  snapshot: CharacterSheetSnapshot,
  changes: Partial<CharacterSheetInput> = {},
  options?: ResolveOptions,
) {
  const resources = snapshot.catalogView?.resources;
  return calculateCharacterSheetForRelease(
    snapshot.catalogView?.calculationIdentity ??
      catalogRuntimeCompatibility.calculation,
    {
      ...snapshot,
      characterKind: snapshot.character.kind,
      sheetMode: snapshot.character.sheetMode,
      resources: resources
        ? {
            castingTables: resources.castingTables
              ? reviewedCastingTablesSchema.parse(resources.castingTables)
              : undefined,
          }
        : undefined,
      retired: snapshot.catalogView?.retired,
      ...changes,
    },
    options,
  );
}
