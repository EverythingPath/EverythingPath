'use client';

import { usePathname } from 'next/navigation';
import { resolveNavigationLocation } from '~/lib/campaign-routes';
import { isCharacterNotFound } from '~/lib/character-not-found';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { FailedLoadCard } from '~/components/campaign-shell/failed-load';
import { CharacterUnavailableCard } from '~/components/character-sheet/character-unavailable-card';
import { useCharacterSheetNavigation } from '~/components/character-sheet/use-character-sheet-navigation';
import { CharacterSheetFrame } from '~/components/character-sheet/character-sheet-frame';

// Missing and inaccessible Characters use the same presentation: a plain
// unavailable card with only the Back link. Any other failure keeps its retry.
export default function IndependentCharacterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isSheet =
    resolveNavigationLocation(usePathname())?.kind === 'character-sheet';
  const navigation = useCharacterSheetNavigation();
  const { reset: resetQueries } = useQueryErrorResetBoundary();
  return (
    <CharacterSheetFrame back={navigation.back}>
      {isCharacterNotFound(error) ? (
        <CharacterUnavailableCard />
      ) : (
        <FailedLoadCard
          noun={isSheet ? 'The character sheet' : 'The characters'}
          retry={() => {
            resetQueries();
            reset();
          }}
        />
      )}
    </CharacterSheetFrame>
  );
}
