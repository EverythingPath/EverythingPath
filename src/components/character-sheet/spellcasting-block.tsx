'use client';
import { ArrowRight, ChevronRight, TriangleAlert } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import {
  characterSpellsPath,
  type CharacterSheetOrigin,
} from '~/lib/campaign-routes';
import type {
  ResolvedSpellCollection,
  ResolvedSpellCollections,
} from '~/lib/character-sheet-spell-collections';
import { spellCollectionHeading } from '~/lib/character-sheet-spell-collections';
import { cn } from '~/lib/utils';
import { spellcastingFeatureChecks } from '~/lib/character-sheet-spellcasting-features';
import { archetypeCastingAnchor } from './archetype-casting-choices';
import { describeChoiceWait } from './archetype-casting-view-model';
import { OrphanedSpells } from './orphaned-spells';
import { action, Block, fieldLabel } from './sheet-parts';
import {
  CastingFigure,
  describeCollectionNote,
  describePerDayWait,
  describeUnresolved,
  formatSpellLevel,
  PerDay,
  WaitingValue,
  type Spellcasting,
} from './spellcasting-parts';
import { SpellcastingNumbers } from './spellcasting-numbers';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Sheet = NonNullable<Controller['sheet']>;

// The approved prototype's Spellcasting section (#233, variant 3): one lean
// summary line per casting class, wrapping into a compact card on the phone,
// and under it, on request, the class's numbers beside its per-level table.
// Each line counts its recorded and Granted Spells and open warnings and links
// to the Spells page; Spells no Spellcasting holds sit in their own group
// beneath.

const incomplete = 'text-xs text-amber-300';

/** What the sheet needs to link each line to its Spells and keep orphans visible. */
type SpellcastingBlockSpells = {
  characterId: string;
  origin?: CharacterSheetOrigin;
  collections: ResolvedSpellCollections;
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
  writes: Controller['spells'];
};

// A Class Level whose class the resolver could not read keeps the section
// honest: it says what is missing instead of "No spellcasting."
function describeGlobalUnresolved(unresolved: readonly string[]) {
  if (unresolved.length === 0) return null;
  const classes = unresolved.filter((reason) =>
    reason.startsWith('class:'),
  ).length;
  if (classes === unresolved.length)
    return classes === 1
      ? 'Not complete: a Class Level has no class yet.'
      : `Not complete: ${classes} Class Levels have no class yet.`;
  return 'Not complete: spellcasting cannot be fully stated yet.';
}

/**
 * "3 known", "5 in spellbook": how many Spells a recording Spellcasting
 * holds; "3 recorded" while an Archetype choice decides how it records.
 */
export function describeRecordedCount(collection: ResolvedSpellCollection) {
  const count = collection.spells.length;
  const heading = collection.heading;
  if (!heading)
    return collection.record === null && count > 0 ? `${count} recorded` : null;
  if (collection.record === 'known') return `${count} known`;
  return `${count} in ${heading.toLowerCase()}`;
}

/** What heads a Spellcasting's Spells: its record, the choice it waits for, or its whole list. */
export type CollectionHeading = {
  kind: 'recorded' | 'waiting' | 'wholeList';
  text: string;
};

/** The record's heading, or the choice it waits for (#422). */
export function describeCollectionHeading(
  collection: Pick<ResolvedSpellCollection, 'heading' | 'record'> | undefined,
  casting: Pick<Spellcasting, 'record'>,
  wholeList = 'Whole list',
): CollectionHeading {
  if (collection?.heading)
    return { kind: 'recorded', text: collection.heading };
  if ((collection ? collection.record : casting.record) === null)
    return { kind: 'waiting', text: 'Waiting for a choice' };
  return { kind: 'wholeList', text: wholeList };
}

// The class-feature checks the Spells page reports: a choice still open and
// a specialist's opposition schools, both settled on the class feature rows.
// Casting advances belong to Class Levels.
const featureChecks = new Set<string>(spellcastingFeatureChecks);

/**
 * Open warnings about one Spellcasting: its counts, its recorded Spells and
 * the class-feature choices its Spells page reports.
 */
function countOpenWarnings(
  casting: Spellcasting,
  collection: ResolvedSpellCollection | undefined,
  warnings: SheetWarningView[],
) {
  const entries = new Set(collection?.spells.map((spell) => spell.entryId));
  const features = new Set([
    ...casting.choices.map((choice) => choice.sourceEntryId),
    ...(casting.school ? [casting.school.entryId] : []),
  ]);
  return warnings.filter(({ target, check, accepted }) => {
    if (accepted) return false;
    if (target.kind === 'spellcasting')
      return target.classEntryId === casting.classEntryId;
    if (target.kind !== 'entry') return false;
    if (featureChecks.has(check)) return features.has(target.entryId);
    return entries.has(target.entryId);
  }).length;
}

