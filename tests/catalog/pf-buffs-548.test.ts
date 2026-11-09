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
  assessCatalogAdmission,
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
} from '../fixtures/pf-buffs-548/data';
import {
  buffEntry,
  buffModifiers,
  buffSituations,
  total,
} from '../fixtures/pf-buffs-548/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import {
  bindSnapshotToCurrentNotices,
  findCommittedBatchOwnershipProblems,
} from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const LUNGE = 'pf1-content/7DtG0pydiheVvIS8';
const VEIL = 'pf1-content/IfR6nJz0I3Z2NrDm';
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
// the senses and combat states, the hunter's animal focus, the bard's
// performances, Lunge and the race builder Frenzy, whose link the import
// strips. Every other buff reaches it through its own action or a linked Spell,
// feat or racial trait.
const WITHOUT_UNCHAINED_CLOSURE = [
  'pf1-content/0Ec3mH1ddh76cvYU', // Debilitating Injury (Hampered)
  'pf1-content/30MZFYjOgu59ZoXj', // Animal Focus (Falcon)
  'pf1-content/3V4SKStquBCW8grU', // Debilitating Injury (Disoriented)
  'pf1-content/3o48BZtE21Il0Z2p', // Frenzy (Race Builder)
  'pf1-content/57bf3joJk7JEpZCZ', // Blindsense 30'
  'pf1-content/5lQmzt3oPWtrZ1Y7', // Inspire Heroics
  'pf1-content/7DtG0pydiheVvIS8', // Lunge
  'pf1-content/7ejl0VF3GAGOjha8', // Blindsight 30'
  'pf1-content/9LKumYEPIbzb1dQB', // Animal Focus (Stag)
  'pf1-content/EVGAAl2kbUwYzT7Z', // See In Darkness
  'pf1-content/EXl28IFj2KFuQNTj', // Darkvision 60'
  'pf1-content/Ej91vWnfFTaxMhyZ', // Squeezing (large)
  'pf1-content/ExpWHnhptAuWwAqZ', // Inspire Competence
  'pf1-content/LR64SMLpzgyMNNcm', // Animal Focus (Owl)
  'pf1-content/LTLUW1y510Skco5R', // Cover (Total)
  'pf1-content/Lm0EtJClkkrfqCUQ', // Scent
  'pf1-content/Mgi0taTxLOPN6y2V', // Animal Focus (Bear)
].sort();
// The unchained rogue's debilitating injury is a Pathfinder Unchained class
// feature: both its buffs require PZO1131 for the rule itself, not through
// their closure (its class ability has no action).
const UNCHAINED_RULE = [
  'pf1-content/0Ec3mH1ddh76cvYU',
  'pf1-content/3V4SKStquBCW8grU',
];

