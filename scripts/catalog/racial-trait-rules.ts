// #719: reviewed Racial Trait facts the pinned records state only in prose or
// in an untargeted change. Each rule is keyed by the pinned upstream trait key
// and names the exact raw changes it consumes; a record whose changes no longer
// match is reported and imports without the rule. Evidence pages come from the
// Core Rulebook (PZO1110), via ep-orch/research/719.md.

export type ReviewedRawChange = {
  target?: string;
  formula: string;
  type: string;
};
type RawChange = ReviewedRawChange;
/** A published book and page, with an optional comparison note. */
type Evidence = { book: string; pages: string; note?: string };

export type RacialTraitFact =
  /** `+2 to one ability score of their choice`: an `ability.$choice` Modifier. */
  | { kind: 'abilityChoice'; value: number; count?: 2 }
  /** #721: fixed ability adjustments the record types `base` or `untypedPerm`. */
  | {
      kind: 'racialAbilities';
      size?: 'medium';
      abilities: {
        target: string;
        value: number;
        situation?: { local: string };
      }[];
    }
  /** One extra feat at 1st level. */
  | { kind: 'bonusFeat' }
  /** Skill Focus as a bonus feat, from the owning race's `links.supplements`. */
  | { kind: 'supplementedFeat' }
  /** Two favored classes. */
  | { kind: 'favoredClassCount' }
  /** Counts as these races for any effect related to race (upstream race keys). */
  | { kind: 'countsAsRaces'; races: string[] };

export type RacialTraitRule = {
  externalKey: string;
  name: string;
  evidence: Evidence;
  consumes: RawChange[];
  fact: RacialTraitFact;
  descriptionSha256?: string;
};

const crb = (pages: string) => ({ book: 'PZO1110', pages });
/**
 * An ability choice from the record's untargeted change; mapped as `racial`,
 * like the importer's fixed race ability changes (#719 orchestrator decision 2).
 * Restrictions such as "a mental ability score" stay prose.
 */
const abilityChoice = ({
  externalKey,
  name,
  evidence,
  formula = '2',
  type = 'base',
}: {
  externalKey: string;
  name: string;
  evidence: Evidence;
  formula?: string;
  type?: string;
}) => ({
  externalKey,
  name,
  evidence,
  consumes: [{ formula, type }],
  fact: { kind: 'abilityChoice' as const, value: Number(formula) },
});
/**
 * #721: an alternate's fixed ability changes that its record types `base` or
 * `untypedPerm`, mapped as the racial adjustments the text gives.
 */
const racialAbilities = ({
  externalKey,
  name,
  evidence,
  type,
  abilities,
}: {
  externalKey: string;
  name: string;
  evidence: Evidence;
  type: string;
  abilities: { target: string; value: number }[];
}) => ({
  externalKey,
  name,
  evidence,
  consumes: abilities.map(({ target, value }) => ({
    target,
    formula: String(value),
    type,
  })),
  fact: { kind: 'racialAbilities' as const, abilities },
});

// The PRT record's page, which ep-orch/research/719.md could not verify
// against the book.
const orcAtavismEvidence = {
  book: 'PZO1121',
  pages: '212',
  note: "Unverified: the pf1-content record's page; not checked against the Advanced Race Guide.",
};

