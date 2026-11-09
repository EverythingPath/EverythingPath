// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { computeFingerprint } from '../../scripts/catalog/admission';
import {
  catalogDataFiles,
  formatCatalogData,
  parseCatalogDataText,
  serializeCatalogData,
} from '../../scripts/catalog/data-files';
import { reviewedAdmissionSchema } from '../../src/lib/catalog/admission-schema';
import {
  decodeAttributionEvidence,
  encodeAttributionEvidence,
  parseReviewedAdmissionInput,
  readAttributionEvidence,
  type AttributionEvidenceEntries,
} from '../../src/lib/catalog/attribution-evidence-codec';

// The plain-map evidence file this encoding replaced (#744), at #770A
// (`50c8a1da`), and the encoded file `pnpm catalog:format` migrated it to
// (`55155e04`). Both are read by blob, so the proof survives a squash and
// every later curation change.
const baseBlob = '9a4368e3ccc86b5d51a3102378db675e4885ee3b';
const migratedBlob = '29b4ac3b446212b9d00148d139f315ee889c341b';

function git(args: string[]) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  });
}
// The two blobs are history only the gate host has: CI checks out a tree-only
// commit (owner 2026-11-02), so the tests that read them are host audits
// (scripts/orchestration/host-audits.json) and skip only when a blob is absent.
function hasBlob(blob: string) {
  try {
    execFileSync('git', ['cat-file', '-e', `${blob}^{blob}`], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}
const withoutHistory = ![baseBlob, migratedBlob].every(hasBlob);
const blobId = (text: string) =>
  createHash('sha256').update(text).digest('hex').slice(0, 24);
const sentence = (n: number) =>
  Array.from({ length: n }, (_, i) => `Sentence ${i} of the source body.`).join(
    ' ',
  );

let baseText: string | undefined;
function baseEvidence() {
  baseText ??= git(['cat-file', 'blob', baseBlob]);
  return baseText;
}

it.skipIf(withoutHistory)(
  'decodes the migrated file to the exact bytes of the plain map it replaced',
  () => {
    const migrated = git(['cat-file', 'blob', migratedBlob]);
    const decoded = decodeAttributionEvidence(JSON.parse(migrated));
    expect(serializeCatalogData('evidence', decoded) === baseEvidence()).toBe(
      true,
    );
  },
  120_000,
);

it('keeps the committed file canonical: decoding and re-encoding it changes nothing', async () => {
  const committed = await readFile(catalogDataFiles.evidence, 'utf8');
  const decoded = decodeAttributionEvidence(JSON.parse(committed));
  expect(formatCatalogData('evidence', decoded) === committed).toBe(true);
}, 120_000);

it('keeps whitespace around and between the JSON parts, and every evidence fingerprint', () => {
  const body = { body: sentence(30), list: [sentence(20), 1.0] };
  const compact = JSON.stringify(body);
  const indented = JSON.stringify(body, null, 2);
  const entries = {
    compact: { content: `  ${compact}\n` },
    indented: { content: `\n${indented}\n\n` },
    header: {
      content: `#1 header\n  ${JSON.stringify({ body: 'x'.repeat(600) })}\n`,
    },
    'header-indented': { content: `#1 header\n\t${indented} \n` },
  };
  const encoded = encodeAttributionEvidence(entries);
  for (const entry of Object.values(encoded.evidence))
    expect(entry.parts?.some((part) => typeof part !== 'string')).toBe(true);
  const decoded = decodeAttributionEvidence(
    JSON.parse(JSON.stringify(encoded)),
  );
  for (const [id, entry] of Object.entries(entries))
    expect(decoded[id]?.content).toBe(entry.content);
  const fingerprints = (value: unknown) =>
    Object.fromEntries(
      Object.entries(reviewedAdmissionSchema.shape.evidence.parse(value)).map(
        ([id, entry]) => [id, computeFingerprint(entry)],
      ),
    );
  expect(fingerprints(decoded)).toEqual(fingerprints(entries));
});

it('refuses an evidence ID or blob that the raw text names twice', () => {
  const entry = (text: string) => `{ "content": "${text}" }`;
  const text = JSON.stringify(sentence(30));
  const id = blobId(text);
  const refusals: [string, RegExp][] = [
    [
      `{ "evidence": { "e": ${entry('A.')}, "e": ${entry('B.')} }, "shared": {} }`,
      /Duplicate attribution evidence key "e" at evidence\./,
    ],
    [
      `{ "e": ${entry('A.')}, "\\u0065": ${entry('B.')} }`,
      /Duplicate attribution evidence key "e" at the root\./,
    ],
    [
      `{ "evidence": { "e": { "parts": ["[", { "ref": "${id}" }, "]"] } }, "shared": { "${id}": [${JSON.stringify(text)}], "${id}": [${JSON.stringify(text)}] } }`,
      new RegExp(`Duplicate attribution evidence key "${id}" at shared\\.`),
    ],
  ];
  for (const [raw, message] of refusals)
    expect(() => parseCatalogDataText('evidence', raw)).toThrow(message);
  expect(parseCatalogDataText('evidence', `{ "e": ${entry('A.')} }`)).toEqual({
    e: { content: 'A.' },
  });
  const admission = (evidence: string) =>
    `{ "assessments": [], "registry": {}, "evidence": ${evidence} }`;
  expect(() =>
    parseReviewedAdmissionInput(
      admission(`{ "e": ${entry('A.')}, "e": ${entry('B.')} }`),
    ),
  ).toThrow(/Duplicate attribution evidence key "e" at evidence\./);
  expect(
    parseReviewedAdmissionInput(admission(`{ "e": ${entry('A.')} }`)),
  ).toEqual({
    assessments: [],
    registry: {},
    evidence: { e: { content: 'A.' } },
  });
});

it.skipIf(withoutHistory)(
  'keeps float literals, prose, header lines, revocations and conclusions byte for byte',
  () => {
    const entries = JSON.parse(baseEvidence()) as AttributionEvidenceEntries;
    const picked = [
      'items-431-KKVx0R4EH17PZonh',
      'crb-conditions-311',
      'spells-530-g3r3q4rx6zh846zq',
      'spells-529-eucwnai4r3awfl5m',
      'race-740-extraction-FHY3oIk5zSOFncJH',
    ];
    const selection = Object.fromEntries(
      picked.map((id) => [id, entries[id] ?? { content: '' }]),
    );
    expect(selection['items-431-KKVx0R4EH17PZonh']?.content).toMatch(
      /:1\.0[,}]/,
    );
    const encoded = encodeAttributionEvidence(selection);
    const decoded = decodeAttributionEvidence(
      JSON.parse(JSON.stringify(encoded)),
    );
    expect(Object.keys(decoded)).toEqual(picked.slice().sort());
    for (const id of picked)
      expect(JSON.stringify(decoded[id])).toBe(JSON.stringify(selection[id]));

    const [prose, header, revoked, concluded, float] = [
      'crb-conditions-311',
      'spells-530-g3r3q4rx6zh846zq',
      'spells-529-eucwnai4r3awfl5m',
      'race-740-extraction-FHY3oIk5zSOFncJH',
      'items-431-KKVx0R4EH17PZonh',
    ].map((id) => encoded.evidence[id]);
    expect(prose).toEqual({ content: entries['crb-conditions-311']?.content });
    const headerLine = `${entries['spells-530-g3r3q4rx6zh846zq']?.content.split('\n')[0]}\n`;
    const [headerPart] = header?.parts ?? [];
    expect(headerLine).toMatch(/^#530 /);
    expect(
      typeof headerPart === 'string' && headerPart.startsWith(headerLine),
    ).toBe(true);
    expect(Object.keys(revoked ?? {}).at(-1)).toBe('revoked');
    expect(revoked?.revoked).toBe(false);
    expect(concluded?.conclusion).toEqual(
      entries['race-740-extraction-FHY3oIk5zSOFncJH']?.conclusion,
    );
    expect(float?.parts?.some((part) => typeof part !== 'string')).toBe(true);
  },
);

it('stores every JSON value of 512 bytes or more once, as a nested hash-named blob', () => {
  const body = sentence(30);
  const record = { name: 'Bless', body, nested: { body, short: 'x' } };
  const content = JSON.stringify({ first: record, second: record });
  const encoded = encodeAttributionEvidence({ e: { content } });
  const bodyText = JSON.stringify(body);
  const recordText = JSON.stringify(record);
  expect(encoded.shared).toEqual({
    [blobId(bodyText)]: [bodyText],
    [blobId(JSON.stringify(record.nested))]: [
      '{"body":',
      { ref: blobId(bodyText) },
      ',"short":"x"}',
    ],
    [blobId(recordText)]: [
      '{"name":"Bless","body":',
      { ref: blobId(bodyText) },
      ',"nested":',
      { ref: blobId(JSON.stringify(record.nested)) },
      '}',
    ],
  });
  expect(encoded.evidence.e).toEqual({
    parts: [
      '{"first":',
      { ref: blobId(recordText) },
      ',"second":',
      { ref: blobId(recordText) },
      '}',
    ],
  });
  expect(decodeAttributionEvidence(encoded)).toEqual({ e: { content } });
  // Nothing large enough to share stays inline, whatever its kind.
  expect(
    encodeAttributionEvidence({ small: { content: '{"a":[1.0,2]}' } }),
  ).toEqual({ evidence: { small: { content: '{"a":[1.0,2]}' } }, shared: {} });
});

it('encodes each entry from its own content, whatever the entry order', () => {
  const body = JSON.stringify({ text: sentence(30) });
  const entries = {
    beta: { content: `#1 header\n${body}` },
    alpha: { content: body, revoked: true },
  };
  const forward = encodeAttributionEvidence(entries);
  const reversed = encodeAttributionEvidence({
    alpha: entries.alpha,
    beta: entries.beta,
  });
  expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward));
  expect(Object.keys(forward.evidence)).toEqual(['alpha', 'beta']);
  expect(
    encodeAttributionEvidence({ beta: entries.beta }).evidence.beta,
  ).toEqual(forward.evidence.beta);
  expect(formatCatalogData('evidence', entries)).toBe(
    formatCatalogData('evidence', forward),
  );
});

