/**
 * Isolated legal demonstration for #740, never an admission.
 * Pinned #719 Human graph (PF1 418761d2; pf1-content 02f4ab0d).
 * CRB p.27 / ARG p.72; provenance.json in that fixture owns source hashes.
 * Only resolver fields and source references are retained; no corpus copy.
 * human-dual-talent-fixture.test.ts verifies this projection against importCatalog.
 */
import type { CharacterSheetCatalogEntry } from '../../src/lib/character-sheet';

// This graph has only unconditional numeric modifiers and prose notes.
type FixtureDefinition = Pick<
  CharacterSheetCatalogEntry,
  '_id' | 'name' | 'ruleIdentity' | 'detail' | 'stacksWithItself'
> & {
  modifiers: {
    target: 'ability.$choice';
    bonusType: 'racial';
    value: number;
  }[];
  situationalNotes?: { text: string }[];
  grantsSlots?: { kind: 'feat'; count: number }[];
  sources: { book: string; pages: string }[];
};
export const humanDualTalentCatalog: FixtureDefinition[] = [
  {
    _id: 'pf1/e6IaBxKgMxy1yKlr',
    name: 'Human',
    ruleIdentity: 'pf1/e6IaBxKgMxy1yKlr',
    stacksWithItself: false,
    modifiers: [],
    detail: {
      kind: 'race',
      racialHitDice: 0,
      creatureTypes: ['humanoid'],
      creatureSubtypes: ['human'],
      racialTraits: [
        'pf1-content/BFszTUJLlDS1ZDB8',
        'pf1-content/LwDcZanOEHqVaYoh',
        'pf1-content/eNIYJNbM6UL7OdyE',
        'pf1-content/uAJ9hLZYdH2JX7J8',
      ],
      size: 'medium',
    },
    sources: [
      {
        book: 'PZO1110',
        pages: '27',
      },
    ],
  },
  {
    _id: 'pf1-content/BFszTUJLlDS1ZDB8',
    name: '+2 to One Ability Score (Human)',
    ruleIdentity: 'pf1-content/BFszTUJLlDS1ZDB8',
    stacksWithItself: false,
    modifiers: [
      {
        target: 'ability.$choice',
        bonusType: 'racial',
        value: 2,
      },
    ],
    situationalNotes: [
      {
        text: 'Race: Human\nHuman characters get a +2 bonus to one ability score of their choice at creation to represent their varied nature.',
      },
    ],
    detail: {
      kind: 'racialTrait',
      raceEntryIds: ['pf1/e6IaBxKgMxy1yKlr'],
      replaces: [],
    },
    sources: [
      {
        book: 'PZO9280',
        pages: '238',
      },
      {
        book: 'PZO1110',
        pages: '27',
      },
      {
        book: 'PZO1121',
        pages: '70',
      },
    ],
  },
  {
    _id: 'pf1-content/LwDcZanOEHqVaYoh',
    name: 'Skilled (Human)',
    ruleIdentity: 'pf1-content/LwDcZanOEHqVaYoh',
    stacksWithItself: false,
    modifiers: [],
    situationalNotes: [
      {
        text: 'Race: Human\nHumans gain 1 additional skill rank at 1st level and 1 additional rank whenever they gain a level.',
      },
    ],
    detail: {
      kind: 'racialTrait',
      raceEntryIds: ['pf1/e6IaBxKgMxy1yKlr'],
      replaces: [],
      bonusSkillRanksPerLevel: 1,
    },
    sources: [
      {
        book: 'PZO9280',
        pages: '238',
      },
      {
        book: 'PZO1121',
        pages: '70',
      },
      {
        book: 'PZO1110',
        pages: '27',
      },
    ],
  },
  {
    _id: 'pf1-content/uAJ9hLZYdH2JX7J8',
    name: 'Bonus Feat (Human)',
    ruleIdentity: 'pf1-content/uAJ9hLZYdH2JX7J8',
    stacksWithItself: false,
    modifiers: [],
    grantsSlots: [
      {
        kind: 'feat',
        count: 1,
      },
    ],
    detail: {
      kind: 'racialTrait',
      raceEntryIds: ['pf1/e6IaBxKgMxy1yKlr'],
      replaces: [],
    },
    sources: [
      {
        book: 'PZO9280',
        pages: '238',
      },
      {
        book: 'PZO1121',
        pages: '70',
      },
      {
        book: 'PZO1110',
        pages: '27',
      },
    ],
  },
  {
    _id: 'pf1-content/eNIYJNbM6UL7OdyE',
    name: 'Languages (Human)',
    ruleIdentity: 'pf1-content/eNIYJNbM6UL7OdyE',
    stacksWithItself: false,
    modifiers: [],
    situationalNotes: [
      {
        text: 'Race: Human\nHumans begin play speaking Common and their ethnic language. Humans whose ethnic language is Common (or Taldane, in the case of Chelaxians or Taldans) do not receive an additional ethnic language. Humans with high Intelligence scores can choose any languages they want (except secret languages, such as Druidic).',
      },
    ],
    detail: {
      kind: 'racialTrait',
      raceEntryIds: ['pf1/e6IaBxKgMxy1yKlr'],
      replaces: [],
    },
    sources: [
      {
        book: 'PZO9280',
        pages: '238',
      },
      {
        book: 'PZO1121',
        pages: '70',
      },
      {
        book: 'PZO1110',
        pages: '27',
      },
    ],
  },
  {
    _id: 'pf1-content/SRBfqkzIldwETAHB',
    name: 'Dual Talent',
    ruleIdentity: 'pf1-content/SRBfqkzIldwETAHB',
    stacksWithItself: false,
    modifiers: [
      {
        target: 'ability.$choice',
        bonusType: 'racial',
        value: 2,
      },
    ],
    situationalNotes: [
      {
        text: 'Race: Human\nReplaced Trait(s): +2 to One Ability Score, Bonus Feat, Skilled\nSome humans are uniquely skilled at maximizing their natural gifts. These humans pick two ability scores and gain a +2 racial bonus in each of those scores. This racial trait replaces the +2 bonus to any one ability score, the bonus feat, and the skilled traits.',
      },
    ],
    detail: {
      kind: 'racialTrait',
      abilityChoiceCount: 2,
      raceEntryIds: ['pf1/e6IaBxKgMxy1yKlr'],
      replaces: [
        'pf1-content/BFszTUJLlDS1ZDB8',
        'pf1-content/LwDcZanOEHqVaYoh',
        'pf1-content/uAJ9hLZYdH2JX7J8',
      ],
    },
    sources: [
      {
        book: 'PZO1121',
        pages: '72',
      },
    ],
  },
];
