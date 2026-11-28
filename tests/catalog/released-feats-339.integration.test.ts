/// <reference types="vite/client" />
// @vitest-environment edge-runtime
// pbl-released-feats-2 (PRD #251): the feat batches' integration tests
// (feats339 to feats347), on entries imported from the pinned store. Each row
// installs two imported feat definitions (featDefinition) on a Character of
// an isolated campaign of a fresh Convex test database, with the shared setup
// of released-feat-integration.ts, and runs its batch test's steps against
// the saved sheet: selecting the first feat, switching the selection off
// where the batch test did, replacing its feat with the second
// (`replaceFeat`, with the arguments that test sent), the client preview's
// derived statistics against the saved sheet's where the batch test compared
// them (before the replacement is saved, too, where it staged one), and each
// total as a literal. Each inserted definition's rule-bearing fields are pinned as
// literals (`expectPinned`) beside the round-trip assertion. Every row ends
// with the shared refusals (`expectRefusals`): the selection cannot be read
// or edited through another campaign or by an outsider, its catalog copies
// cannot be listed there or by an outsider, and an anonymous caller cannot
// read the sheet; the rows of feats339 and feats342 to feats347 also make
// that test's further refusals (`expectForeignAndAnonymousRefusals`): a
// campaign-scoped copy in the other campaign cannot replace the selection's
// feat, and an anonymous caller can neither list the catalog copies nor edit
// the selection.
import { describe, expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';
import { importReleasedEntries } from './released-entries';
import { featBatchKeys, type FeatBatch } from './released-feat-keys';
import {
  localAt,
  localOn,
  pinnedFieldsCheck,
  replaceFeat,
  setUp,
  toggle,
  type FeatRow,
  type Setup,
} from './released-feat-integration';
import {
  assessmentStatus,
  featBatch,
  type FeatDefinition,
} from './released-feat-sheet';

// One import for every row: the nine batches' keys, their references included.
const { entries } = await importReleasedEntries(
  featBatchKeys([
    'feats-339',
    'feats-340',
    'feats-341',
    'feats-342',
    'feats-343',
    'feats-344',
    'feats-345',
    'feats-346',
    'feats-347',
  ]),
);

/**
 * The rule-bearing fields of each inserted definition, as literals: its
 * Modifiers with their conditions (a Situation), its Situational Notes with
 * their Situations, its prerequisites and its slot grants. Incidental fields
 * (rule identity, sources and pages, prerequisite text, description, feat
 * types) are left to the catalog digest. The batch tests compared the saved
 * and listed definitions with one built from the batch's committed preview; a
 * round-trip assertion here compares with the inserted definition, so these
 * pins keep a wrongly imported rule failing.
 */
const pinnedFields = {
  'Skill Focus (Perception)': {
    modifiers: [
      {
        target: 'skill.per',
        bonusType: 'untyped',
        value: { formula: '3 + 3 * min(1, floor(@skillRanks.per / 10))' },
      },
    ],
    situationalNotes: [
      {
        text: 'Choose a skill. You are particularly adept at that skill. Benefits : You get a +3 bonus on all checks involving the chosen skill. If you have 10 or more ranks in that skill, this bonus increases to +6. Special : You can gain this feat multiple times. Its effects do not stack. Each time you take the feat, it applies to a new skill.',
      },
    ],
  },
  'Solo Maneuvers': {
    modifiers: [
      {
        target: 'cmb',
        bonusType: 'untyped',
        value: 1,
        condition: {
          situation: {
            local:
              'against an opponent when you are the only one threatening it',
          },
        },
      },
      {
        target: 'cmd',
        bonusType: 'untyped',
        value: 1,
        condition: {
          situation: {
            local:
              'against combat maneuvers by an opponent when you are the only one threatening it',
          },
        },
      },
    ],
    situationalNotes: [
      {
        text: "You fight best when you're on your own. Benefits : Whenever you are the only one threatening an opponent, you gain a +1 bonus on combat maneuvers against that creature and a +1 bonus to CMD against combat maneuvers made by that creature.",
      },
    ],
  },
  'Skill Focus (Knowledge [Local])': {
    modifiers: [
      {
        target: 'skill.klo',
        bonusType: 'untyped',
        value: { formula: '3 + 3 * min(1, floor(@skillRanks.klo / 10))' },
      },
    ],
    situationalNotes: [
      {
        text: 'You get a +3 bonus on all checks involving the chosen skill. If you have 10 or more ranks in that skill, this bonus increases to +6.\nSpecial: You can gain this feat multiple times. Its effects do not stack. Each time you take the feat, it applies to a new skill.',
      },
    ],
  },
  'Horse Whisperer': {
    modifiers: [
      {
        target: 'skill.han',
        bonusType: 'untyped',
        value: 2,
        condition: { situation: { local: 'handling horses' } },
      },
      {
        target: 'skill.rid',
        bonusType: 'untyped',
        value: 2,
        condition: { situation: { local: 'riding horses' } },
      },
    ],
    situationalNotes: [
      {
        text: 'You gain a +2 bonus on Handle Animal and Ride checks to handle or ride horses. In addition, you can attempt one Handle Animal check to issue a command to all horses within a 60-foot radius. An opponent whose animal companion or mount is within range can attempt a DC 20 Handle Animal check as an immediate action to prevent her horse from being influenced by you. If the opponent succeeds, you cannot influence that creature again for 1 hour.',
      },
    ],
  },
  'Stealthy (Mythic)': {
    modifiers: [
      { target: 'skill.esc', bonusType: 'untyped', value: 2 },
      { target: 'skill.ste', bonusType: 'untyped', value: 2 },
    ],
    situationalNotes: [
      {
        text: "Increase Stealthy's Escape Artist and Stealth bonuses by 2. Before an Escape Artist or Stealth check, spend one mythic power to treat its roll as a natural 20.",
      },
    ],
    prerequisites: [{ feat: 'pf1/f5FPqAYWlKj3zCIY', kind: 'feat' }],
  },
  'Crane Style': {
    modifiers: [
      {
        target: 'ac.other',
        bonusType: 'dodge',
        value: 1,
        condition: {
          situation: {
            local:
              'while using Crane Style and fighting defensively or taking total defense',
          },
        },
      },
    ],
    situationalNotes: [
      {
        text: 'While using Crane Style, fighting defensively takes only -2 on attacks. Fighting defensively or total defense also grants an additional +1 dodge AC. Combat Trick: when targeted by a melee attack in either defense mode, spend up to 3 stamina and an immediate action for extra dodge AC against that attack equal to stamina spent.',
      },
    ],
    prerequisites: [
      { feat: 'pf1/JreaiTHdyWFNj3Tb', kind: 'feat' },
      { feat: 'pf1/2aTFNMs3pW6nUBlr', kind: 'feat' },
      {
        anyOf: [
          { bab: 2, kind: 'bab' },
          { classLevel: 'pf1/W8dxwZ1CZiwLKsqr', min: 1, kind: 'classLevel' },
        ],
      },
    ],
  },
  'Skill Focus (Handle Animal)': {
    modifiers: [
      {
        target: 'skill.han',
        bonusType: 'untyped',
        value: { formula: '3 + 3 * min(1, floor(@skillRanks.han / 10))' },
      },
    ],
    situationalNotes: [
      {
        text: 'You get a +3 bonus on all checks involving the chosen skill. If you have 10 or more ranks in that skill, this bonus increases to +6. Special : You can gain this feat multiple times. Its effects do not stack. Each time you take the feat, it applies to a new skill.',
      },
    ],
  },
  'Skill Focus (Disable Device)': {
    modifiers: [
      {
        target: 'skill.dev',
        bonusType: 'untyped',
        value: { formula: '3 + 3 * min(1, floor(@skillRanks.dev / 10))' },
      },
    ],
    situationalNotes: [
      {
        text: 'You get a +3 bonus on all checks involving the chosen skill. If you have 10 or more ranks in that skill, this bonus increases to +6. Special : You can gain this feat multiple times. Its effects do not stack. Each time you take the feat, it applies to a new skill.',
      },
    ],
  },
  'Tree Hanger': {
    modifiers: [
      {
        target: 'cmd',
        bonusType: 'untyped',
        value: 2,
        condition: { situation: 'trip' },
      },
      {
        target: 'cmd',
        bonusType: 'untyped',
        value: 2,
        condition: {
          situation: {
            local:
              'Tree Hanger: hanging by the tail from a sturdy object in the current square, against bull rush',
          },
        },
      },
      {
        target: 'cmd',
        bonusType: 'untyped',
        value: 2,
        condition: {
          situation: {
            local:
              'Tree Hanger: hanging by the tail from a sturdy object in the current square, against drag',
          },
        },
      },
      {
        target: 'cmd',
        bonusType: 'untyped',
        value: 2,
        condition: {
          situation: {
            local:
              'Tree Hanger: hanging by the tail from a sturdy object in the current square, against reposition',
          },
        },
      },
    ],
    situationalNotes: [
      {
        text: "You gain a +2 bonus to your CMD against all trip attacks. If your square has a branch or other sturdy large object that you could hang from, as a swift action you may make a DC 15 Acrobatics check to jump upward and use your tail to hang from that object. While hanging, you can't be tripped, you ignore the effects of difficult terrain in your square, and you gain a +2 bonus to your CMD against bull rush, drag, and reposition attacks. If you leave that square (including if you are moved against your will), you lose your grip on the object and are no longer hanging. While hanging, you cannot use your tail for anything else. Combat Trick When you jump upward to use your tail to hang from an object, you can spend up to 5 stamina points. You gain a bonus on the Acrobatics check equal to the number of stamina points you spent.",
      },
    ],
    prerequisites: [
      { skillRanks: 'skill.acr', min: 1, kind: 'skillRanks' },
      { unchecked: 'vanara', kind: 'unchecked' },
    ],
  },
  'Skill Focus (Knowledge [Nobility])': {
    modifiers: [
      {
        target: 'skill.kno',
        bonusType: 'untyped',
        value: { formula: '3 + 3 * min(1, floor(@skillRanks.kno / 10))' },
      },
    ],
    situationalNotes: [
      {
        text: 'You get a +3 bonus on all checks involving the chosen skill. If you have 10 or more ranks in that skill, this bonus increases to +6. Special : You can gain this feat multiple times. Its effects do not stack. Each time you take the feat, it applies to a new skill.',
      },
    ],
  },
  Harrowed: {
    modifiers: [
      {
        target: 'save.will',
        bonusType: 'untyped',
        value: 1,
        condition: { situation: 'enchantment' },
      },
    ],
    situationalNotes: [
      {
        text: "You get a +1 bonus on all Will saves made to resist enchantment effects. Once per day, you may draw a card from a Harrow deck you own. At any one time for the rest of that day, you may apply a +2 bonus on any d20 roll modified by the card's suit. For example, if you drew a card from the suit of Dexterity, you could apply this +2 bonus on an Initiative check, a Ref lex save, a Dexterity-based skill check, or a ranged attack roll. You may assign this +2 bonus after you make the roll, but you must do so before you know whether the roll was a success or not.",
      },
    ],
  },
  'Pass For Human': {
    modifiers: [
      {
        target: 'skill.dis',
        bonusType: 'untyped',
        value: 10,
        condition: { situation: { local: 'to disguise yourself as a human' } },
      },
    ],
    situationalNotes: [
      {
        text: 'You receive a +10 bonus on Disguise checks to disguise yourself as a human, and do not receive the penalty for disguising yourself as a member of another race when you do so. In areas largely populated or settled by humans, you can take 10 on your Disguise check, meaning most people tend to assume you are human unless given a reason to think otherwise. Special : A halfling may take this feat, but must have the Childlike feat as a prerequisite. The benefits of the two feats stack.',
      },
    ],
    prerequisites: [
      {
        kind: 'unchecked',
        unchecked: 'Half-elf, half-orc, or halfling (see Special)',
      },
    ],
  },
  'Opening Volley': {
    modifiers: [
      {
        target: 'attack.melee',
        bonusType: 'circumstance',
        value: 4,
        condition: {
          situation: {
            local:
              'next melee attack against the ranged-damaged opponent before end of your next turn',
          },
        },
      },
    ],
    situationalNotes: [
      {
        text: 'Whenever you deal damage with a ranged attack, you gain a +4 circumstance bonus on the next melee attack roll you make against the opponent. This attack must occur before the end of your next turn. Combat Trick When you deal damage with a ranged attack, you can spend 2 stamina points to gain a +4 circumstance bonus on the next two melee attack rolls you make against that opponent until the end of your next turn, instead of on only the next melee attack.',
      },
    ],
  },
  'Skill Focus (Knowledge [Dungeoneering])': {
    modifiers: [
      {
        target: 'skill.kdu',
        bonusType: 'untyped',
        value: { formula: '3 + 3 * min(1, floor(@skillRanks.kdu / 10))' },
      },
    ],
    situationalNotes: [
      {
        text: 'You get a +3 bonus on all checks involving the chosen skill. If you have 10 or more ranks in that skill, this bonus increases to +6. Special: You can gain this feat multiple times. Its effects do not stack. Each time you take the feat, it applies to a new skill.',
      },
    ],
  },
  'Animal Disguise': {
    modifiers: [
      {
        target: 'skill.dis',
        bonusType: 'untyped',
        value: 2,
        condition: {
          situation: {
            local:
              'when disguising yourself as an animal of your size category, with the required animal parts',
          },
        },
      },
    ],
    situationalNotes: [
      {
        text: 'You can use Disguise to disguise yourself as an animal of your size category. You must have an appropriate pelt and any other animal parts needed to complete the disguise. You also gain a +2 bonus on Disguise checks when you disguise yourself as an animal. Creatures with ranks in Knowledge (nature) can use that skill in place of Sense Motive to detect this type of disguise.',
      },
    ],
    prerequisites: [
      { skillRanks: 'skill.dis', min: 6, kind: 'skillRanks' },
      { skillRanks: 'skill.kna', min: 6, kind: 'skillRanks' },
    ],
  },
  'Skill Focus (Heal)': {
    modifiers: [
      {
        target: 'skill.hea',
        bonusType: 'untyped',
        value: { formula: '3 + 3 * min(1, floor(@skillRanks.hea / 10))' },
      },
    ],
    situationalNotes: [
      {
        text: 'You get a +3 bonus on all checks involving the chosen skill. If you have 10 or more ranks in that skill, this bonus increases to +6. Special : You can gain this feat multiple times. Its effects do not stack. Each time you take the feat, it applies to a new skill.',
      },
    ],
  },
  Moontouched: {
    modifiers: [
      {
        target: 'save.fort',
        bonusType: 'untyped',
        value: 2,
        condition: {
          situation: {
            local: 'at night while you can see at least part of the moon',
          },
        },
      },
      {
        target: 'save.ref',
        bonusType: 'untyped',
        value: 2,
        condition: {
          situation: {
            local: 'at night while you can see at least part of the moon',
          },
        },
      },
      {
        target: 'save.will',
        bonusType: 'untyped',
        value: -2,
        condition: {
          situation: {
            local: 'at night while you can see at least part of the moon',
          },
        },
      },
    ],
    situationalNotes: [
      {
        text: 'At night when at least part of the moon is showing and you can see it, you gain a +2 bonus on Fortitude and Reflex saves but take a -2 penalty on Will saves.',
      },
    ],
  },
  'Free Spirit': {
    modifiers: [
      {
        target: 'save.fort',
        bonusType: 'morale',
        value: 2,
        condition: { situation: 'mindAffecting' },
      },
      {
        target: 'save.ref',
        bonusType: 'morale',
        value: 2,
        condition: { situation: 'mindAffecting' },
      },
      {
        target: 'save.will',
        bonusType: 'morale',
        value: 2,
        condition: { situation: 'mindAffecting' },
      },
      {
        target: 'skill.esc',
        bonusType: 'morale',
        value: 2,
        condition: { situation: { local: 'to escape a grapple or bonds' } },
      },
      {
        target: 'cmb',
        bonusType: 'morale',
        value: 2,
        condition: { situation: { local: 'to escape a grapple or bonds' } },
      },
    ],
    situationalNotes: [
      {
        text: 'Your strong belief in the value of freedom protects you from mental and physical shackles. Prerequisites : Cha 13, any chaotic alignment. Benefits : You gain a +2 morale bonus on saving throws made against mind-affecting effects and on all Escape Artist or grapple checks made to escape a grapple or to escape from bonds.',
      },
    ],
    prerequisites: [
      { ability: 'charisma', min: 13, kind: 'ability' },
      { alignment: ['CG', 'CN', 'CE'], kind: 'alignment' },
    ],
  },
  'Enemy Cult': {
    modifiers: [
      {
        target: 'save.fort',
        bonusType: 'resistance',
        value: 2,
        condition: {
          situation: {
            local:
              'Enemy Cult completed, against an evil creature that is not summoned',
          },
        },
      },
      {
        target: 'save.ref',
        bonusType: 'resistance',
        value: 2,
        condition: {
          situation: {
            local:
              'Enemy Cult completed, against an evil creature that is not summoned',
          },
        },
      },
      {
        target: 'save.will',
        bonusType: 'resistance',
        value: 2,
        condition: {
          situation: {
            local:
              'Enemy Cult completed, against an evil creature that is not summoned',
          },
        },
      },
      {
        target: 'ac.other',
        bonusType: 'deflection',
        value: 2,
        condition: {
          situation: {
            local:
              'Enemy Cult completed, against attacks by an evil creature that is not summoned',
          },
        },
      },
      {
        target: 'save.fort',
        bonusType: 'resistance',
        value: 4,
        condition: {
          situation: {
            local: 'Enemy Cult completed, against an evil summoned creature',
          },
        },
      },
      {
        target: 'save.ref',
        bonusType: 'resistance',
        value: 4,
        condition: {
          situation: {
            local: 'Enemy Cult completed, against an evil summoned creature',
          },
        },
      },
      {
        target: 'save.will',
        bonusType: 'resistance',
        value: 4,
        condition: {
          situation: {
            local: 'Enemy Cult completed, against an evil summoned creature',
          },
        },
      },
      {
        target: 'ac.other',
        bonusType: 'deflection',
        value: 4,
        condition: {
          situation: {
            local:
              'Enemy Cult completed, against attacks by an evil summoned creature',
          },
        },
      },
    ],
    situationalNotes: [
      {
        text: "You have crossed paths with a cult opposed to everything in which you believe. Prerequisites : You must have encountered a cult whose general alignment is opposite to yours on at least one axis or who threatened your beliefs or way of life, or you must have the Angelic Encounter, the False Witness, The Omen, or the Terrible Secret background (all of which are found in Ultimate Campaign). Benefits : Choose an appropriate detect chaos/evil/good/law spell that would aid you in opposing your chosen enemy cult. You can cast this spell twice per day as a spell-like ability with a caster level equal to your character level. Goal : Thwart the enemy cult, whose leader must be a challenging foe. You must deal that cult leader a decisive defeat, and additionally eradicate the cult or drive the cult from the area. Completion Benefit : You gain a +2 resistance bonus on saving throws against evil creatures and a +2 deflection bonus to AC against evil creatures' attacks. These bonuses double against evil summoned creatures.",
      },
    ],
    prerequisites: [
      {
        kind: 'unchecked',
        unchecked:
          'You must have encountered a cult whose general alignment is opposite to yours on at least one axis or who threatened your beliefs or way of life, or you must have the Angelic Encounter, the False Witness, The Omen, or the Terrible Secret background (all of which are found in Ultimate Campaign)',
      },
    ],
  },
} as const;

const expectPinned = pinnedFieldsCheck(pinnedFields);

/**
 * The two definitions of a row's batch, by name, after the batch adapter's
 * checks (`situation`, the shape of feats-335 to feats-347), each pinned and
 * with its committed Attribution Assessment's status.
 */
function rowDefinitions(
  batch: FeatBatch,
  ...feats: [
    [keyof typeof pinnedFields, 'confirmed' | 'unresolved'],
    [keyof typeof pinnedFields, 'confirmed' | 'unresolved'],
  ]
) {
  return feats.map(([name, status]) => {
    const definition = featBatch(entries, batch).definition(name, 'situation');
    expectPinned(name, definition);
    expect(assessmentStatus(definition.ruleIdentity), name).toBe(status);
    return definition;
  }) as [FeatDefinition, FeatDefinition];
}

/** Every base ability score 10, Wisdom as given. */
async function baseScores({ member, scope }: Setup, wisdom: number) {
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom,
      charisma: 10,
    },
    operationId: 'base-scores',
  });
}

