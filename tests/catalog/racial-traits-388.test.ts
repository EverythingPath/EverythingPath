// @vitest-environment node
import { createHash } from 'node:crypto';
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
  assessedTraits,
  admittedTraits,
  excludedRows,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/racial-traits-388/data';
import {
  previewEntry,
  racialTraitSheet,
} from '../fixtures/racial-traits-388/sheet';
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
  if (row.detail.kind !== 'racialTrait') throw new Error('Expected trait');
  return { ...row, detail: row.detail };
}
function candidate(name: string) {
  const row = assessedTraits.find((row) => row.name === name);
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
function modifiers(name: string) {
  const row = entry(name);
  return row.modifiers.map((raw) => ({
    ...outputSchema.options[0]
      .omit({ kind: true })
      .extend({ target: z.enum(modifierTargets) })
      .parse(raw),
    sheetEntryId: row.externalKey,
    catalogEntryId: row.externalKey,
    source: row.externalKey,
    entryName: row.name,
    builtIn: false,
  }));
}
// The Situation of one Modifier, selected on its own entry.
function situation(name: string, index: number) {
  const scope = modifiers(name)[index]?.condition?.situation;
  if (!scope) throw new Error(`Modifier ${index} of ${name} has no Situation`);
  if (typeof scope === 'string') return scope;
  if (!('local' in scope)) throw new Error('Expected a local Situation');
  return { local: scope.local, sheetEntryId: entry(name).externalKey };
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
// One resolved statistic of one entry's Modifiers, with Situations selected.
function resolved(
  name: string,
  target: string,
  selected: number[] = [],
  options: { school?: string } = {},
) {
  return resolveSheet(modifiers(name), {
    ...options,
    situations: selected.map((index) => situation(name, index)),
  })[target as 'skill.per'].total;
}
const ability = (
  sheet: ReturnType<typeof racialTraitSheet>,
  target: 'ability.str',
) => calculateCharacterSheetProjections(sheet).current.breakdowns[target].total;

// Every record whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): on its own action, through a bound
// body (a replaced trait, a linked spell or feat, or a body two links away),
// or both.
const unchainedOwn = [
  'pf1-content/3RZF7jBAcKGjU8Lc', // Spell-Like Ability (Shabti)
  'pf1-content/3sFVS1F5eFcCUABV', // Pharaonic Will
  'pf1-content/4LypGODo155PBk96', // Plantspeech
  'pf1-content/4eZSNsHGXAwZm4dk', // Experimental Body: Scorched
  'pf1-content/4m3vBWg6qo6oNpAf', // Shade Magic
  'pf1-content/4tT7hExEjO6bLoDC', // Nereid Fascination (Undine)
  'pf1-content/5a4cHF6UEIcKge9j', // Fey Magic (Gnome - HotW)
  'pf1-content/5aAT2BdFhvV4ukc2', // Death Throes
  'pf1-content/6AA4khYton1MWeXO', // Alternate Spell-Like Ability (Fanglord)
  'pf1-content/6eYkzFOhZc6mL1Sc', // Alternate Spell-Like Ability (Aerieborn)
  'pf1-content/75LOlnGJh2e6OAZc', // Alternate Spell-Like Ability (Coldborn)
];
const unchainedBound = [
  'pf1-content/3RZF7jBAcKGjU8Lc',
  'pf1-content/3haIOIRYDeFc1YZH', // Archon-Blooded (Lawbringers)
  'pf1-content/3sFVS1F5eFcCUABV',
  'pf1-content/4LypGODo155PBk96',
  'pf1-content/4eZSNsHGXAwZm4dk',
  'pf1-content/4m3vBWg6qo6oNpAf',
  'pf1-content/4qveM7bUNizrOvka', // Divided Attention (Orc Ferocity)
  'pf1-content/4tT7hExEjO6bLoDC',
  'pf1-content/4tq1PgGZzIsYSVkH', // Experimental Body: Enchanted
  'pf1-content/5YDsKDGSzLMoH1dv', // Variant Tiefling Abilities
  'pf1-content/6AA4khYton1MWeXO',
  'pf1-content/6eYkzFOhZc6mL1Sc',
  'pf1-content/75LOlnGJh2e6OAZc',
];

it('resolves the reviewed racial trait Modifiers through the public resolver', () => {
  // Archon-Blooded, curated with its ability line, replaces the aasimar's
  // ability score trait: it goes dormant, and the heritage's adjustments count.
  const heritage = entry('Archon-Blooded (Lawbringers)');
  const raceKey = heritage.detail.raceKeys?.[0];
  if (!raceKey) throw new Error('Archon-Blooded has no race');
  expect(heritage.detail.replaces).toEqual([
    `local/race-ability-scores/${raceKey}`,
  ]);
  expect(heritage.detail.unresolvedReplacements).toBeUndefined();
  expect(previewEntry('Aasimar').externalKey).toBe(raceKey);
  const plain = racialTraitSheet({ race: raceKey });
  const chosen = racialTraitSheet({
    race: raceKey,
    traits: [heritage.externalKey],
  });
  for (const [target, before, after] of [
    ['ability.str', 10, 10],
    ['ability.con', 10, 12],
    ['ability.wis', 12, 12],
    ['ability.cha', 12, 10],
  ] as const) {
    expect(ability(plain, target as 'ability.str'), `Aasimar ${target}`).toBe(
      before,
    );
    expect(
      ability(chosen, target as 'ability.str'),
      `Archon-Blooded ${target}`,
    ).toBe(after);
  }
  // The waker may's imported ability line replaces the changeling's Ability
  // Modifiers trait by name.
  const waker = entry('Ability Modifiers (Changeling - Waker May)');
  expect(waker.detail.replaces).toEqual(['pf1-content/PxjUu8YOjXmWdagL']);
  for (const [target, value] of [
    ['ability.str', 2],
    ['ability.cha', 2],
    ['ability.wis', -2],
  ] as const)
    expect(resolved(waker.name, target), target).toBe(value);
  // The racial subtypes and the aquatic elf ethnicity carry no Modifier and
  // keep "Base Statistics" unmatched.
  for (const name of [
    'Aquatic Elves',
    'Slave Born',
    'Arena-Bred',
    'Human-Raised (Half-Elf)',
  ]) {
    expect(entry(name).modifiers, name).toEqual([]);
    expect(entry(name).detail.unresolvedReplacements, name).toEqual([
      'Base Statistics',
    ]);
  }
  // Situational bonuses apply only when their Situation is selected.
  for (const [name, target, label, value] of [
    ['Eye for Opportunity', 'attack.melee', 'attacks of opportunity', 1],
    ['Siege Survivor', 'attack.melee', 'not moved', 1],
    ['Stalwart Watcher', 'attack.ranged', 'fey', 1],
    ['Craven', 'attack.melee', 'flanking', 1],
    ['Craven', 'ac.other', 'fear effect', 1],
    ['Nimble Faller', 'cmd', 'trip', 1],
    ['Xenophobic', 'save.will', 'other than fear', 1],
    ['Greed (Wyvaran)', 'skill.slt', 'take items', 2],
    ['Unnatural', 'ac.other', 'animals', 2],
    ['Unnatural', 'skill.han', 'animal type', -4],
    ['Unnatural', 'skill.umd', 'animal type', -4],
    ['Divided Attention', 'ac.other', 'flank', 1],
    ['Frightener', 'spellDC', 'fear descriptor', 1],
    ['Vampiric Empathy', 'skill.dip', 'bats, rats', 2],
    ['Shadowhunter (Half-Elf)', 'save.fort', 'negative levels', 2],
    ['Sensual', 'skill.prf', 'Perform', 2],
    ['Stonecunning (Dwarf)', 'skill.per', 'stonework', 2],
  ] as const) {
    const base = target
      .replace(/^save\..*/, 'saves')
      .replace(/^ac\..*/, 'ac')
      .replace(/^attack\..*/, 'attack');
    const index = modifiers(name).findIndex(
      (row) =>
        (row.target === target || row.target === base) &&
        JSON.stringify(row.condition?.situation ?? '').includes(label),
    );
    expect(index, `${name} ${target}`).toBeGreaterThanOrEqual(0);
    expect(resolved(name, target), `${name} ${target}`).toBe(0);
    expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
  }
  // Acquisitive's +4 is the new total: racial bonuses on one entry don't
  // stack, so the Situation raises the imported +2 to +4.
  const hoard = indexOf('Acquisitive', 'skill.apr', 'treasure hoard');
  expect(resolved('Acquisitive', 'skill.apr')).toBe(2);
  expect(resolved('Acquisitive', 'skill.apr', [hoard])).toBe(4);
  // Shared Situations.
  expect(modifiers('Craven').map((row) => row.condition?.situation)).toContain(
    'fear',
  );
  const fear = modifiers('Craven').findIndex(
    (row) => row.condition?.situation === 'fear',
  );
  expect(resolved('Craven', 'save.will', [fear])).toBe(-2);
  const watcher = modifiers('Stalwart Watcher').findIndex(
    (row) => row.condition?.situation === 'mindAffecting',
  );
  expect(resolved('Stalwart Watcher', 'save.will', [watcher])).toBe(2);
  expect(
    modifiers('Share Knowledge').map((row) => row.condition?.situation),
  ).toEqual(['poison']);
  expect(resolved('Share Knowledge', 'save.fort', [0])).toBe(2);
  // Imported changes keep mapping; nothing is curated a second time.
  for (const [name, target, value] of [
    ['Craven', 'init', 1],
    ['Greed (Wyvaran)', 'skill.apr', 2],
    ['Deep Jungle', 'skill.sur', 2],
    ['Taskmaster', 'skill.dip', 2],
    ['Climber', 'skill.clm', 2],
    ['Giant Ancestry', 'cmb', 1],
    ['Giant Ancestry', 'cmd', 1],
    ['Giant Ancestry', 'skill.ste', -2],
    ['Market Dweller', 'skill.sen', 2],
    ['Forest Walker (Half-Orc)', 'skill.clm', 2],
    ["Ocean's Daughter", 'skill.swm', 1],
    ['Ability Score Modifiers (Kitsune)', 'ability.dex', 2],
    ['Ability Score Modifiers (Kitsune)', 'ability.str', -2],
  ] as const)
    expect(resolved(name, target), `${name} ${target}`).toBe(value);
  // The race's re-homed note records supply Fearless's and Stability's
  // bonuses (shared Situations).
  for (const [name, target, value] of [
    ['Fearless (Green Martian)', 'save.will', 2],
    ['Stability (Duergar)', 'cmd', 4],
  ] as const) {
    const all = modifiers(name).map((_, index) => index);
    expect(resolved(name, target), `${name} ${target}`).toBe(0);
    expect(resolved(name, target, all), `${name} ${target}`).toBe(value);
  }
  // Stonecunning's own checked note record carries the Dwarf race record's
  // outputs (an uncovered trait note), so the bonus counts once, untyped.
  expect(modifiers('Stonecunning (Dwarf)').map((row) => row.bonusType)).toEqual(
    ['untyped'],
  );
  // No armor, shield or natural armor bonus sits on ac.other.
  for (const row of preview.entries)
    for (const modifier of row.modifiers)
      if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
        expect(modifier.target, row.name).not.toBe('ac.other');
});

it('checks every required note record and the separate description pass against the pinned bodies', () => {
  let required = 0;
  for (const row of assessedTraits) {
    const [description, ...notes] = row.mechanicsReview.curationRecords;
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
    // Only Variant Tiefling Abilities' d% table needs more than one Note.
    expect(parts, row.name).toHaveLength(
      row.name === 'Variant Tiefling Abilities' ? 3 : 1,
    );
    for (const part of parts) {
      expect(part.length, row.name).toBeLessThanOrEqual(4096);
      for (const markup of [
        '@UUID',
        '@Distance',
        '@Toggle',
        '@Weight',
        '@Condition',
        '[[',
      ])
        expect(part, row.name).not.toContain(markup);
    }
    const texts = (entry(row.name).situationalNotes ?? []).map(
      (note) => note.text,
    );
    for (const part of parts) expect(texts, row.name).toContain(part);
  }
  expect(required).toBe(51);
  // The split table keeps every row, in order.
  const table = candidate('Variant Tiefling Abilities')
    .mechanicsReview.curationRecords[0]!.outputs.flatMap((output) =>
      output.kind === 'note' ? [output.text] : [],
    )
    .join('\n');
  expect(table).toContain('1 | You can animate a 1 HD skeleton');
  expect(table).toContain('100 | Roll on this table twice');
  expect(table).toContain('plus 10 pounds at will');
  expect(table.indexOf('49 |')).toBeLessThan(table.indexOf('50 |'));
  // Enrichers read as text: a radius, a burst and a condition.
  for (const [name, text] of [
    ['Nereid Fascination (Undine)', '20-foot-radius aura'],
    ['Death Throes', 'within a 5-foot burst'],
    ['Light Sensitivity (Kobold)', 'Kobolds are dazzled as long as'],
  ] as const)
    expect(
      entry(name)
        .situationalNotes?.map((note) => note.text)
        .join(' '),
      name,
    ).toContain(text);
  // Repeated notes are the explicit covered/no-output records.
  expect(
    assessedTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual([
    'Sure Step (Half-Elf) skill.acr',
    'Sure Step (Half-Elf) skill.per',
    'Delicious cmb',
    'Delicious skill.esc',
    'Shadowhunter (Half-Elf) rangedWeapon',
    'Surface Survivalist skill.fly',
  ]);
  // Standard traits whose Foundry note a checked race record covers have no
  // required record of their own (coveredTraitNotes).
  for (const name of ['Fearless (Green Martian)', 'Stability (Duergar)']) {
    expect(candidate(name).sourceFields.contextNotes, name).toHaveLength(1);
    expect(candidate(name).mechanicsReview.curationRecords, name).toHaveLength(
      1,
    );
  }
  // Stonecunning's uncovered note: its record carries exactly the Dwarf
  // race's #328 skill.per outputs, which it supersedes (that race record stays
  // in the overlay and a full import reports it stale).
  const stone = candidate('Stonecunning (Dwarf)').mechanicsReview
    .curationRecords[1]!;
  expect(stone).toMatchObject({ kind: 'note', target: 'skill.per' });
  expect(stone.outputs).toEqual(
    reviewedCuration.records.find(
      (row) =>
        row.externalKey === 'pf1/nEltI9y37rKJTeWo' &&
        row.kind === 'note' &&
        row.target === 'skill.per',
    )?.outputs,
  );
  // Delicious's penalties stay on the Ghoran race entry (latent overlap).
  expect(entry('Delicious').modifiers).toEqual([]);
  for (const record of candidate(
    'Delicious',
  ).mechanicsReview.curationRecords.slice(1))
    expect(record.rationale).toContain('Ghoran race');
  // Notes the Foundry data put on unrelated statistics are entry-level.
  for (const name of [
    'Thunderous Resilience',
    'Sure Step (Half-Elf)',
    'Nimble Faller',
    'Deep Jungle',
    'Boundary Walker',
    'Amphibious (Adaro)',
    'Cannibalistic Vitality',
    'Unnatural',
  ])
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target),
      name,
    ).toEqual([]);
  for (const [name, targets] of [
    ['Light Sensitivity (Kobold)', ['attack', 'skill.per']],
    ['Shadowhunter (Half-Elf)', ['attack']],
    ['Surface Survivalist', ['save.fort']],
    ['Carrion Sense', ['skill.per']],
    ['Pharaonic Will', ['saves']],
    ['Sociable', ['skill.dip']],
    ['Greed (Wyvaran)', ['skill.slt']],
    ["Ocean's Daughter", ['skill.swm']],
    [
      'Share Knowledge',
      [
        'skill.kar',
        'skill.kdu',
        'skill.ken',
        'skill.kge',
        'skill.khi',
        'skill.klo',
        'skill.kna',
        'skill.kno',
        'skill.kpl',
        'skill.kre',
      ],
    ],
  ] as const)
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target)
        .sort(),
      name,
    ).toEqual(targets);
  // The published text wins over the Foundry note's paraphrase.
  expect(
    entry('Carrion Sense').situationalNotes?.find(
      (note) => note.target === 'skill.per',
    )?.text,
  ).toContain('50% or fewer hit points');
  // Every record lists its outstanding calculations, never as a hold.
  for (const row of assessedTraits) {
    expect(
      row.mechanicsReview.outstandingCalculations.length,
      row.name,
    ).toBeGreaterThan(0);
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
    expect(row.mechanicsReview.proficiencyReview.grants, row.name).toEqual([]);
  }
  // Imported bonus types that contradict the text stay listed for review.
  for (const name of ['Craven', "Ocean's Daughter"])
    expect(
      candidate(name).mechanicsReview.sourceDiscrepancies.join(' '),
      name,
    ).toContain('listed for review');
});

