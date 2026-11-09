// @vitest-environment node
import { recordedPrerequisiteFacts } from './prerequisite-audit-739';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import {
  upstreamRecord,
  sourceDescription,
} from '../../scripts/catalog/records';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import {
  modifierTargets,
  resolveSheet,
  calculateCharacterSheetProjections,
} from '../../src/lib/character-sheet';
import {
  review,
  heldTraits,
  folders,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/traits-383/data';
import { reviewedTraitSheet } from '../fixtures/traits-383/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const PLACEHOLDER =
  'Review required: replace this placeholder with readable rules text or structured outputs.';
const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
function entry(name: string) {
  const row = preview.entries.find((row) => row.name === name);
  if (!row) throw new Error(`Missing ${name}`);
  if (row.detail.kind !== 'trait') throw new Error('Expected trait');
  return { ...row, detail: row.detail };
}
function candidate(name: string) {
  const row = heldTraits.find((row) => row.name === name);
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
function modifiers(name: string, sheetEntryId = entry(name).externalKey) {
  const row = entry(name);
  return row.modifiers.map((raw) => ({
    ...outputSchema.options[0]
      .omit({ kind: true })
      .extend({ target: z.enum(modifierTargets) })
      .parse(raw),
    sheetEntryId,
    catalogEntryId: row.externalKey,
    source: row.externalKey,
    entryName: row.name,
    builtIn: false,
  }));
}
// The Situation of one Modifier, selected on its sheet entry.
function situation(
  name: string,
  index: number,
  sheetEntryId = entry(name).externalKey,
) {
  const scope = modifiers(name)[index]?.condition?.situation;
  if (!scope) throw new Error(`Modifier ${index} of ${name} has no Situation`);
  if (typeof scope === 'string') return scope;
  if (!('local' in scope)) throw new Error('Expected a local Situation');
  return { local: scope.local, sheetEntryId };
}
function indexOf(name: string, target: string, label: string) {
  const index = modifiers(name).findIndex(
    (row) =>
      row.target === target &&
      JSON.stringify(row.condition?.situation ?? '').includes(label),
  );
  if (index < 0) throw new Error(`No ${target} Modifier "${label}" on ${name}`);
  return index;
}
const total = (sheet: ReturnType<typeof reviewedTraitSheet>, target: string) =>
  calculateCharacterSheetProjections(sheet).current.breakdowns[
    target as 'skill.per'
  ].total;

// Traits with no PCGen trait row at the pin, including alternate spellings.
const noRow = [
  'Tireless (The Exchange)',
  'Trouper (Sczarni Faction)',
  'Subjective Equilibrium',
  'Runaway Slave (Osirion, Thuvia, Darklands)',
  'Alchemical Fence (Katapesh)',
  'Shaer (Qadira, native Kelish speaker)',
  'Rebuke the Curse',
  'Twisted Tattoo',
  'Unflappable (Sovereign Court)',
  'Ash Bane (Wastelands)',
  "Whistleblower (Liberty's Edge)",
];

// Every trait whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): 13 on the trait's own action and 3
// through linked bodies, 1 of them both ways.
const unchainedOwn = [
  'pf1-content/nBIreouv1q24UlUp', // Worldly
  'pf1-content/nVaJ8BZ2szFNKHzK', // Charmed Innocent
  'pf1-content/nzry8HGrbNmlFvi6', // Possessed
  'pf1-content/oAf6XElM7caFpiZ2', // Thunderborn
  'pf1-content/oHdiFjufIcJWO4ss', // Untrained Scholar
  'pf1-content/oh489gcc0qMaZm7m', // Fortunate
  'pf1-content/or09cRnKZm7pw6lM', // Rebuke the Curse
  'pf1-content/oslVt6waccRFUVQx', // Hellknight Devotion
  'pf1-content/p5NxwuNGnDaUjPF1', // Twisted Tattoo
  'pf1-content/pOR268ZwiSTtgyZr', // Failed Aspirant
  'pf1-content/plpp1v9SOc8kmw9t', // Furious Vengeance
  'pf1-content/pm9fvAzEHPBHKSla', // Favored Champion
  'pf1-content/qCftXB98XTcZzMJ2', // Driven By Guilt
];
const unchainedLinked = [
  'pf1-content/naeRGsh67jnqu5io', // Child of Mumia: mumia
  'pf1-content/oh489gcc0qMaZm7m', // Fortunate: three spells
  'pf1-content/pEAfeZXY0P8qUCc0', // Ship's Surgeon: healer's kit
];

const saves = (resolved: ReturnType<typeof resolveSheet>) => [
  resolved['save.fort'].total,
  resolved['save.ref'].total,
  resolved['save.will'].total,
];

it('resolves the reviewed trait Modifiers, with trait bonuses that never stack', () => {
  // Trait bonuses from different traits on one statistic never stack.
  const instigator = 'Instigator of Rebellion (Minkai)';
  const friend = 'Friend in Every Town';
  expect(total(reviewedTraitSheet(instigator), 'skill.dip')).toBe(1);
  expect(total(reviewedTraitSheet(instigator, friend), 'skill.dip')).toBe(1);
  expect(total(reviewedTraitSheet(instigator, friend), 'skill.int')).toBe(1);
  expect(total(reviewedTraitSheet(instigator, friend), 'skill.klo')).toBe(1);
  expect(
    total(reviewedTraitSheet('Guardian of the Forge (Torag)'), 'skill.ken'),
  ).toBe(1);
  // Vainglory's imported penalties apply; its illusion DC penalty waits.
  const vainglory = 'Vainglory';
  for (const target of ['skill.blf', 'skill.dis', 'skill.ste'])
    expect(total(reviewedTraitSheet(vainglory), target), target).toBe(-1);
  expect(resolveSheet(modifiers(vainglory)).spellDC.total).toBe(0);
  expect(
    resolveSheet(modifiers(vainglory), {
      situations: [
        situation(vainglory, indexOf(vainglory, 'spellDC', 'illusions')),
      ],
    }).spellDC.total,
  ).toBe(-1);
  // Targetless imported changes contribute nothing; reviewed Modifiers supply
  // the rule, under a Situation per option where the body offers a choice.
  for (const [name, target, value, conditional] of [
    ['Trouper (Sczarni Faction)', 'skill.prf', 1, false],
    ["Ship's Surgeon (Skull and Shackles)", 'skill.crf', 1, false],
    ['Artistic Dilettante (Human; Taldan)', 'skill.crf', 1, false],
    ['Fiend Blood (Any)', 'skill.kpl', 1, true],
    ['Tongue of Many Towns (Human; Garundi)', 'skill.lin', 1, true],
    ['Militia Veteran (Any Town or Village)', 'skill.pro', 1, true],
    ['Drug Addict (Curse of the Crimson Throne)', 'save.fort', 1, true],
  ] as const) {
    expect(entry(name).unsupported, name).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
    );
    const index = modifiers(name).findIndex(
      (row) => row.target === target && row.value === value,
    );
    expect(resolveSheet(modifiers(name))[target].total, name).toBe(
      conditional ? 0 : value,
    );
    expect(
      resolveSheet(modifiers(name), {
        situations: conditional ? [situation(name, index)] : [],
      })[target].total,
      name,
    ).toBe(value);
  }
  expect(
    total(reviewedTraitSheet('Trouper (Sczarni Faction)'), 'skill.prf'),
  ).toBe(1);
  expect(
    total(
      reviewedTraitSheet('Artistic Dilettante (Human; Taldan)'),
      'skill.crf',
    ),
  ).toBe(1);
  // Choices are one Situation per option.
  for (const [name, count] of [
    ['Fiend Blood (Any)', 3],
    ['Tongue of Many Towns (Human; Garundi)', 3],
    ['Militia Veteran (Any Town or Village)', 3],
    ['Drug Addict (Curse of the Crimson Throne)', 2],
    ['Walking Ward (Qadira)', 4],
  ] as const)
    expect(modifiers(name), name).toHaveLength(count);
  // Drug Addict's Personal Addiction bonus is untyped, as published.
  expect(
    modifiers('Drug Addict (Curse of the Crimson Throne)').map((row) => [
      row.target,
      row.bonusType,
    ]),
  ).toEqual([
    ['skill.klo', 'trait'],
    ['save.fort', 'untyped'],
  ]);
  // Unmapped imported changes get reviewed Modifiers: Tireless's 1 hit point
  // (untypedPerm) and Occult Bargain's -1 on concentration.
  const tireless = 'Tireless (The Exchange)';
  expect(modifiers(tireless)).toEqual([
    expect.objectContaining({ target: 'hp', bonusType: 'untyped', value: 1 }),
  ]);
  expect(resolveSheet(modifiers(tireless)).hp.total).toBe(1);
  expect(resolveSheet(modifiers('Occult Bargain')).concentration.total).toBe(
    -1,
  );
  for (const name of [tireless, 'Occult Bargain'])
    expect(entry(name).unsupported, name).toEqual([
      expect.objectContaining({ field: 'changes' }),
    ]);
  // A bonus that rises in a Situation is its new total.
  for (const [name, target, base, label, risen] of [
    ['Open-Minded Explorer (Averaka)', 'skill.dip', 1, 'racial or ethnic', 2],
    ['Honest', 'skill.dip', 1, 'friendly or helpful', 2],
  ] as const) {
    expect(resolveSheet(modifiers(name))[target].total, name).toBe(base);
    expect(
      resolveSheet(modifiers(name), {
        situations: [situation(name, indexOf(name, target, label))],
      })[target].total,
      name,
    ).toBe(risen);
  }
  // Good Influence's two +1 bonuses don't add within the entry; their stacked
  // +2 is its own Situation.
  const influence = 'Good Influence (Aasimar; Lawbringers)';
  const nongood = situation(
    influence,
    indexOf(influence, 'skill.dip', 'nongood creature'),
  );
  const nonlawful = situation(
    influence,
    indexOf(influence, 'skill.dip', 'nonlawful creature'),
  );
  const both = situation(
    influence,
    indexOf(influence, 'skill.dip', 'both bonuses stack'),
  );
  expect(
    resolveSheet(modifiers(influence), { situations: [nongood] })['skill.dip']
      .total,
  ).toBe(1);
  expect(
    resolveSheet(modifiers(influence), { situations: [nongood, nonlawful] })[
      'skill.dip'
    ].total,
  ).toBe(1);
  expect(
    resolveSheet(modifiers(influence), { situations: [both] })['skill.dip']
      .total,
  ).toBe(2);
  // Driven By Guilt's daily swift action reads the Charisma modifier (no
  // penalty) on attacks and the character level on damage.
  const guilt = 'Driven By Guilt (Strange Aeons)';
  expect(
    modifiers(guilt).map((row) => [row.target, row.bonusType, row.value]),
  ).toEqual([
    ['attack', 'untyped', { formula: 'max(0, @ability.cha.mod)' }],
    ['damage', 'untyped', { formula: '@level' }],
    ['saves', 'trait', 1],
  ]);
  const evil = situation(guilt, indexOf(guilt, 'attack', 'evil creatures'));
  expect(
    resolveSheet(modifiers(guilt), { level: 5 })['damage.melee'].total,
  ).toBe(0);
  expect(
    resolveSheet(modifiers(guilt), { level: 5, situations: [evil] })[
      'damage.melee'
    ].total,
  ).toBe(5);
  expect(
    saves(
      resolveSheet(modifiers(guilt), {
        situations: [
          situation(guilt, indexOf(guilt, 'saves', 'evil creatures')),
        ],
      }),
    ),
  ).toEqual([1, 1, 1]);
  // Shared Situations only where the body's condition matches exactly.
  for (const [name, key, target, value] of [
    ["Resurrected (Mummy's Mask)", 'death', 'save.fort', 2],
    ['Secret Revolutionary (Cheliax)', 'mindAffecting', 'save.will', 1],
    ['Runaway Slave (Osirion, Thuvia, Darklands)', 'fear', 'save.ref', 1],
    ['Unflappable (Sovereign Court)', 'fear', 'save.will', 1],
  ] as const)
    expect(
      resolveSheet(modifiers(name), { situations: [key] })[target].total,
      name,
    ).toBe(value);
  for (const [name, key, target] of [
    ['Tribal (Half-Orc, Orc)', 'fear', 'save.will'],
    ['Secret Revolutionary (Cheliax)', 'poison', 'save.fort'],
    ['Triaxian Dragonslayer (Triaxian)', 'spellResistance', 'casterLevel'],
    [
      'Regional Recluse - Sanos Forest or Whistledown (Varisia)',
      'forests',
      'skill.ste',
    ],
  ] as const)
    expect(
      resolveSheet(modifiers(name), { situations: [key] })[target].total,
      `${name} ${key}`,
    ).toBe(0);
  // Foundry files these notes on other statistics; the reviewed Modifiers
  // land where the body puts them.
  for (const [name, targets] of [
    ['Bellis Log Roller (Andoran; Bellis)', ['skill.acr', 'cmd']],
    ['Canopy Shooter (Grippli)', ['damage.ranged']],
    ['Divine Warrior (Iomedae)', ['damage.melee']],
    ['Tunnel Fighter (Dwarf)', ['damage', 'init']],
    ['Ash Bane (Wastelands)', ['save.fort', 'attack.melee']],
    ['Monk Weapon Skill', ['damage']],
  ] as const)
    expect(
      modifiers(name)
        .map((row) => row.target)
        .sort(),
      name,
    ).toEqual([...targets].sort());
  for (const row of preview.entries)
    for (const modifier of row.modifiers)
      if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
        expect(modifier.target, row.name).not.toBe('ac.other');
  // Untyped bonuses and penalties stay untyped, as published.
  for (const [name, target] of [
    ['Walking Ward (Qadira)', 'saves'],
    ['Water Lurker (Wayang)', 'skill.ste'],
    ['Sentimental', 'skill.per'],
    ['Sentimental', 'save.ref'],
    ['Failed Aspirant', 'cmb'],
    ['Shadow-Scarred', 'saves'],
    ['Explorer (Gnome)', 'skill.sur'],
    ['Overwhelming Beauty', 'spellDC'],
  ] as const)
    expect(
      new Set(
        modifiers(name)
          .filter((row) => row.target === target)
          .map((row) => row.bonusType),
      ),
      `${name} ${target}`,
    ).toEqual(new Set(['untyped']));
  // Official Ties: +2 with authorities, -2 with criminals, never together.
  const ties = 'Official Ties';
  expect(resolveSheet(modifiers(ties))['skill.dip'].total).toBe(0);
  expect(
    resolveSheet(modifiers(ties), {
      situations: [
        situation(ties, indexOf(ties, 'skill.dip', 'authority aware')),
      ],
    })['skill.dip'].total,
  ).toBe(2);
  expect(
    resolveSheet(modifiers(ties), {
      situations: [situation(ties, indexOf(ties, 'skill.dip', 'criminals'))],
    })['skill.dip'].total,
  ).toBe(-2);
  // Assimilated Native's Intimidate bonus and Diplomacy penalty share one
  // Situation.
  const native = 'Assimilated Native (Human; Mwangi)';
  const mwangi = resolveSheet(modifiers(native), {
    situations: [situation(native, indexOf(native, 'skill.int', 'Mwangi'))],
  });
  expect([mwangi['skill.int'].total, mwangi['skill.dip'].total]).toEqual([
    2, -2,
  ]);
  // Favored Son/Daughter and Whistleblower keep the imported change as it is
  // typed (listed stacking gaps).
  expect(
    modifiers('Favored Son/Daughter (Any Campaign)').map((row) => [
      row.target,
      row.bonusType,
      row.value,
    ]),
  ).toEqual([['skill.klo', 'profane', 1]]);
  expect(
    modifiers("Whistleblower (Liberty's Edge)").map((row) => [
      row.target,
      row.bonusType,
      row.value,
    ]),
  ).toEqual([['skill.sen', 'trait', 1]]);
});

it('checks every required note record and the separate description pass against the pinned bodies', () => {
  let required = 0;
  for (const row of heldTraits) {
    const [description, ...notes] = row.mechanicsReview.curationRecords;
    const contextNotes = row.sourceFields.contextNotes as
      | { target: string; text: string }[]
      | undefined;
    expect(notes.map((note) => note.target).sort(), row.name).toEqual(
      (contextNotes ?? []).map((note) => note.target).sort(),
    );
    required += notes.length;
    for (const record of row.mechanicsReview.curationRecords) {
      expect(record.status, row.name).toBe('checked');
      expect(record.diagnostics, row.name).toEqual([]);
      expect(JSON.stringify(record.outputs), row.name).not.toContain(
        PLACEHOLDER,
      );
      if (!record.outputs.length)
        expect(record.rationale, row.name).toContain(
          'Explicit covered/no-output',
        );
    }
    expect(description).toMatchObject({
      kind: 'description',
      text: row.mechanicsReview.descriptionText,
    });
    const parts = description!.outputs.flatMap((output) =>
      output.kind === 'note' ? [output.text] : [],
    );
    for (const part of parts) {
      expect(part.length, row.name).toBeLessThanOrEqual(4096);
      expect(part, row.name).not.toContain('@UUID');
      expect(part, row.name).not.toContain('[[');
    }
    const texts = (entry(row.name).situationalNotes ?? []).map(
      (note) => note.text,
    );
    for (const part of parts) expect(texts, row.name).toContain(part);
  }
  expect(required).toBe(102);
  // Repeated notes are explicit covered/no-output records.
  expect(
    heldTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual([
    'Charmed Innocent (Any City) chaSkills',
    ...['kdu', 'ken', 'kge', 'khi', 'klo', 'kna', 'kno', 'kpl', 'kre'].map(
      (skill) => `Possessed skill.${skill}`,
    ),
    'Following in the Footsteps (Ruins of Azlant) skills',
  ]);
  // Notes on statistics the sheet can't target are entry-level.
  for (const name of [
    'Tireless (The Exchange)',
    "Resurrected (Mummy's Mask)",
    'Muscle of the Society (Pathfinder Society)',
    'Subjective Equilibrium',
    'Deep Wounding (Achaekek)',
    'Tireless Avenger',
    'Monster Scholar',
    'Thunderborn (Sylph)',
    'Draconic Destiny',
    'Worthless Pawn (any Great Old One)',
  ])
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target),
      name,
    ).toEqual([]);
  // Readable Notes on the statistic they describe.
  for (const [name, targets] of [
    ['Worldly', ['skills']],
    ['Beast Rider (Half-Orc, Orc)', ['skill.rid']],
    ['Tribal Guide (Kobold)', ['skill.sur']],
    ['Practiced Deception (Norgorber)', ['skill.dis']],
    ['Debauchery Defier (Imperial Palace of Taldor)', ['save.fort']],
    ['Favored Champion (Human; Shoanti)', ['cmb']],
    ['Dawn Renewal (Sarenrae)', ['skill.hea']],
    ['Inquisitive Banterer (Catfolk)', ['skill.dip']],
    ['Friends in Low Places', ['skill.dip']],
  ] as const)
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target),
      name,
    ).toEqual(targets);
  // Possessed's Foundry notes invert the body's condition; the reviewed Note
  // follows the body.
  expect(
    candidate('Possessed').mechanicsReview.curationRecords[1]?.outputs,
  ).toEqual([
    expect.objectContaining({
      kind: 'note',
      text: expect.stringContaining(
        'If you can normally use that skill untrained, you gain a +2 trait bonus',
      ),
    }),
  ]);
  // Every outstanding calculation is recorded, never as an attribution hold.
  for (const row of heldTraits) {
    expect(
      row.mechanicsReview.outstandingCalculations.length,
      row.name,
    ).toBeGreaterThan(0);
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  }
  // No trait in this batch grants a weapon or armor proficiency.
  for (const row of heldTraits)
    expect(row.mechanicsReview.proficiencyReview.grants, row.name).toEqual([]);
});

