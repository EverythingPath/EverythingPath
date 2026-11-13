// The plain-Modifiers family's public word fixture
// (`convex/characterSheetModifiers.integration.test.ts` releases it): one
// body per word the family's scope certifies, each with one output (a
// discriminated `output.kind`, and an emitted output that is one variant
// with a one-item list, so a case or body with none or two doesn't
// typecheck; the bodies that carry no word, the race and the slots' feats,
// are built apart). A
// word is the case's carrier kind (feat, Racial Trait or trait) with one
// output the importer emits for a proven pair: an unconditional Modifier of
// a pair's target and bonus type, a constant or the Strength modifier; a
// feat slot, open or listing its only feat, of one or several (two); or a
// Racial Trait's bonus skill rank per level, which only a Racial Trait's
// detail carries. The public test releases each kind's cases on one sheet
// (a kind's constant cases each have their own target and bonus type; its
// Strength formula shares `skill.int` untyped with one of them, and untyped
// bonuses stack, so none suppresses another) and asserts every case alike,
// from its data: the contribution on
// exactly the statistics its target reaches, every total raised by exactly
// the kind's contributions, and a slot of its count and feats in the bonus
// feat budget. The family's registry entry binds this module by bytes beside
// the proof (`scripts/catalog/launch-mechanism-proofs.ts`), and the catalog
// test's coverage tie (`tests/catalog/launch-modifiers.test.ts`) checks that
// every word the scope certifies is one a case here releases.

export const carrierKinds = ['feat', 'racialTrait', 'trait'] as const;
export type CarrierKind = (typeof carrierKinds)[number];

/** An unconditional Modifier: a constant, or the Strength modifier. */
export type WordModifierOutput =
  | { kind: 'constant'; target: string; bonusType: string; value: number }
  | {
      kind: 'ability-modifier';
      target: string;
      bonusType: string;
      ability: 'str';
    };
/** A feat slot of `count` feats: open, or listing the fixture's one feat. */
export type WordSlotOutput = {
  kind: 'feat-slot';
  count: number;
  feats: 'open' | 'listed';
};
/** One bonus skill rank per level: a Racial Trait's detail only. */
export type WordRankOutput = { kind: 'skill-rank-per-level' };
type CaseName = { key: string; name: string };
export type WordCase =
  | (CaseName & {
      kind: CarrierKind;
      output: WordModifierOutput | WordSlotOutput;
    })
  | (CaseName & { kind: 'racialTrait'; output: WordRankOutput });

/** The race whose standard traits are the Racial Trait cases. */
export const wordRace = 'pf1/plainModifierWordRace';
/** The feat a listed slot names, and two feats an open slot of two holds. */
export const listedFeat = 'pf1/plainModifierWordListedFeat';
export const fillerFeats = [
  'pf1/plainModifierWordFillerA',
  'pf1/plainModifierWordFillerB',
] as const;

const keyOf = (kind: CarrierKind, id: string) =>
  `${kind === 'feat' ? 'pf1' : 'pf1-content'}/plainModifierWord${kind}${id}`;
const capitalised = (text: string) =>
  text.replace(/(^|[.])([a-z])/g, (_, _dot, letter: string) =>
    letter.toUpperCase(),
  );

/**
 * The skills with a constant pair, each in the racial, trait and untyped
 * bonus types.
 */
const skills = [
  'acr',
  'apr',
  'blf',
  'clm',
  'dev',
  'dip',
  'dis',
  'esc',
  'han',
  'hea',
  'int',
  'kar',
  'kdu',
  'ken',
  'kge',
  'khi',
  'klo',
  'kna',
  'kno',
  'kpl',
  'kre',
  'per',
  'rid',
  'sen',
  'slt',
  'spl',
  'ste',
  'sur',
  'swm',
  'umd',
] as const;
/**
 * Each constant (target, bonus type, value): the saves and initiative
 * untyped and trait, a dodge bonus to AC, a racial bonus on all saves and
 * every listed skill in the racial, trait and untyped types. The values are
 * the real rows' (Iron Will's +2, Improved Initiative's +4, Reactionary's +2,
 * Dodge's +1, Halfling Luck's +1, Keen Senses' +2), one per word.
 */
const constants: readonly [target: string, bonusType: string, value: number][] =
  [
    ['save.will', 'untyped', 2],
    ['save.will', 'trait', 1],
    ['save.fort', 'untyped', 2],
    ['save.fort', 'trait', 1],
    ['save.ref', 'untyped', 2],
    ['save.ref', 'trait', 1],
    ['init', 'untyped', 4],
    ['init', 'trait', 2],
    ['ac', 'dodge', 1],
    ['saves', 'racial', 1],
    ...skills.flatMap((skill) =>
      (['racial', 'trait', 'untyped'] as const).map(
        (bonusType): [string, string, number] => [
          `skill.${skill}`,
          bonusType,
          bonusType === 'trait' ? 1 : 2,
        ],
      ),
    ),
  ];

/** A kind's cases: every constant, the Strength formula and four slots. */
function casesOf(kind: CarrierKind): WordCase[] {
  const named = (id: string) => ({
    key: keyOf(kind, id),
    name: `Word ${kind} ${id}`,
  });
  return [
    ...constants.map(
      ([target, bonusType, value]): WordCase => ({
        ...named(`${capitalised(target)}${capitalised(bonusType)}`),
        kind,
        output: { kind: 'constant', target, bonusType, value },
      }),
    ),
    // Intimidating Prowess: `skill.int @abilities.str.mod`, untyped.
    {
      ...named('SkillIntStrength'),
      kind,
      output: {
        kind: 'ability-modifier',
        target: 'skill.int',
        bonusType: 'untyped',
        ability: 'str',
      },
    },
    // Bonus Feat (Human) and Adaptability: `bonusFeats 1`, open and listed;
    // and `bonusFeats 2`, each way.
    ...(['open', 'listed'] as const).flatMap((feats) =>
      [1, 2].map(
        (count): WordCase => ({
          ...named(`Slot${capitalised(feats)}${count}`),
          kind,
          output: { kind: 'feat-slot', count, feats },
        }),
      ),
    ),
  ];
}

