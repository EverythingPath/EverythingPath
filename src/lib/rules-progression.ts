import { MILITIA_ADVANCEMENT } from './militia-progression-rules';
import type { CanonicalRoster } from './canonical-roster';
import type { FoundationCharacter } from './rules-officers';

// Full gift conditions are in the verbatim PC Boons paragraph, not just Table 6-1 labels.
const gifts: Record<
  number,
  { gift: string; maxValueCopper: number; fullyChargedWands: boolean }
> = {
  3: { gift: 'potion', maxValueCopper: 30000, fullyChargedWands: false },
  6: { gift: '750 gp', maxValueCopper: 75000, fullyChargedWands: false },
  8: { gift: 'armor or wand', maxValueCopper: 120000, fullyChargedWands: true },
  11: { gift: '3,000 gp', maxValueCopper: 300000, fullyChargedWands: false },
  13: {
    gift: 'wand or weapon',
    maxValueCopper: 500000,
    fullyChargedWands: true,
  },
  16: { gift: '8,000 gp', maxValueCopper: 800000, fullyChargedWands: false },
  18: { gift: 'magic item', maxValueCopper: 1000000, fullyChargedWands: false },
};
// Title feat packages (militia-rules.md, Title Feat Packages). Each PC picks
// one feat from a fixed list, except Champion, whose PCs gain any feat they
// qualify for: an open outcome with no list.
const titles: Record<number, { title: string; feats: string[] | null }> = {
  4: {
    title: 'Director',
    feats: ['Alertness', 'Deceitful', 'Persuasive', 'Stealthy'],
  },
  9: {
    title: 'Captain',
    feats: ['Great Fortitude', 'Iron Will', 'Lightning Reflexes'],
  },
  14: {
    title: 'Commander',
    feats: ['Fleet', 'Improved Initiative', 'Toughness'],
  },
  19: { title: 'Champion', feats: null },
};
const anyFeat = 'Any feat the PC qualifies for';
const xpAwards: Record<number, number> = {
  5: 1200,
  10: 3200,
  15: 6400,
  20: 25600,
};
function boon(rank: number, characterIds: string[]) {
  const common = { rank, characterIds };
  if ([2, 7, 12, 17].includes(rank))
    return { ...common, kind: 'skilled' as const, skillRanks: 1 };
  if (gifts[rank]) return { ...common, kind: 'gift' as const, ...gifts[rank] };
  const title = titles[rank];
  if (title)
    return {
      ...common,
      kind: 'title' as const,
      title: title.title,
      // Resolution plans have always described Champion's open feat this
      // way; which feats are a fixed choice is `boonFeatChoices`.
      feats: title.feats ?? [anyFeat],
    };
  const xp = xpAwards[rank];
  if (xp !== undefined)
    return {
      ...common,
      kind: 'xp' as const,
      xp,
      xpPerPc: characterIds.length
        ? Math.floor(xp / characterIds.length)
        : null,
    };
  return null;
}
export function projectProgression(
  rank: number,
  training: number,
  roster: CanonicalRoster,
  characters: FoundationCharacter[],
) {
  const pcIds = new Set(
    roster.people.filter((x) => x.kind === 'pc').map((x) => x.characterId),
  );
  const pcs = characters.filter((x) => pcIds.has(x.characterId) && x.isActive);
  const highestPcLevel = pcs.length
    ? Math.max(...pcs.map((x) => x.level))
    : null;
  // Rank never decreases; training earns rank up to the cap.
  const reached = (cap: number) =>
    Math.max(
      rank,
      MILITIA_ADVANCEMENT.filter(
        (x) => x.training <= training && x.rank <= cap,
      ).slice(-1)[0]?.rank ?? rank,
    );
  const eligibleRank = reached(highestPcLevel ?? rank);
  // The rank training alone reaches, before the highest PC level caps it.
  const trainingRank = reached(Infinity);
  return {
    eligibleRank,
    trainingRank,
    highestPcLevel,
    boons: MILITIA_ADVANCEMENT.filter(
      (x) => x.rank > rank && x.rank <= eligibleRank,
    ).flatMap((x) => {
      const value = boon(
        x.rank,
        pcs.map((pc) => pc.characterId),
      );
      return value ? [value] : [];
    }),
    requirements: highestPcLevel === null ? ['highest-level-pc'] : [],
    warnings: [
      ...(highestPcLevel !== null && rank > highestPcLevel
        ? ['rank:pc-cap']
        : []),
    ],
  };
}

export type ProgressionBoon = ReturnType<
  typeof projectProgression
>['boons'][number];

// The fixed feats a boon lets each PC choose from, or null when the boon's
// outcome is open text (Skilled, Gift, XP and Champion's any feat).
export function boonFeatChoices(reward: ProgressionBoon): string[] | null {
  return reward.kind === 'title' ? (titles[reward.rank]?.feats ?? null) : null;
}
