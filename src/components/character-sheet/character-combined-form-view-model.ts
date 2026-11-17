import type { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import {
  characterSheetPath,
  type CharacterSheetOrigin,
} from '~/lib/campaign-routes';
import { eidolonEvolutionChoiceLabel } from './character-eidolon-progression-view-model';
import { formatModifier } from './sheet-parts';

/** The Synthesist's Combined Form as the server reads it (#421). */
export type CombinedFormRead = NonNullable<
  FunctionReturnType<typeof api.characterSheetCombinedForm.read>
>;
type Contribution =
  CombinedFormRead['baseAttackBonus']['contributions'][number];

const sourceLabels = { summoner: 'Summoner', eidolon: 'Eidolon' } as const;
const abilityLabels: Record<
  CombinedFormRead['abilities'][number]['ability'],
  string
> = {
  strength: 'Strength',
  dexterity: 'Dexterity',
  constitution: 'Constitution',
  intelligence: 'Intelligence',
  wisdom: 'Wisdom',
  charisma: 'Charisma',
};
const sizeLabels: Record<NonNullable<CombinedFormRead['size']>, string> = {
  fine: 'Fine',
  diminutive: 'Diminutive',
  tiny: 'Tiny',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  huge: 'Huge',
  gargantuan: 'Gargantuan',
  colossal: 'Colossal',
};
const fallbackNotes: Record<
  CombinedFormRead['inputs'][number]['fallbackState'],
  string | null
> = {
  none: null,
  applied: 'Saved fallback in use',
  suspended: 'Saved fallback kept for when the value is unavailable',
};
const unresolved = 'Unresolved';
const formatSignedValue = (value: number | null) =>
  value === null ? unresolved : formatModifier(value);
const formatPlainValue = (value: number | null) =>
  value === null ? unresolved : String(value);

function describeContributions(items: readonly Contribution[]) {
  return items.map(({ label, value, from }) => ({
    label,
    value: formatModifier(value),
    source: sourceLabels[from],
  }));
}

/** One fused statistic as a row of the view. */
function describeStatistic({
  key,
  label,
  value,
  contributions = [],
  note = null,
  isAtAGlance = false,
  messages = [],
}: {
  key: string;
  label: string;
  value: string;
  contributions?: readonly Contribution[];
  note?: string | null;
  /** One of the four numbers a glance wants before the form is opened. */
  isAtAGlance?: boolean;
  /** Why this value is unresolved while the rest of the form is not. */
  messages?: readonly string[];
}) {
  return {
    key,
    label,
    value,
    contributions: describeContributions(contributions),
    note,
    isAtAGlance,
    messages,
  };
}

/**
 * Words the Combined Form for the summoner's sheet: each fused value with
 * the build it comes from, the unresolved reasons and a read-only notice.
 * It never recalculates: unresolved values stay unresolved.
 */
export function buildCombinedFormView(
  form: CombinedFormRead,
  origin?: CharacterSheetOrigin,
) {
  const { armorClass, saves, hitPoints, baseAttackBonus, evolutions } = form;
  const isCalculated = form.status === 'calculated';
  const unresolvedMessages = form.unresolved.map(({ message }) => message);
  const replaced = baseAttackBonus.replaced
    .map(({ label, value }) => `${label} (${formatModifier(value)})`)
    .join(', ');
  return {
    title: 'Combined Form',
    isCalculated,
    readOnlyNotice:
      'A static view of the synthesist fused with the eidolon. Viewing it does not fuse them, track combat or change either sheet.',
    eidolon: form.eidolon
      ? {
          name: form.eidolon.name,
          href: characterSheetPath(form.eidolon.characterId, origin),
        }
      : null,
    // A calculated form's messages concern one value, the eidolon's hit
    // points, and sit beside it; an unresolved form's concern the whole.
    unresolved: isCalculated ? [] : unresolvedMessages,
    advisories: form.advisories.map(({ message }) => message),
    size: form.size ? sizeLabels[form.size] : unresolved,
    abilities: form.abilities.map((row) => ({
      key: row.ability,
      label: abilityLabels[row.ability],
      score: formatPlainValue(row.score),
      modifier: row.modifier === null ? null : formatModifier(row.modifier),
      source: sourceLabels[row.from],
      excluded: row.excluded.map(
        ({ label, value }) =>
          `${label} ${formatModifier(value)} (the eidolon’s, not applied)`,
      ),
    })),
    statistics: [
      describeStatistic({
        key: 'bab',
        label: 'Base attack bonus',
        value: formatSignedValue(baseAttackBonus.total),
        contributions: baseAttackBonus.contributions,
        note: replaced ? `Replaces ${replaced}.` : null,
        isAtAGlance: true,
      }),
      describeStatistic({
        key: 'ac',
        label: 'Armor Class',
        value: formatPlainValue(armorClass.total),
        contributions: armorClass.contributions,
        note:
          armorClass.total === null
            ? null
            : `Touch ${formatPlainValue(armorClass.touch)}, flat-footed ${formatPlainValue(armorClass.flatFooted)}.`,
        isAtAGlance: true,
      }),
      describeStatistic({
        key: 'fortitude',
        label: 'Fortitude',
        value: formatSignedValue(saves.fortitude.total),
        contributions: saves.fortitude.contributions,
      }),
      describeStatistic({
        key: 'reflex',
        label: 'Reflex',
        value: formatSignedValue(saves.reflex.total),
        contributions: saves.reflex.contributions,
      }),
      describeStatistic({
        key: 'will',
        label: 'Will',
        value: formatSignedValue(saves.will.total),
        contributions: saves.will.contributions,
      }),
      describeStatistic({
        key: 'cmb',
        label: 'CMB',
        value: formatSignedValue(form.combatManeuverBonus),
      }),
      describeStatistic({
        key: 'cmd',
        label: 'CMD',
        value: formatPlainValue(form.combatManeuverDefense),
      }),
      describeStatistic({
        key: 'initiative',
        label: 'Initiative',
        value: formatSignedValue(form.initiative),
      }),
      describeStatistic({
        key: 'hp',
        label: 'Hit points',
        value: formatPlainValue(hitPoints.total),
        isAtAGlance: true,
      }),
      {
        ...describeStatistic({
          key: 'temporaryHp',
          label: 'Temporary hit points',
          value: formatPlainValue(hitPoints.temporary),
          isAtAGlance: true,
          messages: isCalculated ? unresolvedMessages : [],
        }),
        contributions:
          hitPoints.temporary === null
            ? []
            : [
                {
                  label: 'Eidolon hit points',
                  value: String(hitPoints.temporary),
                  source: sourceLabels.eidolon,
                },
              ],
      },
    ],
    skills: form.skills.map(({ skill, name, total, skilled }) => ({
      key: skill,
      label: name,
      value: formatSignedValue(total),
      note: skilled === null ? null : `Skilled ${formatModifier(skilled)}`,
    })),
    evolutions: {
      hitDiceNote:
        evolutions.hitDice === null
          ? 'Evolution effects use the eidolon’s Hit Dice, which are unresolved.'
          : `Evolution effects use the eidolon’s ${evolutions.hitDice} Hit ${evolutions.hitDice === 1 ? 'Die' : 'Dice'}, not the summoner’s ${formatPlainValue(evolutions.characterHitDice)}.`,
      attacks:
        evolutions.maxAttacks === null
          ? unresolved
          : `${evolutions.attackCount} of ${evolutions.maxAttacks}`,
      attacksNote: 'Attacks while fused are not calculated.',
      list: evolutions.list.map(({ key, name, choice }) =>
        choice ? `${name} (${eidolonEvolutionChoiceLabel(key, choice)})` : name,
      ),
    },
    inputs: form.inputs.map(({ label, value, fallbackState }) => ({
      label,
      value: formatPlainValue(value),
      note: fallbackNotes[fallbackState],
    })),
    features: form.features,
    sources: form.sources,
  };
}