it('excludes the three folders, admits Lunge, omits the two bardic performances and holds the rest on named reasons', () => {
  expect(review.candidates).toHaveLength(100);
  expect(review.counts).toEqual({
    total: 100,
    admitted: 1,
    held: 94,
    dependentlyOmitted: 2,
    unsupportedProseOnly: 0,
    excluded: 3,
    excludedFolders: 3,
    recordLevel35Holds: 0,
  });
  expect(excludedRows.map((row) => row.name).sort()).toEqual([
    'Class',
    'Features',
    'Skinwalker',
  ]);
  expect(
    assessedBuffs
      .filter((row) => row.disposition !== 'held')
      .map((row) => [row.name, row.disposition]),
  ).toEqual([
    ['Inspire Heroics', 'dependently-omitted'],
    ['Lunge', 'admitted'],
    ['Inspire Competence', 'dependently-omitted'],
  ]);
  // Lunge matches the admitted Core Rulebook feat and PCGen exactly, duration
  // included; a missing citation alone holds nothing (#241, #507; Sol review).
  expect(candidate(LUNGE)).toMatchObject({
    disposition: 'admitted',
    assessmentStatus: 'confirmed',
    requiredNotices: ['PZO1110'],
    holdIds: [],
    noticeHoldIds: [],
  });
  // Each held buff names a content or reference hold, a notice hold, or both.
  for (const row of assessedBuffs)
    if (row.disposition === 'held')
      expect(
        row.holdIds.length + row.noticeHoldIds.length,
        row.name,
      ).toBeGreaterThan(0);
  const kinds = (row: (typeof assessedBuffs)[number]) =>
    row.holdIds.map((id) =>
      id.replace('pf-buffs-548-', '').replace(/-[A-Za-z0-9]{16}$/, ''),
    );
  // 76 buffs cite no source; the 21 cited ones are the racial-trait buffs.
  // No hold rests on the missing citation.
  expect(assessedBuffs.filter((row) => !row.citedSources.length)).toHaveLength(
    76,
  );
  expect(assessedBuffs.flatMap(kinds)).not.toContain('uncited');
  expect(
    Object.fromEntries(
      assessedBuffs
        .filter((row) => row.holdIds.length)
        .map((row) => [row.name, kinds(row)]),
    ),
  ).toEqual({
    'Crushing Despair': ['emotion-attribution'],
    'Blessing of Courage and Life': ['emotion-attribution'],
    'Animal Focus (Falcon)': ['broken-reference'],
    'Animal Focus (Owl)': ['whole-content'],
    'Bestow Curse (Ability)': ['whole-content'],
    "Blindsense 30'": ['whole-content'],
    "Blindsight 30'": ['whole-content'],
    'Blessings of Luck and Resolve': ['broken-reference'],
    'Blood Frenzy (Sahuagin)': ['whole-content'],
    'Change Shape (Skinwalker, Climb Speed, Long)': ['whole-content'],
    'Change Shape (Skinwalker, Climb Speed, Short)': ['whole-content'],
    'Change Shape (Skinwalker, Distraction)': ['whole-content'],
    'Change Shape (Skinwalker, Ferocity)': ['whole-content'],
    'Change Shape (Skinwalker, Saving Throws)': ['whole-content'],
    'Change Shape (Skinwalker, See in Darkness)': ['whole-content'],
    'Cover (Total)': ['whole-content'],
    "Darkvision 60'": ['whole-content'],
    'Elemental Assault (Cold, Race Builder)': ['broken-reference'],
    'Elemental Assault (Electricity, Race Builder)': ['broken-reference'],
    'Expeditious Retreat': ['broken-reference'],
    'Frenzy (Race Builder)': ['broken-reference'],
    'Iron Within (AC)': ['whole-content'],
    'Powerful Smell': ['whole-content'],
    Scent: ['whole-content'],
    'See In Darkness': ['whole-content'],
    'Squeezing (large)': ['whole-content'],
    'Tentacle Sense': ['whole-content'],
    'Water Bond': ['whole-content'],
    // Its duration (minutes per caster level) contradicts PCGen's rounds.
    'Weapons Against Evil': ['whole-content'],
  });
  // Other buffs retain confirmation; #738 reopens the two Emotion closures.
  for (const row of assessedBuffs)
    expect(row.assessmentStatus, row.name).toBe(
      row.holdIds.length ? 'unresolved' : 'confirmed',
    );
  expect(
    assessedBuffs.filter((row) => row.assessmentStatus === 'confirmed'),
  ).toHaveLength(68);
});

