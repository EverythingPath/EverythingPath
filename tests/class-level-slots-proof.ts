// The class-level slots family's public proof's shapes (#783,
// `convex/characterSheetClassLevelSlots.integration.test.ts`): one synthetic
// class per real bonus feat parent's shape, with its Foundry `bonusFeats`
// formula, its printed feat types and its rows' class levels (pf1 418761d2
// packs/class-abilities; scripts/catalog/pcgen/schedule-slots.ts), and the
// last class level the proof reads its slots at. A Character of the shape's
// class is read at every class level from 1st to `through`. The registry
// entries of `class-level-slots` and `class-feature-level-grants` bind these
// bytes, and `tests/catalog/launch-class-level-slots.test.ts` ties the
// family's listed parents to these shapes.
export type SlotProofShapeName =
  | 'fighter'
  | 'cavalier'
  | 'magus'
  | 'inquisitor';
export type SlotProofShape = {
  formula: string;
  featTypes: readonly string[];
  /** The acquisition's class level, then each increment's. */
  levels: readonly [number, number, number];
  /** The last class level the proof reads, from 1st. */
  through: number;
};

export const slotProofShapes: Readonly<
  Record<SlotProofShapeName, SlotProofShape>
> = {
  // Fighter Bonus Feats: 1st, then every even level, Combat. Only three rows,
  // so the formula matches them through 5th; read through the last row.
  fighter: {
    formula: '1 + floor(@class.level / 2)',
    featTypes: ['Combat'],
    levels: [1, 2, 4],
    through: 4,
  },
  // Bonus Feat (CAV): 6th and every six, Combat; every row, read to 20th.
  cavalier: {
    formula: 'floor(@class.level / 6)',
    featTypes: ['Combat'],
    levels: [6, 12, 18],
    through: 20,
  },
  // Bonus Feats (MAG): 5th and every six, Combat, Item Creation or
  // Metamagic; every row, read to 20th.
  magus: {
    formula: 'floor((@class.level + 1) / 6)',
    featTypes: ['Combat', 'Item Creation', 'Metamagic'],
    levels: [5, 11, 17],
    through: 20,
  },
  // Teamwork Feat: 3rd and every three, Teamwork; three rows, read through
  // the last.
  inquisitor: {
    formula: 'floor(@class.level / 3)',
    featTypes: ['Teamwork'],
    levels: [3, 6, 9],
    through: 9,
  },
};
