'use client';
import { useId, useState } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Checkbox } from '~/components/ui/checkbox';
import { cn } from '~/lib/utils';
import { isLevelPending } from './archetype-casting-view-model';
import { InlineWarnings } from './inline-warning';
import { OffListSpellLevelField } from './off-list-spell-level-field';
import { chip, SaveFeedback } from './sheet-parts';
import { SpellName } from './spell-name';
import { formatSpellLevel } from './spellcasting-parts';
import {
  schoolChoice,
  type useCharacterSpellsPage,
} from './use-character-spells-page';

type Page = ReturnType<typeof useCharacterSpellsPage>;
export type BrowserSpell = Page['browserRows'][number];
export type RecordedSpell = Page['recordedSpells'][number];

const tag = cn(chip, 'px-1 py-0 text-[11px] whitespace-nowrap');
const amber = 'border-amber-500/60 text-amber-300';

const isBrowserSpell = (
  spell: BrowserSpell | RecordedSpell,
): spell is BrowserSpell => 'onList' in spell;

/** The record check: the app's square check inside a comfortable target. */
function RecordCheck({
  name,
  isChecked,
  isDisabled,
  describedBy,
  onChange,
}: {
  name: string;
  isChecked: boolean;
  isDisabled: boolean;
  describedBy?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center md:min-h-9 md:min-w-9">
      <Checkbox
        aria-label={`Record ${name}`}
        aria-describedby={describedBy}
        data-removal-focus
        checked={isChecked}
        disabled={isDisabled}
        onCheckedChange={onChange}
        className="size-5"
      />
    </label>
  );
}

/** "off-list", "too high", "2 slots": the row's advisory tags. */
function SpellTags({
  isOffList,
  isTooHigh,
  isTwoSlots,
  isRecorded,
  castsUpTo,
}: {
  isOffList: boolean;
  isTooHigh: boolean;
  isTwoSlots: boolean;
  isRecorded: boolean;
  castsUpTo: string;
}) {
  const tone = isRecorded ? amber : 'text-muted-foreground';
  return (
    <>
      {isTooHigh ? (
        <span className={cn(tag, tone)} title={castsUpTo}>
          too high
        </span>
      ) : null}
      {isOffList ? <span className={cn(tag, tone)}>off-list</span> : null}
      {isTwoSlots ? (
        <span
          className={cn(tag, amber)}
          title="An opposition-school spell uses two slots of its level."
        >
          2 slots
        </span>
      ) : null}
    </>
  );
}

/**
 * One dense Spell row, shared by the record, the Add mode browser and a
 * whole-list caster's read-only list: level, school, name with its tags
 * (a recorded opposition-school Spell says it takes two slots), the
 * description, and the record check. A Spell off the Spellcasting's list
 * is recorded only through its explicit level: checking it opens the level
 * field and nothing is saved until a valid level is submitted. The row owns
 * its save feedback and warnings; while it saves only its own controls wait.
 */
