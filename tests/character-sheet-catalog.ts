import { mergeBrowseOnlyDefinitions } from '../src/lib/browse-only-definitions';

/**
 * A sheet read as the client sees it: browse-only seeds the read did not load
 * come from its catalog view, so tests can find any definition the Character has.
 */
export function withSheetCatalog<
  Sheet extends Parameters<typeof mergeBrowseOnlyDefinitions>[0] | null,
>(sheet: Sheet): Sheet {
  return sheet ? mergeBrowseOnlyDefinitions(sheet) : sheet;
}
