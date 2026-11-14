import {
  familiarBaseCreatureKeySchema,
  representativeFamiliars,
} from '~/lib/catalog/representative-familiars';
import type { FamiliarFacts } from '~/lib/character-sheet-familiar';

export function buildCharacterSheetFamiliarView({
  baseCreatureKey,
  current,
  permanent,
}: {
  baseCreatureKey: string | null | undefined;
  current: FamiliarFacts | null;
  permanent: FamiliarFacts | null;
}) {
  const selected = familiarBaseCreatureKeySchema.safeParse(baseCreatureKey);
  const statistics = [
    {
      key: 'actualHitDice',
      label: 'Actual Hit Dice',
      current: current?.actualHitDice,
      permanent: permanent?.actualHitDice,
      description: 'The creature’s actual Hit Dice, used for militia roles.',
    },
    {
      key: 'effectiveHitDice',
      label: 'Effective Hit Dice',
      current: current?.effectiveHitDice,
      permanent: permanent?.effectiveHitDice,
      description: 'Used for effects that depend on Hit Dice.',
    },
    {
      key: 'progressionLevel',
      label: 'Familiar progression level',
      current: current?.progression?.level,
      permanent: permanent?.progression?.level,
      description: 'Combines the compatible familiar-granting Class Levels.',
    },
    {
      key: 'maximumHp',
      label: 'Hit points from master',
      current: current?.maximumHp,
      permanent: permanent?.maximumHp,
      description:
        'Half the master’s maximum hit points, rounded down. Temporary hit points are excluded.',
    },
    {
      key: 'baseAttackBonus',
      label: 'Class-derived base attack bonus',
      current: current?.baseAttackBonus,
      permanent: permanent?.baseAttackBonus,
      description: 'Uses the master’s class-derived base attack bonus.',
    },
    {
      key: 'naturalArmor',
      label: 'Natural armor adjustment',
      current: current?.progression?.naturalArmor,
      permanent: permanent?.progression?.naturalArmor,
      description: 'The familiar progression’s natural armor adjustment.',
    },
    {
      key: 'intelligence',
      label: 'Familiar Intelligence',
      current: current?.progression?.intelligence,
      permanent: permanent?.progression?.intelligence,
      description: 'The Intelligence score supplied by familiar progression.',
    },
    ...(['fort', 'ref', 'will'] as const).map((save) => ({
      key: `baseSave.${save}`,
      label: `${{ fort: 'Fortitude', ref: 'Reflex', will: 'Will' }[save]} base save`,
      current: current?.baseSaves[save],
      permanent: permanent?.baseSaves[save],
      description:
        'The better of the creature’s base save and the master’s class-derived base save.',
    })),
  ].map(({ current, permanent, ...statistic }) => ({
    ...statistic,
    valueLabel: current == null ? 'Unresolved' : String(current),
    permanentValueLabel: permanent == null ? 'Unresolved' : String(permanent),
    hasTemporaryChange: (current ?? null) !== (permanent ?? null),
  }));

  return {
    baseCreatureKey: selected.success ? selected.data : null,
    isBaseCreatureUnavailable: Boolean(baseCreatureKey && !selected.success),
    baseCreatureLabel: selected.success
      ? representativeFamiliars[selected.data].name
      : baseCreatureKey
        ? 'Base creature unavailable'
        : 'Choose a base creature',
    choices: Object.values(representativeFamiliars).map((creature) => ({
      key: creature.key,
      label: creature.name,
      size: creature.size,
      selected: creature.key === baseCreatureKey,
    })),
    coverageDescription: 'Representative base creatures: Cat, Raven and Toad.',
    statistics,
    unresolvedTargets: current?.unresolvedTargets ?? [],
    affectedStatisticTargets: current?.affectedStatisticTargets ?? [],
    permanentUnresolvedTargets: permanent?.unresolvedTargets ?? [],
    specialAbilities: current?.progression?.specialAbilities ?? [],
    unresolvedMessage: current?.unresolvedInputs.length
      ? 'Some familiar statistics need values from the associated Character.'
      : null,
    baseCreatureMessage: selected.success
      ? null
      : 'Choose a base creature to calculate its familiar statistics.',
  };
}
