'use client';

import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { useMemo } from 'react';
import type { CharacterSheetOrigin } from '~/lib/campaign-routes';
import { buildCombinedFormView } from './character-combined-form-view-model';
import type { CharacterSheetSnapshot } from './use-character-sheet';

/**
 * The Synthesist's Combined Form on the summoner's sheet (#421): a
 * read-only view with no writes. `view` is null when the Character is not a
 * Synthesist, and undefined while loading.
 */
export function useCharacterCombinedForm(
  snapshot: CharacterSheetSnapshot | null | undefined,
  origin?: CharacterSheetOrigin,
) {
  const form = useQuery(
    api.characterSheetCombinedForm.read,
    snapshot ? { characterId: snapshot.character._id } : 'skip',
  );
  const view = useMemo(
    () => (form ? buildCombinedFormView(form, origin) : form),
    [form, origin],
  );
  return { view, isLoading: Boolean(snapshot) && form === undefined };
}
