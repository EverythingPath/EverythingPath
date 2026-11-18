'use client';
import { formatCriticalRange } from '~/lib/character-sheet-attacks';
import { cn } from '~/lib/utils';
import { useBreakdownResolver } from './breakdown-resolver';
import { formatSigned } from './equipment-statistics';
import {
  describeExtraDice,
  extraDamageKey,
  sortExtraDamage,
  type ShownExtraDamage,
} from './extra-damage';
import { chip, fieldLabel } from './sheet-parts';
import { SheetStatistic } from './sheet-statistic';
import { BreakdownExplanation } from './stat-breakdown-content';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Row = Controller['attacks']['rows'][number];
type Line = Row['singleView'][number];
type Rend = NonNullable<Row['rendView']>;
type Flurry = NonNullable<Row['flurry']>;

const flurryVersionLabels = { core: 'Core', unchained: 'Unchained' } as const;

// Touch-sized on the phone, compact beside the text from 768px.
const number = 'min-h-11 text-sm md:min-h-8';

const formatMultiplier = (multiplier: number) => `×${multiplier}`;
const formatRange = (feet: number) => `${feet} ft.`;
const formatPlain = (value: number) => String(value);

/**
 * The weapon and dice the damage total stands on, above its bonuses, then
 * the Item Ability dice that join it, credited to their ability, with
 * burst dice marked for a critical hit. A Vital Strike says which dice it
 * multiplied, and that the extra dice stay out of a critical hit.
 */
