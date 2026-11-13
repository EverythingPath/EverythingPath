'use client';
import { Search, X } from 'lucide-react';
import { useId } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { cn } from '~/lib/utils';
import { ChoiceSelect } from './choice-select';
import { InlineWarnings } from './inline-warning';
import { chip, fieldLabel } from './sheet-parts';
import { SpellRow, type BrowserSpell } from './spell-row';
import {
  formatSpellLevel,
  formatSpellLevelHeading,
} from './spellcasting-parts';
import type { useCharacterSpellsPage } from './use-character-spells-page';

type Page = ReturnType<typeof useCharacterSpellsPage>;

const filterChip = cn(
  chip,
  'hover:bg-foreground/10 min-h-11 shrink-0 px-2.5 md:min-h-8',
);
const pressedChip = 'border-primary bg-primary/15 text-primary';

/** Search across levels, the school filter and, for a recorder, other lists. */
function BrowserFilters({ page }: { page: Page }) {
  const searchId = useId();
  const className = page.selected?.name.toLowerCase() ?? '';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex min-w-0 flex-1 basis-full items-center md:flex-none md:basis-64">
        <label htmlFor={searchId} className="sr-only">
          Search the {className} list
        </label>
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute left-2 size-4"
        />
        <Input
          id={searchId}
          type="search"
          value={page.query}
          placeholder="Search all levels"
          autoComplete="off"
          onChange={(event) => page.setQuery(event.target.value)}
          className="h-11 pr-10 pl-8 md:h-9"
        />
        {page.query ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Clear search"
            onClick={() => page.setQuery('')}
            className="text-muted-foreground absolute right-1 size-9"
          >
            <X aria-hidden className="size-4" />
          </Button>
        ) : null}
      </div>
      <ChoiceSelect
        label="School"
        value={page.school ?? ''}
        emptyLabel="All schools"
        options={page.schools.map(({ value, label }) => ({ value, label }))}
        onValueChange={(value) => page.setSchool(value || null)}
        className="h-11 flex-1 md:h-9 md:w-44 md:flex-none"
      />
      {page.readOnly ? null : (
        <Button
          type="button"
          variant="outline"
          aria-pressed={page.includeOtherLists}
          onClick={() => page.setIncludeOtherLists(!page.includeOtherLists)}
          className={cn(
            filterChip,
            'h-auto md:min-h-9',
            page.includeOtherLists ? pressedChip : 'text-muted-foreground',
          )}
        >
          Include other lists
        </Button>
      )}
    </div>
  );
}

/** "12 on the wizard list", or "12 loaded" while further pages exist. */
function describeShown(page: Page) {
  const count = page.browserRows.length;
  const isComplete = page.browserStatus === 'Exhausted';
  if (page.searching) {
    if (!isComplete) return `${count} loaded for “${page.query.trim()}”`;
    return `${count} match${count === 1 ? '' : 'es'} for “${page.query.trim()}”`;
  }
  if (!isComplete) return `${count} loaded`;
  const list = page.includeOtherLists
    ? 'on any list'
    : `on the ${page.selected?.name.toLowerCase() ?? ''} list`;
  return `${count} ${list}`;
}

/** Search results cross levels, so they keep a small heading per level. */
function SearchRows({ page }: { page: Page }) {
  const levels = new Map<number | null, BrowserSpell[]>();
  for (const row of page.browserRows)
    levels.set(row.spellLevel, [...(levels.get(row.spellLevel) ?? []), row]);
  return (
    <>
      {[...levels.entries()]
        .sort(([a], [b]) => (a ?? Infinity) - (b ?? Infinity))
        .map(([spellLevel, rows]) => (
          <li key={spellLevel ?? 'unset'} className="pt-1">
            <p className={cn(fieldLabel, 'text-foreground')}>
              {spellLevel === null
                ? 'Level not set'
                : formatSpellLevelHeading(spellLevel)}
            </p>
            <ul>
              {rows.map((row) => (
                <SpellRow key={row.catalogEntryId} spell={row} page={page} />
              ))}
            </ul>
          </li>
        ))}
    </>
  );
}

/** The rows with their loading, empty and paging states. */
function BrowserResults({ page }: { page: Page }) {
  if (page.isLoading)
    return (
      <p role="status" className="text-muted-foreground py-2 text-sm">
        Loading Spells…
      </p>
    );
  return (
    <div className="space-y-1">
      <p className={cn(fieldLabel, 'pt-1')}>{describeShown(page)}</p>
      {page.searching ? null : (
        <InlineWarnings
          warnings={page.warningsForLevel(page.selectedLevel)}
          controller={page.warnings}
        />
      )}
      {page.browserRows.length === 0 ? (
        <p className="text-muted-foreground border-foreground/20 border border-dashed p-3 text-sm">
          No Spells match these filters.
        </p>
      ) : (
        <ul>
          {page.searching ? (
            <SearchRows page={page} />
          ) : (
            page.browserRows.map((row) => (
              <SpellRow key={row.catalogEntryId} spell={row} page={page} />
            ))
          )}
        </ul>
      )}
      <p role="status" className="text-muted-foreground text-sm">
        {page.browserStatus === 'LoadingMore' ? 'Loading more Spells…' : null}
      </p>
      {page.browserStatus === 'CanLoadMore' ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={page.loadMore}
          className={cn(filterChip, 'h-auto')}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}

/**
 * A Spellcasting's class list one spell level at a time: Add mode for a
 * recorder (each row has its record check) and the whole page for a
 * whole-list caster (read-only). The level tabs stay while a search spans
 * every level; choosing a level ends the search. Levels the class cannot
 * cast yet stay open and recordable, with a warning once recorded.
 */
export function SpellBrowser({ page }: { page: Page }) {
  const castable = page.selected?.castableSpellLevels ?? [];
  const highest = castable.length > 0 ? Math.max(...castable) : null;
  const className = page.selected?.name ?? 'This class';
  const castsUpTo =
    highest === null
      ? `${className} can’t cast spells yet`
      : `${className} casts up to ${formatSpellLevel(highest)} level now`;
  const isTooHigh = (level: number) => highest === null || level > highest;
  const levelValue = page.searching ? '' : String(page.selectedLevel);
  return (
    <div className="space-y-2">
      <BrowserFilters page={page} />
      <Tabs
        value={levelValue}
        activationMode="manual"
        onValueChange={(value) => page.setLevel(Number(value))}
        className="gap-1"
      >
        <TabsList
          aria-label="Spell level"
          className={cn(
            '-mx-1 flex h-auto w-auto justify-start gap-1.5 overflow-x-auto bg-transparent px-1 pb-1 md:mx-0 md:flex-wrap md:px-0 md:pb-0',
            page.searching && 'opacity-70',
          )}
        >
          {page.levels.map((level) => (
            <TabsTrigger
              key={level}
              value={String(level)}
              title={isTooHigh(level) ? castsUpTo : undefined}
              className={cn(
                filterChip,
                'h-auto min-w-11 flex-none justify-center font-normal shadow-none',
                'data-[state=active]:border-primary data-[state=active]:bg-primary/15 data-[state=active]:text-primary text-muted-foreground',
                isTooHigh(level) && 'opacity-70',
              )}
            >
              {formatSpellLevel(level)}
            </TabsTrigger>
          ))}
        </TabsList>
        {page.searching ? null : (
          <TabsContent value={levelValue}>
            <BrowserResults page={page} />
          </TabsContent>
        )}
      </Tabs>
      {page.searching ? (
        <section aria-label="Search results">
          <BrowserResults page={page} />
        </section>
      ) : null}
    </div>
  );
}
