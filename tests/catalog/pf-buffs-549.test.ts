// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import { listCurationFormulaIssues } from '../../scripts/catalog/curation';
import {
  upstreamRecord,
  sourceDescription,
} from '../../scripts/catalog/records';
import {
  buildAssessmentBinding,
  collectReferences,
} from '../../scripts/catalog/admission';
import type { PreviewEntry } from '../../scripts/catalog/map';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import {
  review,
  assessedBuffs,
  excludedRows,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/pf-buffs-549/data';
import {
  buffEntry,
  buffModifiers,
  buffSituations,
  total,
} from '../fixtures/pf-buffs-549/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import {
  bindSnapshotToCurrentNotices,
  findCommittedBatchOwnershipProblems,
} from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const EXPERTISE = 'pf1-content/Xwk4zZksBg2KvyEG';
const MAGIC_FANG = 'pf1-content/hLyR3HQklOuoI86H';
function candidate(name: string) {
  const row = assessedBuffs.find(
    (row) => row.externalKey === name || row.name === name,
  );
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
const asPreviewEntries = (rows: typeof preview.entries) =>
  rows as unknown as PreviewEntry[];
const byKey = new Map(
  asPreviewEntries([...preview.entries, ...preview.closure]).map((row) => [
    row.externalKey,
    row,
  ]),
);
function closureOf(key: string) {
  const seen = new Set<string>();
  const stack = [key];
  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    const entry = byKey.get(current);
    if (entry) stack.push(...collectReferences(entry));
  }
  return [...seen].sort();
}
const hasUnchained = (key: string) =>
  JSON.stringify(byKey.get(key) ?? {}).includes('"unchained"');
// The buffs whose full-corpus closure keeps no Unchained action-cost metadata:
// the senses and combat states, the hunter's animal focus, Joyous Companion,
// Combat Expertise, the debilitating injury and the race builder Stench Aura,
// whose link the import strips. Every other buff reaches it through its own
// action or a linked Spell, class ability or racial trait.
const WITHOUT_UNCHAINED_CLOSURE = [
  'pf1-content/RAYOWB9C1py88D2X', // Joyous Companion
  'pf1-content/Un3yEd7l1wt9VEF7', // Squeezing (½ space)
  'pf1-content/WVs1d1l2G45GRlQc', // Tremorsense 30'
  'pf1-content/WmHIEsLnruuSZcx0', // Charging
  'pf1-content/XDuJwn4sGLcklc9P', // Squeezing (< ½ space)
  'pf1-content/Xwk4zZksBg2KvyEG', // Combat Expertise
  'pf1-content/YX0ZXFOGqZXu57AN', // Debilitating Injury (Bewildered)
  'pf1-content/Yr2fjmHuiTy4J6nC', // Animal Focus (Frog)
  'pf1-content/ZdWzYw9c7zJJPwvz', // Low-Light Vision
  'pf1-content/aDfhYYfmFOdJxPJz', // Stench Aura
  'pf1-content/dHZ25yUwzmosJZbw', // Animal Focus (Bat)
  'pf1-content/eD5e5MRoDhHo5W0U', // Cover (Soft)
  'pf1-content/gZcJUqfShwSyM5er', // Climbing
  'pf1-content/gipXe2qnQKwV1HDi', // Flanking
  'pf1-content/h4lF0rjs1xS5MFnZ', // Truesight 120'
  'pf1-content/mZ63Rbpnk9UCwtWN', // Animal Focus (Wolf)
].sort();
// The unchained rogue's debilitating injury is a Pathfinder Unchained class
// feature: its buff requires PZO1131 for the rule itself (its class ability has
// no action), as #548's Disoriented and Hampered.
const UNCHAINED_RULE = ['pf1-content/YX0ZXFOGqZXu57AN'];
const BAB = (value: number) => ({
  target: 'bab' as const,
  bonusType: 'base' as const,
  value,
  sheetEntryId: 'fixture-bab',
  catalogEntryId: 'fixture-bab',
  entryName: 'Fixture BAB',
  source: 'fixture-bab',
  builtIn: false,
});
const CHARISMA = (value: number) => ({
  target: 'ability.cha' as const,
  bonusType: 'base' as const,
  value,
  sheetEntryId: 'fixture-cha',
  catalogEntryId: 'fixture-cha',
  entryName: 'Fixture Charisma',
  source: 'fixture-cha',
  builtIn: false,
});