function DamageDice({
  damage,
  vitalStrike,
  extraDamage,
}: {
  damage: Line['damage'];
  vitalStrike: Line['vitalStrike'];
  extraDamage: readonly ShownExtraDamage[];
}) {
  const parts = extraDamage.map(({ part }) => part);
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          {damage.diceSource.entryName}
        </span>
        <span className="text-muted-foreground font-mono text-[11px]">
          damage dice
        </span>
        <span className="font-mono">{damage.dice}</span>
      </div>
      {damage.damageType ? (
        <p className="text-muted-foreground text-xs">{damage.damageType}</p>
      ) : null}
      {extraDamage.map(({ part, isPreviewed }) => (
        <div
          key={extraDamageKey(part, parts)}
          className={cn(
            'flex items-baseline gap-2',
            isPreviewed && 'text-sky-300',
          )}
        >
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            {part.source}
          </span>
          <span className="text-muted-foreground font-mono text-[11px]">
            {part.critical ? 'on a critical hit' : 'extra dice'}
          </span>
          <span className="font-mono">{part.text}</span>
        </div>
      ))}
      {vitalStrike ? (
        <p className="text-muted-foreground text-xs">
          {vitalStrike.label}: extra dice are not multiplied on a critical hit.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Two-Weapon Rend after a two-weapon full attack (#407): its name, its damage
 * as a breakdown of the resolver's own Rend statistic, and when it applies.
 * It has no attack bonus and no critical, and never joins the single attack.
 */
export function AttackRendLine({
  rend,
  routineName,
}: {
  rend: Rend;
  routineName: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-0.5 text-sm">
      <span className="flex min-w-0 flex-1 basis-24 flex-wrap items-center gap-x-1.5 leading-tight">
        <span className="min-w-0 [overflow-wrap:anywhere]">{rend.label}</span>
        <span className="text-muted-foreground min-w-0 text-xs [overflow-wrap:anywhere]">
          {rend.note}
        </span>
      </span>
      <span className="ml-auto flex items-center">
        <SheetStatistic
          label={`${routineName} ${rend.label}: damage`}
          statistic={rend.statistic}
          target={rend.target}
          format={() => rend.text}
          className={number}
        />
      </span>
    </div>
  );
}

/**
 * The flurry of blows heading a full attack (#414): the class feature's
 * name and version, the base attack bonus its attacks use as a breakdown of
 * the resolver's flurry statistic (a core flurry substitutes the monk level
 * for the monk's own, FAQ naz), and the core −2 on every attack. Its own
 * block above the numbered lines, so it wraps without moving their columns.
 */
export function AttackFlurryLine({
  flurry,
  routineName,
  entryId,
}: {
  flurry: Flurry;
  routineName: string;
  entryId: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-0.5 text-sm">
      <span className="flex min-w-0 flex-1 basis-24 flex-wrap items-center gap-x-1.5 leading-tight">
        <span className="min-w-0 [overflow-wrap:anywhere]">{flurry.name}</span>
        <span className={cn(chip, 'text-primary')}>
          {flurryVersionLabels[flurry.version]}
        </span>
        {flurry.attackPenalty === 0 ? null : (
          <span className="text-muted-foreground min-w-0 text-xs [overflow-wrap:anywhere]">
            {formatSigned(flurry.attackPenalty)} on every attack
          </span>
        )}
      </span>
      <span className="ml-auto inline-flex items-center gap-1">
        <span aria-hidden className={fieldLabel}>
          BAB
        </span>
        <SheetStatistic
          label={`${routineName} ${flurry.name}: base attack bonus`}
          statistic={flurry.baseAttackBonus}
          target={{ kind: 'flurryBaseAttack', entryId }}
          format={formatSigned}
          className={number}
          alternates={{}}
        />
      </span>
    </div>
  );
}

/** A rule's mark on one line: the extra attack it gives or the arrows it fires. */
function RuleTag({
  children,
  srPrefix,
  className,
}: {
  children: string;
  /** Read before the visible text: "extra attack from Haste". */
  srPrefix?: string;
  className?: string;
}) {
  return (
    <span className={cn(chip, className)}>
      {srPrefix ? <span className="sr-only">{srPrefix} </span> : null}
      {children}
    </span>
  );
}

/**
 * One attack of a routine (approved prototype's attack line): its place in
 * the full attack, the weapon, and the attack bonus, damage, critical
 * threat and multiplier, and range increment as numbers that explain
 * themselves, each followed by what it becomes in a Situation of this
 * line's own. Damage reads as dice plus its bonus, in the line and in its
 * breakdown, with the dice credited to their weapon. In a two-weapon full
 * attack each line names its hand, and a double weapon's second end says so.
 * A ranged line names its launcher and the ammunition it fires, and shows
 * the resolver's range penalty beside the increment when the routine shoots
 * beyond the first.
 * A natural attack always says whether it is primary or secondary, and an
 * unarmed strike whether its damage is nonlethal, in words. A rule's extra
 * attack (Haste, Rapid Shot, Medusa's Wrath, a flurry of blows), Manyshot's arrows and a Vital
 * Strike are tags after the weapon name (#407); their numbers are already in
 * the line's statistics. Item Ability dice (#408) follow the damage: always-on
 * dice as "plus 1d6 fire", burst dice as a critical-hit note, and Situational
 * dice only once their Situation is picked, marked as previewed; until then
 * the damage carries the Situation marker and its breakdown lists them under
 * "Only when…".
 */
export function AttackLine({
  line,
  routineName,
  sequence,
  count,
  isHandShown = line.hand === 'off',
}: {
  line: Line;
  routineName: string;
  sequence: 'single' | 'full';
  count: number;
  /** Names the hand (and end) the attack is made with: two-weapon sequences. */
  isHandShown?: boolean;
}) {
  const label = line.roleLabel ?? (isHandShown ? line.positionLabel : null);
  const which =
    sequence === 'single'
      ? 'single attack'
      : `full attack ${line.position} of ${count}`;
  const hand = label
    ? [label, line.endLabel]
        .filter((label) => label !== null)
        .join(', ')
        .toLowerCase()
    : null;
  const name = `${routineName} ${which}${hand ? `, ${hand}` : ''}`;
  const formatDamage = (bonus: number) =>
    `${line.damage.dice}${bonus === 0 ? '' : formatSigned(bonus)}`;
  const resolver = useBreakdownResolver();
  const dice = sortExtraDamage(line.extraDamage, resolver.selected.selections);
  const situationalDice = line.extraDamage.flatMap((part) =>
    part.situation === null
      ? []
      : [
          {
            situation: part.situation,
            sheetEntryId: part.sheetEntryId,
            text: part.text,
            source: part.source,
          },
        ],
  );
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-0.5 text-sm">
      {line.position === null ? null : (
        <span
          aria-hidden
          className="text-muted-foreground w-3 shrink-0 text-right font-mono text-xs"
        >
          {line.position}
        </span>
      )}
      <span className="flex min-w-0 flex-1 basis-24 flex-wrap items-center gap-x-1.5 leading-tight">
        <span className="min-w-0 [overflow-wrap:anywhere]">
          {line.weaponName}
        </span>
        {line.extraAttack ? (
          <RuleTag srPrefix="extra attack from" className="text-primary">
            {line.extraAttack.label}
          </RuleTag>
        ) : null}
        {line.projectilesLabel ? (
          <RuleTag>{line.projectilesLabel}</RuleTag>
        ) : null}
        {line.vitalStrike ? (
          <span
            className={cn(chip, 'text-primary')}
            title={`${line.vitalStrike.label} (${line.vitalStrike.weaponDice} ×${line.vitalStrike.multiplier})`}
          >
            {line.vitalStrike.label}
            <span className="sr-only">
              {' '}
              ({line.vitalStrike.weaponDice} ×{line.vitalStrike.multiplier})
            </span>
          </span>
        ) : null}
        {label ? (
          <span
            className={cn(
              chip,
              line.hand === 'off' &&
                line.attackKind !== 'natural' &&
                'text-primary',
              line.naturalRole === 'secondary' && 'text-muted-foreground',
            )}
          >
            {label}
          </span>
        ) : null}
        {line.damageKindLabel ? (
          <span className={cn(chip, 'text-muted-foreground')}>
            {line.damageKindLabel}
          </span>
        ) : null}
        {line.endLabel ? <span className={chip}>{line.endLabel}</span> : null}
        {line.mode === 'melee' ? null : (
          <span className={chip}>
            {line.mode === 'thrown' ? 'Thrown' : 'Ranged'}
          </span>
        )}
        {line.ammunitionName ? (
          <span className="text-muted-foreground min-w-0 text-xs [overflow-wrap:anywhere]">
            <span className="sr-only">with </span>
            {line.ammunitionName}
          </span>
        ) : null}
      </span>
      <span className="ml-auto flex flex-wrap items-center justify-end gap-x-1">
        <SheetStatistic
          label={`${name}: attack`}
          statistic={line.attack.statistic}
          target={line.attack.target}
          format={formatSigned}
          className={number}
          alternates={{}}
        />
        <SheetStatistic
          label={`${name}: damage`}
          statistic={line.damage.statistic}
          target={line.damage.target}
          format={formatDamage}
          lead={
            <DamageDice
              damage={line.damage}
              vitalStrike={line.vitalStrike}
              extraDamage={[...dice.hit, ...dice.critical]}
            />
          }
          isMarked={dice.situational.length > 0}
          explanation={
            situationalDice.length > 0 ? (
              <BreakdownExplanation
                statistic={line.damage.statistic}
                target={line.damage.target}
                format={formatDamage}
                situationalDice={situationalDice}
              />
            ) : undefined
          }
          className={number}
          alternates={{}}
        />
        {dice.hit.map(({ part, isPreviewed }) => (
          <span
            key={extraDamageKey(part, line.extraDamage)}
            className={cn(
              'inline-flex items-baseline gap-1 font-mono text-sm',
              isPreviewed && 'bg-sky-400/15 px-1 text-sky-300',
            )}
          >
            <span className="text-muted-foreground text-xs">plus </span>
            {describeExtraDice(part)}
            {isPreviewed ? <span className="sr-only">, previewed</span> : null}
          </span>
        ))}
        {dice.critical.length > 0 ? (
          <span
            className={cn(
              'text-muted-foreground text-xs',
              dice.critical.some(({ isPreviewed }) => isPreviewed) &&
                'text-sky-300',
            )}
          >
            ({dice.critical.map(({ part }) => part.text).join(', ')})
          </span>
        ) : null}
        <SheetStatistic
          label={`${name}: critical threat`}
          statistic={line.critical.threat.statistic}
          target={line.critical.threat.target}
          format={formatCriticalRange}
          formatContribution={formatPlain}
          className={number}
          alternates={{}}
        >
          {(threat, threatTotals) => (
            <SheetStatistic
              label={`${name}: critical multiplier`}
              statistic={line.critical.multiplier.statistic}
              target={line.critical.multiplier.target}
              format={formatMultiplier}
              formatContribution={formatMultiplier}
              className={number}
              alternates={{}}
            >
              {(multiplier, multiplierTotals) => (
                <>
                  <span className="inline-flex items-center">
                    {threat}
                    <span
                      aria-hidden
                      className="text-muted-foreground font-mono text-xs"
                    >
                      /
                    </span>
                    {multiplier}
                  </span>
                  {threatTotals}
                  {multiplierTotals}
                </>
              )}
            </SheetStatistic>
          )}
        </SheetStatistic>
        {line.range ? (
          <span className="inline-flex items-center gap-1">
            <span aria-hidden className={fieldLabel}>
              range
            </span>
            <SheetStatistic
              label={`${name}: range increment`}
              statistic={line.range.statistic}
              target={line.range.target}
              format={formatRange}
              formatContribution={formatRange}
              className={number}
              alternates={{}}
            />
            {line.range.penaltyText ? (
              <span className="font-mono text-sm text-amber-300">
                <span className="sr-only">range penalty </span>
                {line.range.penaltyText}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
    </li>
  );
}
