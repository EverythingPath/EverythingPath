import { at, grantIn, type At, type PcgenGrant } from './schedule-model';

/**
 * #771C: the reviewed facts of an archetype's added features that PCGen
 * holds in formulas, not in the mapper's rows (design read
 * 771c-exploiter-design §1, §2). The mapper gives each addition one `adds`
 * row at its PCGen grant level, as it gives Skirmisher's hunter's tricks;
 * the levels its picks or values grow at, and the pool it picks from, are
 * source output recorded here, never increment rows or keys, so nothing
 * here changes the class schedules, the identities or the launch inventory.
 *
 * - Each fact names the printed rule, PCGen's formula where PCGen holds one,
 *   and a cited decision. PCGen's formulas are evidence, never behaviour:
 *   only the slice's tests evaluate them, against the printed rules, and
 *   calculation stays with the sheet's owner (#702).
 * - PCGen's discrepancies are review items with their owning issue, never
 *   settled here.
 */
export type AdditionFact = {
  id: string;
  /** The rule as the book prints it. */
  printed: string;
  /** Where the PRD prints it, under the capture's `pages/`. */
  at: readonly At[];
  /** PCGen's variable and formula for it, and where, if PCGen holds one. */
  pcgen: { variable: string; expression: string; at: At } | null;
  decision: string;
};

/** A pool member: its PCGen record, its line and the PRD line printing it. */
type PoolMember = { key: string; at: At; printed: At };
/** A PCGen record of the pool's type the addition can never pick. */
type PoolExclusion = {
  key: string;
  at: At;
  reason: 'greater' | 'blade-adept' | 'white-mage';
};

export type ReviewedAddition = {
  /** Stable among the archetype's additions, such as `arcane-reservoir`. */
  id: string;
  name: string;
  /** The ledger identity of the added feature, the mapper's `adds` key. */
  externalKey: string;
  /** The reviewed class schedule's feature (`id`) it replaces. */
  replaces: string;
  /** The class levels it is gained or picked at. */
  levels: readonly number[];
  /** The record (or `pool:<name>`) PCGen grants, and where. */
  pcgen: PcgenGrant;
  facts: readonly AdditionFact[];
  /** The pool its picks come from: the eligible members and every exclusion. */
  pool?: {
    name: string;
    members: readonly PoolMember[];
    exclusions: readonly PoolExclusion[];
    decision: string;
  };
};

type AdditionDefect = {
  id: string;
  at: readonly At[];
  /** The issue owning the defect's settlement. */
  owner: number;
  text: string;
};

type ReviewedArchetypeAdditions = {
  /** The PCGen archetype record's key. */
  archetype: string;
  className: string;
  /** The archetype's ledger identity. */
  externalKey: string;
  additions: readonly ReviewedAddition[];
  defects: readonly AdditionDefect[];
};

const acgAbilities =
  'roleplaying_game/advanced_class_guide/acg_abilities_class.lst';
const acgCategories =
  'roleplaying_game/advanced_class_guide/acg_abilitycategories.lst';
const wizardOptions = 'advancedClassGuide/classOptions/wizard.html';
const arcanist = 'advancedClassGuide/classes/arcanist.html';
const acg = grantIn(acgAbilities);
const acgAt = (line: number) => at(acgAbilities, line);
const arcanistAt = (line: number) => at(arcanist, line);
const wizardOptionsAt = (line: number) => at(wizardOptions, line);

// --- Exploiter Wizard ---------------------------------------------------------

/**
 * The ordinary ACG arcanist exploits (acg_abilities_class.lst:98-121), each
 * with the line of arcanist.html printing it, in both files' order.
 */
