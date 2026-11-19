// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  decodeLegalRecord,
  encodeLegalRecord,
  isEncodedLegalRecord,
  legalRecordEncodingRefusal,
  legalRecordLiteralFields,
  parseLegalRecordText,
} from '../../src/lib/catalog/legal-record-codec';
import { readLegalRecord } from '../../scripts/catalog/legal-records';

// The encoding stores each repeated entry, then each repeated text, once
// inside the record's own file (owner decision 2026-11-15, option b). The
// proof standard is the decoded value: every value and key order, compared as
// the serialised string, never sorted.
const sameValue = (left: unknown, right: unknown) =>
  expect(JSON.stringify(left)).toBe(JSON.stringify(right));
const id = (text: string) =>
  createHash('sha256').update(text).digest('hex').slice(0, 24);
/** A text's id: the hash of its JSON form, which keeps lone surrogates apart. */
const textId = (text: string) => id(JSON.stringify(text));
const body = (topic: string) =>
  `${topic}: `.padEnd(
    160,
    'The spell body text repeats for each linked record. ',
  );

/** Two candidates sharing one audit entry, one body text and a comparison. */
function syntheticRecord() {
  const audit = {
    book: 'Advanced Player’s Guide',
    reason: 'The body names a rule this book introduces.',
    evidence: body('Audit evidence'),
  };
  const comparison = {
    source: 'pinned/pf1/spells.db',
    text: body('Comparison text, read by the matcher'),
  };
  const candidate = (externalKey: string) => ({
    externalKey,
    name: `Spell ${externalKey}`,
    disposition: 'held',
    comparison,
    requiredNotices: ['apg', 'core', 'ultimate-magic'],
    auditNoticeReview: [audit, { ...audit, book: 'Ultimate Magic' }],
    fullContentReview: { descriptionText: body('Description'), externalKey },
    mechanicsReview: { curationRecords: [{ text: body('Description') }] },
  });
  return {
    reviewedBy: 'curator',
    holds: [{ id: 'hold-1', status: 'open', reason: body('Hold reason') }],
    notes: body('Hold reason'),
    candidates: [candidate('pf1/a'), candidate('pf1/b'), candidate('pf1/c')],
  };
}

/** The stored file for `value`, parsed back into its JSON form. */
const stored = (value: unknown) =>
  JSON.parse(encodeLegalRecord(value)) as {
    encoding: string;
    entries: Record<string, unknown>;
    texts: Record<string, string>;
    value: { candidates: Record<string, unknown>[] } & Record<string, unknown>;
  };