/** "3 granted": the Granted Spells a Spellcasting has beside its recorded count. */
function describeGrantedCount(casting: Spellcasting) {
  const count = casting.grantedSpells.length;
  return count > 0 ? `${count} granted` : null;
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex flex-wrap items-baseline gap-1">
      <span className={fieldLabel}>{label}</span>
      {children}
    </span>
  );
}

// "Per day 0 At will · 1st 2": the strip the summary line carries so a
// player reads the day's allowance without opening anything. Totals an
// Archetype choice decides dash, and the strip says once what they wait for.
function PerDayStrip({ casting }: { casting: Spellcasting }) {
  if (casting.slots.length === 0) {
    const wait = describeChoiceWait(casting.unresolved, ['presence', 'table']);
    return (
      <span className="text-muted-foreground text-sm">
        {wait ?? 'No spells yet'}
      </span>
    );
  }
  const wait = casting.slots.some(
    (slot) =>
      slot.total === null && !(slot.spellLevel === 0 && casting.cantrips),
  )
    ? describePerDayWait(casting)
    : null;
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
      <span className={fieldLabel}>Per day</span>
      {casting.slots.map((slot, index) => (
        <span key={slot.spellLevel} className="flex items-baseline gap-x-1">
          {index > 0 ? (
            <span aria-hidden className="text-muted-foreground/60">
              ·
            </span>
          ) : null}
          <span className="text-muted-foreground text-sm">
            {formatSpellLevel(slot.spellLevel)}
          </span>
          <PerDay casting={casting} slot={slot} className="text-sm" />
        </span>
      ))}
      {wait ? <WaitingValue reason={wait} /> : null}
    </span>
  );
}

// A Spellcasting whose presence an Archetype choice decides states only
// that, linking to the row that decides it; its Spells stay reachable.
function PresenceWait({ casting }: { casting: Spellcasting }) {
  return (
    <a
      href={`#${archetypeCastingAnchor(casting.classEntryId)}`}
      className={cn(
        action,
        'inline-flex items-center text-sm text-sky-300 hover:underline',
      )}
    >
      Waiting for a spellcasting choice{' '}
      <span className="sr-only">for {casting.name}, in Archetypes</span>
    </a>
  );
}

// The line's way to its Spells: the count, the open warnings and the link.
// They wrap as one unit, and the link takes its own row on the phone.
function SpellsLinks({
  casting,
  spells,
}: {
  casting: Spellcasting;
  spells: SpellcastingBlockSpells;
}) {
  const collection = spells.collections.collections.find(
    (item) => item.classEntryId === casting.classEntryId,
  );
  const count = collection ? describeRecordedCount(collection) : null;
  const granted = describeGrantedCount(casting);
  const openWarnings = countOpenWarnings(casting, collection, spells.warnings);
  const href = characterSpellsPath(
    spells.characterId,
    spells.origin,
    casting.classEntryId,
  );
  const plural = openWarnings === 1 ? 'warning' : 'warnings';
  return (
    <>
      {count !== null || granted !== null || openWarnings > 0 ? (
        <span className="flex items-center gap-x-3">
          {count !== null ? (
            <span className="text-muted-foreground font-mono text-sm">
              {count}
            </span>
          ) : null}
          {granted !== null ? (
            <span className="text-muted-foreground font-mono text-sm">
              {granted}
            </span>
          ) : null}
          {openWarnings > 0 ? (
            <GuardedLink
              href={href}
              className={cn(
                action,
                'flex items-center gap-1 font-mono text-sm text-amber-300 hover:underline',
              )}
            >
              <TriangleAlert aria-hidden className="size-3.5" />
              {openWarnings}{' '}
              <span className="sr-only">
                open {casting.name} Spell {plural}
              </span>
            </GuardedLink>
          ) : null}
        </span>
      ) : null}
      <GuardedLink
        href={href}
        className={cn(
          action,
          'text-primary flex basis-full items-center gap-1 text-sm hover:underline md:basis-auto',
        )}
      >
        {casting.record === 'none' ? (
          `Browse the ${casting.name.toLowerCase()} list`
        ) : (
          <>
            Open spells <span className="sr-only">for {casting.name}</span>
          </>
        )}
        <ArrowRight aria-hidden className="size-3.5" />
      </GuardedLink>
    </>
  );
}