/** The cases, one per certified word. */
export const wordCases: readonly WordCase[] = [
  ...carrierKinds.flatMap(casesOf),
  // Skilled (Human): `bonusSkillRanks @attributes.hd.total`.
  {
    key: keyOf('racialTrait', 'Ranks'),
    name: 'Word racialTrait Ranks',
    kind: 'racialTrait',
    output: { kind: 'skill-rank-per-level' },
  },
];

/** An emitted unconditional Modifier, as the importer gives it. */
export type EmittedModifier = {
  target: string;
  bonusType: string;
  value: number | { formula: string };
};
/** An emitted feat slot: open, or listing its one feat. */
export type EmittedSlot =
  | { kind: 'feat'; count: number }
  | { kind: 'feat'; count: number; feats: [string] };
/**
 * A case's one output, as the importer emits it: one Modifier, one feat
 * slot or one bonus rank per level, each its own variant, so none and two
 * are unrepresentable.
 */
export type EmittedOutput =
  | { kind: 'modifier'; modifiers: [EmittedModifier] }
  | { kind: 'slot'; grantsSlots: [EmittedSlot] }
  | { kind: 'rank'; bonusSkillRanksPerLevel: 1 };

/** A case's one output, as the importer emits it on the body. */
export function wordOutputs({
  output,
}: Pick<WordCase, 'output'>): EmittedOutput {
  switch (output.kind) {
    case 'constant':
      return {
        kind: 'modifier',
        modifiers: [
          {
            target: output.target,
            bonusType: output.bonusType,
            value: output.value,
          },
        ],
      };
    case 'ability-modifier':
      return {
        kind: 'modifier',
        modifiers: [
          {
            target: output.target,
            bonusType: output.bonusType,
            value: { formula: `@ability.${output.ability}.mod` },
          },
        ],
      };
    case 'feat-slot':
      return {
        kind: 'slot',
        grantsSlots: [
          output.feats === 'listed'
            ? { kind: 'feat', count: output.count, feats: [listedFeat] }
            : { kind: 'feat', count: output.count },
        ],
      };
    case 'skill-rank-per-level':
      return { kind: 'rank', bonusSkillRanksPerLevel: 1 };
  }
}

const sources = [{ book: 'PZO1110', pages: '1' }];
type Detail = { kind: string } & Record<string, unknown>;
/** A body's fields beside its outputs, shaped as the importer emits them. */
function bodyFields([externalKey, name]: [string, string], detail: Detail) {
  return {
    externalKey,
    upstreamKey: externalKey,
    pack:
      detail.kind === 'feat'
        ? 'feats'
        : detail.kind === 'trait'
          ? 'pf-traits'
          : 'races',
    name,
    detail,
    description: `${name}.`,
    sources,
    unsupported: [],
  };
}
/** A body the cases need that carries no word: the race, a slot's feat. */
function supportingBody(names: [string, string], detail: Detail) {
  return { ...bodyFields(names, detail), modifiers: [] };
}
const featDetail = { kind: 'feat', featTypes: ['General'], repeatable: 'no' };

/**
 * A case's body, of its kind, carrying its one output: its one Modifier, or
 * no Modifier and its one slot, or no Modifier and its detail's one rank.
 */
export function wordBody(word: WordCase) {
  const output = wordOutputs(word);
  const detail: Detail =
    word.kind === 'feat'
      ? featDetail
      : word.kind === 'trait'
        ? { kind: 'trait', traitType: 'social' }
        : {
            kind: 'racialTrait',
            bonusSkillRanksPerLevel:
              output.kind === 'rank' ? output.bonusSkillRanksPerLevel : 0,
            raceKeys: [wordRace],
            standard: true,
            replaces: [],
          };
  const fields = bodyFields([word.key, word.name], detail);
  switch (output.kind) {
    case 'modifier':
      return { ...fields, modifiers: output.modifiers };
    case 'slot':
      return { ...fields, modifiers: [], grantsSlots: output.grantsSlots };
    case 'rank':
      return { ...fields, modifiers: [] };
  }
}

/**
 * The bodies one kind's sheet releases: its cases, the slots' feats and,
 * for Racial Traits, the race whose standard traits they are.
 */
export function wordBodiesOf(kind: CarrierKind) {
  const cases = wordCases.filter((word) => word.kind === kind);
  return [
    ...(kind === 'racialTrait'
      ? [
          supportingBody([wordRace, 'Word Race'], {
            kind: 'race',
            racialHitDice: 0,
            creatureTypes: ['humanoid'],
            creatureSubtypes: [],
            racialTraits: cases.map(({ key }) => key),
            size: 'medium',
          }),
        ]
      : []),
    ...[listedFeat, ...fillerFeats].map((key) =>
      supportingBody([key, `Word feat ${key.split('/')[1]}`], featDetail),
    ),
    ...cases.map(wordBody),
  ];
}

/** Every body the public proof releases, across the kinds' sheets, once. */
export const wordBodies = [
  ...new Map(
    carrierKinds
      .flatMap(wordBodiesOf)
      .map((body) => [body.externalKey, body] as const),
  ).values(),
];
