// Table 6-1: docs/ai/ironfang-militia/militia-tables.md.
export const MILITIA_ADVANCEMENT = [
  { rank: 1, training: 0, focused: 2, secondary: 0, actions: 1, teams: 2 },
  { rank: 2, training: 10, focused: 3, secondary: 0, actions: 2, teams: 2 },
  { rank: 3, training: 15, focused: 3, secondary: 1, actions: 2, teams: 3 },
  { rank: 4, training: 20, focused: 4, secondary: 1, actions: 2, teams: 3 },
  { rank: 5, training: 30, focused: 4, secondary: 1, actions: 2, teams: 4 },
  { rank: 6, training: 40, focused: 5, secondary: 2, actions: 2, teams: 4 },
  { rank: 7, training: 55, focused: 5, secondary: 2, actions: 3, teams: 4 },
  { rank: 8, training: 75, focused: 6, secondary: 2, actions: 3, teams: 5 },
  { rank: 9, training: 105, focused: 6, secondary: 3, actions: 3, teams: 5 },
  { rank: 10, training: 160, focused: 7, secondary: 3, actions: 3, teams: 5 },
  { rank: 11, training: 235, focused: 7, secondary: 3, actions: 4, teams: 6 },
  { rank: 12, training: 330, focused: 8, secondary: 4, actions: 4, teams: 6 },
  { rank: 13, training: 475, focused: 8, secondary: 4, actions: 4, teams: 6 },
  { rank: 14, training: 665, focused: 9, secondary: 4, actions: 4, teams: 6 },
  { rank: 15, training: 855, focused: 9, secondary: 5, actions: 5, teams: 7 },
  { rank: 16, training: 1350, focused: 10, secondary: 5, actions: 5, teams: 7 },
  { rank: 17, training: 1900, focused: 10, secondary: 5, actions: 5, teams: 7 },
  { rank: 18, training: 2700, focused: 11, secondary: 6, actions: 5, teams: 7 },
  { rank: 19, training: 3850, focused: 11, secondary: 6, actions: 6, teams: 7 },
  { rank: 20, training: 5350, focused: 12, secondary: 6, actions: 6, teams: 8 },
] as const;

export function getAdvancementForRank(rank: number) {
  return MILITIA_ADVANCEMENT.find((row) => row.rank === rank);
}

export function getMaxTeamsForRank(rank: number) {
  return getAdvancementForRank(rank)?.teams ?? (rank >= 20 ? 8 : 2);
}

export type MilitiaFocusCheck = 'Loyalty' | 'Secrecy' | 'Security';

export function getMinimumTrainingForRank(rank: number) {
  return getAdvancementForRank(rank)?.training;
}

export function getFocusedCheckBonusForRank(rank: number) {
  return getAdvancementForRank(rank)?.focused;
}

export function getSecondaryCheckBonusForRank(rank: number) {
  return getAdvancementForRank(rank)?.secondary;
}

export function getOrganizationCheckBonusesForMilitia({
  rank,
  focus,
}: {
  rank: number;
  focus: MilitiaFocusCheck | null | undefined;
}) {
  const focusedBonus = getFocusedCheckBonusForRank(rank);
  const secondaryBonus = getSecondaryCheckBonusForRank(rank);

  if (focusedBonus === undefined || secondaryBonus === undefined) {
    return {
      loyalty: 0,
      secrecy: 0,
      security: 0,
    };
  }

  return {
    loyalty: focus === 'Loyalty' ? focusedBonus : secondaryBonus,
    secrecy: focus === 'Secrecy' ? focusedBonus : secondaryBonus,
    security: focus === 'Security' ? focusedBonus : secondaryBonus,
  };
}

export function getMinimumTreasuryForRank(rank: number) {
  return rank * 10;
}
