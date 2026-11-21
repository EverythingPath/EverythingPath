// rotation-6: a rule-value record (`scripts/catalog/curation.ts`) carries the
// new optional fields through the shared schema: `oncePerSource` and `choice`
// on an increase, `joins` on a per-day maximum, and refuses each elsewhere.
// The records are test fixtures; no committed record carries a new field.
import { describe, expect, it } from 'vitest';
import {
  applyRuleValueCuration,
  hashText,
  parseCuration,
  type RuleValueRecord,
} from '../../scripts/catalog/curation';
import type { PreviewEntry } from '../../scripts/catalog/map';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';

const drafted = (ruleValue: unknown) => ({
  externalKey: 'pf1/pgRX4VpFemwv9R0E',
  descriptionSha256: 'a'.repeat(64),
  outputs: [{ kind: 'ruleValue', ruleValue }],
  rationale: 'A fixture.',
  status: 'drafted',
});
const overlay = (ruleValue: unknown) =>
  parseCuration({ records: [], ruleValues: [drafted(ruleValue)] });

describe('a rule-value record with the rotation-6 fields', () => {
  it.each([
    {
      kind: 'dailyMaximumIncrease',
      key: 'classFeat_channelEnergy',
      amount: 2,
      choice: ['Cleric'],
      oncePerSource: true,
    },
    {
      kind: 'diceIncrease',
      key: 'classFeat_channelEnergy',
      amount: 2,
      oncePerSource: true,
    },
    {
      kind: 'dailyMaximum',
      key: 'classFeat_rage',
      unit: 'rounds',
      amount: { formula: '@classLevel.cleric' },
      joins: true,
    },
  ])('parses $kind with its fields', (ruleValue) => {
    expect(overlay(ruleValue).ruleValues?.[0]?.outputs).toEqual([
      { kind: 'ruleValue', ruleValue },
    ]);
  });

  it.each([
    { kind: 'dice', die: 6, amount: 1, oncePerSource: true },
    {
      kind: 'dailyMaximum',
      key: 'k',
      unit: 'uses',
      amount: 1,
      choice: ['Cleric'],
    },
    { kind: 'dailyMaximumIncrease', key: 'k', amount: 1, joins: true },
  ])('refuses $kind with a field it does not take', (ruleValue) => {
    expect(() => overlay(ruleValue)).toThrow(/ruleValue|rule values|Invalid/);
  });

  it.each([
    { kind: 'dailyMaximumIncrease', key: 'k', amount: 1, choice: [] },
    { kind: 'diceIncrease', key: 'k', amount: 1, oncePerSource: false },
  ])(
    'refuses $kind with a field it takes but a value the field does not allow',
    (ruleValue) => {
      expect(() => overlay(ruleValue)).toThrow(/ruleValue|rule values|Invalid/);
    },
  );
});

// rotation-6 fix r3 (root, 2026-11-20): nothing about an entry's kind is
// checked when a rule value is written, so an increase for a choice on an
// item passes the imported entry schema (release staging) and the curation
// application as on a feat; the read never counts it: an item saves no
// choice of its own (its abilities may each save one, read only for the
// ability), and the calculation reads no choice for it
// (`character-sheet-increase-choice-recording.test.ts`).
const importedEntry = (detail: unknown, ruleValue: unknown) => ({
  externalKey: 'pf1/fixture',
  upstreamKey: 'pf1/fixture',
  pack: 'items',
  name: 'Fixture',
  detail,
  description: '',
  sources: [],
  modifiers: [],
  ruleValues: [ruleValue],
  unsupported: [],
});
const choiceIncrease = {
  kind: 'dailyMaximumIncrease',
  key: 'classFeat_channelEnergy',
  amount: 1,
  choice: ['Cleric'],
};
const itemDetail = { kind: 'item', consumable: false, price: 0, weight: 0 };

describe('an increase for a choice on an item', () => {
  it('passes the imported entry schema', () => {
    expect(
      importedCatalogEntrySchema.safeParse(
        importedEntry(itemDetail, choiceIncrease),
      ).success,
    ).toBe(true);
  });

  it('is applied by the curation application', () => {
    const entry = {
      ...importedEntry(itemDetail, choiceIncrease),
      ruleValues: undefined,
    } as unknown as PreviewEntry;
    const record = {
      externalKey: 'pf1/fixture',
      descriptionSha256: hashText(''),
      outputs: [{ kind: 'ruleValue', ruleValue: choiceIncrease }],
      rationale: 'A fixture.',
      status: 'checked',
      reviewedBy: 'cross-model review',
      reviewedOn: '2026-11-20',
      receipt:
        't3-review-0000000000000000000000000000000000000000000000000000000000000000',
    } as unknown as RuleValueRecord;
    expect(
      applyRuleValueCuration({ records: [record], entries: [entry] }),
    ).toEqual([{ externalKey: 'pf1/fixture', status: 'applied' }]);
    expect(entry.ruleValues).toEqual([choiceIncrease]);
  });
});
