'use client';

import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import {
  areCharacterSheetsAvailable,
  type CharacterSheetSubject,
} from '~/lib/character-sheet-availability';

/**
 * The builder's entry points ask the server which authority the deployment
 * is under and decide through the gates' own rule. Until it answers they
 * offer what legacy authority offers.
 */
export function useCharacterSheetAvailability() {
  const authority = useQuery(api.characterSheet.authority, {});
  return {
    isLoading: authority === undefined,
    isAvailable: (subject: CharacterSheetSubject) =>
      areCharacterSheetsAvailable(authority ?? 'legacy', subject),
  };
}
