// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { ZodError } from 'zod';
import { mapEntry, type PreviewEntry } from '../../scripts/catalog/map';
import {
  sourceDescription,
  upstreamRecord,
  type LoadedRecord,
  type SourceRecord,
} from '../../scripts/catalog/records';
import {
  listTraitClassSkillChoiceReviews,
  parseTraitClassSkillChoiceList,
  reviewedTraitClassSkillChoices,
  traitClassSkillChoiceFor,
  type TraitClassSkillChoiceRecord,
} from '../../scripts/catalog/trait-class-skill-choices';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { skillDefinitions } from '../../src/lib/character-sheet-skill-definitions';
import { readPinned } from './pinned-sources';

// trait-cs (research/trait-class-skills-design.md §3): a trait's "X is always
// a class skill for you" maps from Foundry's class-skill map onto its detail,
// and a choice trait's two options come from the reviewed choice list.
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const mapTrait = (
  record: SourceRecord,
  key = `pf1-content/${record._id}`,
  traitClassSkillChoices?: readonly TraitClassSkillChoiceRecord[],
): PreviewEntry =>
  mapEntry({
    source: {
      repo: 'pf1-content',
      pack: 'pf-traits',
      path: `src/pf-traits/${record._id}.yaml`,
      record,
    },
    kind: 'trait',
    resolveKey: (candidate) => (candidate === key ? key : undefined),
    lookup: new Map(),
    spellClassTags: new Set(),
    traitClassSkillChoices,
  });
const syntheticTrait = (system: Record<string, unknown>) =>
  upstreamRecord.parse({
    _id: 'proofTrait',
    _key: '!items!proofTrait',
    name: 'Proof Trait',
    type: 'feat',
    system: {
      subType: 'trait',
      traitType: 'social',
      description: { value: '<p>Proof.</p>' },
      sources: [{ id: 'PZO1115', pages: '1' }],
      ...system,
    },
  });
const issues = (entry: PreviewEntry, field: string) =>
  entry.unsupported.filter((issue) => issue.field === field);

describe('mapping a trait’s class skills', () => {
  it('maps the skills Foundry marks true as runtime keys, reports the ones the sheet lacks and retains no class-skill content', () => {
    const entry = mapTrait(
      syntheticTrait({
        classSkills: { blf: true, dip: false, art: true, xyz: true },
      }),
    );
    expect(entry.detail).toEqual({
      kind: 'trait',
      traitType: 'social',
      classSkills: ['skill.blf'],
    });
    expect(issues(entry, 'classSkills').map(({ value }) => value)).toEqual([
      'art',
      'xyz',
    ]);
    expect(issues(entry, 'gameContent')).toEqual([]);
    expect(() => importedCatalogEntrySchema.parse(entry)).not.toThrow();
  });

  it('keeps retaining a trait’s other content fields, without its class skills', () => {
    const entry = mapTrait(
      syntheticTrait({
        classSkills: { blf: true },
        uses: { per: 'day', maxFormula: '1' },
      }),
    );
    expect(issues(entry, 'gameContent').map(({ value }) => value)).toEqual([
      { uses: { per: 'day', maxFormula: '1' } },
    ]);
  });

  it('adds no class-skill field to a trait without one, or with none marked', () => {
    for (const system of [
      {},
      { classSkills: {} },
      { classSkills: { blf: false } },
    ])
      expect(
        mapTrait(syntheticTrait(system)).detail,
        JSON.stringify(system),
      ).toEqual({ kind: 'trait', traitType: 'social' });
  });
});

