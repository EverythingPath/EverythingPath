import { warningChecks } from '~/lib/character-sheet';
import type { describeClassSwitch } from '~/lib/character-sheet-class-switch';
import { formatModifier, unresolvedValue } from './sheet-parts';
import type { SheetWarningView } from './use-character-sheet';

// The words of a class version switch (#583): how a version is named by
// where it lives, what a changed total reads as, and how an accepted
// warning is named once it no longer exists on the sheet.

export type ClassSwitchDescription = ReturnType<typeof describeClassSwitch>;
export type ClassSwitchStatistic = ClassSwitchDescription['statistics'][number];
export type ClassSwitchWarningKey =
  ClassSwitchDescription['keptWarnings'][number];

type VersionChoice = {
  name: string;
  scope: 'global' | 'campaign' | 'character';
  isCampaignPreference: boolean;
};

/** "Fighter (campaign)", "Fighter (this Character)" or "Fighter". */
export function versionLabel(choice: VersionChoice) {
  if (choice.scope === 'campaign') return `${choice.name} (campaign)`;
  if (choice.scope === 'character') return `${choice.name} (this Character)`;
  return choice.name;
}

/** The muted origin beside a version's name; nothing for a global one. */
export function versionOrigin(choice: VersionChoice) {
  if (choice.scope === 'campaign')
    return choice.isCampaignPreference ? 'campaign version' : 'campaign';
  if (choice.scope === 'character') return 'this Character';
  return null;
}

const statisticLabels: Record<ClassSwitchStatistic['key'], string> = {
  bab: 'BAB',
  fortitude: 'Fort',
  reflex: 'Ref',
  will: 'Will',
  hp: 'HP',
};

function statisticValue(
  key: ClassSwitchStatistic['key'],
  value: number | null,
) {
  if (value === null) return unresolvedValue;
  return key === 'hp' ? String(value) : formatModifier(value);
}

/** "BAB +2 → +1", "HP 22 → 24". */
export function statisticText(statistic: ClassSwitchStatistic) {
  const { key, before, after } = statistic;
  return `${statisticLabels[key]} ${statisticValue(key, before)} → ${statisticValue(key, after)}`;
}

type WarningCheck = (typeof warningChecks)[number];
const isWarningCheck = (check: string): check is WarningCheck =>
  warningChecks.some((known) => known === check);

// A cleared warning no longer exists, so it is named by its check.
const checkLabels: Partial<Record<WarningCheck, string>> = {
  hpGainedAboveMaximum: 'Hit points above the Hit Die maximum',
  hpGainedBelowMinimum: 'Hit points below the Hit Die minimum',
  firstLevelHpNotMaximum: 'First level hit points below the maximum',
  featDuplicate: 'Feat taken more than once',
  traitDuplicate: 'Trait taken more than once',
  favoredClassBonusNotFavored: 'Favored class bonus on another class',
  skillRankCap: 'Skill ranks above the level',
  classVersions: 'Original and Unchained versions both present',
};

/** The warning as the sheet states it while it exists, else by its check. */
export function warningName(
  warnings: readonly SheetWarningView[],
  key: ClassSwitchWarningKey,
) {
  const warning = warnings.find(
    (candidate) =>
      candidate.check === key.check && candidate.subject === key.subject,
  );
  const name =
    warning?.message ??
    (isWarningCheck(key.check) ? checkLabels[key.check] : undefined) ??
    key.check;
  return name.replace(/\.$/, '');
}

export function keptLevelsText(count: number, className: string) {
  if (count === 1)
    return `The ${className} level keeps its hit points, skill ranks, favored class bonus, ability increase and choices.`;
  return `All ${count} ${className} levels keep their hit points, skill ranks, favored class bonuses, ability increases and choices.`;
}

export function dormantKeptText(count: number) {
  if (count === 1)
    return 'Kept with its choices and notes; it counts again if you switch back.';
  return 'Kept with their choices and notes; they count again if you switch back.';
}

export function keptWarningsText(count: number) {
  return count === 1
    ? '1 accepted warning stays accepted'
    : `${count} accepted warnings stay accepted`;
}
