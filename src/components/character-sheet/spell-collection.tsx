'use client';
import { Plus } from 'lucide-react';
import { useId } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { isLevelPending } from './archetype-casting-view-model';
import { InlineWarnings } from './inline-warning';
import { Block, chip, fieldLabel } from './sheet-parts';
import { SpellRow, type RecordedSpell } from './spell-row';
import {
  describeCollectionNote,
  formatSpellLevelHeading,
} from './spellcasting-parts';
import { useFocusAfterSpellRemoval } from './use-focus-after-spell-removal';
import type { useCharacterSpellsPage } from './use-character-spells-page';

type Page = ReturnType<typeof useCharacterSpellsPage>;
type Collection = NonNullable<Page['collection']>;

/** The outline chip-style action in a block header (Add Spells, Done). */
export const headerAction = cn(chip, 'min-h-11 gap-1 px-2.5 md:min-h-8');

/** Recorded Spells by level, ascending, with the unset level last. */
function groupByLevel(spells: RecordedSpell[]) {
  const groups = new Map<number | null, RecordedSpell[]>();
  for (const spell of spells)
    groups.set(spell.spellLevel, [
      ...(groups.get(spell.spellLevel) ?? []),
      spell,
    ]);
  return [...groups.entries()]
    .sort(([a], [b]) => (a ?? Infinity) - (b ?? Infinity))
    .map(([spellLevel, rows]) => ({ spellLevel, rows }));
}

/** "2/3 known" where the class table sets an allowance; otherwise the plain count. */
function describeLevelCount(
  collection: Collection,
  spellLevel: number | null,
  rowCount: number,
) {
  const level = collection.levels.find((row) => row.spellLevel === spellLevel);
  if (level && level.allowance !== null)
    return {
      text: `${level.count}/${level.allowance} known`,
      isOverAllowance: level.count > level.allowance,
    };
  return { text: String(level?.count ?? rowCount), isOverAllowance: false };
}

function AddSpellsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onClick}
      className={headerAction}
    >
      <Plus aria-hidden className="size-3.5" />
      Add Spells
    </Button>
  );
}

function LevelGroup({
  page,
  collection,
  spellLevel,
  rows,
  remove,
}: {
  page: Page;
  collection: Collection;
  spellLevel: number | null;
  rows: RecordedSpell[];
  remove: (entryId: string, write: () => Promise<boolean>) => Promise<boolean>;
}) {
  const headingId = useId();
  const count = describeLevelCount(collection, spellLevel, rows.length);
  const isWaiting =
    spellLevel === null &&
    rows.every((spell) => isLevelPending(spell, page.selected));
  return (
    <section aria-labelledby={headingId} className="pt-2 first:pt-0">
      <h3
        id={headingId}
        className={cn(
          fieldLabel,
          'flex flex-wrap items-baseline gap-x-2 pb-0.5',
        )}
      >
        <span className="text-foreground">
          {spellLevel === null
            ? isWaiting
              ? 'Level waits for a choice'
              : 'Level not set'
            : formatSpellLevelHeading(spellLevel)}
        </span>
        <span className={cn(count.isOverAllowance && 'text-amber-300')}>
          {count.text}
        </span>
      </h3>
      {spellLevel === null ? null : (
        <InlineWarnings
          warnings={page.warningsForLevel(spellLevel)}
          controller={page.warnings}
          className="pb-1"
        />
      )}
      <ul>
        {rows.map((spell) => (
          <SpellRow
            key={spell.entryId}
            spell={spell}
            page={page}
            remove={remove}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * A recording Spellcasting's default view: its Spells known, Spellbook,
 * Formula book or Familiar, grouped by level with each level's count (and
 * allowance where the class table sets one) and its count warnings. Each
 * check removes its Spell; Add Spells opens the class list. A witch's
 * Familiar says its Spells stay with the witch. While an Archetype choice
 * decides how the class records (#422), the Spells stay listed under
 * "Recorded Spells" and say what they wait for.
 */
export function SpellCollection({ page }: { page: Page }) {
  const focus = useFocusAfterSpellRemoval(
    page.recordedSpells.map((spell) => spell.entryId),
  );
  const collection = page.collection;
  const collectionHeading = collection?.heading ?? null;
  if (!collection || (!collectionHeading && collection.record !== null))
    return null;
  const heading = collectionHeading ?? 'Recorded Spells';
  const isEmpty = page.recordedSpells.length === 0;
  const note =
    collectionHeading === null
      ? 'How these Spells are prepared and recorded waits for an Archetype choice.'
      : describeCollectionNote(page.selected);
  return (
    <Block
      title={heading}
      aside={isEmpty ? null : <AddSpellsButton onClick={page.enterBrowser} />}
    >
      {note ? (
        <p className="text-muted-foreground mb-2 text-xs [overflow-wrap:anywhere]">
          {note}
        </p>
      ) : null}
      <div ref={focus.container}>
        {isEmpty ? (
          <div className="border-foreground/20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border border-dashed p-3">
            <p className="text-muted-foreground min-w-0 flex-1 basis-48 text-sm">
              Nothing in the {heading.toLowerCase()} yet.
            </p>
            <AddSpellsButton onClick={page.enterBrowser} />
          </div>
        ) : (
          groupByLevel(page.recordedSpells).map((group) => (
            <LevelGroup
              key={group.spellLevel ?? 'unset'}
              page={page}
              collection={collection}
              spellLevel={group.spellLevel}
              rows={group.rows}
              remove={focus.remove}
            />
          ))
        )}
      </div>
    </Block>
  );
}