export const reviewedRacialTraitRules: readonly RacialTraitRule[] = [
  {
    externalKey: 'pf1-content/xPtJg4WPKxVRmVdM',
    name: 'Oversized Goblins',
    evidence: { book: 'PZO1130', pages: '104' },
    consumes: [
      { target: 'size', formula: '1', type: 'racial' },
      { target: 'str', formula: '4', type: 'racial' },
      { target: 'dex', formula: '-2', type: 'racial' },
    ],
    fact: {
      kind: 'racialAbilities',
      size: 'medium',
      abilities: [
        { target: 'str', value: 2 },
        { target: 'dex', value: 2 },
        { target: 'cha', value: -2 },
      ],
    },
  },
  {
    externalKey: 'pf1-content/zaQk4Qx8fsdxsOSW',
    name: 'Demodand-Spawn (Foulspawn)',
    descriptionSha256:
      '1344fab58947c8411e66b049603bc2d1a568c59eba1a9f3dd719fcbf092b8616',
    evidence: {
      book: 'PZO9423',
      pages: '20',
    },
    consumes: [],
    fact: {
      kind: 'racialAbilities',
      abilities: [
        {
          target: 'con',
          value: 2,
        },
        {
          target: 'wis',
          value: 2,
        },
        {
          target: 'int',
          value: -2,
        },
      ],
    },
  },
  {
    externalKey: 'pf1-content/zlOXohhDPfhgEstJ',
    name: 'Daemon-Spawn (Grimspawn)',
    descriptionSha256:
      'a72a1c5611ec1469ad7984ee3924d8947d22f702525767146a41cea9aa342d97',
    evidence: {
      book: 'PZO9423',
      pages: '19',
    },
    consumes: [],
    fact: {
      kind: 'racialAbilities',
      abilities: [
        {
          target: 'dex',
          value: 2,
        },
        {
          target: 'int',
          value: 2,
        },
        {
          target: 'wis',
          value: -2,
        },
      ],
    },
  },
  {
    externalKey: 'pf1-content/wrqUJsULTxngAMQb',
    name: 'Wereshark-Kin (Seascarred)',
    descriptionSha256:
      '1e72716a1d8077295562dcd17e90f6b35f703e687dd9bdd3dc712d4fe54e241f',
    evidence: {
      book: 'PZO9280',
      pages: '248',
    },
    consumes: [],
    fact: {
      kind: 'racialAbilities',
      abilities: [
        {
          target: 'wis',
          value: 2,
        },
        {
          target: 'int',
          value: -2,
        },
        {
          target: 'con',
          value: 2,
          situation: {
            local: 'while shapechanged',
          },
        },
      ],
    },
  },
  {
    externalKey: 'pf1-content/yRISJZyDwhGV0jFO',
    name: 'Mistsoul (Vapor Undine)',
    descriptionSha256:
      '89a9998c62627ee572abb150a9682c638351606833c58fc570c5688e68797dea',
    evidence: {
      book: 'PZO9492',
      pages: '21',
    },
    consumes: [],
    fact: {
      kind: 'racialAbilities',
      abilities: [
        {
          target: 'con',
          value: 2,
        },
        {
          target: 'wis',
          value: 2,
        },
        {
          target: 'int',
          value: -2,
        },
      ],
    },
  },
  {
    externalKey: 'pf1-content/yodj1nKWZ1hzQVVv',
    name: 'Vetala-Born (Ajibachana)',
    descriptionSha256:
      'ba55f11252ebcec9eb1b2ce9fdbd0147d3fe6d817f46af099971c332cd9505a3',
    evidence: {
      book: 'PZO9280',
      pages: '241',
    },
    consumes: [],
    fact: {
      kind: 'racialAbilities',
      abilities: [
        {
          target: 'dex',
          value: 2,
        },
        {
          target: 'int',
          value: 2,
        },
        {
          target: 'wis',
          value: -2,
        },
      ],
    },
  },
  {
    externalKey: 'pf1-content/Ni5twdUyps9MQyOX',
    name: 'Jiang-Shi Born (Ru-Shi)',
    descriptionSha256:
      '036b11548b3e77a7be166a8746489c5326128730ab26090f1521310486d2f558',
    evidence: {
      book: 'PZO9427',
      pages: '20',
    },
    consumes: [],
    fact: {
      kind: 'racialAbilities',
      abilities: [
        {
          target: 'str',
          value: 2,
        },
        {
          target: 'int',
          value: 2,
        },
        {
          target: 'dex',
          value: -2,
        },
      ],
    },
  },
  {
    externalKey: 'pf1-content/TbnWNAk91q2wgqCP',
    name: 'Angel-Blooded (Angelkin)',
    descriptionSha256:
      'f1991eec19b5ce3e0286356093bf78ef240d96e4b30109e8eb56b140e685cf34',
    evidence: { book: 'PZO9424', pages: '21' },
    consumes: [],
    fact: {
      kind: 'racialAbilities',
      abilities: [
        { target: 'str', value: 2 },
        { target: 'cha', value: 2 },
      ],
    },
  },
  {
    externalKey: 'pf1-content/SRBfqkzIldwETAHB',
    name: 'Dual Talent',
    evidence: { book: 'PZO1121', pages: '72' },
    consumes: [
      { formula: '2', type: 'racial' },
      { formula: '2', type: 'racial' },
    ],
    fact: { kind: 'abilityChoice', value: 2, count: 2 },
  },
  abilityChoice({
    externalKey: 'pf1-content/BFszTUJLlDS1ZDB8',
    name: '+2 to One Ability Score (Human)',
    evidence: crb('27'),
  }),
  abilityChoice({
    externalKey: 'pf1-content/orOAYDkNl4pqYWA4',
    name: '+2 to One Ability Score (Half-Elf)',
    evidence: crb('24'),
  }),
  abilityChoice({
    externalKey: 'pf1-content/VHmuEYXmx81Q5EmC',
    name: '+2 to One Ability Score (Half-Orc)',
    // The SYS record and #719 cite p. 25 (orchestrator decision 6, #721).
    evidence: {
      ...crb('25'),
      note: 'PCGen cr_abilities_race.lst gives Half-Orc ~ Ability Scores SOURCEPAGE p. 24.',
    },
  }),
  // #721: the alternates that replace an ability score trait, whose own
  // ability changes do not map as typed (ep-orch/research/721.md §2D).
  racialAbilities({
    externalKey: 'pf1-content/SJOcTJ2MQI3AoMeh',
    name: 'Orc Atavism',
    // "They gain a +2 bonus to Strength".
    evidence: orcAtavismEvidence,
    type: 'base',
    abilities: [{ target: 'str', value: 2 }],
  }),
  abilityChoice({
    externalKey: 'pf1-content/SJOcTJ2MQI3AoMeh',
    name: 'Orc Atavism',
    // "...and a -2 penalty to one mental ability score of their choice".
    evidence: orcAtavismEvidence,
    formula: '-2',
    type: 'untyped',
  }),
  {
    externalKey: 'pf1-content/SJOcTJ2MQI3AoMeh',
    name: 'Orc Atavism',
    evidence: orcAtavismEvidence,
    consumes: [],
    // The pinned text counts as half-orc and orc, explicitly excluding
    // human. The base race supplies half-orc; replacing Orc Blood removes
    // its Human equivalence without losing this separately stated Orc one.
    fact: { kind: 'countsAsRaces', races: ['pf1/JOuAdPAOTat7d5v6'] },
  },
  abilityChoice({
    externalKey: 'pf1-content/PZivMg8Pl1LRnSQE',
    name: 'Kindred-Raised',
    // "They gain a +2 bonus to Charisma and one other ability score of their
    // choice." The Charisma change is `untyped` and maps as it is.
    evidence: { book: 'PZO9280', pages: '212' },
    type: 'untyped',
  }),
  racialAbilities({
    externalKey: 'pf1-content/ZLN55d8hUbX0lqfm',
    name: 'Tree-Born',
    // "They have no Constitution penalty": the gathlain's +2 Dexterity stays.
    evidence: { book: 'PZO1140', pages: '10' },
    type: 'base',
    abilities: [{ target: 'dex', value: 2 }],
  }),
  racialAbilities({
    externalKey: 'pf1-content/YQqgLh49YxGpID1c',
    name: 'Keen Kitsune',
    // "+2 bonus to Dexterity and Intelligence instead of Dexterity and
    // Charisma", with the kitsune's −2 Strength.
    evidence: { book: 'PZO9473', pages: '12' },
    type: 'untypedPerm',
    abilities: [
      { target: 'dex', value: 2 },
      { target: 'int', value: 2 },
      { target: 'str', value: -2 },
    ],
  }),
  {
    externalKey: 'pf1-content/uAJ9hLZYdH2JX7J8',
    name: 'Bonus Feat (Human)',
    evidence: crb('27'),
    consumes: [{ target: 'bonusFeats', formula: '1', type: 'untyped' }],
    fact: { kind: 'bonusFeat' },
  },
  {
    externalKey: 'pf1-content/wZZzaSmiF8hTuRo7',
    name: 'Adaptability',
    evidence: crb('24'),
    consumes: [{ target: 'bonusFeats', formula: '1', type: 'untyped' }],
    fact: { kind: 'supplementedFeat' },
  },
  {
    externalKey: 'pf1-content/srOpqbXesXBuvTqe',
    name: 'Multitalented',
    evidence: crb('24'),
    consumes: [],
    fact: { kind: 'favoredClassCount' },
  },
  {
    externalKey: 'pf1-content/rzYk40R1rWSfay4a',
    name: 'Elf Blood',
    evidence: crb('24'),
    consumes: [],
    // Elf and Human.
    fact: {
      kind: 'countsAsRaces',
      races: ['pf1/NgIhxRI0axrf3fcO', 'pf1/e6IaBxKgMxy1yKlr'],
    },
  },
  {
    externalKey: 'pf1-content/JWzMBJeAQYDav9gw',
    name: 'Orc Blood',
    evidence: crb('25'),
    consumes: [],
    // Human and Orc.
    fact: {
      kind: 'countsAsRaces',
      races: ['pf1/e6IaBxKgMxy1yKlr', 'pf1/JOuAdPAOTat7d5v6'],
    },
  },
];

/**
 * A checked race description output that states the same fact as a raw change
 * or note on one standard trait. The output moves onto that trait, where
 * replacing the trait removes it. It supersedes the raw change, which is not
 * mapped, or the note, which is no longer a required curation input, so it
 * counts once.
 */
export type DescriptionRehomeRule = {
  race: string;
  descriptionSha256: string;
  outputTarget: string;
  trait: string;
  supersedes:
    | { kind: 'change'; change: RawChange & { target: string } }
    | { kind: 'note'; target: string; text: string };
  evidence: string;
};
const supersedesChange = (change: RawChange & { target: string }) => ({
  kind: 'change' as const,
  change,
});

