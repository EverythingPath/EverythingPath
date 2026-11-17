'use client';
import { useId, type ReactNode } from 'react';
import { abilityLabels } from '~/lib/character-sheet';
import { spellcastingBreakdownTarget } from '~/lib/character-sheet-breakdowns';
import { describeRecording } from '~/lib/character-sheet-casting-copy';
import { cn } from '~/lib/utils';
import {
  casterLevelDependencies,
  concentrationDependencies,
  describeChoiceWait,
  describeProvenance,
} from './archetype-casting-view-model';
import { fieldLabel, formatModifier, missingChoice } from './sheet-parts';
import type {
  SpellcastingFeaturesView,
  SpellcastingSchoolView,
} from './spellcasting-features-view-model';
import {
  capitalize,
  CastingFigure,
  Dash,
  describeUnresolved,
  formatSpellLevel,
  PerDay,
  WaitingValue,
  type Spellcasting,
  type SpellcastingSlot,
} from './spellcasting-parts';
import { SheetStatistic } from './sheet-statistic';

const waitingForChoice = 'Waiting for a choice';

/** "Prepared, spellbook", "Spontaneous, spells known": how the class prepares and records. */
function describePreparation(casting: Spellcasting) {
  if (casting.type === null || casting.record === null) return null;
  return describeRecording({
    type: casting.type,
    record: casting.record,
    bookType: casting.bookType,
  });
}

/** "Bard list": the effective list's class; null while a choice decides it. */
function describeSpellList(casting: Spellcasting) {
  return casting.spellList.name === null
    ? null
    : `${casting.spellList.name} list`;
}

// "from Seducer (your choice)": which Archetype a changed figure comes from.
function Provenance({
  casting,
  property,
  lead,
}: {
  casting: Spellcasting;
  property: string;
  /** Names what the source changed when the figure itself is not it: "offset". */
  lead?: string;
}) {
  const row = casting.castingProperties.find((item) => item.key === property);
  const text = row ? describeProvenance(row) : null;
  if (!text) return null;
  return (
    <span className="text-muted-foreground text-xs">
      {lead ? `${lead} ${text}` : text}
    </span>
  );
}

const th = cn(fieldLabel, 'px-1.5 pb-1 text-left font-normal');
const td = 'border-foreground/10 border-t px-1.5 py-1 align-baseline';

/** "1 base + 1 bonus": how a per-day number is made; null for a bare table number. */
function describeComposition(slot: SpellcastingSlot) {
  const extra = slot.extra ?? 0;
  if (slot.total === null || (slot.bonus === 0 && extra === 0)) return null;
  const parts = [`${slot.base ?? 0} base`];
  if (slot.bonus > 0) parts.push(`${slot.bonus} bonus`);
  if (extra > 0) parts.push(`${extra} extra`);
  return parts.join(' + ');
}

function SaveDc({
  casting,
  slot,
  school,
}: {
  casting: Spellcasting;
  slot: SpellcastingSlot;
  school?: string;
}) {
  const schoolDC = school
    ? slot.schoolDCs.find((candidate) => candidate.school === school)
    : undefined;
  const statistic = school ? schoolDC?.breakdown : slot.dc;
  const unresolved = school ? schoolDC?.unresolved : slot.dcUnresolved;
  if (!statistic) return <Dash reason="Not applicable" />;
  const level = `${formatSpellLevel(slot.spellLevel)}-level`;
  const name = school
    ? `${level} ${capitalize(school)} save DC`
    : `${level} save DC`;
  const target = spellcastingBreakdownTarget(casting.classEntryId, {
    kind: 'dc',
    spellLevel: slot.spellLevel,
    school,
  });
  const incompleteReason = unresolved ? describeUnresolved(['spellDC']) : null;
  return (
    <>
      <SheetStatistic
        label={`${casting.name} ${name}`}
        statistic={statistic}
        target={target}
        incompleteReason={incompleteReason}
        className="min-h-7 text-sm"
        alternates={{ isStacked: true, className: 'items-start' }}
      />
    </>
  );
}

/** A known or prepared count; a dash where the table has none for this level. */
function Count({ value }: { value: number | null }) {
  if (value === null) return <Dash reason="Not applicable" />;
  return <span className="font-mono">{value}</span>;
}