describe('the legal record codec', () => {
  it('stores a repeated entry and a repeated text once and decodes to the same value', () => {
    const record = syntheticRecord();
    const file = stored(record);
    expect(Object.keys(file)).toEqual([
      'encoding',
      'entries',
      'texts',
      'value',
    ]);
    expect(file.encoding).toBe('legal-record-v1');
    // The audit entry repeats in every candidate, so it is stored once and
    // each candidate refers to it by the hash of its compact JSON.
    const auditId = id(JSON.stringify(record.candidates[0]?.auditNoticeReview));
    expect(file.value.candidates.map((row) => row.auditNoticeReview)).toEqual([
      { $entry: auditId },
      { $entry: auditId },
      { $entry: auditId },
    ]);
    // The description repeats inside each candidate and across them.
    const descriptionId = textId(body('Description'));
    expect(file.texts[descriptionId]).toBe(body('Description'));
    expect(file.value.candidates[0]?.fullContentReview).toEqual({
      descriptionText: { $text: descriptionId },
      externalKey: 'pf1/a',
    });
    sameValue(parseLegalRecordText(encodeLegalRecord(record)), record);
  });

  it('keeps every field a production reader reads, and everything outside the candidates, literal', () => {
    const record = syntheticRecord();
    const file = stored(record);
    for (const row of file.value.candidates) {
      expect(row.comparison).toEqual(record.candidates[0]?.comparison);
      expect(row.requiredNotices).toEqual(['apg', 'core', 'ultimate-magic']);
    }
    expect(file.value.holds).toEqual(record.holds);
    expect(file.value.notes).toBe(body('Hold reason'));
    expect(legalRecordLiteralFields).toEqual(
      expect.arrayContaining([
        'externalKey',
        'disposition',
        'holdIds',
        'noticeHoldIds',
        'requiredNotices',
        'comparison',
        'inheritedRuleNotices',
        'source',
      ]),
    );
  });

  it('writes each reference on one line, both stores sorted by id', () => {
    const text = encodeLegalRecord(syntheticRecord());
    expect(text).toMatch(
      /"auditNoticeReview": \{"\$entry": "[0-9a-f]{24}"\},\n/,
    );
    expect(text.endsWith('}\n')).toBe(true);
    const file = stored(syntheticRecord());
    for (const store of [file.entries, file.texts])
      expect(Object.keys(store)).toEqual(Object.keys(store).sort());
  });

  it('writes a record with nothing repeated in its plain form', () => {
    const record = { candidates: [{ externalKey: 'pf1/a', note: 'short' }] };
    expect(encodeLegalRecord(record)).toBe(
      `${JSON.stringify(record, null, 2)}\n`,
    );
  });

  it('is deterministic and idempotent', () => {
    const text = encodeLegalRecord(syntheticRecord());
    expect(encodeLegalRecord(syntheticRecord())).toBe(text);
    // Encoding the stored form again decodes it first: the same bytes.
    expect(encodeLegalRecord(JSON.parse(text))).toBe(text);
  });

  it('reads a plain record as itself', () => {
    const plain = syntheticRecord();
    expect(decodeLegalRecord(plain)).toBe(plain);
    for (const value of [[1, 2], 'text', null, { encoding: 'other' }])
      expect(decodeLegalRecord(value)).toBe(value);
  });

  describe('refuses a stored file', () => {
    const file = () => stored(syntheticRecord());
    const firstEntry = (value: ReturnType<typeof file>) =>
      Object.keys(value.entries)[0] ?? '';
    const firstText = (value: ReturnType<typeof file>) =>
      Object.keys(value.texts)[0] ?? '';

    it('with a missing entry or text', () => {
      const entry = file();
      const gone = (
        entry.value.candidates[0]?.auditNoticeReview as { $entry: string }
      ).$entry;
      delete entry.entries[gone];
      expect(() => decodeLegalRecord(entry)).toThrow(
        `Legal record entry ${gone} referenced by candidates[0].auditNoticeReview is missing.`,
      );
      const text = file();
      const missing = firstText(text);
      delete text.texts[missing];
      expect(() => decodeLegalRecord(text)).toThrow(
        new RegExp(
          `Legal record text ${missing} referenced by .+ is missing\\.`,
        ),
      );
    });

    it('whose stored entry or text does not match its id', () => {
      const entry = file();
      const edited = firstEntry(entry);
      entry.entries[edited] = [{ book: 'Edited by hand' }];
      expect(() => decodeLegalRecord(entry)).toThrow(
        `Legal record entry ${edited} does not match its hash.`,
      );
      const text = file();
      const changed = firstText(text);
      text.texts[changed] = 'Edited by hand';
      expect(() => decodeLegalRecord(text)).toThrow(
        `Legal record text ${changed} does not match its hash.`,
      );
    });

    it('with an entry or text nothing refers to', () => {
      const entry = file();
      entry.entries[id('unused')] = ['unused'];
      expect(() => decodeLegalRecord(entry)).toThrow(
        `Legal record entry ${id('unused')} is not referenced.`,
      );
      const text = file();
      text.texts[id('unused')] = 'unused';
      expect(() => decodeLegalRecord(text)).toThrow(
        `Legal record text ${id('unused')} is not referenced.`,
      );
    });

    it('whose entries refer to each other in a cycle', () => {
      const value = file();
      const [a, b] = [id('a'), id('b')];
      value.entries = {
        [a]: { next: { $entry: b } },
        [b]: { next: { $entry: a } },
      };
      value.texts = {};
      value.value = {
        candidates: [{ externalKey: 'pf1/a', review: { $entry: a } }],
      };
      expect(() => decodeLegalRecord(value)).toThrow(
        `Legal record entry ${a} refers to itself.`,
      );
    });

    it('with a reference in a field that stays literal', () => {
      const value = file();
      const text = firstText(value);
      value.value.candidates[0] = {
        ...value.value.candidates[0],
        comparison: { text: { $text: text } },
      };
      expect(() => decodeLegalRecord(value)).toThrow(
        'Legal record reference at candidates[0].comparison.text is in a field that stays literal.',
      );
      const outside = file();
      outside.value.notes = { $text: firstText(outside) };
      expect(() => decodeLegalRecord(outside)).toThrow(
        'Legal record reference at notes is in a field that stays literal.',
      );
    });
  });

  it('refuses to encode a record holding a value shaped like a reference', () => {
    expect(() =>
      encodeLegalRecord({
        candidates: [{ externalKey: 'pf1/a', review: { $text: 'abc' } }],
      }),
    ).toThrow(
      'Legal record value at candidates[0].review is shaped like a reference; it cannot be encoded.',
    );
    expect(() =>
      encodeLegalRecord({
        candidates: [{ externalKey: 'pf1/a', comparison: [{ $entry: 1 }] }],
      }),
    ).toThrow(
      'Legal record value at candidates[0].comparison[0] is shaped like a reference; it cannot be encoded.',
    );
  });

  // The codec's contract is narrow, not total over JSON: what it could not
  // round-trip, it refuses by name, and dual read never misreads a plain record.
  describe('outside its contract', () => {
    const wrapperShaped = { encoding: 'legal-record-v1', candidates: [] };

    it('reads a plain record that carries the encoding key as itself', () => {
      expect(decodeLegalRecord(wrapperShaped)).toBe(wrapperShaped);
      expect(isEncodedLegalRecord(wrapperShaped)).toBe(false);
      // Only the whole wrapper, each member of its type, is the encoded form.
      for (const value of [
        { encoding: 'legal-record-v1', entries: {}, texts: {} },
        { encoding: 'legal-record-v1', entries: [], texts: {}, value: {} },
        { encoding: 'legal-record-v1', entries: {}, texts: [], value: {} },
        {
          encoding: 'legal-record-v1',
          entries: {},
          texts: { a: 1 },
          value: {},
        },
        { encoding: 'legal-record-v2', entries: {}, texts: {}, value: {} },
        {
          encoding: 'legal-record-v1',
          entries: {},
          texts: {},
          value: {},
          extra: 1,
        },
      ]) {
        expect(isEncodedLegalRecord(value)).toBe(false);
        expect(decodeLegalRecord(value)).toBe(value);
      }
    });

    it('knows the encoded form whatever its key order', () => {
      const file = stored(syntheticRecord());
      const reordered = {
        value: file.value,
        texts: file.texts,
        entries: file.entries,
        encoding: file.encoding,
      };
      expect(isEncodedLegalRecord(reordered)).toBe(true);
      sameValue(decodeLegalRecord(reordered), syntheticRecord());
    });

    it('refuses by name to encode a plain record that carries the encoding key', () => {
      const message =
        'Legal record has the encoded form\'s top-level key encoding: "legal-record-v1"; it cannot be encoded.';
      expect(legalRecordEncodingRefusal(wrapperShaped)).toBe(message);
      expect(() => encodeLegalRecord(wrapperShaped)).toThrow(message);
    });

    it('names the first value shaped like a reference', () => {
      expect(
        legalRecordEncodingRefusal({
          notes: [{ $entry: 'x' }],
          candidates: [],
        }),
      ).toBe(
        'Legal record value at notes[0] is shaped like a reference; it cannot be encoded.',
      );
      expect(legalRecordEncodingRefusal(syntheticRecord())).toBeUndefined();
    });
  });

  // Ids are content hashes of an exact form: a text's JSON keeps lone
  // surrogates distinct, where its UTF-8 bytes would not.
  describe('never gives one id to different content', () => {
    const prefix = (unit: string) => `${'body '.repeat(40)}${unit}`;

    it.each([
      [
        'two lone surrogates',
        [prefix('\ud800'), prefix('\ud801')],
        [0, 1, 0, 1],
      ],
      [
        'a lone surrogate and the replacement character',
        [prefix('\ud800'), prefix('\ufffd')],
        [0, 0, 1, 1],
      ],
    ])('round-trips %s exactly', (_, texts, order) => {
      const record = {
        candidates: [
          { externalKey: 'pf1/a', review: order.map((index) => texts[index]) },
        ],
      };
      const file = stored(record);
      expect(Object.keys(file.texts).sort()).toEqual(texts.map(textId).sort());
      const decoded = decodeLegalRecord(file) as typeof record;
      expect(decoded.candidates[0]?.review).toStrictEqual(
        record.candidates[0]?.review,
      );
      expect(encodeLegalRecord(file)).toBe(encodeLegalRecord(record));
    });

    it('keeps refusing a stored text whose id is not its content hash', () => {
      const [a = '', b = ''] = [prefix('\ud800'), prefix('\ud801')];
      const file = stored({
        candidates: [{ externalKey: 'pf1/a', review: [a, a] }],
      });
      file.texts[textId(a)] = b;
      expect(() => decodeLegalRecord(file)).toThrow(
        `Legal record text ${textId(a)} does not match its hash.`,
      );
    });

    it('refuses by name two contents whose ids collide', async () => {
      vi.resetModules();
      vi.doMock('node:crypto', () => ({
        createHash: () => ({
          update() {
            return this;
          },
          digest: () => 'c'.repeat(64),
        }),
      }));
      try {
        const codec = await import('../../src/lib/catalog/legal-record-codec');
        const [a, b] = [body('First'), body('Second')];
        expect(() =>
          codec.encodeLegalRecord({
            candidates: [{ externalKey: 'pf1/a', review: [a, b, a, b] }],
          }),
        ).toThrow(
          `Legal record texts collide on id ${'c'.repeat(24)}; it cannot be encoded.`,
        );
        const [left, right] = [
          { book: 'One', reason: body('Left') },
          { book: 'Two', reason: body('Right') },
        ];
        expect(() =>
          codec.encodeLegalRecord({
            candidates: [
              { externalKey: 'pf1/a', review: [left, right] },
              { externalKey: 'pf1/b', review: [left, right] },
            ],
          }),
        ).toThrow(
          `Legal record entries collide on id ${'c'.repeat(24)}; it cannot be encoded.`,
        );
      } finally {
        vi.doUnmock('node:crypto');
        vi.resetModules();
      }
    });
  });

  // Temporary encodings of committed records, read through the loader in
  // whichever form they are stored: nothing is written back.
  it.each([
    ['a Spells record', () => readLegalRecord('spells-528.json')],
    ['a small record', () => readLegalRecord('monster-abilities-506.json')],
  ])(
    'round-trips %s to the same value, smaller than its plain form',
    (_, read) => {
      const value = read();
      const encoded = encodeLegalRecord(value);
      expect(JSON.parse(encoded)).toHaveProperty('encoding', 'legal-record-v1');
      expect(encoded.length).toBeLessThan(
        JSON.stringify(value, null, 2).length,
      );
      sameValue(parseLegalRecordText(encoded), value);
      expect(encodeLegalRecord(JSON.parse(encoded))).toBe(encoded);
    },
  );
});