it('records the race, alternate-trait, monster-ability and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  for (const row of assessedTraits) {
    expect(row.requiredNotices.at(-1), row.name).toBe('PZO1110');
    for (const cited of row.citedSources)
      expect(row.requiredNotices, row.name).toContain(cited.book);
    for (const linked of row.linkedContentReview)
      for (const book of linked.sources)
        expect(row.requiredNotices, row.name).toContain(book.id);
    // The race record's books (Race abilities).
    const races = row.inheritedRuleNotices.filter((notice) =>
      notice.location.includes('/packs/races/'),
    );
    expect(races.length, row.name).toBeGreaterThan(0);
    for (const notice of races)
      expect(row.requiredNotices, row.name).toContain(notice.book);
    // Every alternate records the APG exchange framework.
    const framework = row.inheritedRuleComparisonEvidence.find(
      (comparison) => comparison.line === 86,
    );
    if (row.racialTraitKind === 'alt') {
      expect(row.requiredNotices, row.name).toContain('PZO1115');
      expect(framework?.literalRow, row.name).toContain(
        'This racial trait replaces the intimidating racial trait',
      );
    } else expect(framework, row.name).toBeUndefined();
    if (row.disposition === 'admitted') {
      // #328 S4-A: the launch comparison supersedes the whole-content
      // hold, and the notice chains are reviewed (PZO1110), cleared
      // (PZO1121) or confirmed (PZO9280), so the row records no hold.
      expect(row.holdIds, row.name).toEqual([]);
      expect(row.noticeHoldIds, row.name).toEqual([]);
      continue;
    }
    expect(row.holdIds, row.name).toEqual([
      `racial-traits-388-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `racial-traits-388-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    assessedTraits.filter((row) => row.racialTraitKind === 'alt'),
  ).toHaveLength(39);
  // Universal monster rules the bodies grant take the earliest book their
  // pinned Universal Monster Rules journal page lists.
  for (const [name, book, page] of [
    ['Darkvision (Undine)', 'PZO1127', 'Darkvision'],
    ['Darkvision (Ganzi)', 'PZO1127', 'Darkvision'],
    ['Low-Light Vision (Vanara)', 'PZO1112', 'Low-Light Vision'],
    ['Low-Light Vision (Orang-Pendak)', 'PZO1112', 'Low-Light Vision'],
    ['Forest Walker (Half-Orc)', 'PZO1112', 'Low-Light Vision'],
    ['Carrion Sense', 'PZO1112', 'Scent'],
    ['Amphibious (Adaro)', 'PZO1112', 'Amphibious'],
    ['Light Sensitivity (Kobold)', 'PZO1112', 'Light Sensitivity'],
    ['Thunderous Resilience', 'PZO1112', 'Resistance'],
    ['Share Knowledge', 'PZO1112', 'Resistance'],
    ['Boundary Walker', 'PZO1112', 'Spell Resistance'],
    ['Delicious', 'PZO1112', 'Natural Attacks'],
    ['Variant Tiefling Abilities', 'PZO1116', 'See in Darkness'],
    ['Variant Tiefling Abilities', 'PZO1127', 'All-Around Vision'],
    ['Variant Tiefling Abilities', 'PZO1112', 'Tremorsense'],
  ] as const)
    expect(
      candidate(name).inheritedRuleNotices.some(
        (notice) =>
          notice.book === book &&
          notice.location.includes('universal-monster-rules-umr') &&
          notice.rule.length > 0,
      ) && candidate(name).requiredNotices.includes(book),
      `${name} ${page}`,
    ).toBe(true);
  // Linked bodies' books and the third-party book.
  for (const [name, book] of [
    ['Shade Magic', 'PZO1115'],
    ['Deep Jungle', 'PZO1118'],
    ['Slave Born', 'PZO1115'],
    ['Fearless (Green Martian)', 'DYN0032-E'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Unchained action-cost metadata anywhere in the bound closure requires
  // the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedBound])].sort();
  expect(unchained).toHaveLength(15);
  expect(
    assessedTraits
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(unchained);
  for (const row of assessedTraits) {
    const own =
      (
        row.sourceFields.actions as
          | { activation?: { unchained?: unknown } }[]
          | undefined
      )?.some((action) => action.activation?.unchained) ?? false;
    expect(own, row.name).toBe(unchainedOwn.includes(row.externalKey));
    const rules = row.inheritedRuleNotices
      .filter((notice) => notice.book === 'PZO1131')
      .map((notice) => notice.rule);
    expect(
      rules.some((rule) => rule.includes("racial trait's own action")),
      row.name,
    ).toBe(own);
    expect(
      rules.some((rule) => rule.includes('on the bound')),
      row.name,
    ).toBe(unchainedBound.includes(row.externalKey));
  }
  // Creature types have no pinned rules record: named unresolved origins.
  for (const name of ['Reptilian (Nagaji)', 'Kasatha', 'Amphibious (Adaro)'])
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).toContain('Creature type and subtype rules');
  // A body PCGen files under another book than the record cites stays a
  // named hold; the lead's book is not required from it.
  for (const [name, book] of [
    ['Divided Attention', 'PZO9280'],
    ['Exotic Weapon Training', 'PZO1121'],
  ] as const) {
    expect(
      candidate(name).additionalComparisonLeads.map((row) => row.book),
      name,
    ).toContain(book);
    expect(candidate(name).requiredNotices, name).not.toContain(book);
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).toContain('Cited source');
  }
  // Codes no earlier inventory reviewed have no Registry identity and are held.
  for (const book of ['DYN0032-E', 'PZO90124', 'PZO9244'])
    expect(
      review.noticeRequirements.find((row) => row.book === book),
      book,
    ).toMatchObject({
      registryKeys: [],
      holdId: `racial-traits-388-notice-${book}-complete-chain`,
    });
  for (const requirement of review.noticeRequirements) {
    if (requirement.book === 'PZO1110') {
      expect(requirement.holdId).toBeNull();
      continue;
    }
    expect(held.get(requirement.holdId ?? ''), requirement.book).toEqual([
      requirement.book,
      ...requirement.registryKeys.filter((key) => key !== requirement.book),
    ]);
    for (const key of requirement.candidates) {
      const row = assessedTraits.find((row) => row.externalKey === key);
      // #328 S4-A: an admitted trait stays in its batch's notice row as
      // history, with no hold of its own.
      if (row?.disposition === 'admitted')
        expect(row.noticeHoldIds, row.name).toEqual([]);
      else expect(row?.noticeHoldIds).toContain(requirement.holdId);
    }
  }
});

it('records the importer reading of every race, replacement and unresolved name', () => {
  for (const row of assessedTraits) {
    const detail = entry(row.name).detail;
    const reviewed = row.mechanicsReview.racialTraitReview;
    expect(reviewed.raceKeys, row.name).toEqual(detail.raceKeys);
    expect(reviewed.standard, row.name).toBe(detail.standard);
    expect(reviewed.replaces, row.name).toEqual(detail.replaces ?? []);
    expect(reviewed.unresolvedReplacements, row.name).toEqual(
      detail.unresolvedReplacements ?? [],
    );
    expect(reviewed.kind, row.name).toBe(row.racialTraitKind);
    expect(detail.standard, row.name).toBe(row.racialTraitKind === 'std');
  }
  const unresolved = Object.fromEntries(
    assessedTraits
      .filter((row) => entry(row.name).detail.unresolvedReplacements?.length)
      .map((row) => [row.name, entry(row.name).detail.unresolvedReplacements]),
  );
  expect(unresolved).toEqual({
    // Racial subtypes and the aquatic elf ethnicity keep their race's ability
    // score trait.
    'Aquatic Elves': ['Base Statistics'],
    'Slave Born': ['Base Statistics'],
    'Arena-Bred': ['Base Statistics'],
    'Human-Raised (Half-Elf)': ['Base Statistics'],
    // Names with no standard trait record.
    'Cave Crawler': ['Fast Movement'],
    "Ocean's Daughter": ['Sea Lungs'],
  });
  // The singular "Replaced Trait:" header of the skinwalker heritage parts
  // is read and resolves the skinwalker's spell-like ability.
  for (const name of [
    'Alternate Spell-Like Ability (Skinwalker - Fanglord)',
    'Alternate Spell-Like Ability (Skinwalker - Aerieborn)',
    'Alternate Spell-Like Ability (Skinwalker - Coldborn)',
  ])
    expect(entry(name).detail.replaces, name).toEqual([
      'pf1-content/ZEVsEIPpOyHmpmEe',
    ]);
});

it('pins all 100 keys, the complete bodies, checked bindings and literal PCGen and PRD evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 2,
    held: 69,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 29,
    excludedFolders: 12,
    excludedRaceBuilder: 17,
    recordLevel35Holds: 0,
  });
  for (const row of excludedRows) {
    const raw = upstreamRecord.parse(
      parse(await readPinned(row.source.repo, row.source.path)),
    );
    if (row.kind === 'folder')
      expect(raw._key, row.name).toBe(`!folders!${raw._id}`);
    else {
      expect(row.folderPath[0], row.name).toBe('Race Builder');
      expect(raw._key, row.name).toBe(`!items!${raw._id}`);
    }
  }
  expect(preview.entries).toHaveLength(71);
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
        reviewedOn: '2026-10-19',
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
  }
  for (const row of assessedTraits)
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
  for (const row of assessedTraits) {
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
      if (!comparison.publicationAnchor) {
        // Core Essentials support rows name no book.
        expect(comparison.path, row.name).toContain('/core_essentials/');
        continue;
      }
      const { path, line, text, sha256 } = comparison.publicationAnchor;
      expect(files.get(path)).toBe(sha256);
      const publication = await readFile(
        `tests/fixtures/pinned/pcgen/${path}`,
        'utf8',
      );
      expect(publication.split(/\r?\n/)[line - 1]?.split('\t')[0]).toBe(text);
    }
    // The PRD paragraph is literally on the pinned capture page.
    const prd = row.prdComparison;
    if (!prd) continue;
    const page = await readPinned('prd', prd.path);
    expect(sha(page), prd.path).toBe(prd.pageSha256);
    expect(page, row.name).toContain(prd.literalParagraph);
    expect(sha(prd.literalParagraph)).toBe(prd.paragraphSha256);
    expect(prd.textMatches, row.name).toBe(prd.wordDifferences.length === 0);
  }
  expect(
    assessedTraits.filter((row) => row.prdComparison).map((row) => row.name),
  ).toHaveLength(22);
  expect(
    assessedTraits
      .filter((row) => row.prdComparison && !row.prdComparison.textMatches)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Fiendish Sorcery',
    'Human-Raised (Half-Elf)',
    'Stonecunning (Dwarf)',
    'Xenophobic',
  ]);
  expect(candidate('Xenophobic').prdComparison?.wordDifferences).toEqual([
    { pinned: 'effects', prd: 'affects' },
  ]);
  // Craven follows the ARG printing; the APG row is a cited lead.
  expect(candidate('Craven').comparison?.literalRow).toContain(
    'They take a -2 penalty on saves against fear effects',
  );
  expect(
    candidate('Craven').additionalComparisonLeads[0]?.literalRow,
  ).toContain('They suffer a -2 penalty on fear saves');
});

