'use client';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Checkbox } from '~/components/ui/checkbox';
import { cn } from '~/lib/utils';
import type { RacialTraitOptionView } from './character-sheet-races-view-model';
import { chip, fieldLabel, SaveFeedback } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;

// A playing-card choice: lifts on hover unless motion is reduced, marks
// itself when checked, and names what it replaces under its name.
const optionCard =
  'border-foreground/40 has-checked:border-primary has-focus-visible:ring-ring/50 flex min-h-11 cursor-pointer items-start gap-2 border px-2.5 py-1.5 text-sm transition-[transform,box-shadow] has-checked:shadow-xs has-focus-visible:ring-[3px] has-disabled:cursor-not-allowed has-disabled:opacity-50 motion-safe:hover:-translate-y-px motion-safe:hover:shadow-sm md:min-h-8';

type OptionGroup = {
  key: string;
  subrace: string | null;
  isApplicable: boolean;
  options: RacialTraitOptionView[];
};

/** Applicable options first, each subrace's independent options together. */
export function groupTraitOptions(
  options: RacialTraitOptionView[],
): OptionGroup[] {
  const groups = new Map<string, OptionGroup>();
  for (const isApplicable of [true, false]) {
    for (const option of options) {
      if (option.applicable !== isApplicable) continue;
      const key = `${isApplicable ? 'race' : 'other'}:${option.subrace ?? ''}`;
      const group = groups.get(key) ?? {
        key,
        subrace: option.subrace,
        isApplicable,
        options: [],
      };
      group.options.push(option);
      groups.set(key, group);
    }
  }
  return [...groups.values()];
}

/** The standards an option replaces: the linked ones, else the named ones. */
function describeReplacements(option: RacialTraitOptionView) {
  const names = option.replacementNames.length
    ? option.replacementNames
    : option.unresolvedReplacements;
  return names.length ? names.join(', ') : null;
}

function describeGroup(group: OptionGroup) {
  if (group.subrace) return `${group.subrace} · each option chosen on its own`;
  return group.isApplicable ? null : 'Other races';
}

function TraitOptionCard({
  option,
  actions,
}: {
  option: RacialTraitOptionView;
  actions: Controller['races'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const status = actions.statusFor(option.catalogEntryId);
  const isDisabled = status.kind === 'saving' || maintenance.readOnly;
  const isMuted = !option.applicable || (option.selected && option.dormant);
  const replacedNames = describeReplacements(option);
  return (
    <li className="flex flex-col gap-0.5">
      <label className={cn(optionCard, isMuted && 'text-muted-foreground')}>
        <Checkbox
          className="mt-0.5"
          checked={option.selected}
          disabled={isDisabled}
          aria-label={`${option.name} selected`}
          aria-describedby={reasonId}
          onCheckedChange={(isChecked) => {
            if (isDisabled) return;
            void actions.setTraitSelected(option.catalogEntryId, isChecked);
          }}
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-sans [overflow-wrap:anywhere]">
              {option.name}
            </span>
            {option.selected && option.dormant ? (
              <span className={cn(chip, 'text-muted-foreground')}>
                Not counting now
              </span>
            ) : null}
          </span>
          {replacedNames ? (
            <span className="text-muted-foreground text-xs [overflow-wrap:anywhere]">
              Replaces {replacedNames}
            </span>
          ) : null}
          {option.applicable ? null : (
            <span className="text-xs text-amber-300">
              Belongs to another race
            </span>
          )}
        </span>
      </label>
      <SaveFeedback
        status={status}
        savedText={option.selected ? 'Trait selected.' : 'Trait deselected.'}
        savingText="Saving…"
        shouldHideWhenIdle
      />
    </li>
  );
}

/**
 * Alternate racial traits as playing cards: the selected race's own first,
 * a subrace's options grouped under its name without choosing one another,
 * then traits of other races, which stay selectable but dormant. Checking
 * selects, unchecking deselects; nothing here deletes a Selection.
 */
export function RacialTraitOptions({
  options,
  actions,
}: {
  options: RacialTraitOptionView[];
  actions: Controller['races'];
}) {
  const groups = groupTraitOptions(options);
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className={cn(fieldLabel, 'mb-1')}>
        Alternate racial traits
      </legend>
      {groups.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No alternate racial traits available.
        </p>
      ) : (
        groups.map((group) => {
          const description = describeGroup(group);
          return (
            <div key={group.key} className="flex flex-col gap-1">
              {description ? (
                <p className="text-muted-foreground text-xs">{description}</p>
              ) : null}
              <ul
                aria-label={
                  group.subrace ??
                  (group.isApplicable
                    ? 'Alternate racial traits'
                    : 'Traits of other races')
                }
                className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3"
              >
                {group.options.map((option) => (
                  <TraitOptionCard
                    key={option.catalogEntryId}
                    option={option}
                    actions={actions}
                  />
                ))}
              </ul>
            </div>
          );
        })
      )}
    </fieldset>
  );
}
