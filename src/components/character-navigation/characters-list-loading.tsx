import { Skeleton } from '~/components/ui/skeleton';
import { pageClass } from './character-list-classes';
import { CharactersTitle } from './characters-title';

export function CharactersListLoading() {
  return (
    <main className={pageClass}>
      <CharactersTitle />
      <div role="status" aria-label="Loading characters" className="space-y-4">
        <Skeleton aria-hidden className="h-8 w-48" />
        <Skeleton aria-hidden className="h-40 w-full" />
      </div>
    </main>
  );
}
