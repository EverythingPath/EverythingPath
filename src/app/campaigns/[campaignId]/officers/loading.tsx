import { CharactersPageFrame } from '~/components/campaign-sections/page-frames';
import { CharactersSkeleton } from '~/components/characters-officers/characters-skeleton';

// The characters' route fallback, shown at once inside the kept campaign
// shell while the page's own data arrives. Same frame as the page.
export default function Loading() {
  return (
    <CharactersPageFrame>
      <CharactersSkeleton />
    </CharactersPageFrame>
  );
}