const ordinaryExploits = (
  [
    ['Acid Jet', 461],
    ['Arcane Barrier', 463],
    ['Arcane Weapon', 465],
    ['Bloodline Development', 467],
    ['Consume Magic Items', 471],
    ['Counterspell', 473],
    ['Dimensional Slide', 475],
    ['Energy Shield', 477],
    ['Familiar', 479],
    ['Flame Arc', 481],
    ['Force Strike', 483],
    ['Ice Missile', 485],
    ['Item Crafting', 487],
    ['Lightning Lance', 489],
    ['Metamagic Knowledge', 491],
    ['Metamixing', 493],
    ['Potent Magic', 495],
    ['Quick Study', 497],
    ['School Understanding', 499],
    ['See Magic', 502],
    ['Spell Disruption', 504],
    ['Spell Resistance', 506],
    ['Spell Tinkerer', 508],
    ['Swift Consume', 510],
  ] as const
).map(([name, printed], index) => ({
  key: `Arcanist Exploit ~ ${name}`,
  at: acgAt(98 + index),
  printed: arcanistAt(printed),
}));

/** The greater exploits (acg_abilities_class.lst:127-142). */
const greaterExploits = [
  'Alter Enhancements',
  'Burning Flame',
  'Counter Drain',
  'Dancing Electricity',
  'Energy Absorption',
  'Greater Counterspell',
  'Greater Metamagic Knowledge',
  'Greater Spell Resistance',
  'Greater Spell Disruption',
  'Icy Tomb',
  'Lingering Acid',
  'Redirect Spell',
  'Resistance Drain',
  'Siphon Spell',
  'Spell Thief',
  'Suffering Knowledge',
].map((name, index) => ({
  key: `Arcanist Exploit ~ ${name}`,
  at: acgAt(127 + index),
  reason: 'greater' as const,
}));

/** Blade Adept's own exploits (acg_abilities_class.lst:2398-2402). */
const bladeAdeptExploits = [
  'Eldritch Blade',
  'Magus Arcana',
  'Spell Strike',
  'Student of the Blade',
  'Weapon Specialization',
].map((name, index) => ({
  key: `Arcanist Exploit ~ ${name}`,
  at: acgAt(2398 + index),
  reason: 'blade-adept' as const,
}));