export const reviewedDescriptionRehomes: readonly DescriptionRehomeRule[] = [
  {
    race: 'pf1/fX9F2amW2BcYoHwb',
    descriptionSha256:
      '1e0cc3706d1e12122b8ea7210342f2acd8248ee98f66bf04afd40ad3c9844b6d',
    outputTarget: 'skill.ste',
    trait: 'pf1-content/gwRHgXExczYgcJOA',
    supersedes: {
      kind: 'note',
      target: 'skill.ste',
      text: 'Additional +2 Racial bonus when underground.  (total of +4 bonus from this trait)',
    },
    evidence:
      'Skilled (Svirfneblin), Inner Sea Races p. 250 / Advanced Race Guide p. 204: +2 Stealth improves to +4 underground. The complete +4 shares the trait Source with its ordinary +2.',
  },
  {
    // Gnome Magic (CRB p. 23): +1 to the DC of illusion spells. The race's
    // checked description output and the trait's `dc.school.ill` change.
    race: 'pf1/efwHEwjvL9Z94MJI',
    descriptionSha256:
      '3b2139d7e3341d80ad97e567cfc778f3149b00073dfbfa22a6599a0e4dc14ab9',
    outputTarget: 'spellDC',
    trait: 'pf1-content/MiPbhGqPRX7H4C7a',
    supersedes: supersedesChange({
      target: 'dc.school.ill',
      formula: '1',
      type: 'untyped',
    }),
    evidence: 'CRB p. 23, Gnome Magic',
  },
  // #328 supplied natural armor from these races' checked descriptions because
  // the importer drops the race's raw `nac` change. Each race's natural armor
  // trait carries the same fact as a raw `nac` change.
  ...[
    {
      race: 'pf1/2mWMyKiPWk6Y8cNx', // Ghoran: +2 Natural Armor
      descriptionSha256:
        '95c5dc00d101395a88c5e618f7fcb8fff15f4d554a6c700694952f2de98b58f6',
      trait: 'pf1-content/DLslPcoXcnvQjIPH',
      supersedes: supersedesChange({
        target: 'nac',
        formula: '2',
        type: 'base',
      }),
    },
    {
      race: 'pf1/9FBT6uqlRgaw9gug', // Changeling: Natural Armor (Changeling)
      descriptionSha256:
        '125e8bcbdd97049ba8fe4b98d8d1de8f650603e43ddb435386e7e7dd2e90627f',
      trait: 'pf1-content/Qx1JqPVW0quaOGfY',
      supersedes: supersedesChange({
        target: 'nac',
        formula: '+1',
        type: 'base',
      }),
    },
    {
      race: 'pf1/Lt4ZP5GCinGvTfnF', // Grindylow: Natural Armor (Grindylow)
      descriptionSha256:
        'f3a484fb7833af29f26b92f9cf6d9b712cecc571b523eb343f831655f34a7976',
      trait: 'pf1-content/ttCN9QWoKGpAXX4H',
      supersedes: supersedesChange({
        target: 'nac',
        formula: '2',
        type: 'untyped',
      }),
    },
    {
      race: 'pf1/NhEPoXIZWOOunSH7', // Cecaelia: Natural Armor (Cecaelia)
      descriptionSha256:
        '1f679ce30e0ea2e8ac1b885e2578c0b66fca0ec362456eb04c7c9b2ddaf29b74',
      trait: 'pf1-content/v5Uff6XAqbnWbk4j',
      supersedes: supersedesChange({
        target: 'nac',
        formula: '2',
        type: 'untyped',
      }),
    },
    {
      race: 'pf1/ZVzH0qb1Tqety6fU', // Nagaji: Armored Scales
      descriptionSha256:
        'a1ab1ca79333330acf487c48cfd749b37aa28e4280f6ecbac3b8290801924ff6',
      trait: 'pf1-content/xoItsNqchG4wE6OG',
      supersedes: supersedesChange({
        target: 'nac',
        formula: '1',
        type: 'racial',
      }),
    },
    {
      race: 'pf1/YCCdi4OEC4WuzelM', // Reptoid: Scales
      descriptionSha256:
        'cace65ac796499fea0acc4d0c8dff8e6ffa1a00d754260a6536ed313b636d9d1',
      trait: 'pf1-content/gh1taO4CBM237eMu',
      supersedes: supersedesChange({
        target: 'nac',
        formula: '1',
        type: 'racial',
      }),
    },
  ].map((rule) => ({
    ...rule,
    outputTarget: 'ac.natural',
    evidence:
      'Checked #328 description output (2026-10-07) and the pinned trait record',
  })),
  // The same pattern as Gnome Magic: a +1 school DC on the race description
  // and a raw `dc.school.*` change on the race's magic trait.
  {
    race: 'pf1/GAoJIy6ycj3OovQT', // Kitsune: Kitsune Magic (enchantment)
    descriptionSha256:
      '353b303d23b6763f6c82f6e04c1fb10d3579b5e1b5694d99bcbce142e5ebd813',
    outputTarget: 'spellDC',
    trait: 'pf1-content/YLr7f3djG85wvbAT',
    supersedes: supersedesChange({
      target: 'dc.school.enc',
      formula: '1',
      type: 'untyped',
    }),
    evidence: 'Checked #328 description output and the pinned trait record',
  },
  {
    race: 'pf1/fX9F2amW2BcYoHwb', // Svirfneblin: Svirfneblin Magic (illusion)
    descriptionSha256:
      '1e0cc3706d1e12122b8ea7210342f2acd8248ee98f66bf04afd40ad3c9844b6d',
    outputTarget: 'spellDC',
    trait: 'pf1-content/Jnw41wF4ln2vH7d8',
    supersedes: supersedesChange({
      target: 'dc.school.ill',
      formula: '1',
      type: 'untyped',
    }),
    evidence: 'Checked #328 description output and the pinned trait record',
  },
  {
    // Wayang: Shadow Magic carries the +1 shadow DC as a raw note, not a change.
    race: 'pf1/Vaf5bV3wpk24pVt2',
    descriptionSha256:
      '250d2c6b41121b00c9fe71e57e02988886a621cebe6034ff1da923c73cfca5f4',
    outputTarget: 'spellDC',
    trait: 'pf1-content/XixpDZG7W0XELNni',
    supersedes: {
      kind: 'note',
      target: 'dc.school.ill',
      text: '+[[1]] to the DC of spells of the shadow subschool.',
    },
    evidence: 'Checked #328 description output and the pinned trait record',
  },
];

/**
 * #720: a race or trait change the source does not support as an unconditional
 * Modifier. It is reported with its reason and contributes nothing.
 */
export type ReviewedUnsupportedChange = {
  externalKey: string;
  change: RawChange & { target: string };
  reason: string;
};