export function SpellRow({
  spell,
  page,
  remove,
}: {
  spell: BrowserSpell | RecordedSpell;
  page: Page;
  /** Removes through the list's focus handling; the browser removes in place. */
  remove?: (entryId: string, write: () => Promise<boolean>) => Promise<boolean>;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const panelId = useId();
  const [isDrafting, setIsDrafting] = useState(false);
  const { selected, writes } = page;
  const isOffList = isBrowserSpell(spell) ? !spell.onList : spell.offList;
  // CRB p. 77: a prepared opposition-school Spell takes two slots.
  const isTwoSlots = !isBrowserSpell(spell) && spell.twoSlots;
  const isRecorded =
    spell.entryId !== null || (isBrowserSpell(spell) && spell.recorded);
  const isSaving = spell.status.kind === 'saving';
  const isDisabled = isSaving || maintenance.readOnly;
  const school = spell.school ? schoolChoice(spell.school) : null;
  const isExpanded = page.isDescriptionExpanded(spell.catalogEntryId);
  const isTooHigh =
    spell.spellLevel !== null &&
    selected !== null &&
    !selected.castableSpellLevels.includes(spell.spellLevel);
  const castable = selected?.castableSpellLevels ?? [];
  const highest = castable.length > 0 ? Math.max(...castable) : null;
  const castsUpTo =
    highest === null
      ? `${selected?.name ?? 'This class'} can’t cast spells yet`
      : `${selected?.name} casts up to ${formatSpellLevel(highest)} level now`;
  const showsLevelField =
    !page.readOnly &&
    isOffList &&
    (isRecorded ? spell.entryId !== null : isDrafting);
  // #422: a recorded Spell's list level can wait for an Archetype choice.
  const isPending = !isBrowserSpell(spell) && isLevelPending(spell, selected);

  function removeSpell(entryId: string) {
    const write = () => writes.remove({ entryId, name: spell.name });
    return remove ? remove(entryId, write) : write();
  }

  function changeRecord(checked: boolean) {
    if (!selected) return;
    if (!checked) {
      if (spell.entryId !== null) void removeSpell(spell.entryId);
      else setIsDrafting(false);
      return;
    }
    if (isRecorded || !isBrowserSpell(spell)) return;
    if (isOffList) setIsDrafting(true);
    else void writes.record({ castingClassId: selected.classEntryId, spell });
  }

  async function saveLevel(level: number) {
    if (spell.entryId !== null)
      return writes.editLevel({
        entryId: spell.entryId,
        name: spell.name,
        level,
      });
    if (!selected || !isBrowserSpell(spell)) return false;
    const saved = await writes.record({
      castingClassId: selected.classEntryId,
      spell,
      level,
    });
    if (saved) setIsDrafting(false);
    return saved;
  }

  return (
    <li
      data-spell-entry={spell.entryId ?? undefined}
      className="border-foreground/10 grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-2 border-b py-0.5 last:border-b-0 md:grid-cols-[2.5rem_3rem_minmax(0,19rem)_minmax(0,1fr)_auto] md:gap-x-3 lg:grid-cols-[2.5rem_3rem_minmax(0,23rem)_minmax(0,1fr)_auto]"
    >
      <span
        className={cn(
          'col-start-1 row-start-1 text-center font-mono text-base',
          spell.spellLevel === null && 'text-muted-foreground',
        )}
      >
        {spell.spellLevel === null ? (
          isPending ? (
            <span className="text-xs leading-tight">
              Level waits for a choice
            </span>
          ) : (
            <>
              <span aria-hidden>—</span>
              <span className="sr-only">Level not set</span>
            </>
          )
        ) : (
          formatSpellLevel(spell.spellLevel)
        )}
      </span>
      <span
        className="text-muted-foreground hidden font-mono text-sm md:col-start-2 md:row-start-1 md:inline"
        title={school?.label}
      >
        {school?.abbreviation}
      </span>
      <span className="col-start-2 row-start-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 md:col-start-3">
        <SpellName
          name={spell.name}
          panelId={panelId}
          isExpanded={isExpanded}
          onToggle={() => page.toggleDescription(spell.catalogEntryId)}
        />
        {school ? (
          <span
            className="text-muted-foreground font-mono text-xs md:hidden"
            title={school.label}
          >
            {school.abbreviation}
          </span>
        ) : null}
        <SpellTags
          isOffList={isOffList}
          isTooHigh={isTooHigh}
          isTwoSlots={isTwoSlots}
          isRecorded={isRecorded}
          castsUpTo={castsUpTo}
        />
      </span>
      <span
        className="text-muted-foreground hidden min-w-0 truncate text-sm md:col-start-4 md:row-start-1 md:block"
        title={spell.description}
      >
        {spell.description}
      </span>
      <span className="col-start-3 row-start-1 flex justify-end md:col-start-5">
        {page.readOnly ? null : (
          <RecordCheck
            name={spell.name}
            isChecked={isRecorded || isDrafting}
            isDisabled={isDisabled}
            describedBy={reasonId}
            onChange={changeRecord}
          />
        )}
      </span>
      {isExpanded ? (
        <p
          id={panelId}
          className="text-muted-foreground col-span-2 col-start-2 pb-1.5 text-xs [overflow-wrap:anywhere] md:hidden"
        >
          {[school?.label, spell.description].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      {showsLevelField ? (
        <OffListSpellLevelField
          key={spell.entryId ?? 'draft'}
          spellName={spell.name}
          level={spell.explicitLevel}
          save={saveLevel}
          isSaving={isSaving}
          isReadOnly={maintenance.readOnly}
          shouldFocusOnOpen={spell.entryId === null}
          className="col-span-full pb-1 md:col-start-3"
        />
      ) : null}
      <div className="col-span-full md:col-start-3">
        <SaveFeedback
          status={spell.status}
          savedText="Saved."
          shouldHideWhenIdle
        />
      </div>
      <InlineWarnings
        warnings={spell.warnings}
        controller={page.warnings}
        className="col-span-full pb-1 md:col-start-3"
      />
    </li>
  );
}