/** The client preview of the saved sheet with the selection's feat replaced. */
function stagedReplacement(
  saved: Awaited<ReturnType<Setup['readClient']>>,
  entryId: Awaited<ReturnType<Setup['select']>>,
  change: {
    catalogEntryId: Awaited<ReturnType<Setup['insert']>>;
    active?: true;
  },
) {
  return calculateCharacterSheetPreview(saved, {
    entries: saved.entries.map((row) =>
      row._id === entryId ? { ...row, ...change } : row,
    ),
  });
}

/** The saved selection is switched off and holds the given feat. */
async function expectFinalSelection(
  { owner, scope }: Setup,
  entryId: Awaited<ReturnType<Setup['select']>>,
  catalogEntryId: Awaited<ReturnType<Setup['insert']>>,
) {
  expect(
    (await owner.query(api.characterSheet.read, scope))?.entries.find(
      (row) => row._id === entryId,
    ),
  ).toMatchObject({ active: false, catalogEntryId });
}

/**
 * A Skill Focus definition's one Modifier (#724): untyped on its skill, the
 * reviewed rank formula given as a literal by the row.
 */
function skillFocusModifiers(target: string, formula: string) {
  return [{ target, bonusType: 'untyped', value: { formula } }];
}

const rows: FeatRow[] = [
  {
    batch: 'feats-339',
    title:
      'Skill Focus (Perception) (confirmed), then Solo Maneuvers (unresolved) in its place: listed as installed, the derived statistics of the client preview equal those of the saved sheet, also before the replacement is saved, the +3 Perception and the sole-threatening CMD follow the selection, no global definition is made, and others are refused',
    async check(setup) {
      const { t, member, scope, insert, fighterLevel, select } = setup;
      const [focus, solo] = rowDefinitions(
        'feats-339',
        ['Skill Focus (Perception)', 'confirmed'],
        ['Solo Maneuvers', 'unresolved'],
      );
      const focusId = await insert(focus);
      const soloId = await insert(solo);
      await fighterLevel();
      await baseScores(setup, 14);
      const selectionId = await select(focusId);
      const saved = await setup.readClient();
      for (const projection of [saved.calculated, saved.permanentCalculated]) {
        expect(projection.derivedStatistics.will.total).toBe(2);
        // #724: no Perception ranks, so Skill Focus adds +3 with nothing selected.
        expect(projection.breakdowns['skill.per'].total).toBe(5);
      }
      expect(focus.modifiers).toEqual(
        skillFocusModifiers(
          'skill.per',
          '3 + 3 * min(1, floor(@skillRanks.per / 10))',
        ),
      );
      expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
        saved.calculated.derivedStatistics,
      );
      expect(
        calculateCharacterSheetPreview(saved).breakdowns['skill.per'].total,
      ).toBe(5);
      // The stored definition is the one installed.
      expect(
        (await member.query(api.catalogCopies.list, scope)).find(
          (row) => row._id === focusId,
        ),
      ).toMatchObject(focus);
      await toggle(setup, selectionId, false);
      const inactive = await setup.readClient();
      expect(inactive.calculated.breakdowns['skill.per'].total).toBe(2);
      expect(
        calculateCharacterSheetPreview(inactive).breakdowns['skill.per'].total,
      ).toBe(2);
      // The client preview selecting Solo Maneuvers before the choice is saved.
      const staged = stagedReplacement(inactive, selectionId, {
        catalogEntryId: soloId,
        active: true,
      });
      await replaceFeat(setup, selectionId, {
        catalogEntryId: soloId,
        active: true,
      });
      const soloSaved = await setup.readClient();
      expect(staged.derivedStatistics).toEqual(
        soloSaved.calculated.derivedStatistics,
      );
      expect(
        calculateCharacterSheetPreview(soloSaved).derivedStatistics,
      ).toEqual(soloSaved.calculated.derivedStatistics);
      expect(soloSaved.calculated.derivedStatistics.cmd.total).toBe(11);
      const soloSituation = {
        ...localOn(solo, 'cmd'),
        sheetEntryId: selectionId,
      };
      expect(
        calculateCharacterSheetPreview(
          soloSaved,
          {},
          { situations: [soloSituation] },
        ).derivedStatistics.cmd.total,
      ).toBe(12);
      // The old test compared these with the ordinary CMD read above (11).
      expect(
        calculateCharacterSheetPreview(
          soloSaved,
          {},
          { situations: ['bullRush'] },
        ).derivedStatistics.cmd.total,
      ).toBe(11);
      expect(
        calculateCharacterSheetPreview(soloSaved, {}, { situations: ['trip'] })
          .derivedStatistics.cmd.total,
      ).toBe(11);
      await toggle(setup, selectionId, false);
      const soloInactive = await setup.readClient();
      expect(
        calculateCharacterSheetPreview(
          soloInactive,
          {},
          { situations: [soloSituation] },
        ).derivedStatistics.cmd.total,
      ).toBe(11);
      await setup.expectForeignAndAnonymousRefusals(selectionId, solo);
      await setup.expectRefusals(selectionId, true);
      await expectFinalSelection(setup, selectionId, soloId);
      // Installing a definition on a Character makes no global one.
      expect(
        await t.run((ctx) =>
          ctx.db
            .query('catalogEntry')
            .withIndex('by_scope_and_ruleIdentity', (q) =>
              q.eq('scope', 'global').eq('ruleIdentity', solo.ruleIdentity),
            )
            .take(1),
        ),
      ).toEqual([]);
    },
  },
  {
    batch: 'feats-340',
    title:
      'Skill Focus (Knowledge [Local]) (confirmed), then Horse Whisperer (unresolved) in its place: listed as installed, the derived statistics of the client preview equal those of the saved sheet, the +3 Knowledge (local) and the horse-handling +2 follow the selection, and others are refused',
    async check(setup) {
      const { member, scope, insert, fighterLevel, select } = setup;
      const [focus, horse] = rowDefinitions(
        'feats-340',
        ['Skill Focus (Knowledge [Local])', 'confirmed'],
        ['Horse Whisperer', 'unresolved'],
      );
      const focusId = await insert(focus);
      const horseId = await insert(horse);
      await fighterLevel();
      await baseScores(setup, 14);
      const selectionId = await select(focusId);
      const saved = await setup.readClient();
      for (const projection of [saved.calculated, saved.permanentCalculated]) {
        expect(projection.derivedStatistics.will.total).toBe(2);
        // #724: no Knowledge (local) ranks, so Skill Focus adds +3 with nothing selected.
        expect(projection.breakdowns['skill.klo'].total).toBe(3);
      }
      expect(focus.modifiers).toEqual(
        skillFocusModifiers(
          'skill.klo',
          '3 + 3 * min(1, floor(@skillRanks.klo / 10))',
        ),
      );
      expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
        saved.calculated.derivedStatistics,
      );
      expect(
        calculateCharacterSheetPreview(saved).breakdowns['skill.klo'].total,
      ).toBe(3);
      // The stored definition is the one installed.
      expect(
        (await member.query(api.catalogCopies.list, scope)).find(
          (row) => row._id === focusId,
        ),
      ).toMatchObject(focus);
      await toggle(setup, selectionId, false);
      const inactive = await setup.readClient();
      expect(inactive.calculated.breakdowns['skill.klo'].total).toBe(0);
      expect(
        calculateCharacterSheetPreview(inactive).breakdowns['skill.klo'].total,
      ).toBe(0);
      await replaceFeat(setup, selectionId, {
        catalogEntryId: horseId,
        active: true,
      });
      const horseSaved = await setup.readClient();
      expect(
        calculateCharacterSheetPreview(horseSaved).derivedStatistics,
      ).toEqual(horseSaved.calculated.derivedStatistics);
      const scopedHorse = {
        ...localOn(horse, 'skill.han'),
        sheetEntryId: selectionId,
      };
      expect(horseSaved.calculated.breakdowns['skill.han'].total).toBe(0);
      expect(
        calculateCharacterSheetPreview(
          horseSaved,
          {},
          { situations: [scopedHorse] },
        ).breakdowns['skill.han'].total,
      ).toBe(2);
      expect(
        calculateCharacterSheetPreview(
          horseSaved,
          {},
          { situations: ['charging'] },
        ).breakdowns['skill.han'].total,
      ).toBe(0);
      expect(
        calculateCharacterSheetPreview(
          horseSaved,
          {},
          {
            situations: [{ ...scopedHorse, sheetEntryId: 'another-selection' }],
          },
        ).breakdowns['skill.han'].total,
      ).toBe(0);
      await toggle(setup, selectionId, false);
      const horseInactive = await setup.readClient();
      expect(
        calculateCharacterSheetPreview(
          horseInactive,
          {},
          { situations: [scopedHorse] },
        ).breakdowns['skill.han'].total,
      ).toBe(0);
      await setup.expectRefusals(selectionId, true);
      await expectFinalSelection(setup, selectionId, horseId);
    },
  },
  {
    batch: 'feats-341',
    title:
      'Stealthy (Mythic) (unresolved), then Crane Style (unresolved) in its place: listed as installed, the derived statistics of the client preview equal those of the saved sheet, the +2 Escape Artist and Stealth and the Crane Style dodge AC follow the selection, and others are refused',
    async check(setup) {
      const { member, scope, insert, fighterLevel, select } = setup;
      const [stealth, crane] = rowDefinitions(
        'feats-341',
        ['Stealthy (Mythic)', 'unresolved'],
        ['Crane Style', 'unresolved'],
      );
      const stealthId = await insert(stealth);
      const craneId = await insert(crane);
      await fighterLevel();
      await baseScores(setup, 14);
      const selectionId = await select(stealthId);
      const saved = await setup.readClient();
      for (const projection of [saved.calculated, saved.permanentCalculated]) {
        expect(projection.derivedStatistics.will.total).toBe(2);
        expect(projection.breakdowns['skill.esc'].total).toBe(2);
        expect(projection.breakdowns['skill.ste'].total).toBe(2);
      }
      expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
        saved.calculated.derivedStatistics,
      );
      expect(
        calculateCharacterSheetPreview(saved).breakdowns['skill.ste'].total,
      ).toBe(2);
      // The stored definition is the one installed.
      expect(
        (await member.query(api.catalogCopies.list, scope)).find(
          (row) => row._id === stealthId,
        ),
      ).toMatchObject(stealth);
      await toggle(setup, selectionId, false);
      const inactive = await setup.readClient();
      expect(inactive.calculated.breakdowns['skill.ste'].total).toBe(0);
      expect(
        calculateCharacterSheetPreview(inactive).breakdowns['skill.ste'].total,
      ).toBe(0);
      await replaceFeat(setup, selectionId, {
        catalogEntryId: craneId,
        active: true,
      });
      const craneSaved = await setup.readClient();
      const scoped = {
        ...localOn(crane, 'ac.other'),
        sheetEntryId: selectionId,
      };
      expect(craneSaved.calculated.breakdowns['ac.other'].total).toBe(0);
      expect(
        calculateCharacterSheetPreview(craneSaved, {}, { situations: [scoped] })
          .breakdowns['ac.other'].total,
      ).toBe(1);
      expect(
        calculateCharacterSheetPreview(
          craneSaved,
          {},
          { situations: ['fighting-defensively'] },
        ).breakdowns['ac.other'].total,
      ).toBe(0);
      expect(
        calculateCharacterSheetPreview(
          craneSaved,
          {},
          { situations: [{ ...scoped, sheetEntryId: 'other-selection' }] },
        ).breakdowns['ac.other'].total,
      ).toBe(0);
      await toggle(setup, selectionId, false);
      const craneInactive = await setup.readClient();
      expect(
        calculateCharacterSheetPreview(
          craneInactive,
          {},
          { situations: [scoped] },
        ).breakdowns['ac.other'].total,
      ).toBe(0);
      await setup.expectRefusals(selectionId, true);
      await expectFinalSelection(setup, selectionId, craneId);
    },
  },
  ...(
    [
      [
        'Skill Focus (Handle Animal)',
        'han',
        '3 + 3 * min(1, floor(@skillRanks.han / 10))',
      ],
      [
        'Skill Focus (Disable Device)',
        'dev',
        '3 + 3 * min(1, floor(@skillRanks.dev / 10))',
      ],
    ] as const
  ).map(
    ([name, skill, formula]): FeatRow => ({
      batch: 'feats-342',
      title: `${name} (confirmed), then Tree Hanger (unresolved) in its place: listed as installed, the derived statistics of the client preview equal those of the saved sheet, also before the replacement is saved, the +3 skill and the trip CMD +2 follow the selection, and others are refused`,
      async check(setup) {
        const { member, scope, insert, select } = setup;
        const target = `skill.${skill}` as const;
        const [focus, tree] = rowDefinitions(
          'feats-342',
          [name, 'confirmed'],
          ['Tree Hanger', 'unresolved'],
        );
        const focusId = await insert(focus);
        const treeId = await insert(tree);
        await baseScores(setup, 10);
        const selectionId = await select(focusId);
        const saved = await setup.readClient();
        // #724: no ranks and the skill's ability at 10, so Skill Focus adds +3
        // with nothing selected.
        expect(saved.calculated.breakdowns[target].total).toBe(3);
        expect(saved.permanentCalculated.breakdowns[target].total).toBe(3);
        expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
          saved.calculated.derivedStatistics,
        );
        expect(focus.modifiers).toEqual(skillFocusModifiers(target, formula));
        expect(
          calculateCharacterSheetPreview(saved).breakdowns[target].total,
        ).toBe(3);
        // The stored definition is the one installed.
        expect(
          (await member.query(api.catalogCopies.list, scope)).find(
            (row) => row._id === focusId,
          ),
        ).toMatchObject(focus);
        const staged = stagedReplacement(saved, selectionId, {
          catalogEntryId: treeId,
        });
        await replaceFeat(setup, selectionId, { catalogEntryId: treeId });
        const treeSaved = await setup.readClient();
        expect(staged.derivedStatistics).toEqual(
          treeSaved.calculated.derivedStatistics,
        );
        // The old test compared the trip and bull-rush CMD with this ordinary
        // CMD (plus 2 and plus 0): all three are literals here.
        expect(treeSaved.calculated.derivedStatistics.cmd.total).toBe(10);
        expect(
          calculateCharacterSheetPreview(
            treeSaved,
            {},
            { situations: ['trip'] },
          ).derivedStatistics.cmd.total,
        ).toBe(12);
        expect(
          calculateCharacterSheetPreview(
            treeSaved,
            {},
            { situations: ['bullRush'] },
          ).derivedStatistics.cmd.total,
        ).toBe(10);
        await toggle(setup, selectionId, false);
        const inactive = await setup.readClient();
        expect(
          calculateCharacterSheetPreview(inactive, {}, { situations: ['trip'] })
            .derivedStatistics.cmd.total,
        ).toBe(10);
        await setup.expectForeignAndAnonymousRefusals(selectionId, tree);
        await setup.expectRefusals(selectionId, true);
        await expectFinalSelection(setup, selectionId, treeId);
      },
    }),
  ),
  {
    batch: 'feats-343',
    title:
      'Skill Focus (Knowledge [Nobility]) (confirmed), then Harrowed (unresolved) in its place: listed as installed, the derived statistics of the client preview equal those of the saved sheet, also before the replacement is saved, the +3 Knowledge (nobility) and the enchantment Will +1 follow the selection, and others are refused',
    async check(setup) {
      const { member, scope, insert, select } = setup;
      const [focus, harrow] = rowDefinitions(
        'feats-343',
        ['Skill Focus (Knowledge [Nobility])', 'confirmed'],
        ['Harrowed', 'unresolved'],
      );
      const focusId = await insert(focus);
      const harrowId = await insert(harrow);
      await baseScores(setup, 10);
      const selectionId = await select(focusId);
      const saved = await setup.readClient();
      // #724: no ranks and the skill's ability at 10, so Skill Focus adds +3
      // with nothing selected.
      expect(saved.calculated.breakdowns['skill.kno'].total).toBe(3);
      expect(saved.permanentCalculated.breakdowns['skill.kno'].total).toBe(3);
      expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
        saved.calculated.derivedStatistics,
      );
      expect(focus.modifiers).toEqual(
        skillFocusModifiers(
          'skill.kno',
          '3 + 3 * min(1, floor(@skillRanks.kno / 10))',
        ),
      );
      expect(
        calculateCharacterSheetPreview(saved).breakdowns['skill.kno'].total,
      ).toBe(3);
      // The stored definition is the one installed.
      expect(
        (await member.query(api.catalogCopies.list, scope)).find(
          (row) => row._id === focusId,
        ),
      ).toMatchObject(focus);
      const staged = stagedReplacement(saved, selectionId, {
        catalogEntryId: harrowId,
      });
      await replaceFeat(setup, selectionId, { catalogEntryId: harrowId });
      const harrowSaved = await setup.readClient();
      expect(staged.derivedStatistics).toEqual(
        harrowSaved.calculated.derivedStatistics,
      );
      // The old test compared the enchantment and fear Will with this
      // ordinary Will (plus 1 and plus 0): all three are literals here.
      expect(harrowSaved.calculated.derivedStatistics.will.total).toBe(0);
      expect(
        calculateCharacterSheetPreview(
          harrowSaved,
          {},
          { situations: ['enchantment'] },
        ).derivedStatistics.will.total,
      ).toBe(1);
      expect(
        calculateCharacterSheetPreview(
          harrowSaved,
          {},
          { situations: ['fear'] },
        ).derivedStatistics.will.total,
      ).toBe(0);
      await toggle(setup, selectionId, false);
      const inactive = await setup.readClient();
      expect(
        calculateCharacterSheetPreview(
          inactive,
          {},
          { situations: ['enchantment'] },
        ).derivedStatistics.will.total,
      ).toBe(0);
      await setup.expectForeignAndAnonymousRefusals(selectionId, harrow);
      await setup.expectRefusals(selectionId, true);
      await expectFinalSelection(setup, selectionId, harrowId);
    },
  },
  {
    batch: 'feats-344',
    title:
      'Pass For Human (unresolved), then Opening Volley (unresolved) in its place: listed as installed, the derived statistics of the client preview equal those of the saved sheet, also before the replacement is saved, the selected human-disguise +10 and the opening-volley +4 follow the selection, and others are refused',
    async check(setup) {
      const { member, scope, insert, select } = setup;
      const [disguise, volley] = rowDefinitions(
        'feats-344',
        ['Pass For Human', 'unresolved'],
        ['Opening Volley', 'unresolved'],
      );
      const disguiseId = await insert(disguise);
      const volleyId = await insert(volley);
      await baseScores(setup, 10);
      const selectionId = await select(disguiseId);
      const saved = await setup.readClient();
      expect(saved.calculated.breakdowns['skill.dis'].total).toBe(0);
      expect(saved.permanentCalculated.breakdowns['skill.dis'].total).toBe(0);
      expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
        saved.calculated.derivedStatistics,
      );
      const human = localAt(disguise);
      expect(
        calculateCharacterSheetPreview(
          saved,
          {},
          { situations: [{ ...human, sheetEntryId: selectionId }] },
        ).breakdowns['skill.dis'].total,
      ).toBe(10);
      expect(
        calculateCharacterSheetPreview(
          saved,
          {},
          { situations: [{ ...human, sheetEntryId: 'other' }] },
        ).breakdowns['skill.dis'].total,
      ).toBe(0);
      // The stored definition is the one installed.
      expect(
        (await member.query(api.catalogCopies.list, scope)).find(
          (row) => row._id === disguiseId,
        ),
      ).toMatchObject(disguise);
      const staged = stagedReplacement(saved, selectionId, {
        catalogEntryId: volleyId,
      });
      await replaceFeat(setup, selectionId, { catalogEntryId: volleyId });
      const volleySaved = await setup.readClient();
      expect(staged.derivedStatistics).toEqual(
        volleySaved.calculated.derivedStatistics,
      );
      const timing = { ...localAt(volley), sheetEntryId: selectionId };
      expect(
        calculateCharacterSheetPreview(
          volleySaved,
          {},
          { situations: [timing] },
        ).breakdowns['attack.melee'].total,
      ).toBe(4);
      expect(volleySaved.calculated.breakdowns['attack.melee'].total).toBe(0);
      await toggle(setup, selectionId, false);
      const inactive = await setup.readClient();
      expect(
        calculateCharacterSheetPreview(inactive, {}, { situations: [timing] })
          .breakdowns['attack.melee'].total,
      ).toBe(0);
      await setup.expectForeignAndAnonymousRefusals(selectionId, volley);
      await setup.expectRefusals(selectionId, true);
      await expectFinalSelection(setup, selectionId, volleyId);
    },
  },
  ...(
    [
      {
        batch: 'feats-345',
        focus: 'Skill Focus (Knowledge [Dungeoneering])',
        skill: 'kdu',
        formula: '3 + 3 * min(1, floor(@skillRanks.kdu / 10))',
        second: 'Animal Disguise',
        target: 'skill.dis',
        rule: 'the animal-disguise +2',
      },
      {
        batch: 'feats-346',
        focus: 'Skill Focus (Heal)',
        skill: 'hea',
        formula: '3 + 3 * min(1, floor(@skillRanks.hea / 10))',
        second: 'Moontouched',
        target: 'save.fort',
        rule: 'the moon-visibility Fortitude +2',
      },
    ] as const
  ).map(
    ({
      batch,
      focus: focusName,
      skill,
      formula,
      second,
      target,
      rule,
    }): FeatRow => ({
      batch,
      title: `${focusName} (confirmed), then ${second} (unresolved) in its place: listed as installed, the derived statistics of the client preview equal those of the saved sheet, also before the replacement is saved, the +3 skill and ${rule} follow the selection, and others are refused`,
      async check(setup) {
        const { member, scope, insert, select } = setup;
        const [focus, replacement] = rowDefinitions(
          batch,
          [focusName, 'confirmed'],
          [second, 'unresolved'],
        );
        const focusId = await insert(focus);
        const replacementId = await insert(replacement);
        await baseScores(setup, 10);
        const selectionId = await select(focusId);
        const saved = await setup.readClient();
        // #724: no ranks and the skill's ability at 10, so Skill Focus adds +3
        // with nothing selected.
        expect(saved.calculated.breakdowns[`skill.${skill}`].total).toBe(3);
        expect(
          saved.permanentCalculated.breakdowns[`skill.${skill}`].total,
        ).toBe(3);
        expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
          saved.calculated.derivedStatistics,
        );
        expect(focus.modifiers).toEqual(
          skillFocusModifiers(`skill.${skill}`, formula),
        );
        expect(
          calculateCharacterSheetPreview(saved).breakdowns[`skill.${skill}`]
            .total,
        ).toBe(3);
        // The stored definition is the one installed.
        expect(
          (await member.query(api.catalogCopies.list, scope)).find(
            (row) => row._id === focusId,
          ),
        ).toMatchObject(focus);
        const staged = stagedReplacement(saved, selectionId, {
          catalogEntryId: replacementId,
        });
        await replaceFeat(setup, selectionId, {
          catalogEntryId: replacementId,
        });
        const replaced = await setup.readClient();
        expect(staged.derivedStatistics).toEqual(
          replaced.calculated.derivedStatistics,
        );
        const local = localAt(replacement);
        expect(replaced.calculated.breakdowns[target].total).toBe(0);
        expect(
          calculateCharacterSheetPreview(
            replaced,
            {},
            { situations: [{ ...local, sheetEntryId: selectionId }] },
          ).breakdowns[target].total,
        ).toBe(2);
        expect(
          calculateCharacterSheetPreview(
            replaced,
            {},
            { situations: [{ ...local, sheetEntryId: 'other' }] },
          ).breakdowns[target].total,
        ).toBe(0);
        await toggle(setup, selectionId, false);
        const inactive = await setup.readClient();
        expect(
          calculateCharacterSheetPreview(
            inactive,
            {},
            { situations: [{ ...local, sheetEntryId: selectionId }] },
          ).breakdowns[target].total,
        ).toBe(0);
        await setup.expectForeignAndAnonymousRefusals(selectionId, replacement);
        await setup.expectRefusals(selectionId, true);
        await expectFinalSelection(setup, selectionId, replacementId);
      },
    }),
  ),
  {
    batch: 'feats-347',
    title:
      'Free Spirit (unresolved), then Enemy Cult (unresolved) in its place: listed as installed, the derived statistics of the client preview equal those of the saved sheet, also before the replacement is saved, the mind-affecting Will +2 and the Story-completion Fortitude +2 follow the selection, and others are refused',
    async check(setup) {
      const { member, scope, insert, select } = setup;
      const [spirit, enemyCult] = rowDefinitions(
        'feats-347',
        ['Free Spirit', 'unresolved'],
        ['Enemy Cult', 'unresolved'],
      );
      const spiritId = await insert(spirit);
      const enemyCultId = await insert(enemyCult);
      await baseScores(setup, 10);
      const selectionId = await select(spiritId);
      const saved = await setup.readClient();
      expect(saved.calculated.breakdowns['save.will'].total).toBe(0);
      expect(saved.permanentCalculated.breakdowns['save.will'].total).toBe(0);
      expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
        saved.calculated.derivedStatistics,
      );
      expect(
        calculateCharacterSheetPreview(
          saved,
          {},
          { situations: ['mindAffecting'] },
        ).breakdowns['save.will'].total,
      ).toBe(2);
      // The stored definition is the one installed.
      expect(
        (await member.query(api.catalogCopies.list, scope)).find(
          (row) => row._id === spiritId,
        ),
      ).toMatchObject(spirit);
      const staged = stagedReplacement(saved, selectionId, {
        catalogEntryId: enemyCultId,
      });
      await replaceFeat(setup, selectionId, { catalogEntryId: enemyCultId });
      const enemyCultSaved = await setup.readClient();
      expect(staged.derivedStatistics).toEqual(
        enemyCultSaved.calculated.derivedStatistics,
      );
      const completion = {
        ...localAt(enemyCult),
        sheetEntryId: selectionId,
      };
      expect(enemyCultSaved.calculated.breakdowns['save.fort'].total).toBe(0);
      expect(
        calculateCharacterSheetPreview(
          enemyCultSaved,
          {},
          { situations: [completion] },
        ).breakdowns['save.fort'].total,
      ).toBe(2);
      expect(
        calculateCharacterSheetPreview(
          enemyCultSaved,
          {},
          { situations: [{ ...completion, sheetEntryId: 'other' }] },
        ).breakdowns['save.fort'].total,
      ).toBe(0);
      await toggle(setup, selectionId, false);
      const inactive = await setup.readClient();
      expect(
        calculateCharacterSheetPreview(
          inactive,
          {},
          { situations: [completion] },
        ).breakdowns['save.fort'].total,
      ).toBe(0);
      await setup.expectForeignAndAnonymousRefusals(selectionId, enemyCult);
      await setup.expectRefusals(selectionId, true);
      await expectFinalSelection(setup, selectionId, enemyCultId);
    },
  },
];

describe('the released feat integration rows', () => {
  for (const row of rows)
    test(`${row.batch}: ${row.title}`, async () =>
      row.check(await setUp(row.batch)));
});