it('reads the plain map and the encoded file alike, and refuses anything else', () => {
  const plain = { e: { content: 'Prose.' } };
  expect(readAttributionEvidence(plain)).toEqual(plain);
  expect(readAttributionEvidence({ evidence: plain, shared: {} })).toEqual(
    plain,
  );
  expect(() => decodeAttributionEvidence(plain)).toThrow(/evidence/);
  // `--attribution PATH` inputs carry either form under `evidence`.
  const admission = { assessments: [], registry: {} };
  expect(
    parseReviewedAdmissionInput(
      JSON.stringify({
        ...admission,
        evidence: encodeAttributionEvidence(plain),
      }),
    ),
  ).toEqual({ ...admission, evidence: plain });
  expect(
    parseReviewedAdmissionInput(
      JSON.stringify({ ...admission, evidence: plain }),
    ),
  ).toEqual({ ...admission, evidence: plain });
  expect(parseReviewedAdmissionInput('[]')).toEqual([]);
});

it('refuses dangling, mismatched, orphaned, cyclic and malformed blobs', () => {
  const text = JSON.stringify(sentence(30));
  const id = blobId(text);
  const other = blobId('other');
  const file = (evidence: unknown, shared: unknown) => ({ evidence, shared });
  const refusals: [unknown, RegExp][] = [
    [
      file({ e: { parts: ['[', { ref: id }, ']'] } }, {}),
      new RegExp(`blob ${id} referenced by e is missing`),
    ],
    [
      file({ e: { parts: ['[', { ref: id }, ']'] } }, { [id]: ['"changed"'] }),
      new RegExp(`blob ${id} does not match its hash`),
    ],
    [
      file({ e: { content: 'Prose.' } }, { [id]: [text] }),
      new RegExp(`blob ${id} is not referenced`),
    ],
    [
      file(
        { e: { parts: [{ ref: id }] } },
        { [id]: [{ ref: other }], [other]: [{ ref: id }] },
      ),
      /refers to itself/,
    ],
    [
      file({ e: { content: 'Prose.', parts: ['Prose.'] } }, {}),
      /e has both content and parts/,
    ],
    [file({ e: {} }, {}), /e has neither content nor parts/],
    [file({ e: { parts: ['[', 1, ']'] } }, {}), /evidence/],
    [file({ e: { content: 'x', source: 'y' } }, {}), /source/],
    [{ ...file({}, {}), extra: true }, /extra/],
  ];
  for (const [value, message] of refusals)
    expect(() => decodeAttributionEvidence(value)).toThrow(message);
  expect(() =>
    encodeAttributionEvidence({ e: { content: 'x', source: 'y' } }),
  ).toThrow(/source/);
});
