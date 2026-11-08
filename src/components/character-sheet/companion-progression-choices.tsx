'use client';
import { abilityLabels } from '~/lib/character-sheet';
import type { AnimalCompanionProgressionState } from '~/lib/character-sheet-companion-progression';
import {
  canonicalSkillKey,
  skillDefinitions,
} from '~/lib/character-sheet-skills';
import { fieldLabel } from './sheet-parts';

function skillName(key: string) {
  const skill = canonicalSkillKey(key);
  return skillDefinitions.find((definition) => definition.key === skill)?.name;
}

/**
 * What the players recorded for the Companion, as recorded: its hit points
 * (or that they are not recorded yet), skill ranks and ability increases.
 * They stay listed whether or not any source counts. The eidolon (#409)
 * lists the same three.
 */
export function CompanionProgressionChoices({
  choices,
}: {
  choices: Pick<
    AnimalCompanionProgressionState,
    'hpGained' | 'skillRanks' | 'abilityIncreases'
  >;
}) {
  const ranks = Object.entries(choices.skillRanks).map(([key, value]) => ({
    key,
    label: skillName(key) ?? 'Other skill',
    value,
  }));
  const rows = [
    {
      label: 'Hit points gained',
      value:
        choices.hpGained === null
          ? 'Not recorded yet'
          : String(choices.hpGained),
    },
    {
      label: 'Skill ranks',
      value: ranks.length
        ? ranks.map((rank) => `${rank.label} ${rank.value}`).join(', ')
        : 'None recorded',
    },
    {
      label: 'Ability increases',
      value: choices.abilityIncreases.length
        ? choices.abilityIncreases
            .map((ability) => abilityLabels[ability])
            .join(', ')
        : 'None recorded',
    },
  ];
  return (
    <dl aria-label="Recorded choices" className="flex flex-col gap-1">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
        >
          <dt className={fieldLabel}>{row.label}</dt>
          <dd className="text-sm [overflow-wrap:anywhere]">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
