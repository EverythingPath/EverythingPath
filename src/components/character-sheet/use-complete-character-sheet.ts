'use client';

import { useMemo } from 'react';
import { mergeBrowseOnlyDefinitions } from '~/lib/browse-only-definitions';
import { characterScopeKey, type CharacterScope } from './character-scope';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { useCompleteView } from './use-complete-view';

/** A query response is the complete release view; loading never replaces it. */
export function useCompleteCharacterSheet(
  scope: CharacterScope,
  incoming: CharacterSheetSnapshot | null | undefined,
) {
  const snapshot = useCompleteView(characterScopeKey(scope), incoming);
  return useMemo(
    () => (snapshot ? mergeBrowseOnlyDefinitions(snapshot) : snapshot),
    [snapshot],
  );
}