export const reviewedUnsupportedChanges: readonly ReviewedUnsupportedChange[] =
  [
    {
      // The native race and Skilled (Svirfneblin) both specify Craft
      // (alchemy), not every Craft skill. The trait's untargeted change
      // likewise instructs the player to select that specialization.
      externalKey: 'pf1/fX9F2amW2BcYoHwb',
      change: { target: 'skill.crf', formula: '2', type: 'racial' },
      reason:
        'Specific to Craft (alchemy) in the pinned race and Skilled (Svirfneblin) text (Inner Sea Races p. 250; Advanced Race Guide p. 204). The sheet has no Craft specialization target; the bonus stays readable and contributes nothing to generic Craft.',
    },
    {
      // Delicious: "–2 penalty on Escape Artist and combat maneuver checks to
      // escape a grapple against a creature that has a bite attack with the
      // grab ability". The checked #328 description record states it as a
      // Situational Note and a conditional CMB Modifier; no shared Situation
      // fits it exactly.
      externalKey: 'pf1/2mWMyKiPWk6Y8cNx', // Ghoran
      change: { target: 'skill.esc', formula: '-2', type: 'untyped' },
      reason:
        'Conditional in the source (Delicious, Ultimate Wilderness p. 15: only to escape a grapple against a creature with a bite attack and grab); the checked description note states it, so it contributes nothing.',
    },
    // #328's checked description outputs supply these races' natural armor.
    // A race imported as one entry, without its traits, would otherwise count
    // its raw change beside the output. With its traits, the natural armor
    // trait owns the raw change (#719), so this applies to neither.
    ...(
      [
        ['pf1/2mWMyKiPWk6Y8cNx', '2'], // Ghoran
        ['pf1/9FBT6uqlRgaw9gug', '1'], // Changeling
        ['pf1/Lt4ZP5GCinGvTfnF', '2'], // Grindylow
        ['pf1/NhEPoXIZWOOunSH7', '2'], // Cecaelia
        ['pf1/ZVzH0qb1Tqety6fU', '1'], // Nagaji
      ] as const satisfies readonly (readonly [string, string])[]
    ).map(([externalKey, formula]) => ({
      externalKey,
      change: { target: 'nac', formula, type: 'base' },
      reason:
        'The checked description output supplies this natural armor bonus; the raw change would count it again.',
    })),
    {
      // Primitive Feat (Primitive Human): its record cites only a Paizo blog
      // post, so no reviewed bonus feat rule is added (orchestrator decision 4).
      externalKey: 'pf1-content/9bVCgccjlCuW7YyP',
      change: { target: 'bonusFeats', formula: '1', type: 'untyped' },
      reason:
        'No reviewed bonus feat rule: the source is a Paizo blog post, not a published product; it contributes nothing.',
    },
  ];

/** The reviewed reason a record's raw change is unsupported, if any. */
export function reviewedUnsupportedReason(
  externalKey: string,
  change: Record<string, unknown>,
) {
  return reviewedUnsupportedChanges.find(
    (rule) =>
      rule.externalKey === externalKey && matchesRawChange(change, rule.change),
  )?.reason;
}

/**
 * #720: a race or trait natural armor change the source states as a *racial*
 * bonus to natural armor. It keeps its racial type, so it stacks with another
 * natural armor bonus (CRB pp. 12, 179); every other race and trait natural
 * armor change is a natural armor bonus.
 */
export const reviewedRacialNaturalArmor: readonly {
  externalKey: string;
  change: RawChange & { target: 'nac' };
  evidence: Evidence;
}[] = [
  {
    // Granite Skin (Oread): "They gain a +1 racial bonus to natural armor."
    externalKey: 'pf1-content/aD19XOFMcxvFTIYY',
    change: { target: 'nac', formula: '1', type: 'racial' },
    evidence: { book: 'PZO1121', pages: '144' },
  },
];

/** Whether a record's raw natural armor change is a reviewed racial bonus. */
export function isReviewedRacialNaturalArmor(
  externalKey: string,
  change: Record<string, unknown>,
) {
  return reviewedRacialNaturalArmor.some(
    (rule) =>
      rule.externalKey === externalKey && matchesRawChange(change, rule.change),
  );
}

/** The reviewed rules for a pinned trait; an alternate may have several. */
export function findRacialTraitRules(externalKey: string) {
  return reviewedRacialTraitRules.filter(
    (rule) => rule.externalKey === externalKey,
  );
}

/** Exact raw change identity: an absent or empty target is untargeted. */
export function matchesRawChange(
  change: Record<string, unknown>,
  raw: RawChange,
) {
  const target =
    typeof change.target === 'string' && change.target !== ''
      ? change.target
      : undefined;
  return (
    target === raw.target &&
    change.formula === raw.formula &&
    change.type === raw.type
  );
}

/**
 * #721: a reviewed ability score Racial Trait for a pinned race whose fixed
 * ability changes no pinned trait record owns. The trait carries exactly the
 * race record's own ability changes, which the rule names; when they no longer
 * match, the rule is reported stale and the changes stay on the race.
 */
export type RaceAbilityTraitRule = {
  /** The pinned race record. */
  race: string;
  /** The race's name: the trait is `Ability Score Modifiers (<name>)`. */
  name: string;
  /** The race description's heading for the line the trait stands for. */
  heading: string;
  /** The race record's first cited book and page, the published text. */
  evidence: Evidence;
  /** PCGen's `<Race> ~ Ability Scores` comparison, or `none`. */
  pcgen: string;
  consumes: (RawChange & { target: string })[];
  /** A reported difference between the record and its published text. */
  note?: string;
};

/** The stable identity of a race's reviewed ability score trait. */
export function raceAbilityTraitKey(raceKey: string) {
  return `local/race-ability-scores/${raceKey}`;
}

const abilityKeys = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha']);
/** `'dex 2, con -2'`: the race record's ability targets and formulas. */
function parseAbilityChanges(changes: string) {
  return changes.split(', ').map((change) => {
    const match = /^(\w+) (-?\d+)$/.exec(change);
    const [, target = '', formula = ''] = match ?? [];
    if (!match || !abilityKeys.has(target))
      throw new Error(`Malformed reviewed ability change: "${change}"`);
    return { target, formula, type: 'racial' };
  });
}

/**
 * One rule; `changes` lists the race record's ability targets and formulas in
 * record order, all `racial` (ep-orch/research/721.md §1).
 */
function abilityLine({
  race,
  name,
  evidence,
  changes,
  heading = 'Ability Score Modifiers',
  pcgen = 'none',
  note,
}: {
  race: string;
  name: string;
  evidence: Evidence;
  changes: string;
  heading?: string;
  pcgen?: string;
  note?: string;
}): RaceAbilityTraitRule {
  return {
    race,
    name,
    heading,
    evidence,
    pcgen,
    consumes: parseAbilityChanges(changes),
    ...(note ? { note } : {}),
  };
}

const coreEssentials = 'Core Essentials';
const dimorphism = ({ sex, changes }: { sex: string; changes: string }) =>
  `The race text's Ability Score Modifiers give +2 Intelligence; the ${sex} ${changes} come from its Dimorphism text (Inner Sea Races p. 246), and PCGen's Lashunta ~ Ability Scores is +2 Intelligence only. The trait carries the record's changes as they are; the Sexual Dimorphism trait record (pf1-content/H8rQtfSQ6Ws9EicL), which binds no race, is not merged.`;