it('records the trait framework, inherited rules, linked bodies and enforced notice holds without inventing attribution', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  for (const row of heldTraits) {
    expect(row.requiredNotices, row.name).toContain('PZO1115');
    expect(row.requiredNotices.at(-1), row.name).toBe('PZO1110');
    const [framework, drawback] = row.inheritedRuleComparisonEvidence;
    expect(framework, row.name).toMatchObject({
      line: 18,
      book: 'PZO1115',
      appliesToRootBody: false,
    });
    expect(framework?.literalRow, row.name).toContain(
      'BONUS:SAVE|Reflex|1|TYPE=Trait',
    );
    if (row.traitType === 'drawback') {
      expect(row.requiredNotices, row.name).toContain('PZO1125');
      expect(drawback?.literalRow, row.name).toMatch(
        /^ABILITYCATEGORY:Drawbacks\t/,
      );
    }
    for (const cited of row.citedSources)
      expect(row.requiredNotices, row.name).toContain(cited.book);
    for (const linked of row.linkedContentReview)
      for (const book of linked.sources)
        expect(row.requiredNotices, row.name).toContain(book.id);
    expect(row.holdIds, row.name).toEqual([
      `traits-383-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-383-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name),
  ).toEqual(['Occult Bargain', 'Sentimental', 'Shadow-Scarred', 'Vainglory']);
  // Inherited rules the bodies change or depend on, and linked bodies' books.
  for (const [name, book] of [
    ['Subjective Equilibrium', 'PZO1114'],
    ['Official Ties', 'PZO1134'],
    ['Shadow Dissident (Nidal)', 'PZO1117'],
    ['Runaway Slave (Osirion, Thuvia, Darklands)', 'PZO1112'],
    ['Destined for Greatness (Absalom)', 'PZO1123'],
    ['Channel the Earth (Plane of Earth)', 'PZO1115'],
    ['Child of Mumia (Osirion)', 'PZO9246'],
    ["Ship's Surgeon (Skull and Shackles)", 'PZO1123'],
    ['Practiced Deception (Norgorber)', 'PZO9420'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Fortunate's "mirror image" link resolves to Mirror Strike (Ultimate
  // Combat): the bound body's book is required and the error is listed.
  const fortunate = candidate('Fortunate');
  expect(fortunate.requiredNotices).toContain('PZO1118');
  expect(
    fortunate.linkedContentReview.map((linked) => linked.name).sort(),
  ).toEqual(['Confusion', 'Mirror Strike', 'Prismatic Spray']);
  expect(fortunate.mechanicsReview.sourceDiscrepancies).toEqual(
    expect.arrayContaining([expect.stringContaining('Mirror Strike')]),
  );
  // Unchained action-cost metadata anywhere in the bound closure, the
  // trait's own actions included, requires the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedLinked])].sort();
  expect(unchained).toHaveLength(15);
  expect(
    heldTraits
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(unchained);
  const bodies = new Map(
    [...preview.entries, ...preview.closure].map((row) => [
      row.externalKey,
      row,
    ]),
  );
  for (const key of unchained) {
    const row = heldTraits.find((row) => row.externalKey === key)!;
    expect(row.noticeHoldIds, row.name).toContain(
      'traits-383-notice-PZO1131-complete-chain',
    );
    const rules = row.inheritedRuleNotices
      .filter((notice) => notice.book === 'PZO1131')
      .map((notice) => notice.rule);
    if (unchainedOwn.includes(key))
      expect(rules, row.name).toEqual(
        expect.arrayContaining([expect.stringContaining("trait's own action")]),
      );
    if (unchainedLinked.includes(key)) {
      expect(rules, row.name).toEqual(
        expect.arrayContaining([expect.stringContaining('on the bound')]),
      );
      for (const linked of row.linkedContentReview)
        expect(bodies.has(linked.externalKey), linked.name).toBe(true);
    }
    // The metadata is literally in the trait's own record or a bound body.
    const own =
      (
        row.sourceFields.actions as
          | { activation?: { unchained?: unknown } }[]
          | undefined
      )?.some((action) => action.activation?.unchained) ?? false;
    expect(own, row.name).toBe(unchainedOwn.includes(key));
  }
  for (const row of heldTraits.filter(
    (row) => !unchained.includes(row.externalKey),
  ))
    expect(
      (
        row.sourceFields.actions as
          | { activation?: { unchained?: unknown } }[]
          | undefined
      )?.some((action) => action.activation?.unchained) ?? false,
      row.name,
    ).toBe(false);
  // Same-name rows of other traits and unpinned printings are not required.
  for (const [name, book] of [
    ["Resurrected (Mummy's Mask)", 'PZO9441'],
    ['Cosmopolitan (Absalom)', 'PZO9421'],
    ['Inciter (Tiefling)', 'PZO9280'],
    ['Militia Veteran (Any Town or Village)', 'PZO9405'],
    ['Stargazer (Human; Varisian)', 'PZO9448'],
    ['Stargazer (Human; Varisian)', 'PZO9000-15E'],
    ['Drug Addict (Curse of the Crimson Throne)', 'PZO9000-2S'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  const linkedNames = heldTraits.flatMap((row) =>
    row.linkedContentReview.map((linked) => linked.name),
  );
  expect(linkedNames).toHaveLength(7);
  expect(new Set(linkedNames).size).toBe(7);
  // The closure holds exactly the linked bodies.
  expect(preview.closure.map((row) => row.externalKey).sort()).toEqual(
    [
      ...new Set(
        heldTraits.flatMap((row) =>
          row.linkedContentReview.map((linked) => linked.externalKey),
        ),
      ),
    ].sort(),
  );
  for (const name of noRow) {
    expect(candidate(name).comparison, name).toBeNull();
    expect(candidate(name).additionalComparisonLeads, name).toEqual([]);
    expect(candidate(name).inheritedRuleUnresolvedOrigins[0], name).toContain(
      'no PCGen row at the pin',
    );
  }
  // Drug Addict has only the 2008 player's guide rows, as leads.
  const addict = candidate('Drug Addict (Curse of the Crimson Throne)');
  expect(addict.comparison).toBeNull();
  expect(addict.additionalComparisonLeads.map((row) => row.line)).toEqual([
    8, 9,
  ]);
  expect(heldTraits.filter((row) => !row.comparison)).toHaveLength(
    noRow.length + 1,
  );
  // Named unresolved origins.
  for (const [name, origin] of [
    ['Cold Heart (Hellknight)', 'emotion descriptor'],
    ['Child of Mumia (Osirion)', 'curse descriptor'],
    ['Secret Revolutionary (Cheliax)', 'drug and addiction rules'],
    [
      'Debauchery Defier (Imperial Palace of Taldor)',
      'drug and addiction rules',
    ],
  ] as const)
    expect(candidate(name).inheritedRuleUnresolvedOrigins, name).toEqual([
      expect.stringContaining(origin),
    ]);
  for (const [name, origin] of [
    ['Rebuke the Curse', 'curse descriptor'],
    ['Twisted Tattoo', 'primal magic'],
  ] as const)
    expect(candidate(name).inheritedRuleUnresolvedOrigins, name).toEqual([
      expect.stringContaining('no PCGen row at the pin'),
      expect.stringContaining(origin),
    ]);
  for (const requirement of review.noticeRequirements) {
    if (requirement.book === 'PZO1110') {
      expect(requirement.holdId).toBeNull();
      continue;
    }
    expect(held.get(requirement.holdId ?? ''), requirement.book).toEqual([
      requirement.book,
      ...requirement.registryKeys.filter((key) => key !== requirement.book),
    ]);
    for (const key of requirement.candidates)
      expect(
        heldTraits.find((row) => row.externalKey === key)?.noticeHoldIds,
      ).toContain(requirement.holdId);
  }
});

it('records prerequisite mapper findings against the actual mapped atoms', () => {
  const kinds = (name: string) =>
    entry(name).prerequisites?.map((atom) =>
      'kind' in atom ? atom.kind : 'anyOf',
    );
  const facts = (name: string) =>
    recordedPrerequisiteFacts({
      batch: 'traits-383',
      candidate: candidate(name),
    });
  // Race labels are alternatives; the unsupported regional qualification
  // stays intact. The original diagnoses remain in the draft audit.
  expect(kinds('Beast Rider (Half-Orc, Orc)')).toEqual(['anyOf']);
  expect(kinds('Runaway Slave (Osirion, Thuvia, Darklands)')).toEqual([
    'unchecked',
  ]);
  for (const name of [
    'Beast Rider (Half-Orc, Orc)',
    'Tribal (Half-Orc, Orc)',
    'Runaway Slave (Osirion, Thuvia, Darklands)',
  ])
    expect(facts(name), name).toEqual([expect.stringContaining('#739')]);
  // Elven Serenity's "Half-Elf, Elf-Raised" is a race and its alternate
  // racial trait, both required.
  expect(kinds('Elven Serenity (Half-Elf, Elf-Raised)')).toEqual([
    'race',
    'unchecked',
  ]);
  expect(kinds('Militia Veteran (Any Town or Village)')).toEqual(['unchecked']);
  expect(kinds('Divine Warrior (Iomedae)')).toEqual(['deity']);
  expect(facts('Divine Warrior (Iomedae)')).toEqual([]);
  for (const [name, gap] of [
    ['Trouper (Sczarni Faction)', 'no faction fact exists'],
    [
      "Witness to Nature's Cruelty (Human; Kellid)",
      'no heritage or ethnicity fact exists',
    ],
    ['Natural Magic (Yuelral)', 'no deity fact exists'],
    ['Bellis Log Roller (Andoran; Bellis)', 'no region fact exists'],
    ['Occult Bargain', 'not a Requirements line'],
    ['Driven By Guilt (Strange Aeons)', 'not a Requirements line'],
  ] as const)
    expect(facts(name), name).toEqual(
      expect.arrayContaining([expect.stringContaining(gap)]),
    );
  for (const row of heldTraits)
    expect(row.mechanicsReview.prerequisiteReview.normalizedAtoms).toEqual(
      entry(row.name).prerequisites ?? [],
    );
});

it('re-binds the landed assessments whose content closures cover Noble Born - Lebeda and Regional Recluse - Sanos Forest or Whistledown', () => {
  // Their fixtures' copies of our two keys are this batch's curated entries.
  const ours = new Map(preview.entries.map((row) => [row.externalKey, row]));
  for (const [batch, key] of [
    ['369', 'pf1-content/nWlZ25PwQDz2zhoH'],
    ['370', 'pf1-content/nWlZ25PwQDz2zhoH'],
    ['379', 'pf1-content/nWlZ25PwQDz2zhoH'],
    ['371', 'pf1-content/qDxSXompaz69Ceqj'],
    ['375', 'pf1-content/qDxSXompaz69Ceqj'],
    ['376', 'pf1-content/qDxSXompaz69Ceqj'],
  ] as const) {
    const fixture = JSON.parse(
      readFileSync(`tests/fixtures/traits-${batch}/preview.json`, 'utf8'),
    ) as { closure: { externalKey: string }[] };
    expect(
      fixture.closure.find((row) => row.externalKey === key),
      batch,
    ).toEqual(ours.get(key));
  }
});

it('pins all 100 keys, the complete bodies, checked bindings and literal PCGen evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 0,
    held: 99,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 1,
    recordLevel35Holds: 0,
  });
  // The Campaign folder is excluded by the importer's folder contract.
  expect(folders.map((row) => [row.externalKey, row.name, row.rawKey])).toEqual(
    [['pf1-content/pCbPxzsBnEH3Mz08', 'Campaign', '!folders!pCbPxzsBnEH3Mz08']],
  );
  expect(preview.entries).toHaveLength(99);
  for (const row of review.candidates) {
    const bytes = await readPinned(row.source.repo, row.source.path);
    expect(sha(bytes), row.externalKey).toBe(row.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes));
    expect(raw._id).toBe(row.externalKey.split('/')[1]);
    expect(raw.name).toBe(row.name);
    if (row.disposition === 'excluded') continue;
    expect(raw.system).toEqual(row.sourceFields);
    expect(row.sourceFields.tags ?? []).not.toContain('3.5');
    const description = sourceDescription(raw);
    expect(sha(description)).toBe(row.descriptionSha256);
    expect(description).toBe(row.mechanicsReview.descriptionText);
    for (const reviewed of row.mechanicsReview.curationRecords) {
      expect(reviewed).toMatchObject({
        status: 'checked',
        reviewedBy: 'Opus (AI curator) for the owner',
        reviewedOn: '2026-10-18',
      });
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
    expect(entry(row.name).sources).toEqual(row.citedSources);
    expect(entry(row.name).detail.traitType).toBe(row.traitType);
  }
  for (const row of heldTraits)
    for (const linked of row.linkedContentReview)
      expect(sha(await readPinned(linked.repo, linked.path)), linked.name).toBe(
        linked.sha256,
      );
  const files = new Map(
    review.comparisonSources.pcgenFiles.map((file) => [file.path, file.sha256]),
  );
  for (const [path, digest] of files) {
    const bytes = await readFile(`tests/fixtures/pinned/pcgen/${path}`);
    expect(sha(bytes), path).toBe(digest);
  }
  for (const row of heldTraits) {
    for (const comparison of [
      row.comparison,
      ...row.additionalComparisonLeads,
      ...row.rejectedRootComparisonEvidence,
      ...row.inheritedRuleComparisonEvidence,
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
  }
  // Bellis Log Roller's row encodes the trip bonus on CMD, and Militia
  // Veteran's unpinned Taldor, Echoes of Glory printing grants +2.
  expect(
    candidate('Bellis Log Roller (Andoran; Bellis)').comparison?.literalRow,
  ).toContain('BONUS:VAR|CMD_Trip|1|TYPE=Trait');
  expect(
    candidate('Militia Veteran (Any Town or Village)')
      .additionalComparisonLeads[0]?.literalRow,
  ).toContain('BONUS:SKILL|%LIST|2|TYPE=Trait');
});

it('reextracts the reviewed mechanics from a clean shared fixture tree and keeps every trait held on its own holds', async () => {
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
    expect(artifact.curation.passed).toBe(true);
    expect(artifact.curation.missing).toEqual([]);
    expect(artifact.curation.stale).toEqual([]);
    expect(artifact.curation.summary).toMatchObject({
      required: 102,
      checked: 102,
      missing: 0,
      descriptions: { candidates: 99, checked: 99 },
    });
    expect(
      artifact.catalog.entries.map((row) => row.externalKey).sort(),
    ).toEqual(heldTraits.map((row) => row.externalKey).sort());
    for (const row of artifact.catalog.entries) {
      const saved = entry(row.name);
      expect({
        description: row.description,
        modifiers: row.modifiers,
        situationalNotes: row.situationalNotes,
        sources: row.sources,
      }).toEqual({
        description: saved.description,
        modifiers: saved.modifiers,
        situationalNotes: saved.situationalNotes,
        sources: saved.sources,
      });
    }
    // The assessments are bound against the full-corpus content closure: the
    // committed entries and the linked bodies in their closures.
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
    const ours = new Set(heldTraits.map((row) => row.externalKey));
    const gate = assessCatalogAdmission({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(gate.admitted.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    // Every linked body is in the committed closure, so no trait fails on a
    // reference.
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    const held = gate.held.filter((row) => ours.has(row.externalKey));
    expect(held).toHaveLength(99);
    for (const row of held)
      expect(row.reason, row.name).toBe(candidate(row.name).rationale);
    for (const row of heldTraits) {
      const assessment = reviewedAdmission.assessments.find(
        (a) => a.externalKey === row.externalKey,
      );
      expect(assessment).toMatchObject({
        status: 'unresolved',
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
    // Confirming a trait's whole content still holds it on its held notices:
    // every trait requires the held APG trait framework notice.
    const orphan = candidate('Favored Son/Daughter (Any Campaign)');
    expect(orphan.requiredNotices).toEqual(['PZO1115', 'PZO1110']);
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === orphan.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === orphan.externalKey),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === orphan.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