it('reextracts the reviewed mechanics from a clean shared fixture tree and keeps every racial trait held on its own holds', async () => {
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
      required: 51,
      checked: 51,
      missing: 0,
      descriptions: { candidates: 71, checked: 71 },
    });
    expect(
      artifact.catalog.entries.map((row) => row.externalKey).sort(),
    ).toEqual(assessedTraits.map((row) => row.externalKey).sort());
    // A bounded import applies no race note record (its race is outside the
    // selection), so these two standard traits lack the re-homed bonuses.
    const rehomed = ['Fearless (Green Martian)', 'Stability (Duergar)'];
    for (const row of artifact.catalog.entries) {
      const saved = entry(row.name);
      expect(
        {
          description: row.description,
          situationalNotes: row.situationalNotes,
          sources: row.sources,
        },
        row.name,
      ).toEqual({
        description: saved.description,
        situationalNotes: saved.situationalNotes,
        sources: saved.sources,
      });
      if (rehomed.includes(row.name))
        expect(row.modifiers, row.name).toEqual([]);
      else expect(row.modifiers, row.name).toEqual(saved.modifiers);
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
    const ours = new Set(assessedTraits.map((row) => row.externalKey));
    const gate = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    // #328 S4-A confirms the batch's Human, Dwarf and Half-Orc standard
    // traits. Without the owner's notice clearances (this gate) they stay
    // held on their notice chains; the committed gate admits them.
    const admittedKeys = new Set(admittedTraits.map((row) => row.externalKey));
    expect(gate.admitted.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    expect(
      assessCatalogAdmission({ artifact: authoritative, ...reviewedAdmission })
        .admitted.filter((row) => ours.has(row.externalKey))
        .map((row) => row.externalKey)
        .sort(),
    ).toEqual([...admittedKeys].sort());
    for (const row of gate.held.filter((row) =>
      admittedKeys.has(row.externalKey),
    ))
      expect(row.reason, row.name).toMatch(
        /Notice holds|Missing or unreviewed required notices/,
      );
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    const held = gate.held.filter(
      (row) => ours.has(row.externalKey) && !admittedKeys.has(row.externalKey),
    );
    expect(held).toHaveLength(69);
    // Fearless (Green Martian)'s Dynamite source keeps the importer's
    // source-matched hold (#227/#241) ahead of its own.
    for (const row of held)
      expect(row.reason, row.name).toBe(
        row.name === 'Fearless (Green Martian)'
          ? 'Known notice/evidence hold (#227/#241); unavailable for new release admission.'
          : candidate(row.name).rationale,
      );
    for (const row of assessedTraits) {
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
    // Confirming a CRB-cited standard trait's whole content still holds it on
    // its other cited books' held notices.
    const keen = candidate('Stonecunning (Dwarf)');
    expect(keen.requiredNotices).toEqual(['PZO9280', 'PZO1121', 'PZO1110']);
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === keen.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === keen.externalKey),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === keen.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
