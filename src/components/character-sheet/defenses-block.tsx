'use client';
import type {
  DamageReduction,
  SpellResistanceStatistic,
} from '~/lib/character-sheet';
import { describeSituation } from './modifier-labels';
import { Block, unresolvedValue } from './sheet-parts';
import { RuleValueRow } from './rule-value-row';
import { StatGroups } from './stat-row';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Derived = NonNullable<
  Controller['sheet']
>['calculated']['derivedStatistics'];
type Resistances = {
  damageReduction: DamageReduction;
  spellResistance: SpellResistanceStatistic;
};

/** DR x/— for no bypass, else DR x/bypass. */
const reduction = (value: number | null, bypass: string) =>
  `${value ?? unresolvedValue}/${bypass === '-' ? '—' : bypass}`;

const applies = (line: { applies: boolean }) =>
  line.applies ? ' (applies)' : '';
const only = (situation: Parameters<typeof describeSituation>[0]) =>
  `, only ${typeof situation === 'string' ? '' : 'when '}${describeSituation(situation)}`;
/** A line's key: its entry and rule value, so same-named lines stay apart. */
const lineKey = (line: { entryId: string; ruleValueIndex: number }) =>
  `${line.entryId}:${line.ruleValueIndex}`;

function damageReductionLines(dr: DamageReduction) {
  return [
    ...dr.lines.map((line) => ({
      key: lineKey(line),
      text: `${line.name} ${reduction(line.value, line.bypass)}${applies(line)}`,
    })),
    ...dr.conditional.map((line) => ({
      key: lineKey(line),
      text: `${line.name} ${reduction(line.value, line.bypass)}${only(line.situation)}`,
    })),
  ];
}

function spellResistanceValue(sr: SpellResistanceStatistic) {
  if (sr.value !== null) return String(sr.value);
  return sr.lines.some((line) => line.value === null)
    ? unresolvedValue
    : 'None';
}

function spellResistanceLines(sr: SpellResistanceStatistic) {
  return [
    ...sr.lines.map((line) => ({
      key: lineKey(line),
      text: `${line.name} ${line.value ?? unresolvedValue}${applies(line)}`,
    })),
    ...sr.conditional.map((line) => ({
      key: lineKey(line),
      text: `${line.name} ${line.value ?? unresolvedValue}${only(line.situation)}`,
    })),
  ];
}

const hasLines = (statistic?: {
  lines: readonly unknown[];
  conditional: readonly unknown[];
}) => (statistic?.lines.length ?? 0) + (statistic?.conditional.length ?? 0) > 0;

/** Damage reduction and spell resistance rows, each once it has a line. */
function resistanceRows(resistances?: Resistances) {
  const dr = resistances?.damageReduction;
  const sr = resistances?.spellResistance;
  if (!hasLines(dr) && !hasLines(sr)) return null;
  return (
    <ul className="pt-3">
      {dr && hasLines(dr) ? (
        <RuleValueRow
          label="Damage reduction"
          value={
            dr.values
              .map(({ value, bypass }) => reduction(value, bypass))
              .join(', ') || 'None'
          }
          lines={damageReductionLines(dr)}
        />
      ) : null}
      {sr && hasLines(sr) ? (
        <RuleValueRow
          label="Spell resistance"
          value={spellResistanceValue(sr)}
          lines={spellResistanceLines(sr)}
        />
      ) : null}
    </ul>
  );
}

/**
 * Defenses (approved prototype): Armor Class with its touch and flat-footed
 * variants, the three saves, and CMD with its flat-footed variant. HP is in
 * the pinned summary and is not repeated here. Damage reduction and spell
 * resistance (rule values) follow when the Character has any line of them.
 */
export function DefensesBlock({
  statistics,
  resistances,
}: {
  statistics: Derived;
  resistances?: Resistances;
}) {
  return (
    <Block title="Defenses">
      <StatGroups
        groups={[
          {
            key: 'ac',
            rows: [
              {
                figure: {
                  label: 'Armor Class',
                  title: 'Armor Class',
                  target: { kind: 'derived', statistic: 'ac' },
                  statistic: statistics.ac,
                },
                variants: [
                  {
                    label: 'Touch',
                    title: 'Touch AC',
                    target: { kind: 'derived', statistic: 'touchAc' },
                    statistic: statistics.touchAc,
                  },
                  {
                    label: 'Flat-footed',
                    title: 'Flat-footed AC',
                    target: { kind: 'derived', statistic: 'flatFootedAc' },
                    statistic: statistics.flatFootedAc,
                  },
                ],
              },
            ],
          },
          {
            key: 'saves',
            rows: [
              {
                figure: {
                  label: 'Fortitude',
                  title: 'Fortitude save',
                  target: { kind: 'derived', statistic: 'fortitude' },
                  statistic: statistics.fortitude,
                  isSigned: true,
                },
              },
              {
                figure: {
                  label: 'Reflex',
                  title: 'Reflex save',
                  target: { kind: 'derived', statistic: 'reflex' },
                  statistic: statistics.reflex,
                  isSigned: true,
                },
              },
              {
                figure: {
                  label: 'Will',
                  title: 'Will save',
                  target: { kind: 'derived', statistic: 'will' },
                  statistic: statistics.will,
                  isSigned: true,
                },
              },
            ],
          },
          {
            key: 'cmd',
            rows: [
              {
                figure: {
                  label: 'CMD',
                  title: 'Combat Maneuver Defense',
                  target: { kind: 'derived', statistic: 'cmd' },
                  statistic: statistics.cmd,
                },
                variants: [
                  {
                    label: 'Flat-footed',
                    title: 'Flat-footed CMD',
                    target: { kind: 'derived', statistic: 'flatFootedCmd' },
                    statistic: statistics.flatFootedCmd,
                  },
                ],
              },
            ],
          },
        ]}
      />
      {resistanceRows(resistances)}
    </Block>
  );
}