it('excludes the two folders and the conditional-modifier helper, admits Combat Expertise and holds the rest on named reasons', () => {
  expect(review.candidates).toHaveLength(100);
  expect(review.counts).toEqual({
    total: 100,
    admitted: 1,
    held: 96,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 3,
    excludedFolders: 2,
    excludedHelpers: 1,
    recordLevel35Holds: 0,
  });
  expect(excludedRows.map((row) => [row.name, row.kind]).sort()).toEqual([
    ['*Common Conditional Modifiers', 'conditionalHelper'],
    ['Racial', 'folder'],
    ['Spells', 'folder'],
  ]);
  expect(
    assessedBuffs
      .filter((row) => row.disposition !== 'held')
      .map((row) => [row.name, row.disposition]),
  ).toEqual([['Combat Expertise', 'admitted']]);
  // Combat Expertise matches the admitted Core Rulebook feat and PCGen,
  // duration included, once its penalty also reaches combat maneuver checks.
  expect(candidate(EXPERTISE)).toMatchObject({
    disposition: 'admitted',
    assessmentStatus: 'confirmed',
    requiredNotices: ['PZO1110'],
    holdIds: [],
    noticeHoldIds: [],
  });
  for (const row of assessedBuffs)
    if (row.disposition === 'held')
      expect(
        row.holdIds.length + row.noticeHoldIds.length,
        row.name,
      ).toBeGreaterThan(0);
  const kinds = (row: (typeof assessedBuffs)[number]) =>
    row.holdIds.map((id) =>
      id.replace('pf-buffs-549-', '').replace(/-[A-Za-z0-9]{16}$/, ''),
    );
  // 74 buffs cite no source; the 23 cited ones are the racial-trait buffs.
  // No hold rests on the missing citation (#241, #507; Sol review of #548).
  expect(assessedBuffs.filter((row) => !row.citedSources.length)).toHaveLength(
    74,
  );
  expect(assessedBuffs.flatMap(kinds)).not.toContain('uncited');
  expect(
    Object.fromEntries(
      assessedBuffs
        .filter((row) => row.holdIds.length)
        .map((row) => [row.name, kinds(row)]),
    ),
  ).toEqual({
    'Weapon of Awe': ['emotion-attribution'],
    Adoration: ['emotion-attribution'],
    'Good Hope': ['emotion-attribution'],
    'Remove Fear': ['emotion-attribution'],
    'Angelic Aspect (Lesser)': ['broken-reference'],
    'Animal Focus (Frog)': ['broken-reference'],
    'Ape Walk': ['whole-content'],
    'Change Shape (Skinwalker, Amphibious)': ['whole-content'],
    'Change Shape (Skinwalker, Base Speed)': ['whole-content'],
    'Change Shape (Skinwalker, Darkvision)': ['whole-content'],
    'Change Shape (Skinwalker, Falling Damage)': ['whole-content'],
    'Change Shape (Skinwalker, Natural Armor)': ['whole-content'],
    'Change Shape (Skinwalker, STR)': ['whole-content'],
    'Change Shape (Skinwalker, Scent)': ['whole-content'],
    'Change Shape (Skinwalker, Swim Speed)': ['whole-content'],
    'Change Shape (Skinwalker, WIS)': ['whole-content'],
    Charging: ['whole-content'],
    Climbing: ['whole-content'],
    'Cover (Soft)': ['whole-content'],
    // Its "True seeing" link resolves to the True Breed feat.
    Displacement: ['wrong-reference'],
    'Elemental Assault (Acid, Race Builder)': ['broken-reference'],
    'Elemental Assault (Fire, Race Builder)': ['broken-reference'],
    Flanking: ['whole-content'],
    Hobble: ['whole-content'],
    Inspiration: ['whole-content'],
    'Iron Within (Speed)': ['whole-content'],
    'Low-Light Vision': ['whole-content'],
    // Its duration (1 round per level, the level its instructions set to the
    // character level) contradicts half the level.
    'Nereid Fascination': ['whole-content'],
    'Small Quarter Ally': ['whole-content'],
    // Its body adds a DR bypass the governing trait doesn't grant.
    'Smite Good (Tiefling)': ['whole-content'],
    'Squeezing (< ½ space)': ['whole-content'],
    'Squeezing (½ space)': ['whole-content'],
    'Stench Aura': ['broken-reference'],
    'Stoic Defender': ['whole-content'],
    'Swallow Your Fear': ['whole-content'],
    "Tremorsense 30'": ['whole-content'],
    "Truesight 120'": ['whole-content'],
  });
  for (const row of assessedBuffs)
    expect(row.assessmentStatus, row.name).toBe(
      row.holdIds.length ? 'unresolved' : 'confirmed',
    );
  expect(
    assessedBuffs.filter((row) => row.assessmentStatus === 'confirmed'),
  ).toHaveLength(60);
  // Death knell's duration (@item.level * 10 minutes) is the spell's 10
  // minutes per HD of the subject: its instructions set the buff level to the
  // slain target's Hit Dice (Sol review of #549).
  const knell = candidate('Death Knell');
  expect(knell).toMatchObject({
    disposition: 'held',
    assessmentStatus: 'confirmed',
    holdIds: [],
    noticeHoldIds: ['pf-buffs-549-notice-PZO1131-complete-chain'],
  });
  expect(knell.sourceFields).toMatchObject({
    duration: { units: 'minute', value: '@item.level * 10' },
    description: {
      instructions: expect.stringContaining(
        'Set buff level to the number of HD of the target.',
      ),
    },
  });
  // Nereid fascination's instructions set the level to the character level,
  // so its @item.level rounds are twice the rule's half level.
  expect(candidate('Nereid Fascination').sourceFields).toMatchObject({
    duration: { units: 'round', value: '@item.level' },
    description: {
      instructions:
        "<p>Set the buff's level to the level of the character.</p>",
    },
  });
});