export const reviewedRaceAbilityTraits: readonly RaceAbilityTraitRule[] = [
  abilityLine({
    race: 'pf1/FHY3oIk5zSOFncJH',
    name: 'Aasimar',
    evidence: { book: 'PZO9280', pages: '238' },
    changes: 'wis 2, cha 2',
    pcgen: 'ARG p. 85',
    note: 'The race description gives only "+2 Charisma"; the record and PCGen give +2 Wisdom and +2 Charisma.',
  }),
  abilityLine({
    race: 'pf1/LAtTC2NPuqjTLEkn',
    name: 'Adaro',
    evidence: { book: 'PZO9482', pages: '16' },
    changes: 'str 2, dex 2, int -2, con 2',
  }),
  abilityLine({
    race: 'pf1/9Fe6mDt0oP52m6Jl',
    name: 'Android',
    evidence: { book: 'PZO1133', pages: '19' },
    changes: 'dex 2, int 2, cha -2',
    pcgen: coreEssentials,
  }),
  abilityLine({
    race: 'pf1/zlWiqUqxCajrZRe3',
    name: 'Aphorite',
    evidence: { book: 'PZO1141', pages: '224' },
    changes: 'str 2, int 2, dex -2',
  }),
  abilityLine({
    race: 'pf1/E6bHjOMkRatMQwbR',
    name: 'Aquatic Elf',
    evidence: { book: 'PZO9482', pages: '4' },
    changes: 'dex 2, int 2, con -2',
    pcgen: coreEssentials,
  }),
  abilityLine({
    race: 'pf1/JxLvkHxDYY98HcAH',
    name: 'Astomoi',
    evidence: { book: 'PZO1133', pages: '37' },
    changes: 'int 2, wis 2, con -2',
  }),
  abilityLine({
    race: 'pf1/ZYWZL5BWLfZyMif9',
    name: 'Being of Ib',
    evidence: { book: 'PZO90111', pages: '87' },
    changes: 'str -4, con -2, wis 4',
    heading: '–4 Strength, –2 Constitution, +4 Wisdom',
  }),
  abilityLine({
    race: 'pf1/WzN6fEHiT8OTpwUR',
    name: 'Caligni',
    evidence: { book: 'PZO1133', pages: '66' },
    changes: 'dex 2, con 2, int -2',
  }),
  abilityLine({
    race: 'pf1/VE4d35yiptv2eyxm',
    name: 'Catfolk',
    evidence: { book: 'PZO9280', pages: '239' },
    changes: 'dex 2, cha 2, wis -2',
    pcgen: 'ARG p. 91',
  }),
  abilityLine({
    race: 'pf1/NhEPoXIZWOOunSH7',
    name: 'Cecaelia',
    evidence: { book: 'PZO9482', pages: '6' },
    changes: 'wis 2, dex 2, int -2',
    heading: 'Ability Scores Modifiers',
  }),
  abilityLine({
    race: 'pf1/Z76GkfAvnzba4XDd',
    name: 'Deep One Hybrid',
    evidence: { book: 'PZO1133', pages: '70' },
    changes: 'wis 2, con 2, dex -2',
  }),
  abilityLine({
    race: 'pf1/puKk997wHX3kIRkR',
    name: 'Dhampir',
    evidence: { book: 'PZO9280', pages: '240' },
    changes: 'dex 2, cha 2, con -2',
    pcgen: 'ARG p. 97',
  }),
  abilityLine({
    race: 'pf1/yLaDS5HGbwtgpkbP',
    name: 'Drow',
    evidence: { book: 'PZO9280', pages: '241' },
    changes: 'dex 2, cha 2, con -2',
    heading: 'Ability Score Modifier',
    pcgen: 'ARG p. 103',
  }),
  abilityLine({
    race: 'pf1/jLZAApW8ymudcJpw',
    name: 'Drow Noble',
    evidence: { book: 'PZO1112', pages: '115' },
    changes: 'dex 4, cha 2, con -2, int 2, wis 2',
    heading: 'Ability Score Modifier',
  }),
  abilityLine({
    race: 'pf1/eV9USBGHA1rYd5P7',
    name: 'Duergar',
    evidence: { book: 'PZO9280', pages: '241' },
    changes: 'con 2, wis 2, cha -4',
    pcgen: 'ARG p. 186',
  }),
  abilityLine({
    race: 'pf1/HKRRq2tdZVEGlmHG',
    name: 'Duskwalker',
    evidence: { book: 'PZO1141', pages: '230' },
    changes: 'dex 2, wis 2, con -2',
  }),
  abilityLine({
    race: 'pf1/nEltI9y37rKJTeWo',
    name: 'Dwarf',
    evidence: { book: 'PZO1110', pages: '21' },
    changes: 'con 2, wis 2, cha -2',
    pcgen: 'CRB p. 21',
  }),
  abilityLine({
    race: 'pf1/NgIhxRI0axrf3fcO',
    name: 'Elf',
    evidence: { book: 'PZO1110', pages: '22' },
    changes: 'dex 2, int 2, con -2',
    pcgen: 'CRB p. 22',
  }),
  abilityLine({
    race: 'pf1/6BKIB9hjKwSJorAZ',
    name: 'Fetchling',
    evidence: { book: 'PZO9280', pages: '242' },
    changes: 'dex 2, cha 2, wis -2',
    heading: 'Ability Score Modifier',
    pcgen: 'ARG p. 109',
  }),
  abilityLine({
    race: 'pf1/QKrRHanuWwD4pu8Q',
    name: 'Ganzi',
    evidence: { book: 'PZO1141', pages: '234' },
    changes: 'con 2, cha 2, int -2',
  }),
  abilityLine({
    race: 'pf1/2mWMyKiPWk6Y8cNx',
    name: 'Ghoran',
    evidence: { book: 'PZO1140', pages: '15' },
    changes: 'con 2, cha 2, int -2',
    pcgen: coreEssentials,
  }),
  abilityLine({
    race: 'pf1/Gy4jOckBEwMjByga',
    name: 'Gillman',
    evidence: { book: 'PZO9482', pages: '8' },
    changes: 'con 2, cha 2, wis -2',
    pcgen: 'ARG p. 188',
  }),
  abilityLine({
    race: 'pf1/ITHs6VCRdSQUsoen',
    name: 'Gnoll',
    evidence: { book: 'PZO1112', pages: '155' },
    changes: 'str 2, con 2',
    pcgen: 'Bestiary monster race line, p. 155',
  }),
  abilityLine({
    race: 'pf1/efwHEwjvL9Z94MJI',
    name: 'Gnome',
    evidence: { book: 'PZO1110', pages: '23' },
    changes: 'con 2, cha 2, str -2',
    pcgen: 'CRB p. 23',
  }),
  abilityLine({
    race: 'pf1/bOv30pyHB1gFbSTj',
    name: 'Goblin',
    evidence: { book: 'PZO9280', pages: '244' },
    changes: 'dex 4, str -2, cha -2',
    pcgen: 'ARG p. 115',
  }),
  abilityLine({
    race: 'pf1/YxeSVRbG7lfQybfr',
    name: 'Green Martian',
    evidence: { book: 'DYN0032-E', pages: '24' },
    changes: 'str 2, wis 2, cha -2',
    heading: '+2 Strength, +2 Wisdom, -2 Charisma',
    note: 'The record cites a Dynamite product, which the known notice hold holds.',
  }),
  abilityLine({
    race: 'pf1/Lt4ZP5GCinGvTfnF',
    name: 'Grindylow',
    evidence: { book: 'PZO9482', pages: '17' },
    changes: 'dex 4, int -2, wis -2, cha -2',
    heading: 'Ability Scores Modifier',
  }),
  abilityLine({
    race: 'pf1/MSLlV9YnompTd6xp',
    name: 'Grippli',
    evidence: { book: 'PZO9280', pages: '244' },
    changes: 'dex 2, wis 2, str -2',
    heading: 'Ability Score Modifier',
    pcgen: 'ARG p. 190',
  }),
  abilityLine({
    race: 'pf1/Hf31mrYb3uucNyLO',
    name: 'Halfling',
    evidence: { book: 'PZO1110', pages: '26' },
    changes: 'dex 2, cha 2, str -2',
    pcgen: 'CRB p. 26',
  }),
  abilityLine({
    race: 'pf1/19JcztRuEWbrOqQW',
    name: 'Hobgoblin',
    evidence: { book: 'PZO9280', pages: '244' },
    changes: 'dex 2, con 2',
    pcgen: 'ARG p. 121',
  }),
  abilityLine({
    race: 'pf1/TPHe88Yhy4SsDpKo',
    name: 'Ifrit',
    evidence: { book: 'PZO9280', pages: '245' },
    changes: 'dex 2, cha 2, wis -2',
    pcgen: 'ARG p. 127',
  }),
  abilityLine({
    race: 'pf1/VYbsatEW3DFCLWtD',
    name: 'Kasatha',
    evidence: { book: 'PZO9280', pages: '245' },
    changes: 'dex 2, wis 2',
    pcgen: coreEssentials,
  }),
  abilityLine({
    race: 'pf1/LMNzbqGSRAFQFE2Y',
    name: 'Kobold',
    evidence: { book: 'PZO9280', pages: '245' },
    changes: 'dex 2, str -4, con -2',
    pcgen: 'ARG p. 133',
  }),
  abilityLine({
    race: 'pf1/Mb6NAx0BJsoKbvt6',
    name: 'Kuru',
    evidence: { book: 'PZO9244', pages: '51' },
    changes: 'dex 2, con 2, int -2',
  }),
  abilityLine({
    race: 'pf1/7aDvyO68K8hm58Qm',
    name: 'Lashunta (Female)',
    evidence: { book: 'PZO9280', pages: '246' },
    changes: 'int 2, cha 2, con -2',
    pcgen: coreEssentials,
    note: dimorphism({
      sex: 'female',
      changes: '+2 Charisma and −2 Constitution',
    }),
  }),
  abilityLine({
    race: 'pf1/g9GYFtD8FOxtUGvJ',
    name: 'Lashunta (Male)',
    evidence: { book: 'PZO9280', pages: '246' },
    changes: 'int 2, str 2, wis -2',
    pcgen: coreEssentials,
    note: dimorphism({ sex: 'male', changes: '+2 Strength and −2 Wisdom' }),
  }),
  abilityLine({
    race: 'pf1/LU6Rgor1wTS5cCRN',
    name: 'Lizardfolk',
    evidence: { book: 'PZO1121', pages: '226' },
    changes: 'str 2, con 2',
    pcgen:
      'Bestiary monster race line, p. 195; it adds −2 Intelligence and is not comparable',
  }),
  abilityLine({
    race: 'pf1/WxPc1Nw2V3ohdl2x',
    name: 'Locathah',
    evidence: { book: 'PZO9482', pages: '10' },
    changes: 'dex 2, wis 2, int -2',
    heading: 'Ability Scores',
  }),
  abilityLine({
    race: 'pf1/3lV30qfiQaWKB0sp',
    name: 'Merfolk',
    evidence: { book: 'PZO9482', pages: '12' },
    changes: 'dex 2, con 2, cha 2',
    pcgen: 'ARG p. 194',
  }),
  abilityLine({
    race: 'pf1/aCyDEyMB5PKJAuTi',
    name: 'Monkey Goblin',
    evidence: { book: 'PZO1137', pages: '138' },
    changes: 'dex 4, wis -2, cha -2',
    pcgen: coreEssentials,
  }),
  abilityLine({
    race: 'pf1/jhh6z3NZlImHjZ8H',
    name: 'Munavri',
    evidence: { book: 'PZO1137', pages: '197' },
    changes: 'dex 4, str -2, con 2, int 2, wis 2, cha 2',
    heading:
      '–2 Strength, +4 Dexterity, +2 Constitution, +2 Intelligence, +2 Wisdom, +2 Charisma',
  }),
  abilityLine({
    race: 'pf1/ZVzH0qb1Tqety6fU',
    name: 'Nagaji',
    evidence: { book: 'PZO9280', pages: '246' },
    changes: 'str 2, cha 2, int -2',
    pcgen: 'ARG p. 196',
  }),
  abilityLine({
    race: 'pf1/TpfcHDjKatQL3XBl',
    name: 'Naiad',
    evidence: { book: 'PZO1137', pages: '200' },
    changes: 'dex 2, cha 2, str -2',
    heading: 'Ability Scores',
  }),
  abilityLine({
    race: 'pf1/gZxiUYLYsGqQYwGZ',
    name: 'Ogre',
    evidence: { book: 'PZO1121', pages: '229' },
    changes: 'str 4, con 2, int -2, cha -2',
    pcgen:
      'Bestiary monster race line, p. 220; the monster block, not comparable',
  }),
  abilityLine({
    race: 'pf1/m5cdZ1RG7c1mkhqF',
    name: 'Orang-Pendak',
    evidence: { book: 'PZO1133', pages: '186' },
    changes: 'str 2, wis 2, int -2',
  }),
  abilityLine({
    race: 'pf1/JOuAdPAOTat7d5v6',
    name: 'Orc',
    evidence: { book: 'PZO9280', pages: '246' },
    changes: 'str 4, int -2, wis -2, cha -2',
    pcgen: 'ARG p. 139',
  }),
  abilityLine({
    race: 'pf1/4qEXPDlfIj1cIvCe',
    name: 'Oread',
    evidence: { book: 'PZO9280', pages: '247' },
    changes: 'str 2, wis 2, cha -2',
    pcgen: 'ARG p. 145',
  }),
  abilityLine({
    race: 'pf1/rAKaCt6BW3rVv2kN',
    name: 'Ratfolk',
    evidence: { book: 'PZO9280', pages: '247' },
    changes: 'dex 2, int 2, str -2',
    pcgen: 'ARG p. 151',
  }),
  abilityLine({
    race: 'pf1/LQ7U0315C6CusmsU',
    name: 'Reborn Samsaran',
    evidence: { book: 'PZO9284', pages: '50' },
    changes: 'int 2, wis 2, con -2',
  }),
  abilityLine({
    race: 'pf1/YCCdi4OEC4WuzelM',
    name: 'Reptoid',
    evidence: { book: 'PZO1133', pages: '202' },
    changes: 'str 2, cha 2, dex -2',
  }),
  abilityLine({
    race: 'pf1/ZnRc2qF1ZfpajxEe',
    name: 'Rougarou',
    evidence: { book: 'PZO1137', pages: '242' },
    changes: 'str 2, wis 2, int -2',
    pcgen: coreEssentials,
  }),
  abilityLine({
    race: 'pf1/TbZmYyDUxRn9baWy',
    name: 'Sahuagin',
    evidence: { book: 'PZO9482', pages: '17' },
    changes: 'str 2, wis 2, cha -2',
    heading: 'Ability Scores Modifiers',
  }),
  abilityLine({
    race: 'pf1/aQ8RQYKVd2hqI4jh',
    name: 'Samsaran',
    evidence: { book: 'PZO9280', pages: '247' },
    changes: 'int 2, wis 2, con -2',
    pcgen: 'ARG p. 198',
  }),
  abilityLine({
    race: 'pf1/H6tsZqHiaTOcFSOn',
    name: 'Shabti',
    evidence: { book: 'PZO1133', pages: '227' },
    changes: 'con 2, cha 2',
  }),
  abilityLine({
    race: 'pf1/apWl6JIJ8U8p0azq',
    name: 'Skinwalker',
    evidence: { book: 'PZO1133', pages: '233' },
    changes: 'wis 2, int -2',
    pcgen: coreEssentials,
    note: 'The race text adds "+2 to one physical ability score while shapechanged", which neither the record nor PCGen structures; it stays prose.',
  }),
  abilityLine({
    race: 'pf1/MF8vCjLIGTmJl3Mo',
    name: 'Strix',
    evidence: { book: 'PZO9280', pages: '249' },
    changes: 'dex 2, cha -2',
    heading: 'Ability Score Racial Traits',
    pcgen: 'ARG p. 200',
  }),
  abilityLine({
    race: 'pf1/Gtz5E4r6tg6spifD',
    name: 'Suli',
    evidence: { book: 'PZO9280', pages: '250' },
    changes: 'str 2, int -2, cha 2',
    pcgen: 'ARG p. 202',
  }),
  abilityLine({
    race: 'pf1/fX9F2amW2BcYoHwb',
    name: 'Svirfneblin',
    evidence: { book: 'PZO9280', pages: '250' },
    changes: 'dex 2, wis 2, str -2, cha -4',
    pcgen: 'ARG p. 204',
  }),
  abilityLine({
    race: 'pf1/pbX1xj9Z0ZhUfKvZ',
    name: 'Sylph',
    evidence: { book: 'PZO9280', pages: '250' },
    changes: 'dex 2, int 2, con -2',
    pcgen: 'ARG p. 157',
  }),
  abilityLine({
    race: 'pf1/ryBQiQNP6ZrkwZCy',
    name: 'Syrinx',
    evidence: { book: 'PZO9280', pages: '251' },
    changes: 'wis 2, dex -2',
    pcgen: coreEssentials,
  }),
  abilityLine({
    race: 'pf1/yAS41rHv0WzDmuRm',
    name: 'Tengu',
    evidence: { book: 'PZO9280', pages: '251' },
    changes: 'dex 2, wis 2, con -2',
    pcgen: 'ARG p. 163',
  }),
  abilityLine({
    race: 'pf1/nVjKDLZSRONzYm8f',
    name: 'Tiefling',
    evidence: { book: 'PZO9280', pages: '251' },
    changes: 'dex 2, int 2, cha -2',
    pcgen: 'ARG p. 169',
  }),
  abilityLine({
    race: 'pf1/sMHXS804w3UdTVKH',
    name: 'Triaxian',
    evidence: { book: 'PZO9280', pages: '252' },
    changes: 'con 2, wis 2, str -2',
    pcgen: coreEssentials,
  }),
  abilityLine({
    race: 'pf1/DQGhOq3M3uxTFKYO',
    name: 'Triton',
    evidence: { book: 'PZO9482', pages: '14' },
    changes: 'str 2, cha 2, dex -2',
    heading: 'Ability Scores',
  }),
  abilityLine({
    race: 'pf1/qdFPM6gztJxvdiRf',
    name: 'Trox',
    evidence: { book: 'PZO9280', pages: '253' },
    changes: 'str 6, int -2, wis -2, cha -2',
    pcgen: coreEssentials,
    note: 'The race text gives +4 Strength and Advanced Strength (+2); the record and PCGen carry the sum, +6.',
  }),
  abilityLine({
    race: 'pf1/iqJvhd7NbmybUl0y',
    name: 'Undine',
    evidence: { book: 'PZO9280', pages: '253' },
    changes: 'dex 2, wis 2, str -2',
    pcgen: 'ARG p. 175',
  }),
  abilityLine({
    race: 'pf1/VkQBqlEG8GPmNnzI',
    name: 'Vanara',
    evidence: { book: 'PZO9280', pages: '253' },
    changes: 'dex 2, wis 2, cha -2',
    pcgen: 'ARG p. 206',
  }),
  abilityLine({
    race: 'pf1/Yder5QR51sDl5X0n',
    name: 'Vishkanya',
    evidence: { book: 'PZO9280', pages: '253' },
    changes: 'dex 2, cha 2, wis -2',
    pcgen: 'ARG p. 208',
  }),
  abilityLine({
    race: 'pf1/Vaf5bV3wpk24pVt2',
    name: 'Wayang',
    evidence: { book: 'PZO9280', pages: '253' },
    changes: 'dex 2, int 2, wis -2',
    pcgen: 'ARG p. 210',
  }),
  abilityLine({
    race: 'pf1/PsRZOF49ZKtorZbs',
    name: 'Wyrwood',
    evidence: { book: 'PZO9280', pages: '253' },
    changes: 'dex 2, int 2, cha -2',
    pcgen: coreEssentials,
  }),
  abilityLine({
    race: 'pf1/4i8qiF2QnGnPOyKC',
    name: 'Wyvaran',
    evidence: { book: 'PZO9280', pages: '253' },
    changes: 'dex 2, int -2, wis 2',
    pcgen: coreEssentials,
  }),
  abilityLine({
    race: 'pf1/sXIQ3MFLInN9SF7m',
    name: 'Yaddithian',
    evidence: { book: 'PZO1137', pages: '285' },
    changes: 'con 2, int 2, wis -2',
  }),
];