// One class's line: name and recording model, caster level, concentration,
// the per-day strip, what is still unresolved, its Spells and the button that
// opens its numbers. The open state lives here, so a class that disappears
// takes its own disclosure with it and no other.
function CastingSummary({
  casting,
  spells,
}: {
  casting: Spellcasting;
  spells?: SpellcastingBlockSpells;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const isPresencePending = casting.unresolved.includes('presence');
  const unresolved = isPresencePending
    ? null
    : describeUnresolved(casting.unresolved);
  const collection = spells?.collections.collections.find(
    (item) => item.classEntryId === casting.classEntryId,
  );
  const heading = describeCollectionHeading(
    collection ?? {
      heading: spellCollectionHeading(casting),
      record: casting.record,
    },
    casting,
  );
  const note = describeCollectionNote(casting);
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="flex min-w-0 basis-full flex-wrap items-baseline gap-x-2 md:basis-auto">
          <span className="font-sans text-base">{casting.name}</span>
          <span className="text-muted-foreground text-xs">{heading.text}</span>
        </span>
        {isPresencePending ? (
          <PresenceWait casting={casting} />
        ) : (
          <>
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <Labelled label="CL">
                <CastingFigure
                  casting={casting}
                  kind="casterLevel"
                  className="min-h-7 text-sm"
                />
              </Labelled>
              <Labelled label="Conc">
                <CastingFigure
                  casting={casting}
                  kind="concentration"
                  className="min-h-7 text-sm"
                />
              </Labelled>
            </span>
            <PerDayStrip casting={casting} />
          </>
        )}
        {unresolved ? <span className={incomplete}>{unresolved}</span> : null}
        <span className="flex basis-full flex-wrap items-center gap-x-4 md:ml-auto md:basis-auto">
          {spells ? <SpellsLinks casting={casting} spells={spells} /> : null}
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={isOpen ? panelId : undefined}
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              action,
              'text-primary inline-flex items-center gap-1 text-sm hover:underline',
            )}
          >
            <ChevronRight
              aria-hidden
              className={cn(
                'size-3.5 transition-transform',
                isOpen && 'rotate-90',
              )}
            />
            View {casting.name} spellcasting
          </button>
        </span>
      </div>
      {note ? (
        <p className="text-muted-foreground mt-1 text-xs [overflow-wrap:anywhere]">
          {note}
        </p>
      ) : null}
      {isOpen ? <SpellcastingNumbers casting={casting} id={panelId} /> : null}
    </li>
  );
}

/** The orphan rows as the Spells page shows them, from the sheet's own read. */
function listSpellsWithoutSpellcasting(spells: SpellcastingBlockSpells) {
  return spells.collections.spellsWithoutSpellcasting.map((spell) => ({
    ...spell,
    warnings: spells.warnings.filter(
      ({ target }) =>
        target.kind === 'entry' && target.entryId === spell.entryId,
    ),
    status: spells.writes.statusForEntry(spell.entryId),
  }));
}

/**
 * The Spellcasting section of the Full living sheet: each casting class on
 * its own line with its caster level, concentration and per-day strip, its
 * Spells a link away and its numbers and allowance table a tap away. A
 * Character with no casting class says so; one whose Class Levels the
 * resolver could not read says that instead, since missing class data is
 * not the absence of spellcasting. Spells under no Spellcasting stay listed
 * here, even when no Spellcasting is left.
 */
export function SpellcastingBlock({
  characterName,
  spellcastings,
  unresolved,
  spells,
}: {
  characterName: string;
  spellcastings: Sheet['calculated']['spellcastings'];
  unresolved: Sheet['calculated']['spellcastingUnresolved'];
  spells?: SpellcastingBlockSpells;
}) {
  const globalUnresolved = describeGlobalUnresolved(unresolved);
  const spellsWithoutSpellcasting = spells
    ? listSpellsWithoutSpellcasting(spells)
    : [];
  return (
    <Block
      title="Spellcasting"
      aside={
        globalUnresolved ? (
          <p className={incomplete}>{globalUnresolved}</p>
        ) : null
      }
    >
      {spellcastings.length === 0 ? (
        globalUnresolved ? null : (
          <p className="text-muted-foreground text-sm">
            {characterName} has no Spellcasting.
          </p>
        )
      ) : (
        <ul className="divide-foreground/10 -my-2 divide-y">
          {spellcastings.map((casting) => (
            <CastingSummary
              key={casting.classEntryId}
              casting={casting}
              spells={spells}
            />
          ))}
        </ul>
      )}
      {spells ? (
        <OrphanedSpells
          spells={spellsWithoutSpellcasting}
          writes={spells.writes}
          warningController={spells.warningController}
          className="border-foreground/10 mt-4 border-t pt-2"
        />
      ) : null}
    </Block>
  );
}