it('applies the reviewed Modifiers through the public resolver', () => {
  const cl = (
    name: string,
    target: Parameters<typeof total>[1],
    levels: readonly number[],
    situations: readonly ReturnType<typeof buffSituations>[number][] = [],
  ) =>
    levels.map((casterLevel) =>
      total(buffModifiers(name, { casterLevel }), target, { situations }),
    );
  // Caster-level formulas read the effect's recorded caster level.
  expect(cl('Anticipate Peril', 'init', [1, 3, 5, 8])).toEqual([1, 3, 5, 5]);
  expect(cl('Wrathful Mantle', 'save.fort', [5, 8, 19, 20])).toEqual([
    1, 2, 4, 5,
  ]);
  const [onArmor, onShield] = buffSituations('Magic Vestment');
  expect(cl('Magic Vestment', 'ac.armor', [12])).toEqual([0]);
  expect(cl('Magic Vestment', 'ac.armor', [5, 12, 20], [onArmor!])).toEqual([
    1, 3, 5,
  ]);
  expect(cl('Magic Vestment', 'ac.shield', [12], [onArmor!])).toEqual([0]);
  expect(cl('Magic Vestment', 'ac.shield', [12], [onShield!])).toEqual([3]);
  expect(cl('Magic Vestment', 'ac.other', [20], [onArmor!])).toEqual([0]);
  const weapon = buffSituations('Magic Weapon, Greater');
  expect(cl('Magic Weapon, Greater', 'attack.melee', [12])).toEqual([0]);
  expect(
    cl('Magic Weapon, Greater', 'attack.ranged', [8, 12, 20], weapon),
  ).toEqual([2, 3, 5]);
  expect(cl('Magic Weapon, Greater', 'damage.melee', [20], weapon)).toEqual([
    5,
  ]);
  const [oneWeapon, allNatural] = buffSituations('Magic Fang, Greater');
  expect(
    cl('Magic Fang, Greater', 'attack.melee', [8, 12, 20], [oneWeapon!]),
  ).toEqual([2, 3, 5]);
  expect(
    cl('Magic Fang, Greater', 'damage.melee', [20], [allNatural!]),
  ).toEqual([1]);
  expect(cl('Magic Fang, Greater', 'attack.melee', [20])).toEqual([0]);
  // Magic fang: the reviewed replacements zero the imported +1s; the reviewed
  // Modifiers apply them only with the affected natural weapon.
  const fang = buffModifiers(MAGIC_FANG);
  expect(fang.slice(0, 2).map((row) => row.value)).toEqual([0, 0]);
  expect([total(fang, 'attack.melee'), total(fang, 'damage.melee')]).toEqual([
    0, 0,
  ]);
  const natural = { situations: buffSituations(MAGIC_FANG) };
  expect([
    total(fang, 'attack.melee', natural),
    total(fang, 'damage.melee', natural),
    total(fang, 'attack.ranged', natural),
  ]).toEqual([1, 1, 0]);
  // Foundry's private "resist" and "haste" types: the reviewed bonuses.
  for (const name of ['Holy Aura', 'Unholy Aura']) {
    const rows = buffModifiers(name);
    expect([total(rows, 'ac.other'), total(rows, 'save.ref')], name).toEqual([
      4, 4,
    ]);
    expect(
      total(rows, 'save.will', { situations: buffSituations(name) }),
      name,
    ).toBe(6);
  }
  const fervor = buffModifiers('Blessing of Fervor (Atk, AC, Ref)');
  expect([
    total(fervor, 'attack.melee'),
    total(fervor, 'ac.other'),
    total(fervor, 'save.ref'),
    total(fervor, 'save.will'),
  ]).toEqual([2, 2, 2, 0]);
  const limbs = buffModifiers('Channel Vigor (Limbs)');
  expect([
    total(limbs, 'attack.ranged'),
    total(limbs, 'ac.other'),
    total(limbs, 'save.ref'),
  ]).toEqual([1, 1, 1]);
  const torso = buffModifiers('Channel Vigor (Torso)');
  expect([total(torso, 'concentration'), total(torso, 'save.fort')]).toEqual([
    6, 6,
  ]);
  // Death knell's +1 caster level and +2 Strength.
  const knell = buffModifiers('Death Knell');
  expect([total(knell, 'casterLevel'), total(knell, 'ability.str')]).toEqual([
    1, 2,
  ]);
  // Dexterity-based skills, ability penalties and the imported numbers.
  const jitterbugs = buffModifiers('Jitterbugs');
  expect(
    ['skill.acr', 'skill.ste', 'skill.fly', 'skill.esc', 'skill.per'].map(
      (target) => total(jitterbugs, target as 'skill.per'),
    ),
  ).toEqual([-4, -4, -4, -4, 0]);
  const elderly = buffModifiers('Threefold Aspect (Elderly)');
  expect(
    ['ability.int', 'ability.wis', 'ability.str', 'ability.dex'].map((target) =>
      total(elderly, target as 'ability.wis'),
    ),
  ).toEqual([4, 4, -2, -2]);
  const might = buffModifiers('Righteous Might');
  expect(
    ['ability.str', 'ability.con', 'ability.dex', 'ac.natural', 'ac.other'].map(
      (target) => total(might, target as 'ac.natural'),
    ),
  ).toEqual([4, 4, -2, 2, 0]);
  const hope = buffModifiers('Good Hope');
  expect(
    ['attack.melee', 'damage.ranged', 'save.will', 'skill.per'].map((target) =>
      total(hope, target as 'save.will'),
    ),
  ).toEqual([2, 2, 2, 2]);
  expect(total(buffModifiers('Alter Self (Small)'), 'ability.dex')).toBe(2);
  expect(
    total(
      buffModifiers('Change Shape (Skinwalker, Natural Armor)'),
      'ac.natural',
    ),
  ).toBe(1);
  expect(
    total(
      buffModifiers('Change Shape (Skinwalker - Beast Talker, CON)'),
      'ability.con',
    ),
  ).toBe(2);
  // Combat expertise: the penalty on melee attacks and combat maneuver checks
  // and the dodge bonus grow with base attack bonus.
  for (const [bab, step] of [
    [0, 1],
    [4, 2],
    [8, 3],
    [20, 6],
  ] as const) {
    const expertise = [...buffModifiers(EXPERTISE), BAB(bab)];
    expect(
      [
        total(expertise, 'attack.melee'),
        total(expertise, 'cmb'),
        total(expertise, 'ac.other'),
        total(expertise, 'attack.ranged'),
      ],
      `BAB ${bab}`,
    ).toEqual([-step, -step, step, 0]);
  }
  // Smite evil reads the paladin's own Charisma and paladin level.
  const smite = [...buffModifiers('Smite Evil'), CHARISMA(16)];
  const target = { situations: buffSituations('Smite Evil') };
  expect([total(smite, 'attack.melee'), total(smite, 'ac.other')]).toEqual([
    0, 0,
  ]);
  expect([
    total(smite, 'attack.melee', target),
    total(smite, 'damage.melee', { ...target, classLevels: { paladin: 7 } }),
    total(smite, 'ac.other', target),
  ]).toEqual([3, 7, 3]);
  // A negative Charisma modifier (score 6) adds nothing.
  expect(
    total(
      [...buffModifiers('Smite Evil'), CHARISMA(6)],
      'attack.melee',
      target,
    ),
  ).toBe(0);
});