export function findRaceAbilityTraitRule(raceKey: string) {
  return reviewedRaceAbilityTraits.find((rule) => rule.race === raceKey);
}

/**
 * #721: other names a pinned standard trait answers to in alternates'
 * "Replaced Trait(s)" headers, by pinned trait identity.
 */
export const reviewedTraitNameAliases: readonly {
  trait: string;
  names: string[];
  evidence: string;
}[] = [
  {
    // +2 to One Ability Score (Half-Elf), CRB p. 24.
    trait: 'pf1-content/orOAYDkNl4pqYWA4',
    names: ['Ability Score Modifiers'],
    evidence:
      'Kindred-Raised (Inner Sea Races p. 212): "This racial trait replaces the half-elf\'s usual racial ability score modifiers."',
  },
  {
    // +2 to One Ability Score (Half-Orc), CRB p. 25.
    trait: 'pf1-content/VHmuEYXmx81Q5EmC',
    names: ['Ability Score Modifiers'],
    evidence:
      'Orc Atavism (Advanced Race Guide p. 212): "This racial trait replaces the half-orc\'s usual racial ability score modifiers."',
  },
  {
    // Ability Modifiers (Changeling), Inner Sea Races p. 240.
    trait: 'pf1-content/PxjUu8YOjXmWdagL',
    names: ['Ability Score Modifiers'],
    evidence:
      'Witchborn (Inner Sea Races p. 215): "This racial trait alters the changeling\'s racial ability score modifiers."',
  },
  {
    // Ability Score Modifiers (Gathlain), Ultimate Wilderness p. 9.
    trait: 'pf1-content/7IMx5MBTrYTOhTnf',
    names: ['Constitution Penalty'],
    evidence:
      'Tree-Born (Ultimate Wilderness p. 10): "This replaces the penalty to Constitution"; its record\'s instructions remove this trait.',
  },
  {
    // Normal Speed (Gathlain), Ultimate Wilderness p. 9.
    trait: 'pf1-content/lhDGN1bu2IsaabX4',
    names: ['Speed'],
    evidence:
      'Tree-Born (Ultimate Wilderness p. 10): "and alters speed"; its record\'s instructions remove this trait.',
  },
];