// Rows are only the spell levels the table has; a school column appears only
// when a slot returned a DC for it. While a breakdown is open the table may
// overflow its frame instead of clipping the panel.
function AllowanceTable({ casting }: { casting: Spellcasting }) {
  const schools = [
    ...new Set(
      casting.slots.flatMap((slot) =>
        slot.schoolDCs.map((candidate) => candidate.school),
      ),
    ),
  ];
  const hasKnown = casting.slots.some((slot) => slot.known !== null);
  const hasPrepared = casting.slots.some((slot) => slot.prepared !== null);
  return (
    <div className="-mx-1 min-w-0 overflow-x-auto px-1 has-[[aria-expanded=true]]:overflow-visible">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{casting.name} spell allowances</caption>
        <thead>
          <tr>
            <th scope="col" className={th}>
              Spell level
            </th>
            <th scope="col" className={th}>
              Per day
            </th>
            {hasKnown ? (
              <th scope="col" className={th}>
                Known
              </th>
            ) : null}
            {hasPrepared ? (
              <th scope="col" className={th}>
                Prepared
              </th>
            ) : null}
            <th scope="col" className={th}>
              Save DC
            </th>
            {schools.map((school) => (
              <th key={school} scope="col" className={th}>
                {capitalize(school)} DC
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {casting.slots.map((slot) => {
            const composition = describeComposition(slot);
            return (
              <tr key={slot.spellLevel}>
                <th scope="row" className={cn(td, 'text-left font-mono')}>
                  {formatSpellLevel(slot.spellLevel)}
                </th>
                <td className={td}>
                  <PerDay
                    casting={casting}
                    slot={slot}
                    className="text-base"
                    isReasonShown
                  />
                  {composition ? (
                    <span className="text-muted-foreground block text-xs">
                      {composition}
                    </span>
                  ) : null}
                </td>
                {hasKnown ? (
                  <td className={td}>
                    <Count value={slot.known} />
                  </td>
                ) : null}
                {hasPrepared ? (
                  <td className={td}>
                    <Count value={slot.prepared} />
                  </td>
                ) : null}
                <td className={td}>
                  <SaveDc casting={casting} slot={slot} />
                </td>
                {schools.map((school) => (
                  <td key={school} className={td}>
                    <SaveDc casting={casting} slot={slot} school={school} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Figure({
  label,
  title,
  children,
}: {
  label: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <>
      <dt className={fieldLabel}>{label}</dt>
      <dd
        className="flex flex-wrap items-baseline gap-x-2 text-sm"
        title={title}
      >
        {children}
      </dd>
    </>
  );
}

/** "casting level 5 = Cleric 3 +2 from Mystic Theurge": how advances add up. */
function CastingSum({
  casting,
  features,
}: {
  casting: Spellcasting;
  features: SpellcastingFeaturesView;
}) {
  const pending = features.pendingAdvances;
  return (
    <>
      {casting.advances.length > 0 ? (
        <span className="text-muted-foreground text-xs">
          casting level {casting.castingLevel} = {features.castingSum}
        </span>
      ) : null}
      {pending > 0 ? (
        <span className="text-muted-foreground text-xs">
          {pending} {pending === 1 ? 'advance waits' : 'advances wait'} until{' '}
          {casting.name} can cast.
        </span>
      ) : null}
    </>
  );
}

// The specialist school with its opposition schools, or the outlined prompt
// to choose them. The row only reads: the schools are set on the Arcane
// School class feature row of the sheet, and the copy says so.
function SchoolFigure({ school }: { school: SpellcastingSchoolView }) {
  const opposition = school.oppositionSchools
    .map((candidate) => candidate.label)
    .join(' and ');
  return (
    <Figure label="School">
      <span>{school.school.label}</span>
      <span aria-hidden className="text-muted-foreground/60">
        ·
      </span>
      <span
        className={cn(
          'text-muted-foreground text-xs',
          school.missing && cn(missingChoice, 'px-1 text-sky-300'),
        )}
      >
        {school.missing
          ? 'choose two opposition schools'
          : `opposition ${opposition}`}
      </span>
      <span className="text-muted-foreground basis-full text-xs">
        {school.missing
          ? 'Choose them on the Arcane School class feature.'
          : 'Set on the Arcane School class feature.'}
      </span>
    </Figure>
  );
}

// The sheet's summary already opens these breakdowns, so here the number
// stands alone: the total, the choice it waits for, or an explained dash.
function PlainFigure({
  casting,
  kind,
  value,
  format = String,
}: {
  casting: Spellcasting;
  kind: 'casterLevel' | 'concentration';
  value: number | undefined;
  format?: (total: number) => string;
}) {
  if (value !== undefined)
    return <span className="font-mono">{format(value)}</span>;
  const wait = describeChoiceWait(
    casting.unresolved,
    kind === 'casterLevel'
      ? casterLevelDependencies
      : concentrationDependencies,
  );
  if (wait) return <WaitingValue reason={wait} className="text-sm" />;
  return (
    <span className="font-mono">
      <Dash reason="Not available" />
    </span>
  );
}

/**
 * One Spellcasting's numbers: casting level, caster level, concentration and
 * ability beside its per-level allowance table, every number explained by
 * the shared breakdown. The casting level is the table row; the caster level
 * is what the spells use, offset and Modifiers included. Both are stated so
 * the difference (a paladin's −3, a trait's +1) is visible rather than
 * puzzling. The sheet opens it under a summary line, whose caster level
 * and concentration already open their breakdowns; the Spells page shows it
 * alone for the selected Spellcasting, so there those figures open theirs,
 * and with the Spellcasting's features (#415) it also states how Casting
 * advances make the casting level, the specialist school with its
 * opposition schools (set on the Arcane School class feature row, not here),
 * and the extra slot a domain, school or spirit adds.
 */
export function SpellcastingNumbers({
  casting,
  id,
  isHeadingVisible = true,
  hasFigureBreakdowns = false,
  features = null,
  className = 'border-foreground/10 mt-2 border-t pt-3',
}: {
  casting: Spellcasting;
  id?: string;
  isHeadingVisible?: boolean;
  hasFigureBreakdowns?: boolean;
  features?: SpellcastingFeaturesView | null;
  className?: string;
}) {
  const headingId = useId();
  // #422: an Archetype choice can leave the ability, preparation or list pending.
  const ability = casting.ability ? abilityLabels[casting.ability] : null;
  const preparation = describePreparation(casting);
  const spellList = describeSpellList(casting);
  const hasListChange =
    casting.castingProperties.some((row) => row.key === 'spellList') ||
    casting.spellList.classTag !== casting.classTag;
  const tableWait = describeChoiceWait(casting.unresolved, [
    'presence',
    'table',
  ]);
  const isExtraSlotPending = casting.unresolved.includes('extraSlots');
  const school = features?.school ?? null;
  return (
    <section id={id} aria-labelledby={headingId} className={className}>
      <h3
        id={headingId}
        className={isHeadingVisible ? 'mb-2 font-sans text-base' : 'sr-only'}
      >
        {casting.name} spellcasting
      </h3>
      <div className="grid gap-x-6 gap-y-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5">
          <Figure label="Casting level">
            <span className="font-mono">{casting.castingLevel}</span>
          </Figure>
          <Figure label="Caster level">
            {hasFigureBreakdowns ? (
              <CastingFigure
                casting={casting}
                kind="casterLevel"
                className="min-h-7 text-sm"
              />
            ) : (
              <PlainFigure
                casting={casting}
                kind="casterLevel"
                value={casting.casterLevel?.total}
              />
            )}
            {features ? (
              <CastingSum casting={casting} features={features} />
            ) : null}
            <Provenance
              casting={casting}
              property="casterLevelOffset"
              lead="offset"
            />
          </Figure>
          <Figure label="Concentration">
            {hasFigureBreakdowns ? (
              <CastingFigure
                casting={casting}
                kind="concentration"
                className="min-h-7 text-sm"
              />
            ) : (
              <PlainFigure
                casting={casting}
                kind="concentration"
                value={casting.concentration?.total}
                format={formatModifier}
              />
            )}
          </Figure>
          <Figure label="Casting ability">
            {ability ? (
              <span>{ability}</span>
            ) : (
              <WaitingValue reason={waitingForChoice} className="text-sm" />
            )}
            <Provenance casting={casting} property="ability" />
            {ability ? (
              <span className="text-muted-foreground text-xs">
                Bonus spells use permanent {ability}.
              </span>
            ) : null}
          </Figure>
          <Figure label="Preparation">
            {preparation ? (
              <span>{preparation}</span>
            ) : (
              <WaitingValue reason={waitingForChoice} className="text-sm" />
            )}
            <Provenance casting={casting} property="recording" />
          </Figure>
          {hasListChange ? (
            <Figure label="Spell list">
              {spellList ? (
                <span>{spellList}</span>
              ) : (
                <WaitingValue reason={waitingForChoice} className="text-sm" />
              )}
              <Provenance casting={casting} property="spellList" />
            </Figure>
          ) : null}
          {school ? <SchoolFigure school={school} /> : null}
          {isExtraSlotPending ? (
            <Figure label="Extra slot">
              <WaitingValue
                reason="Waiting for the extra slots choice"
                className="text-sm"
              />
            </Figure>
          ) : features && features.extraSlots.length > 0 ? (
            <Figure label="Extra slot">
              {features.extraSlots.map((slot) => (
                <span key={slot.kind} className="font-mono">
                  {slot.label}
                </span>
              ))}
              <span className="text-muted-foreground text-xs">
                per level from 1st
              </span>
            </Figure>
          ) : null}
        </dl>
        {casting.slots.length === 0 ? (
          <p className="text-muted-foreground self-center text-sm">
            {tableWait ??
              `No spells yet: the ${casting.name.toLowerCase()} table starts later.`}
          </p>
        ) : (
          <AllowanceTable casting={casting} />
        )}
      </div>
    </section>
  );
}