const exploiterWizard: ReviewedArchetypeAdditions = {
  archetype: 'Wizard Archetype ~ Exploiter Wizard',
  className: 'Wizard',
  externalKey: 'everythingpath/wizard-exploiter-wizard',
  additions: [
    {
      id: 'arcane-reservoir',
      name: 'Arcane Reservoir',
      externalKey: 'everythingpath/wizard-exploiter-wizard-arcane-reservoir',
      replaces: 'arcane-bond',
      levels: [1],
      pcgen: acg('Exploiter Wizard ~ Arcane Reservoir', 1, 4052),
      facts: [
        {
          id: 'reservoir-maximum',
          printed: '3 + arcanist level, the Exploiter’s Wizard level',
          at: [arcanistAt(456), wizardOptionsAt(350)],
          pcgen: {
            variable: 'MaxArcanistReservoirSize',
            expression: '3+WizardLVL',
            at: acgAt(4057),
          },
          decision: `The arcanist's reservoir holds at most 3 + her level (${arcanistAt(456)}); the Exploiter "uses his wizard level as his arcanist level for the purpose of determining how many points he gains" (${wizardOptionsAt(350)}). PCGen's maximum agrees: 4 at Wizard 1, 12 at 9 (E2), 23 at 20.`,
        },
        {
          id: 'reservoir-daily',
          printed: '3 + 1/2 arcanist level, the Exploiter’s Wizard level',
          at: [arcanistAt(456), wizardOptionsAt(350)],
          pcgen: {
            variable: 'ArcanistReservoirSize',
            expression: '3+WizardLVL/2',
            at: acgAt(4057),
          },
          decision: `Each day the reservoir refills to 3 + 1/2 her level, and the previous day's points are lost (${arcanistAt(456)}), by Wizard level (${wizardOptionsAt(350)}). PCGen's formula agrees once rounded down, as every PF1 fraction is: 3 at Wizard 1, 7 at 9 (E2), 13 at 20. Tracking the points spent stays outside the MVP (E2).`,
        },
        {
          id: 'reservoir-spell-boost',
          printed:
            'expend 1 point when casting a wizard spell: +1 caster level or +1 DC, at most 1 point a spell',
          at: [arcanistAt(457)],
          pcgen: null,
          decision: `The arcanist spends 1 point as a free action on a spell she casts for +1 caster level or +1 DC, no more than 1 point a spell (${arcanistAt(457)}); the Exploiter does so on a wizard spell. PCGen holds it only in its description (${acgAt(4057)}). Potent Magic changes it to +2 (${arcanistAt(495)}, E2), the exploit's own rule.`,
        },
      ],
    },
    {
      id: 'exploiter-exploit',
      name: 'Exploiter Exploit',
      externalKey: 'everythingpath/wizard-exploiter-wizard-exploiter-exploit',
      replaces: 'arcane-school',
      levels: [1, 5, 9, 13, 17],
      pcgen: { granted: 'pool:Arcanist Exploit', level: 1, at: acgAt(4058) },
      facts: [
        {
          id: 'exploit-picks',
          printed:
            'one arcanist exploit at 1st level and every 4 levels thereafter',
          at: [wizardOptionsAt(351)],
          pcgen: {
            variable: 'ArcanistExploitPool',
            expression: '1+(WizardLVL-1)/4',
            at: acgAt(4058),
          },
          decision: `The Exploiter gains a single arcanist exploit "at 1st level and every 4 levels thereafter" (${wizardOptionsAt(351)}): picks at 1, 5, 9, 13 and 17. PCGen's pool count agrees, since its Arcanist Exploit category has no fractional pool (FRACTIONALPOOL:NO, ${at(acgCategories, 34)}): 3 picks at Wizard 9 (E2), 4 at 13 (E1). The pick slots are #702's.`,
        },
        {
          id: 'exploit-dc',
          printed:
            '10 + 1/2 arcanist level + Charisma modifier, the Exploiter’s Wizard level',
          at: [arcanistAt(459), wizardOptionsAt(351)],
          pcgen: {
            variable: 'ArcanistExploitDC',
            expression: '10+CHA+WizardLVL/2',
            at: acgAt(4058),
          },
          decision: `Unless an exploit says otherwise, its save DC is 10 + 1/2 the arcanist's level + her Charisma modifier (${arcanistAt(459)}); the Exploiter uses his Wizard level "for determining the effects and DCs of his arcanist exploits" (${wizardOptionsAt(351)}). PCGen's formula agrees once rounded down: 14 + Cha at Wizard 9 (E2).`,
        },
      ],
      pool: {
        name: 'Arcanist Exploit',
        members: ordinaryExploits,
        exclusions: [
          ...greaterExploits,
          ...bladeAdeptExploits,
          {
            key: 'Arcanist Exploit ~ Fast Healing',
            at: acgAt(2657),
            reason: 'white-mage',
          },
        ],
        decision: `The Exploiter picks from the 24 ordinary exploits arcanist.html prints (${arcanistAt(461)}-${arcanistAt(510)}), PCGen's ArcanistExploit records at ${acgAt(98)}-121. Greater exploits are chosen only through the arcanist's separate Greater Exploits feature (${arcanistAt(516)}), which PCGen gates on ArcanistGreaterExploitEnable (${acgAt(127)}-142), set only by that feature (${acgAt(68)}); the Exploiter grants neither, and Wizard level substitutes for the effects and DCs only (${wizardOptionsAt(351)}), so none is eligible at any level. Blade Adept's five exploits need that archetype (${acgAt(2398)}-2402; E1), and Fast Healing is White Mage's greater exploit (${acgAt(2657)}). The pool is the Advanced Class Guide's: later books' exploits are no part of this record.`,
      },
    },
  ],
  defects: [
    {
      id: 'energy-exploit-dice',
      at: [acgAt(4058), acgAt(67), arcanistAt(461)],
      owner: 771,
      text: `PCGen gives the Exploiter ArcanistEnergyExploitDice max(10,(1+WizardLVL))/4 (${acgAt(4058)}), which Acid Jet, Flame Arc, Ice Missile and Lightning Lance read (${acgAt(98)}, :107, :109, :111): 2.5 dice from Wizard 1 to 9 and 5.25 at 20. The printed dice are 1d6 plus 1d6 for every 2 levels beyond 1st, at most 10d6 at 19th (${arcanistAt(461)}, :481, :485, :489): 1 at 1st, 5 at 9th (E2), 10 at 19th, which the Arcanist's own min(10,(1+ArcanistLVL)/2) gives (${acgAt(67)}). Rounded down, the Exploiter's formula agrees only at Wizard 3 and 4. It is not an approved formula (E2); the printed dice stand.`,
    },
    {
      id: 'exploit-level-unread',
      at: [acgAt(4058), acgAt(67)],
      owner: 771,
      text: `PCGen sets ArcanistExploitLevel min(1,WizardLVL/11) for the Exploiter (${acgAt(4058)}), as the Arcanist's min(1,ArcanistLVL/11) (${acgAt(67)}), but no pinned PCGen record reads it. It is no greater-exploit eligibility: greater exploits gate on ArcanistGreaterExploitEnable (${acgAt(127)}-142), which the Exploiter never sets.`,
    },
    {
      id: 'arcanist-level-binding',
      at: [acgAt(4058), wizardOptionsAt(350), wizardOptionsAt(351)],
      owner: 771,
      text: `PCGen sets ArcanistLVL to the full Wizard level with no condition (BONUS:VAR|ArcanistLVL|WizardLVL, ${acgAt(4058)}), so every exploit reading the arcanist level scales by Wizard level. The book substitutes Wizard level only for the reservoir's points (${wizardOptionsAt(350)}) and "for determining the effects and DCs of his arcanist exploits" (${wizardOptionsAt(351)}); where an exploit's own text fixes a level (bloodline-development-level, school-understanding-level), that text stands.`,
    },
    {
      id: 'bloodline-development-level',
      at: [acgAt(101), arcanistAt(467), arcanistAt(469)],
      owner: 771,
      text: `Bloodline Development sets BloodlineLVL to ArcanistLvl (${acgAt(101)}), so through arcanist-level-binding the Exploiter's bloodline progresses by full Wizard level. The book gives the 1st-level bloodline power "as though she were a 1st-level sorcerer", treating her level as her sorcerer level only while she spends a point to bolster it, for Charisma-modifier rounds (${arcanistAt(467)}); her levels stack with a bloodline she already has (${arcanistAt(469)}). R02 and the 5th Exploiter interface contract name it; the printed rule stands.`,
    },
    {
      id: 'school-understanding-level',
      at: [acgAt(116), arcanistAt(499), arcanistAt(500)],
      owner: 771,
      text: `School Understanding sets ArcaneSchoolLVL and ArcaneSchoolProgressionLVL to ArcanistLvl (${acgAt(116)}), so through arcanist-level-binding the Exploiter's school progresses by full Wizard level. The book gives one 1st-level school ability "as though she were a 1st-level wizard", her level counting only while she spends a point to bolster it (${arcanistAt(499)}); her levels stack with a school she already has (${arcanistAt(500)}). R03 and the 6th Exploiter interface contract name it; the printed rule stands.`,
    },
    {
      id: 'energy-shield-steps',
      at: [acgAt(105), arcanistAt(477)],
      owner: 612,
      text: `Energy Shield's resistance is 10+(min(20,5*ArcanistLVL/5)) in PCGen (${acgAt(105)}), 10 + level: 17 at 7th. The book gives resistance 10, increased by 5 for every 5 levels, at most 30 at 20th (${arcanistAt(477)}): 15 at 7th. The record is every arcanist's, so its curation batch (#612) owns it; the Exploiter reaches it through arcanist-level-binding. Observed, not settled here.`,
    },
    {
      id: 'spell-resistance-variable',
      at: [acgAt(119), arcanistAt(506)],
      owner: 613,
      text: `Spell Resistance writes its value to SpellDisruptionBonus, ArcanistLvl+6 (${acgAt(119)}), a variable named for Spell Disruption; Greater Spell Resistance raises the same variable (${acgAt(134)}). The value agrees with the printed 6 + her arcanist level (${arcanistAt(506)}). The record is every arcanist's, so its curation batch (#613) owns it. Observed, not settled here.`,
    },
  ],
};

const reviewed = [exploiterWizard];

/**
 * The reviewed additions of a PCGen archetype record, by its key; undefined
 * for every archetype without a reviewed record.
 */
export function reviewedArchetypeAdditions(archetype: string) {
  return reviewed.find((record) => record.archetype === archetype);
}