it('applies the reviewed Modifiers through the public resolver', () => {
  // Caster-level formulas read the effect's recorded caster level.
  const cl = (
    name: string,
    target: Parameters<typeof total>[1],
    levels: readonly number[],
    situations?: Parameters<typeof buffSituations>[0],
  ) =>
    levels.map((casterLevel) =>
      total(
        buffModifiers(name, { casterLevel }),
        target,
        situations ? { situations: buffSituations(situations) } : {},
      ),
    );
  const DIVINE_POWER_LEVELS = [7, 8, 9, 12, 18, 20];
  for (const target of [
    'attack.melee',
    'damage.ranged',
    'skill.clm',
    'skill.swm',
  ] as const)
    expect(cl('Divine Power', target, DIVINE_POWER_LEVELS), target).toEqual([
      2, 2, 3, 4, 6, 6,
    ]);
  expect(cl('Divine Power', 'skill.per', [12])).toEqual([0]);
  expect(cl('Acute Senses', 'skill.per', [1, 7, 8, 15, 16, 20])).toEqual([
    10, 10, 20, 20, 30, 30,
  ]);
  expect(cl('Sanctify Armor', 'ac.armor', [3, 4, 8, 12, 19, 20])).toEqual([
    0, 1, 2, 3, 4, 5,
  ]);
  expect(cl('Sanctify Armor', 'ac.other', [20])).toEqual([0]);
  // Situation-gated caster-level bonuses apply only when selected.
  expect(cl('Jump', 'skill.acr', [9])).toEqual([0]);
  expect(cl('Jump', 'skill.acr', [1, 4, 5, 8, 9, 20], 'Jump')).toEqual([
    10, 10, 20, 20, 30, 30,
  ]);
  expect(
    cl('Unerring Weapon', 'attack.melee', [1, 4, 19, 20], 'Unerring Weapon'),
  ).toEqual([2, 3, 6, 7]);
  expect(
    cl('Bullet Shield', 'ac.other', [3, 5, 19, 20], 'Bullet Shield'),
  ).toEqual([4, 5, 7, 8]);
  expect(cl('Bullet Shield', 'ac.other', [20])).toEqual([0]);
  expect(
    cl('Lay of the Land', 'skill.kge', [3, 5, 9], 'Lay of the Land'),
  ).toEqual([3, 5, 5]);
  // Natural armor and armor bonuses sit on their own AC leaves (#734).
  expect(
    total(
      buffModifiers('Change Shape (Skinwalker - Beast Talker, Natural Armor)'),
      'ac.natural',
    ),
  ).toBe(1);
  const bear = buffModifiers('Aspect of the Bear');
  expect([
    total(bear, 'ac.natural'),
    total(bear, 'cmb'),
    total(bear, 'ac.other'),
  ]).toEqual([2, 2, 0]);
  // Foundry's private "resist" type: the reviewed resistance bonuses.
  expect(total(buffModifiers('Resistance'), 'save.fort')).toBe(1);
  const barrier = buffModifiers('Stunning Barrier');
  expect([total(barrier, 'ac.other'), total(barrier, 'save.will')]).toEqual([
    1, 1,
  ]);
  for (const name of ['Shield of Law', 'Cloak of Chaos']) {
    const rows = buffModifiers(name);
    expect([total(rows, 'ac.other'), total(rows, 'save.ref')], name).toEqual([
      4, 4,
    ]);
  }
  // Charisma-based skills, ability penalties and the imported numbers.
  const beauty = buffModifiers('Tap Inner Beauty');
  expect(
    ['skill.blf', 'skill.dip', 'skill.umd', 'skill.per'].map((target) =>
      total(beauty, target as 'skill.dip'),
    ),
  ).toEqual([2, 2, 2, 0]);
  const young = buffModifiers('Threefold Aspect (Young Adult)');
  expect(
    ['ability.dex', 'ability.con', 'ability.wis'].map((target) =>
      total(young, target as 'ability.wis'),
    ),
  ).toEqual([2, 2, -2]);
  const adult = buffModifiers('Threefold Aspect (Adult)');
  expect(
    ['ability.int', 'ability.wis', 'ability.dex'].map((target) =>
      total(adult, target as 'ability.wis'),
    ),
  ).toEqual([2, 2, -2]);
  const despair = buffModifiers('Crushing Despair');
  expect(
    ['attack.melee', 'damage.melee', 'save.will', 'skill.per'].map((target) =>
      total(despair, target as 'save.will'),
    ),
  ).toEqual([-2, -2, -2, -2]);
  expect(total(buffModifiers('Lunge'), 'ac.other')).toBe(-2);
  expect(total(buffModifiers('Great Cleave'), 'ac.other')).toBe(-2);
  const heroics = buffModifiers('Inspire Heroics');
  expect([total(heroics, 'ac.other'), total(heroics, 'save.ref')]).toEqual([
    4, 4,
  ]);
  expect(total(buffModifiers('Luckbringer'), 'save.will')).toBe(1);
  expect(
    total(
      buffModifiers('Change Shape (Skinwalker - Beast Talker, DEX)'),
      'ability.dex',
    ),
  ).toBe(2);
  // Veil of positive energy: the reviewed change replacements set the
  // imported +2 sacred bonuses to 0; the reviewed Modifiers apply them only
  // against undead.
  const veil = buffModifiers(VEIL);
  expect(veil.slice(0, 2).map((row) => row.value)).toEqual([0, 0]);
  expect([total(veil, 'ac.other'), total(veil, 'save.will')]).toEqual([0, 0]);
  const undead = { situations: buffSituations(VEIL) };
  expect([
    total(veil, 'ac.other', undead),
    total(veil, 'save.will', undead),
  ]).toEqual([2, 2]);
});