// The 19 traits of the design's table, from the pinned pf1-content tree.
const traitsDirectory = 'src/pf-traits';
const fixed = [
  ['AqVT6NKa96JsBIbp', 'Fast_Talker', 'skill.blf'],
  ['xZtqiu7M9QVZhjtP', 'Classically_Schooled', 'skill.spl'],
  ['kJHIn1P7sodvbx9k', 'Suspicious', 'skill.sen'],
  ['NuR6mWkvYBtRfl4T', 'Dangerously_Curious', 'skill.umd'],
  ['ClHv7nLXZViVvbeb', 'Brute__Half_Orc_', 'skill.int'],
  ['cDBC38MX6zGe2Myt', 'Ease_of_Faith', 'skill.dip'],
  ['YD5T6kLoG8XrgvkG', 'Poverty_Stricken', 'skill.sur'],
  ['onHaG9Qv0muoVM6G', 'Favored_Son_Daughter__Any_Campaign_', 'skill.klo'],
  ['gYOgJlRg3ssPqvVG', 'Eyes_and_Ears_of_the_City__Abadar_', 'skill.per'],
  ['lRGmeiOsSlNDjdug', 'Child_of_the_Streets', 'skill.slt'],
  ['UHB1ynm4zstnZsPc', 'Outcast__Half_Orc_', 'skill.sur'],
  ['7IGven6YWErDTHAG', 'Bully', 'skill.int'],
  ['7TreYWIp2t44jO3u', 'Caretaker', 'skill.hea'],
] as const;
const choices = [
  ['kNEL5ID2NpI4dsHa', 'Scholar_of_Ruins__Human_', ['skill.kge', 'skill.kdu']],
  ['M2CVmyEbiCMIGQwI', 'Devotee_of_the_Green', ['skill.kge', 'skill.kna']],
  [
    'nynIIPqAUW9XgPmK',
    'Guardian_of_the_Forge__Torag_',
    ['skill.ken', 'skill.khi'],
  ],
  ['XHBX3kbsiH0G5Jbk', 'Mathematical_Prodigy', ['skill.kar', 'skill.ken']],
  ['cd9vJ6bt1JhaBAwI', 'Child_of_the_Temple', ['skill.kno', 'skill.kre']],
  [
    'bmyLSdEx8P5s7lcP',
    'Scholar_of_the_Great_Beyond',
    ['skill.khi', 'skill.kpl'],
  ],
] as const;
async function pinnedTrait(id: string, name: string): Promise<LoadedRecord> {
  const path = `${traitsDirectory}/${name}_${id}.yaml`;
  return {
    repo: 'pf1-content',
    pack: 'pf-traits',
    path,
    record: upstreamRecord.parse(parse(await readPinned('pf1-content', path))),
  };
}
const mapPinned = (
  source: LoadedRecord,
  records?: readonly TraitClassSkillChoiceRecord[],
) => mapTrait(source.record, `pf1-content/${source.record._id}`, records);
// Explicit review states, whatever the committed list's records are now: the
// record step checks them in place (`catalog-record-review.ts`).
const drafted = (
  record: TraitClassSkillChoiceRecord,
): TraitClassSkillChoiceRecord => ({
  traitKey: record.traitKey,
  bodySha256: record.bodySha256,
  sourceSentence: record.sourceSentence,
  options: record.options,
  status: 'drafted',
});
const checked = (
  record: TraitClassSkillChoiceRecord,
): TraitClassSkillChoiceRecord => ({
  ...drafted(record),
  status: 'checked',
  reviewedBy: 'reviewer',
  reviewedOn: '2026-11-10',
  receipt: `t3-review-${'0'.repeat(64)}`,
});
// A checked record reviewed against another body.
const stale = (
  record: TraitClassSkillChoiceRecord,
): TraitClassSkillChoiceRecord => ({
  ...checked(record),
  bodySha256: 'f'.repeat(64),
});
const committedRecord = (id: string) => {
  const record = reviewedTraitClassSkillChoices.find(
    ({ traitKey }) => traitKey === `pf1-content/${id}`,
  );
  if (!record) throw new Error(`No class-skill choice record for ${id}.`);
  return record;
};

describe('the 19 class-skill traits at the pins', () => {
  it.each(fixed)(
    'maps %s (%s) to its one fixed class skill',
    async (id, name, skill) => {
      const entry = mapPinned(await pinnedTrait(id, name));
      expect(entry.detail).toMatchObject({
        kind: 'trait',
        classSkills: [skill],
      });
      expect(entry.detail).not.toHaveProperty('classSkillChoice');
      expect(issues(entry, 'gameContent')).toEqual([]);
      expect(issues(entry, 'classSkills')).toEqual([]);
    },
  );

  it('never maps Scholar of the Great Beyond’s Foundry default (Knowledge (history)) as a fixed class skill, in any review state', async () => {
    const source = await pinnedTrait(
      'bmyLSdEx8P5s7lcP',
      'Scholar_of_the_Great_Beyond',
    );
    const record = committedRecord('bmyLSdEx8P5s7lcP');
    for (const records of [
      undefined,
      [drafted(record)],
      [checked(record)],
      [stale(record)],
    ]) {
      const entry = mapPinned(source, records);
      const state = records?.[0]?.status ?? 'committed';
      expect(entry.detail, state).not.toHaveProperty('classSkills');
      expect(issues(entry, 'classSkills'), state).toEqual([
        expect.objectContaining({ value: ['khi'] }),
      ]);
      expect(issues(entry, 'gameContent'), state).toEqual([]);
    }
  });

  it.each(choices)(
    'maps %s (%s) end to end: a checked record gives its two options, a drafted one none, a stale one none and an issue',
    async (id, name, options) => {
      const source = await pinnedTrait(id, name);
      const record = committedRecord(id);
      const withChecked = mapPinned(source, [checked(record)]);
      expect(withChecked.detail).toEqual({
        kind: 'trait',
        traitType: expect.any(String),
        classSkillChoice: options,
      });
      expect(issues(withChecked, 'classSkillChoice')).toEqual([]);
      expect(() => importedCatalogEntrySchema.parse(withChecked)).not.toThrow();
      for (const unreviewed of [
        mapPinned(source, [drafted(record)]),
        mapPinned(source, [stale(record)]),
      ]) {
        expect(unreviewed.detail).not.toHaveProperty('classSkills');
        expect(unreviewed.detail).not.toHaveProperty('classSkillChoice');
      }
      expect(
        issues(mapPinned(source, [stale(record)]), 'classSkillChoice'),
      ).toEqual([expect.objectContaining({ value: 'f'.repeat(64) })]);
      expect(
        issues(mapPinned(source, [drafted(record)]), 'classSkillChoice'),
      ).toEqual([]);
    },
  );
});

