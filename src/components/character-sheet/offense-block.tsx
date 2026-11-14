'use client';
import { Block } from './sheet-parts';
import { StatGroups } from './stat-row';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Derived = NonNullable<
  Controller['sheet']
>['calculated']['derivedStatistics'];

/** Offense (approved prototype): base attack, CMB and Initiative. */
export function OffenseBlock({ statistics }: { statistics: Derived }) {
  return (
    <Block title="Offense">
      <StatGroups
        groups={[
          {
            key: 'attack',
            rows: [
              {
                figure: {
                  label: 'Base attack',
                  title: 'Base attack bonus',
                  target: 'bab',
                  statistic: statistics.bab,
                  isSigned: true,
                },
              },
            ],
          },
          {
            key: 'cmb',
            rows: [
              {
                figure: {
                  label: 'CMB',
                  title: 'Combat Maneuver Bonus',
                  target: { kind: 'derived', statistic: 'cmb' },
                  statistic: statistics.cmb,
                  isSigned: true,
                },
              },
            ],
          },
          {
            key: 'initiative',
            rows: [
              {
                figure: {
                  label: 'Initiative',
                  title: 'Initiative',
                  target: { kind: 'derived', statistic: 'initiative' },
                  statistic: statistics.initiative,
                  isSigned: true,
                },
              },
            ],
          },
        ]}
      />
    </Block>
  );
}