it('applies each situational Modifier only under its Situation, with the tiers mutually exclusive', () => {
  for (const [name, situation, target, value] of [
    ['Dispel Law', 'lawfulCreatures', 'ac.other', 4],
    ['Pernicious Poison', 'poison', 'save.fort', -4],
    ['Remove Fear', 'fear', 'save.will', 4],
    ['Remove Fear', 'fear', 'save.ref', 4],
    ['Joyous Companion', 'fear', 'save.will', 1],
    ['Small Quarter Ally', 'fear', 'save.fort', 1],
    ['Charging', 'bullRush', 'cmb', 2],
    ['Certain Grip', 'trip', 'cmd', 4],
    ['Certain Grip', 'bullRush', 'cmd', 4],
  ] as const) {
    const rows = buffModifiers(name);
    expect(buffSituations(name), name).toContain(situation);
    expect(total(rows, target, { situations: [situation] }), name).toBe(
      total(rows, target) + value,
    );
  }
  // Certain grip: one competence bonus to CMD, however many maneuvers apply.
  expect(
    total(buffModifiers('Certain Grip'), 'cmd', {
      situations: ['bullRush', 'drag', 'reposition', 'trip'],
    }),
  ).toBe(4);
  // Local Situations.
  for (const [name, target, value] of [
    ['Protection From Evil', 'ac.other', 2],
    ['Protection From Evil', 'save.ref', 4],
    ['Angelic Aspect (Lesser)', 'save.will', 4],
    ['Dispel Evil', 'ac.other', 4],
    ['Adoration', 'skill.dip', 2],
    ['Chastise', 'skill.int', 5],
    ['Glibness', 'skill.blf', 20],
    ['Identify', 'skill.spl', 10],
    ['Unbreakable Heart', 'save.will', 4],
    ['Banner, Greater', 'save.fort', 2],
    ['Weapon of Awe', 'damage.melee', 2],
    ['Certain Grip', 'skill.acr', 4],
    ['Cover (Soft)', 'ac.other', 4],
  ] as const) {
    const rows = buffModifiers(name);
    expect(total(rows, target), name).toBe(0);
    expect(
      total(rows, target, { situations: buffSituations(name) }),
      name,
    ).toBe(value);
  }
  const smiteGood = buffModifiers('Smite Good (Tiefling)');
  expect(
    total(smiteGood, 'damage.melee', {
      situations: buffSituations('Smite Good (Tiefling)'),
      hitDice: 6,
    }),
  ).toBe(6);
  // Mutually exclusive tiers for another creature's level.
  const tiers = (
    name: string,
    target: Parameters<typeof total>[1],
    expected: readonly number[],
    base = 0,
  ) => {
    const rows = buffModifiers(name);
    const scopes = buffSituations(name);
    expect(scopes, name).toHaveLength(expected.length);
    expect(total(rows, target), name).toBe(base);
    expect(
      scopes.map((scope) => total(rows, target, { situations: [scope] })),
      name,
    ).toEqual(expected);
  };
  tiers('Evil Eye (Atk)', 'attack.melee', [-2, -4]);
  tiers('Evil Eye (Skill)', 'skill.per', [-2, -4]);
  tiers('Animal Focus (Frog)', 'skill.swm', [4, 6, 8]);
  tiers('Touch of Good', 'attack.ranged', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  tiers('Touch of Good', 'save.will', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  // Bewildered: -2 to AC, plus the rogue tier against the rogue's attacks.
  tiers('Debilitating Injury (Bewildered)', 'ac.other', [-4, -6, -8], -2);
});

it('checks every description and context-note record against the pinned bodies', () => {
  let descriptions = 0;
  let notes = 0;
  for (const row of assessedBuffs) {
    const records = row.mechanicsReview.curationRecords;
    expect(records[0]?.kind, row.name).toBe('description');
    for (const record of records) {
      expect(record.status, row.name).toBe('checked');
      expect(record.diagnostics, row.name).toEqual([]);
      expect(record.reviewedBy).toBe('Opus (AI curator) for the owner');
      expect(
        listCurationFormulaIssues({
          record,
          isSpellEffect: row.kind === 'spellEffect',
        }),
        row.name,
      ).toEqual([]);
      if (record.kind === 'description') {
        descriptions++;
        expect(record.text).toBe(row.mechanicsReview.descriptionText);
      } else {
        notes++;
        expect(record.kind, row.name).toBe('note');
        expect(
          (row.sourceFields.contextNotes as { text: string }[]).map(
            (note) => note.text,
          ),
          row.name,
        ).toContain(record.text);
      }
      if (!record.outputs.length)
        expect(record.rationale, row.name).toContain(
          'Explicit covered/no-output',
        );
    }
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  }
  // One description record per buff (#759's ownership sweep) and every
  // required context-note record.
  expect(descriptions).toBe(97);
  expect(notes).toBe(80);
  expect(
    buffEntry('Animal Focus (Wolf)').situationalNotes?.map((note) => note.text),
  ).toEqual([
    'Scent with a range of 10 feet (20 feet from hunter level 8, 30 feet from 15); the range doubles if the opponent is upwind and is halved if it is downwind.',
  ]);
  expect(
    buffEntry("Tremorsense 30'").situationalNotes?.map((note) => note.text),
  ).toEqual([
    'Tremorsense 30 feet: you automatically pinpoint anything in contact with the ground (aquatic creatures: moving through water) within range.',
  ]);
});

it('records the cited, governing, inherited and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) => `pf-buffs-549-notice-${book}-complete-chain`;
  for (const row of assessedBuffs) {
    expect(row.requiredNotices[0], row.name).toBe('PZO1110');
    for (const cited of row.citedSources)
      expect(row.requiredNotices, row.name).toContain(cited.book);
    for (const comparison of [row.comparison, ...row.additionalComparisonLeads])
      if (comparison)
        expect(row.requiredNotices, row.name).toContain(comparison.book);
    for (const notice of row.inheritedRuleNotices)
      expect(row.requiredNotices, row.name).toContain(notice.book);
    for (const linked of row.linkedContentReview)
      for (const book of linked.sources)
        expect(row.requiredNotices, row.name).toContain(book.id);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
    for (const id of row.holdIds)
      expect(id, row.name).toMatch(
        new RegExp(`^pf-buffs-549-[a-z-]+-${row.externalKey.split('/')[1]}$`),
      );
  }
  const unchained = assessedBuffs
    .filter((row) => closureOf(row.externalKey).some(hasUnchained))
    .map((row) => row.externalKey)
    .sort();
  expect(unchained).toHaveLength(81);
  expect(unchained).toEqual(
    assessedBuffs
      .map((row) => row.externalKey)
      .filter((key) => !WITHOUT_UNCHAINED_CLOSURE.includes(key))
      .sort(),
  );
  expect(
    assessedBuffs
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual([...unchained, ...UNCHAINED_RULE].sort());
  // Monster abilities and universal monster rules the effects grant, by the
  // earliest book of their pinned record (#541).
  expect(
    Object.fromEntries(
      assessedBuffs
        .map(
          (row) =>
            [
              row.name,
              [
                ...new Set(
                  row.inheritedRuleNotices
                    .filter((notice) =>
                      /monster|Monster Rules/.test(notice.rule),
                    )
                    .map((notice) => notice.book),
                ),
              ],
            ] as const,
        )
        .filter(([, books]) => books.length),
    ),
  ).toEqual({
    'Alter Self (Small)': ['PZO1127', 'PZO1112'],
    'Angelic Aspect (Lesser)': ['PZO1112'],
    'Animal Focus (Bat)': ['PZO1127', 'PZO1112'],
    'Animal Focus (Wolf)': ['PZO1112'],
    'Change Shape (Skinwalker - Beast Talker, Darkvision)': ['PZO1127'],
    'Change Shape (Skinwalker, Darkvision)': ['PZO1127'],
    'Change Shape (Skinwalker, Scent)': ['PZO1112'],
    'Low-Light Vision': ['PZO1112'],
    "Tremorsense 30'": ['PZO1112'],
  });
  // A Spell Effect's governing Spell is its spellKey (bar the Animal Focus
  // typed as a spell and the misnamed Angelic Aspect) and the first linked body.
  for (const row of assessedBuffs.filter((row) => row.kind === 'spellEffect')) {
    const governing = row.linkedContentReview[0];
    expect(row.inheritedRuleSourceEvidence, row.name).toEqual(
      governing ? [governing] : [],
    );
    expect(row.mechanicsReview.effectReview.spellKey ?? null, row.name).toBe(
      ['Animal Focus (Frog)', 'Angelic Aspect (Lesser)'].includes(row.name)
        ? null
        : governing?.externalKey,
    );
  }
  for (const row of review.noticeRequirements) {
    if (row.book === 'PZO1110') {
      expect(row.holdId).toBeNull();
      continue;
    }
    expect(held.get(row.holdId ?? ''), row.book).toEqual([
      row.book,
      ...row.registryKeys.filter((key) => key !== row.book),
    ]);
    for (const key of row.candidates)
      expect(candidate(key).noticeHoldIds).toContain(row.holdId);
  }
});

it('pins all 100 keys, the complete bodies, linked bodies and literal PCGen and PRD evidence in the shared store', async () => {
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  for (const row of excludedRows) {
    const raw = upstreamRecord.parse(
      parse(await readPinned(row.source.repo, row.source.path)),
    );
    expect(raw._key, row.name).toBe(
      row.kind === 'folder' ? `!folders!${raw._id}` : `!items!${raw._id}`,
    );
  }
  expect(preview.entries).toHaveLength(97);
  for (const row of review.candidates) {
    const bytes = await readPinned(row.source.repo, row.source.path);
    expect(sha(bytes), row.externalKey).toBe(row.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes));
    expect(raw._id).toBe(row.externalKey.split('/')[1]);
    expect(raw.name).toBe(row.name);
    if (row.disposition === 'excluded') continue;
    expect(raw.system).toEqual(row.sourceFields);
    const description = sourceDescription(raw);
    expect(sha(description)).toBe(row.descriptionSha256);
    expect(description).toBe(row.mechanicsReview.descriptionText);
    for (const reviewed of row.mechanicsReview.curationRecords) {
      expect(sha(reviewed.text)).toBe(reviewed.textSha256);
      expect(
        reviewedCuration.records.find(
          (current) =>
            current.externalKey === row.externalKey &&
            current.kind === reviewed.kind &&
            current.target === reviewed.target &&
            current.textSha256 === reviewed.textSha256,
        ),
      ).toEqual(reviewed);
    }
    expect(buffEntry(row.externalKey).sources).toEqual(row.citedSources);
    for (const linked of row.linkedContentReview)
      expect(sha(await readPinned(linked.repo, linked.path)), linked.name).toBe(
        linked.sha256,
      );
    for (const page of row.prdComparisonEvidence)
      expect(sha(await readPinned('prd', page.path)), page.path).toBe(
        page.sha256,
      );
  }
  const files = new Map(
    review.comparisonSources.pcgenFiles.map((file) => [file.path, file.sha256]),
  );
  for (const [path, digest] of files) {
    const bytes = await readFile(`tests/fixtures/pinned/pcgen/${path}`);
    expect(sha(bytes), path).toBe(digest);
  }
  for (const row of assessedBuffs)
    for (const comparison of [
      row.comparison,
      ...row.additionalComparisonLeads,
      ...row.rejectedRootComparisonEvidence,
    ]) {
      if (!comparison) continue;
      expect(files.get(comparison.path)).toBe(comparison.comparisonFileSha256);
      const lines = (
        await readFile(`tests/fixtures/pinned/pcgen/${comparison.path}`, 'utf8')
      ).split(/\r?\n/);
      expect(lines[comparison.line - 1]).toBe(comparison.literalRow);
      expect(sha(comparison.literalRow)).toBe(comparison.comparisonLineSha256);
      const { path, line, text, sha256 } = comparison.publicationAnchor;
      expect(files.get(path)).toBe(sha256);
      const publication = await readFile(
        `tests/fixtures/pinned/pcgen/${path}`,
        'utf8',
      );
      expect(publication.split(/\r?\n/)[line - 1]?.split('\t')[0]).toBe(text);
    }
  // Combat Expertise's evidence is the Core Rulebook feat row.
  const expertise = candidate(EXPERTISE);
  expect(expertise.comparison?.literalRow).toContain(
    'penalty on melee attack rolls and combat maneuver checks',
  );
  expect(expertise.comparison?.publicationTitle).toBe('Core Rulebook');
  // Death knell's PCGen row gives 10 minutes per HD of the subject.
  expect(candidate('Death Knell').comparison?.literalRow).toContain(
    'These effects last for 10 minutes per HD of the subject creature.',
  );
  // The reviewed change replacements are recorded with their evidence.
  expect(
    review.changeReplacements.map((row) => [
      row.externalKey,
      row.change,
      row.formula,
    ]),
  ).toEqual([
    [MAGIC_FANG, { target: 'mattack', formula: '1', type: 'enh' }, '0'],
    [MAGIC_FANG, { target: 'wdamage', formula: '1', type: 'enh' }, '0'],
  ]);
});

it('reextracts the buffs from a clean shared fixture tree, admits Combat Expertise and fails only the five unresolved references', async () => {
  const tree = await materializePinnedTree(pinnedFiles, {
    sha256: pinnedSha256,
  });
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: review.candidates.map((row) => row.externalKey),
    });
    expect(artifact.curation.missing).toEqual([]);
    expect(artifact.curation.stale).toEqual([]);
    expect(artifact.curation.summary).toMatchObject({
      required: 80,
      checked: 80,
      missing: 0,
      descriptions: { checked: 97 },
    });
    expect(
      artifact.catalog.entries.map((row) => row.externalKey).sort(),
    ).toEqual(assessedBuffs.map((row) => row.externalKey).sort());
    for (const row of artifact.catalog.entries) {
      const saved = buffEntry(row.externalKey);
      expect(
        {
          detail: row.detail,
          modifiers: row.modifiers,
          situationalNotes: row.situationalNotes,
          sources: row.sources,
        },
        row.name,
      ).toEqual({
        detail: saved.detail,
        modifiers: saved.modifiers,
        situationalNotes: saved.situationalNotes,
        sources: saved.sources,
      });
    }
    // The assessments are bound against the full-corpus content closure: the
    // committed entries and the entries their closures reach.
    const authoritative = {
      ...artifact,
      catalog: {
        ...artifact.catalog,
        entries: [
          ...preview.entries,
          ...preview.closure,
        ] as unknown as typeof artifact.catalog.entries,
      },
    };
    // The bounded tree extracts only the batch's keys; in the full corpus the
    // closure's entries (the Combat Expertise feat, the linked Spells, class
    // abilities and racial traits) are extracted too.
    const inScope = {
      ...authoritative,
      comparison: {
        ...authoritative.comparison,
        records: [
          ...authoritative.comparison.records,
          ...preview.closure.map((row) => ({
            ...authoritative.comparison.records[0]!,
            externalKey: row.externalKey,
            name: row.name,
            status: 'admitted' as const,
          })),
        ],
      },
    };
    const ours = new Set(assessedBuffs.map((row) => row.externalKey));
    const gate = assessWithUnclearedHolds({
      artifact: inScope,
      ...reviewedAdmission,
    });
    expect(
      gate.admitted
        .filter((row) => ours.has(row.externalKey))
        .map((row) => row.name),
    ).toEqual(['Combat Expertise']);
    expect(
      gate.dependentOmissions.filter((row) => ours.has(row.externalKey)),
    ).toEqual([]);
    expect(
      gate.failures
        .filter((row) => ours.has(row.externalKey))
        .map((row) => [candidate(row.externalKey).name, row.reason])
        .sort(),
    ).toEqual(
      [
        'Angelic Aspect (Lesser)',
        'Animal Focus (Frog)',
        'Elemental Assault (Acid, Race Builder)',
        'Elemental Assault (Fire, Race Builder)',
        'Stench Aura',
      ].map((name) => [
        name,
        'Broken structure or reference: unresolved imported reference.',
      ]),
    );
    const held = gate.held.filter((row) => ours.has(row.externalKey));
    expect(held).toHaveLength(91);
    for (const row of held) {
      const reviewed = candidate(row.externalKey);
      if (reviewed.assessmentStatus === 'unresolved')
        expect(row.reason, row.name).toBe(reviewed.rationale);
      else
        expect(row.reason, row.name).toMatch(
          /^(Notice holds|Missing or unreviewed required notices): /,
        );
    }
    for (const row of assessedBuffs) {
      const assessment = reviewedAdmission.assessments.find(
        (a) => a.externalKey === row.externalKey,
      );
      expect(assessment).toMatchObject({
        status: row.assessmentStatus,
        ...bindSnapshotToCurrentNotices(row.currentBinding),
        requiredNotices: row.requiredNotices,
      });
      expect(
        buildAssessmentBinding({
          artifact: authoritative,
          entry: authoritative.catalog.entries.find(
            (candidate) => candidate.externalKey === row.externalKey,
          )!,
          requiredNotices: row.requiredNotices,
          evidenceIds: [row.evidenceId],
          ...reviewedAdmission,
        }),
      ).toEqual(bindSnapshotToCurrentNotices(row.currentBinding));
    }
    // A changed reviewed Modifier invalidates Combat Expertise's binding, and
    // the gate holds it.
    const changed = {
      ...inScope,
      catalog: {
        ...inScope.catalog,
        entries: inScope.catalog.entries.map((row) =>
          row.externalKey === EXPERTISE ? { ...row, modifiers: [] } : row,
        ),
      },
    };
    expect(
      assessWithUnclearedHolds({
        artifact: changed,
        ...reviewedAdmission,
      }).held.find((row) => row.externalKey === EXPERTISE)?.reason,
    ).toContain('no longer matches current content');
  } finally {
    await tree.dispose();
  }
});

it("keeps the batch's own rows as its inventory records them", () => {
  expect(
    findCommittedBatchOwnershipProblems(
      'scripts/catalog/legal/pf-buffs-549.json',
    ),
  ).toEqual([]);
});
