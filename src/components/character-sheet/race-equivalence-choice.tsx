'use client';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import type { RacialChoiceRowView } from './character-sheet-races-view-model';
import { ChoiceSelect, type ChoiceOption } from './choice-select';
import { chip, SaveFeedback } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;

/** Race names for Rule Identities; an identity without a definition stays unnamed. */
function listRaceEquivalenceOptions(
  identities: readonly string[],
  raceNames: Record<string, string>,
): ChoiceOption[] {
  return identities.map((identity) => ({
    value: identity,
    label: raceNames[identity] ?? 'Unavailable race',
  }));
}

/**
 * Which race an entry counts as, among the races its definition allows.
 * The choice is stored as the race's identity; the control speaks in names.
 */
export function RaceEquivalenceChoice({
  row,
  raceNames,
  actions,
  showsName = false,
}: {
  row: RacialChoiceRowView;
  /** Each race's name by its Rule Identity. */
  raceNames: Record<string, string>;
  actions: Controller['races'];
  /** Outside its own row, the entry's name introduces the control. */
  showsName?: boolean;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const status = actions.statusFor(row.rowId);
  const isDisabled = status.kind === 'saving' || maintenance.readOnly;
  const options = listRaceEquivalenceOptions(row.raceChoices, raceNames);
  const choice =
    row.choice !== null && row.raceChoices.includes(row.choice)
      ? row.choice
      : '';
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
      {showsName ? (
        <span className="font-sans text-sm [overflow-wrap:anywhere]">
          {row.name}
        </span>
      ) : null}
      <span className="text-muted-foreground text-xs">counts as</span>
      <ChoiceSelect
        label={showsName ? `${row.name} counts as race` : 'Counts as race'}
        value={choice}
        options={options}
        emptyLabel="Choose race"
        isMissing={row.counting && choice === ''}
        isDim={!row.counting}
        disabled={isDisabled}
        className="w-48"
        onValueChange={(value) => {
          if (isDisabled) return;
          void actions.chooseRaceEquivalence(
            row.target,
            value === '' ? null : value,
            row.rowId,
          );
        }}
      />
      {row.counting ? null : <span className={chip}>Not counting now</span>}
      <SaveFeedback
        status={status}
        savedText="Race equivalence saved."
        savingText="Saving…"
        shouldHideWhenIdle
      />
    </div>
  );
}