describe('the reviewed class-skill choice list', () => {
  it('holds the six choice traits, each bound to its pinned body and sentence', async () => {
    expect(
      reviewedTraitClassSkillChoices.map(({ traitKey, options }) => [
        traitKey,
        options,
      ]),
    ).toEqual(
      expect.arrayContaining(
        choices.map(([id, , options]) => [`pf1-content/${id}`, options]),
      ),
    );
    expect(reviewedTraitClassSkillChoices).toHaveLength(choices.length);
    for (const [id, name] of choices) {
      const { record } = await pinnedTrait(id, name);
      const body = sourceDescription(record);
      const row = reviewedTraitClassSkillChoices.find(
        ({ traitKey }) => traitKey === `pf1-content/${id}`,
      );
      expect(row?.bodySha256, name).toBe(sha(body));
      expect(body, name).toContain(row?.sourceSentence);
      // The sentence names each option it gives.
      for (const option of row?.options ?? [])
        expect(row?.sourceSentence, `${name} ${option}`).toContain(
          skillDefinitions.find(({ key }) => key === option)?.name,
        );
    }
  });

  it('gives a checked record’s options to its trait, and none, with an issue, when the body changed', async () => {
    const source = await pinnedTrait(
      'M2CVmyEbiCMIGQwI',
      'Devotee_of_the_Green',
    );
    const record = committedRecord('M2CVmyEbiCMIGQwI');
    const apply = (
      rows: readonly TraitClassSkillChoiceRecord[],
      body = source.record,
    ) => {
      const unsupported: PreviewEntry['unsupported'] = [];
      return {
        ...traitClassSkillChoiceFor({
          externalKey: record.traitKey,
          record: body,
          unsupported,
          records: rows,
        }),
        unsupported,
      };
    };
    expect(apply([checked(record)])).toEqual({
      listed: true,
      options: ['skill.kge', 'skill.kna'],
      unsupported: [],
    });
    expect(apply([drafted(record)])).toEqual({
      listed: true,
      unsupported: [],
    });
    expect(apply([])).toEqual({ listed: false, unsupported: [] });
    const changed = {
      ...source.record,
      system: {
        ...source.record.system,
        description: { value: '<p>Another body.</p>' },
      },
    };
    expect(apply([checked(record)], changed)).toEqual({
      listed: true,
      unsupported: [
        expect.objectContaining({
          field: 'classSkillChoice',
          value: record.bodySha256,
        }),
      ],
    });
  });

  it('refuses a malformed list: a repeated trait, one option, two equal options or a key the sheet lacks', () => {
    const [record] = reviewedTraitClassSkillChoices;
    const list = (traits: unknown[]) =>
      parseTraitClassSkillChoiceList({ version: 1, traits });
    expect(() => list([record, record])).toThrow(/share/);
    for (const options of [
      ['skill.kge'],
      ['skill.kge', 'skill.kge'],
      ['skill.kge', 'skill.art'],
      ['kge', 'kna'],
    ])
      expect(() => list([{ ...record, options }]), String(options)).toThrow(
        ZodError,
      );
  });

  it('lists each record for a review receipt by trait and body, with its sentence and options as the payload', () => {
    const record = drafted(reviewedTraitClassSkillChoices[0]!);
    const [listed, reviewed] = listTraitClassSkillChoiceReviews({
      traits: [record, checked(record)],
    });
    expect(listed).toMatchObject({
      id: `trait-class-skill-choice ${record.traitKey} sha256:${record.bodySha256}`,
      sources: [{ subject: record.traitKey, sourceSha256: record.bodySha256 }],
      review: { status: 'drafted' },
    });
    // Checking a record changes its review, never the payload a receipt covers.
    expect(reviewed).toMatchObject({ review: { status: 'checked' } });
    expect(reviewed?.payloadSha256).toBe(listed?.payloadSha256);
    const [other] = listTraitClassSkillChoiceReviews({
      traits: [{ ...record, options: [record.options[1], record.options[0]] }],
    });
    expect(other?.payloadSha256).not.toBe(listed?.payloadSha256);
  });
});
