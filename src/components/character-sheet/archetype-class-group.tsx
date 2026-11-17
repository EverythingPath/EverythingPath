'use client';
import { useId } from 'react';
import { ArchetypeCard } from './archetype-card';
import { ArchetypeCastingChoices } from './archetype-casting-choices';
import type { SpellNames } from './archetype-casting-view-model';
import type {
  ArchetypeClassView,
  ArchetypeGrantProps,
  ArchetypesController,
  FeatureNames,
} from './character-sheet-archetypes-view-model';
import { chip } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;

/**
 * One class's Archetypes: chosen for the class as a whole, never for a
 * single Class Level, as cards that stack on the phone and sit side by side
 * from the tablet, and under them the casting conflicts its Archetypes
 * leave to the player (#422).
 */
export function ArchetypeClassGroup({
  group,
  featureNames,
  spellNames = {},
  grantProps,
  actions,
  warnings,
  warningController,
}: {
  group: ArchetypeClassView;
  featureNames: FeatureNames;
  /** Spell names for per-Spell casting conflicts, from the sheet's catalog. */
  spellNames?: SpellNames;
  grantProps: ArchetypeGrantProps;
  actions: ArchetypesController;
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
}) {
  const headingId = useId();
  const classLevel = group.calculated?.classLevel ?? 0;
  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-1.5"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h3 id={headingId} className="font-sans text-base">
          {group.name}
        </h3>
        {classLevel > 0 ? (
          <span className={chip}>Level {classLevel}</span>
        ) : null}
        <p className="text-muted-foreground text-xs">
          Applies to all {group.name} levels
        </p>
      </div>
      {group.options.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No Archetypes available for this class.
        </p>
      ) : (
        <ul
          aria-label={`${group.name} Archetypes`}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
        >
          {group.options.map((option) => (
            <ArchetypeCard
              key={option.definition._id}
              group={group}
              option={option}
              featureNames={featureNames}
              grantProps={grantProps}
              actions={actions}
              warnings={warnings}
              warningController={warningController}
            />
          ))}
        </ul>
      )}
      <ArchetypeCastingChoices
        group={group}
        spellNames={spellNames}
        actions={actions}
        warnings={warnings}
        warningController={warningController}
      />
    </div>
  );
}