it('applies each situational Modifier only under its Situation, with the tiers mutually exclusive', () => {
  // Shared Situations where the body's condition matches exactly.
  for (const [name, situation, target, value] of [
    ['Protection From Law', 'lawfulCreatures', 'ac.other', 2],
    ['Protection From Law', 'lawfulCreatures', 'save.ref', 2],
    ['Protection From Good', 'goodCreatures', 'ac.other', 2],
    ['Dispel Chaos', 'chaoticCreatures', 'ac.other', 4],
    ['Dispel Good', 'goodCreatures', 'ac.other', 4],
    ['Mind Blank', 'mindAffecting', 'save.will', 8],
    ['Blessing of Courage and Life', 'fear', 'save.will', 2],
    ['Blessing of Courage and Life', 'death', 'save.fort', 2],
    ['Burst of Glory', 'fear', 'save.ref', 1],
    ['Blessings of Luck and Resolve', 'fear', 'save.will', 2],
    ['Aspect of the Wolf', 'trip', 'cmb', 2],
  ] as const) {
    const rows = buffModifiers(name);
    expect(buffSituations(name), name).toContain(situation);
    expect(total(rows, target), name).toBe(0);
    expect(total(rows, target, { situations: [situation] }), name).toBe(value);
  }
  // Both morale bonuses of blessing of courage and life don't stack.
  expect(
    total(buffModifiers('Blessing of Courage and Life'), 'save.will', {
      situations: ['fear', 'death'],
    }),
  ).toBe(2);
  // Perfect placement: +1 insight to AC, +3 against attacks of opportunity.
  const placement = buffModifiers('Perfect Placement');
  expect(total(placement, 'ac.other')).toBe(1);
  expect(
    total(placement, 'ac.other', {
      situations: buffSituations('Perfect Placement'),
    }),
  ).toBe(3);
  // Mutually exclusive tiers for another creature's level.
  const tiers = (
    name: string,
    target: Parameters<typeof total>[1],
    expected: readonly number[],
  ) => {
    const rows = buffModifiers(name);
    const scopes = buffSituations(name);
    expect(scopes, name).toHaveLength(expected.length);
    expect(total(rows, target), name).toBe(0);
    expect(
      scopes.map((scope) => total(rows, target, { situations: [scope] })),
      name,
    ).toEqual(expected);
  };
  tiers('Evil Eye (Saves)', 'save.will', [-2, -4]);
  tiers('Evil Eye (AC)', 'ac.other', [-2, -4]);
  tiers('Animal Focus (Bear)', 'ability.con', [2, 4, 6]);
  tiers('Animal Focus (Falcon)', 'skill.per', [4, 6, 8]);
  tiers('Animal Focus (Owl)', 'skill.ste', [4, 6, 8]);
  // Disoriented: -2 on attack rolls, plus the rogue tier against the rogue.
  const disoriented = buffModifiers('Debilitating Injury (Disoriented)');
  const rogue = buffSituations('Debilitating Injury (Disoriented)');
  expect(rogue).toHaveLength(3);
  expect(total(disoriented, 'attack.melee')).toBe(-2);
  expect(
    rogue.map((scope) =>
      total(disoriented, 'attack.melee', { situations: [scope] }),
    ),
  ).toEqual([-4, -6, -8]);
  // Guidance: +1 competence on the one chosen roll.
  const guidance = buffModifiers('Guidance');
  const chosen = { situations: buffSituations('Guidance') };
  expect(buffSituations('Guidance')).toHaveLength(1);
  expect([
    total(guidance, 'attack.melee'),
    total(guidance, 'save.fort'),
    total(guidance, 'skill.per'),
  ]).toEqual([0, 0, 0]);
  expect([
    total(guidance, 'attack.melee', chosen),
    total(guidance, 'save.fort', chosen),
    total(guidance, 'skill.per', chosen),
  ]).toEqual([1, 1, 1]);
  // Halo: two local Situations.
  const halo = buffModifiers('Halo');
  const [blinded, evil] = buffSituations('Halo');
  expect([
    total(halo, 'save.fort', { situations: [blinded!] }),
    total(halo, 'skill.int', { situations: [evil!] }),
    total(halo, 'skill.int'),
  ]).toEqual([2, 2, 0]);
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
        if (!record.outputs.length)
          expect(record.rationale, row.name).toContain(
            'Explicit covered/no-output',
          );
      } else {
        notes++;
        expect(record.kind, row.name).toBe('note');
        expect(
          (row.sourceFields.contextNotes as { text: string }[]).map(
            (note) => note.text,
          ),
          row.name,
        ).toContain(record.text);
        if (!record.outputs.length)
          expect(record.rationale, row.name).toContain(
            'Explicit covered/no-output',
          );
      }
    }
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  }
  // One description record per buff (#759's ownership sweep) and every
  // required context-note record.
  expect(descriptions).toBe(97);
  expect(notes).toBe(78);
  // The reviewed Notes reach the imported entries.
  expect(
    buffEntry('Ill Omen').situationalNotes?.map((note) => note.text),
  ).toEqual([
    'Roll twice and take the less favorable result on your next d20 roll, plus one more d20 roll per five caster levels of the caster (maximum five rolls at 20th level). If you can speak, have a free hand and know of the spell, you can spend a move action on a brief prayer to negate one reroll.',
  ]);
  expect(
    buffEntry("Darkvision 60'").situationalNotes?.map((note) => note.text),
  ).toEqual(['Darkvision 60 feet.']);
});