/**
 * #721: heritage subraces whose pf1-content "Base Statistics" stands for their
 * race's ability score modifiers: each states its own ability line in prose.
 * The name resolves to the race's ability score trait only once the subrace
 * carries structured ability changes; until then it stays unresolved with
 * {@link proseAbilityLineReason}, so no base adjustment goes dormant without
 * its replacement.
 */
export const proseAbilityLineReason =
  'ability line is prose only; resolves once curated with structured Modifiers';
/** #721: an alternate whose own ability changes do not map to Modifiers. */
export const unmappedAbilityChangesReason =
  'its own ability changes do not map to Modifiers; resolves once they are reviewed or curated as Modifiers';
const heritage = ({
  id,
  book,
  pages,
}: {
  id: string;
  book: string;
  pages: string;
}) => ({
  externalKey: `pf1-content/${id}`,
  evidence: { book, pages },
});
export const reviewedAbilityLineSubraces: readonly {
  externalKey: string;
  evidence: Evidence;
}[] = [
  // Aasimar, Blood of Angels pp. 21–23.
  heritage({ id: 'nPKsivL973H9L7y7', book: 'PZO9424', pages: '21' }), // Agathion-Blooded (Idyllkin)
  heritage({ id: 'TbnWNAk91q2wgqCP', book: 'PZO9424', pages: '21' }), // Angel-Blooded (Angelkin)
  heritage({ id: '3haIOIRYDeFc1YZH', book: 'PZO9424', pages: '22' }), // Archon-Blooded (Lawbringers)
  heritage({ id: 'U8dkiXDmSDOETLxv', book: 'PZO9424', pages: '22' }), // Azata-Blooded (Musetouched)
  heritage({ id: 'R7UDXRs0E5klyzCY', book: 'PZO9424', pages: '23' }), // Garuda-Blooded (Plumekith)
  heritage({ id: 'KEXruHT9nIp41wT1', book: 'PZO9424', pages: '23' }), // Peri-Blooded (Emberkin)
  // Dhampir, Blood of the Night pp. 20–21.
  heritage({ id: 'Ni5twdUyps9MQyOX', book: 'PZO9427', pages: '20' }), // Jiang-Shi Born (Ru-Shi)
  heritage({ id: 'f91ILsrKfkpL9uUG', book: 'PZO9427', pages: '20' }), // Moroi-Born (Svetocher)
  heritage({ id: 'SFD4dGofogr1c1S9', book: 'PZO9427', pages: '21' }), // Nosferatu-Born (Ancient-Born)
  heritage({ id: 'yodj1nKWZ1hzQVVv', book: 'PZO9427', pages: '21' }), // Vetala-Born (Ajibachana)
  // Ifrit, Oread, Sylph and Undine, Plane-Hopper's Handbook pp. 20–22.
  heritage({ id: 'jAQXQDgwCX0eKxZ2', book: 'PZO9492', pages: '20' }), // Lavasoul (Magma Ifrit)
  heritage({ id: 'WE57FyExdDq2mjnV', book: 'PZO9492', pages: '22' }), // Sunsoul (Solar Ifrit)
  heritage({ id: 'a1otKF9eFw6gSfvB', book: 'PZO9492', pages: '20' }), // Gemsoul (Crystal Oread)
  heritage({ id: 'Hp26XuRpA7QNUOZO', book: 'PZO9492', pages: '20' }), // Ironsoul (Metal Oread)
  heritage({ id: 'DFWkrIYLx6L7Vs6W', book: 'PZO9492', pages: '21' }), // Smokesoul (Fume Sylph)
  heritage({ id: 'kLPypNzy62fMbj3d', book: 'PZO9492', pages: '21' }), // Stormsoul (Lightning Sylph)
  heritage({ id: 'yRISJZyDwhGV0jFO', book: 'PZO9492', pages: '21' }), // Mistsoul (Vapor Undine)
  heritage({ id: '0CISUAPF2V91vvoo', book: 'PZO9492', pages: '21' }), // Rimesoul (Frost Undine)
  // Skinwalker, Blood of the Moon pp. 10 and 18, and Strange Aeons p. 89.
  heritage({ id: 'mBfn8hCLwEsAxlnl', book: 'PZO9439', pages: '10' }), // Werebat-Kin (Bloodmarked)
  heritage({ id: 'ZLFxIufcHBwiIZrl', book: 'PZO9439', pages: '10' }), // Werebear-Kin (Coldborn)
  heritage({ id: 'Mb0hz0BAj51wOmUr', book: 'PZO9439', pages: '10' }), // Wereboar-Kin (Ragebred)
  heritage({ id: 'uj0JvFUtrmpOSNVa', book: 'PZO9439', pages: '10' }), // Werecrocodile-Kin (Scaleheart)
  heritage({ id: 'S2fAbQom6ogn4gh9', book: 'PZO90115', pages: '89' }), // Wereraptor-Kin (Aerieborn)
  heritage({ id: 'mNPzfPRAdgvumhww', book: 'PZO9439', pages: '18' }), // Wererat-Kin (Nightskulk)
  heritage({ id: 'wrqUJsULTxngAMQb', book: 'PZO9439', pages: '10' }), // Wereshark-Kin (Seascarred)
  heritage({ id: 'nopyUgzhxcD4G8uD', book: 'PZO9439', pages: '10' }), // Weretiger-Kin (Fanglord)
  heritage({ id: 'calSa82WwxgUFwXr', book: 'PZO9439', pages: '10' }), // Werewolf-Kin (Witchwolf)
  // Tiefling, Blood of Fiends pp. 19–23.
  heritage({ id: 'NBmeuhkyRCjD3kV4', book: 'PZO9423', pages: '19' }), // Asura-Spawn (Faultspawn)
  heritage({ id: 'zlOXohhDPfhgEstJ', book: 'PZO9423', pages: '19' }), // Daemon-Spawn (Grimspawn)
  heritage({ id: 'zaQk4Qx8fsdxsOSW', book: 'PZO9423', pages: '20' }), // Demodand-Spawn (Foulspawn)
  heritage({ id: 'emgcgmgSjpuv1GHa', book: 'PZO9423', pages: '20' }), // Demon-Spawn (Pitborn)
  heritage({ id: 'izCRmMUEyikdfpiq', book: 'PZO9423', pages: '21' }), // Devil-Spawn (Hellspawn)
  heritage({ id: '0iFqZXfHNt2vAJ8h', book: 'PZO9423', pages: '21' }), // Div-Spawn (Spitespawn)
  heritage({ id: 'UMT2CcRjz9uXlsvb', book: 'PZO9423', pages: '22' }), // Kyton-Spawn (Shackleborn)
  heritage({ id: 'BgNdXPtHRUJOuPwF', book: 'PZO9423', pages: '22' }), // Oni-Spawn (Hungerseed)
  heritage({ id: 'iWZjiKTQnGS5XnB0', book: 'PZO9423', pages: '23' }), // Qlippoth-Spawn (the Motherless)
  heritage({ id: 'JLGJMVewolF9XNVW', book: 'PZO9423', pages: '23' }), // Rakshasa-Spawn (Beastbrood)
];

/** #721: alternates that stay unresolved with a reviewed reason. */
export const reviewedUnresolvedAlternates: readonly {
  externalKey: string;
  reason: string;
  evidence: string;
}[] = [];
