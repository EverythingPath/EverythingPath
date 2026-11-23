'use client';
import type { ResolvedStatistic, Situation } from '~/lib/character-sheet';
import type { CharacterSheetBreakdownTarget } from '~/lib/character-sheet-breakdowns';
import { cn } from '~/lib/utils';
import { describeSituation } from './modifier-labels';
import { BreakdownContributions } from './breakdown-contributions';
import { BreakdownLine, contributionKey } from './breakdown-line';
import { BreakdownNotes } from './breakdown-notes';
import { useBreakdownResolver } from './breakdown-resolver';
import { CombatSituations } from './combat-situations';
import { SelectedSituationsSection } from './selected-situations-section';
import { fieldLabel } from './sheet-parts';
import { SituationDiceLines, type SituationDice } from './situation-dice-lines';
import { SituationPreview } from './situation-preview';
import { SituationMarker } from './situation-marker';
import { extraDamageSituationKey } from './extra-damage';
import {
  describeContributionScope,
  describePrerequisite,
  listPrerequisiteContributions,
} from './stat-breakdown-groups';
import { useSituationBreakdown } from './use-situation-breakdown';

/** A leaf breakdown, a derived statistic, or one class's casting number. */
export type BreakdownTarget = CharacterSheetBreakdownTarget;

/** Item Ability dice that apply only in a Situation of their item (#408). */
export type SituationalDice = SituationDice & {
  situation: Situation;
  sheetEntryId: string;
};

// Each Situation's dice, keyed as the statistic's own groups are, so bane's
// dice join its +2 under "vs. undead" and holy's stand alone under "vs. evil".
function groupSituationalDice(dice: readonly SituationalDice[]) {
  const byKey = new Map<
    string,
    { situation: Situation; dice: SituationDice[] }
  >();
  for (const part of dice) {
    const key = extraDamageSituationKey(part.situation, part.sheetEntryId);
    const group = byKey.get(key) ?? { situation: part.situation, dice: [] };
    group.dice.push({ text: part.text, source: part.source });
    byKey.set(key, group);
  }
  return byKey;
}

/**
 * Why a number is what it is: every applied contribution, built-ins
 * included; what stacking set aside and why; its rules that change no
 * number; what the picked Situations make it; then "Only when…" with what
 * the number becomes in each Situation, the Combat situations collapsed
 * below them, what waits on another entry, and what belongs to another
 * weapon, routine or casting. Every total is the resolver's own answer.
 */
export function BreakdownExplanation({
  statistic,
  target,
  format = String,
  formatContribution,
  situationalDice = [],
}: {
  statistic: ResolvedStatistic;
  /** Without a sheet statistic to preview, Situations are not listed. */
  target?: BreakdownTarget;
  format?: (total: number) => string;
  formatContribution?: (value: number) => string;
  /** Dice that join the number only in a Situation, listed under "Only when…". */
  situationalDice?: readonly SituationalDice[];
}) {
  const resolver = useBreakdownResolver();
  const view = useSituationBreakdown(statistic, target);
  const dice = groupSituationalDice(situationalDice);
  const diceOnly = view
    ? [...dice.entries()].filter(
        ([key]) => !view.groups.some((group) => group.key === key),
      )
    : [];
  const waiting = view?.waiting ?? listPrerequisiteContributions(statistic);
  const excluded = view?.excluded ?? statistic.excluded ?? [];
  const notes =
    view?.notes ??
    (statistic.notes ?? []).filter(
      (note) => (note.situation ?? note.condition?.situation) === undefined,
    );
  return (
    <>
      <BreakdownContributions
        statistic={statistic}
        formatContribution={formatContribution}
      />
      {notes.length > 0 ? (
        <div className="border-foreground/15 mt-2 border-t pt-2">
          <p className={cn(fieldLabel, 'mb-1')}>Rules</p>
          <BreakdownNotes notes={notes} className="text-xs" />
        </div>
      ) : null}
      {view ? (
        <SelectedSituationsSection
          selected={view.selected}
          format={format}
          formatContribution={formatContribution}
        />
      ) : null}
      {view && (view.groups.length > 0 || diceOnly.length > 0) ? (
        <div className="border-foreground/15 mt-2 border-t pt-2">
          <p className={cn(fieldLabel, 'mb-1')}>Only when…</p>
          <ul className="space-y-2">
            {view.groups.map((group) => (
              <SituationPreview
                key={group.key}
                group={group}
                format={format}
                formatContribution={formatContribution}
                dice={dice.get(group.key)?.dice}
              />
            ))}
            {diceOnly.map(([key, group]) => (
              <li key={key}>
                <span className="flex min-w-0 items-baseline gap-1.5 text-sky-300">
                  <SituationMarker
                    isDecorative
                    className="relative top-0 shrink-0 self-center"
                  />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {describeSituation(group.situation)}
                  </span>
                </span>
                <SituationDiceLines dice={group.dice} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {view ? (
        <CombatSituations
          groups={view.combatGroups}
          format={format}
          formatContribution={formatContribution}
        />
      ) : null}
      {waiting.length > 0 ? (
        <div className="border-foreground/15 mt-2 border-t pt-2">
          <p className={cn(fieldLabel, 'mb-1')}>Waiting</p>
          <ul className="space-y-0.5">
            {waiting.map((item, index) => (
              <BreakdownLine
                key={contributionKey(item, index)}
                contribution={item}
                className="text-muted-foreground"
                format={formatContribution}
                detail={describePrerequisite(
                  item,
                  resolver.findPrerequisiteName,
                  resolver.findCastingClassName,
                )}
              />
            ))}
          </ul>
        </div>
      ) : null}
      {excluded.length > 0 ? (
        <div className="border-foreground/15 mt-2 border-t pt-2">
          <p className={cn(fieldLabel, 'mb-1')}>Outside this scope</p>
          <ul className="space-y-0.5">
            {excluded.map((item, index) => (
              <BreakdownLine
                key={contributionKey(item, index)}
                contribution={item}
                className="text-muted-foreground"
                format={formatContribution}
                detail={
                  describeContributionScope(
                    item,
                    resolver.findCastingClassName,
                  ) ?? 'only elsewhere on the sheet'
                }
              />
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