it('records the cited, governing, inherited and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) => `pf-buffs-548-notice-${book}-complete-chain`;
  for (const row of assessedBuffs) {
    expect(row.requiredNotices[0], row.name).toBe('PZO1110');
    for (const cited of row.citedSources)
      expect(row.requiredNotices, row.name).toContain(cited.book);
    for (const comparison of [row.comparison, ...row.additionalComparisonLeads])
      if (comparison)
        expect(row.requiredNotices, row.name).toContain(comparison.book);
    // A row of another book is rejected evidence, never a requirement.
    for (const rejected of row.rejectedRootComparisonEvidence)
      expect(
        row.citedSources.map((cited) => cited.book),
        row.name,
      ).not.toContain(rejected.book);
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
        new RegExp(`^pf-buffs-548-[a-z-]+-${row.externalKey.split('/')[1]}$`),
      );
  }
  // Unchained action-cost metadata anywhere in the full-corpus closure
  // requires the held PZO1131; the set is pinned by key.
  const unchained = assessedBuffs
    .filter((row) => closureOf(row.externalKey).some(hasUnchained))
    .map((row) => row.externalKey)
    .sort();
  expect(unchained).toHaveLength(80);
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
              row.inheritedRuleNotices
                .filter((notice) => /monster|Monster Rules/.test(notice.rule))
                .map((notice) => notice.book),
            ] as const,
        )
        .filter(([, books]) => books.length),
    ),
  ).toEqual({
    "Blindsense 30'": ['PZO1112'],
    "Blindsight 30'": ['PZO1112'],
    'See In Darkness': ['PZO1116'],
    "Darkvision 60'": ['PZO1127'],
    Scent: ['PZO1112'],
    'Keen Senses': ['PZO1112'],
    'Aspect of the Wolf': ['PZO1112'],
    'Tentacle Sense': ['PZO1112'],
    'Change Shape (Skinwalker, Ferocity)': ['PZO1112'],
    'Change Shape (Skinwalker, Distraction)': ['PZO1112'],
    'Change Shape (Skinwalker, See in Darkness)': ['PZO1116'],
  });
  // A Spell Effect's governing Spell is its spellKey (bar the Animal Focus
  // typed as a spell and the misnamed Blessings) and the first linked body.
  for (const row of assessedBuffs.filter((row) => row.kind === 'spellEffect')) {
    const governing = row.linkedContentReview[0];
    expect(row.inheritedRuleSourceEvidence, row.name).toEqual(
      governing ? [governing] : [],
    );
    expect(row.mechanicsReview.effectReview.spellKey ?? null, row.name).toBe(
      ['Animal Focus (Falcon)', 'Blessings of Luck and Resolve'].includes(
        row.name,
      )
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
    expect(raw._key, row.name).toBe(`!folders!${raw._id}`);
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
  // Lunge's evidence is the Core Rulebook feat row.
  const lunge = candidate(LUNGE);
  expect(lunge.comparison?.literalRow).toContain(
    'by taking a -2 penalty to your AC until your next turn',
  );
  expect(lunge.comparison?.publicationTitle).toBe('Core Rulebook');
  // The owl focus is on Stealth in PCGen, where the body says Perception.
  expect(candidate('Animal Focus (Owl)').comparison?.literalRow).toContain(
    'BONUS:SKILL|Stealth|HunterAnimalFocusOwlBonus|TYPE=Competence',
  );
  // The reviewed change replacements are recorded with their evidence.
  expect(
    review.changeReplacements.map((row) => [
      row.externalKey,
      row.change,
      row.formula,
    ]),
  ).toEqual([
    [VEIL, { target: 'ac', formula: '2', type: 'sacred' }, '0'],
    [VEIL, { target: 'allSavingThrows', formula: '2', type: 'sacred' }, '0'],
  ]);
});

it('reextracts the buffs from a clean shared fixture tree, admits Lunge, omits the two performances and fails only the five unresolved references', async () => {
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
      required: 78,
      checked: 78,
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
    // closure's entries (the Lunge feat, the bard's performances) are
    // extracted too.
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
    ).toEqual(['Lunge', 'Inspire Competence']);
    // Inspire Heroics and Inspire Competence are supported and need only the
    // reviewed CRB notice. #605 wave C (2026-11-04) assessed the bard's
    // Inspire Competence class ability (class-abilities-605), so that buff
    // now admits with it; Inspire Heroics' class ability has no assessment
    // yet. The inventory keeps the dispositions this batch recorded.
    expect(
      gate.dependentOmissions
        .filter((row) => ours.has(row.externalKey))
        .map((row) => [row.name, row.reason]),
    ).toEqual([
      ['Inspire Heroics', 'Dependent omission: pf1/LIFTbzT5WDcsDn0O.'],
    ]);
    expect(
      gate.failures
        .filter((row) => ours.has(row.externalKey))
        .map((row) => [candidate(row.externalKey).name, row.reason])
        .sort(),
    ).toEqual(
      [
        'Animal Focus (Falcon)',
        'Blessings of Luck and Resolve',
        'Elemental Assault (Cold, Race Builder)',
        'Elemental Assault (Electricity, Race Builder)',
        'Frenzy (Race Builder)',
      ].map((name) => [
        name,
        'Broken structure or reference: unresolved imported reference.',
      ]),
    );
    // #738 keeps Expeditious Retreat's rules journal link as text: held.
    const held = gate.held.filter((row) => ours.has(row.externalKey));
    expect(held).toHaveLength(89);
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
    // A changed reviewed Modifier invalidates Lunge's binding, and the gate
    // holds it.
    const changed = {
      ...inScope,
      catalog: {
        ...inScope.catalog,
        entries: inScope.catalog.entries.map((row) =>
          row.externalKey === LUNGE ? { ...row, modifiers: [] } : row,
        ),
      },
    };
    expect(
      assessCatalogAdmission({
        artifact: changed,
        ...reviewedAdmission,
      }).held.find((row) => row.externalKey === LUNGE)?.reason,
    ).toContain('no longer matches current content');
  } finally {
    await tree.dispose();
  }
});

it("keeps the batch's own rows as its inventory records them", () => {
  expect(
    findCommittedBatchOwnershipProblems(
      'scripts/catalog/legal/pf-buffs-548.json',
    ),
  ).toEqual([]);
});
