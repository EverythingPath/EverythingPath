// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import {
  catalogDataFiles,
  checkCatalogDataFiles,
  formatCatalogData,
  type CatalogDataFile,
} from '../../scripts/catalog/data-files';
import { runCapturedProcess } from '../../scripts/catalog/process';

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

function note(externalKey: string, text: string) {
  return {
    externalKey,
    kind: 'note',
    target: 'save.will',
    text,
    textSha256: createHash('sha256').update(text).digest('hex'),
    status: 'drafted',
    outputs: [
      { kind: 'note', text: 'Second.' },
      { kind: 'note', text: 'First.' },
    ],
    rationale: 'Drafted.',
    diagnostics: [],
    seedBindings: [],
  };
}
function situation(key: string, aliases: string[]) {
  return {
    key,
    label: key,
    aliases,
    reviewedBy: 'Reviewer',
    reviewedOn: '2026-10-07',
  };
}
function hold(id: string, notices: string[]) {
  return { id, notices, evidence: ['scripts/catalog/legal/example.json'] };
}

it('keeps every committed catalog data file canonical', async () => {
  expect(await checkCatalogDataFiles(resolve('.'))).toEqual([]);
});

it('sorts top-level collections by identity, whatever the input order, and is idempotent', () => {
  const records = [
    note('pf1/Zed', '+2 vs. fear'),
    note('pf1/Alpha', '+1 vs. fear'),
    note('pf1/Alpha', '+1 vs. poison'),
  ];
  const situations = [situation('poison', []), situation('fear', ['fear'])];
  const forward = formatCatalogData('curation', { records, situations });
  const reversed = formatCatalogData('curation', {
    situations: [...situations].reverse(),
    records: [...records].reverse(),
  });
  expect(reversed).toBe(forward);
  expect(formatCatalogData('curation', JSON.parse(forward))).toBe(forward);
  const parsed = JSON.parse(forward) as {
    records: { externalKey: string; text: string }[];
    situations: { key: string }[];
  };
  expect(Object.keys(parsed)).toEqual(['records', 'situations']);
  expect(parsed.records.map((record) => record.externalKey)).toEqual([
    'pf1/Alpha',
    'pf1/Alpha',
    'pf1/Zed',
  ]);
  expect(parsed.situations.map((entry) => entry.key)).toEqual([
    'fear',
    'poison',
  ]);
  const holds = [hold('b', ['PZO2']), hold('a', ['PZO9', 'PZO1'])];
  expect(JSON.parse(formatCatalogData('heldNotices', holds))).toEqual([
    hold('a', ['PZO9', 'PZO1']),
    hold('b', ['PZO2']),
  ]);
  const evidence = { zeta: { content: 'Z' }, alpha: { content: 'A' } };
  const formatted = JSON.parse(formatCatalogData('evidence', evidence)) as {
    evidence: object;
  };
  expect(Object.keys(formatted)).toEqual(['evidence', 'shared']);
  expect(Object.keys(formatted.evidence)).toEqual(['alpha', 'zeta']);
});

it('sorts #716 structure records by binding and leaves out an empty collection', () => {
  const sha = (text: string) => createHash('sha256').update(text).digest('hex');
  const structure = (externalKey: string, fields: Record<string, unknown>) => ({
    rationale: 'Drafted.',
    status: 'drafted',
    fields,
    sourceSha256: sha(externalKey),
    externalKey,
  });
  const structures = [
    structure('everythingpath/fighter-archer-weapon-mastery', {
      'detail.part': '20',
      'detail.parentFeature': 'pf1/McXAM1BoPHZLO1n4',
    }),
    structure('everythingpath/fighter-archer', {
      sources: [{ pages: '104', book: "Advanced Player's Guide" }],
    }),
  ];
  const forward = formatCatalogData('curation', { records: [], structures });
  expect(
    formatCatalogData('curation', {
      records: [],
      structures: [...structures].reverse(),
    }),
  ).toBe(forward);
  const parsed = JSON.parse(forward) as {
    structures: { externalKey: string; fields: object }[];
  };
  expect(parsed.structures.map((record) => record.externalKey)).toEqual([
    'everythingpath/fighter-archer',
    'everythingpath/fighter-archer-weapon-mastery',
  ]);
  expect(Object.keys(parsed.structures[0] ?? {})).toEqual([
    'externalKey',
    'sourceSha256',
    'fields',
    'status',
    'rationale',
  ]);
  expect(Object.keys(parsed.structures[1]?.fields ?? {})).toEqual([
    'detail.parentFeature',
    'detail.part',
  ]);
  const empty: object = JSON.parse(
    formatCatalogData('curation', { records: [], structures: [] }),
  );
  expect(Object.keys(empty)).toEqual(['records', 'situations']);
});

it('orders fields by schema, sorts identity maps and keeps nested arrays as authored', () => {
  const shuffled = Object.fromEntries(
    Object.entries(note('pf1/Alpha', '+1 vs. fear')).reverse(),
  );
  const text = formatCatalogData('curation', {
    situations: [],
    records: [
      { ...shuffled, reviewedBy: 'Reviewer', reviewedOn: '2026-10-07' },
    ],
  });
  const [written] = (JSON.parse(text) as { records: object[] }).records;
  expect(Object.keys(written!)).toEqual([
    'externalKey',
    'kind',
    'target',
    'text',
    'textSha256',
    'status',
    'outputs',
    'rationale',
    'diagnostics',
    'reviewedBy',
    'reviewedOn',
    'seedBindings',
  ]);
  expect(written).toMatchObject({
    outputs: [{ text: 'Second.' }, { text: 'First.' }],
  });
  const assessment = {
    reviewedOn: '2026-10-07',
    reviewedBy: 'Reviewer',
    rationale: 'Reviewed.',
    requiredNotices: ['PZO9', 'CRB'],
    noticeFingerprints: { PZO9: 'b'.repeat(64), CRB: 'a'.repeat(64) },
    evidenceFingerprints: { zeta: 'c'.repeat(64), alpha: 'd'.repeat(64) },
    mappingFingerprint: 'e'.repeat(64),
    contentFingerprint: 'f'.repeat(64),
    status: 'unresolved',
    externalKey: 'pf1/Alpha',
  };
  const [formatted] = JSON.parse(
    formatCatalogData('assessments', [assessment]),
  ) as Record<string, Record<string, string> | string[]>[];
  expect(Object.keys(formatted!)).toEqual([
    'externalKey',
    'status',
    'contentFingerprint',
    'mappingFingerprint',
    'evidenceFingerprints',
    'noticeFingerprints',
    'requiredNotices',
    'rationale',
    'reviewedBy',
    'reviewedOn',
  ]);
  expect(Object.keys(formatted!.evidenceFingerprints!)).toEqual([
    'alpha',
    'zeta',
  ]);
  expect(formatted!.requiredNotices).toEqual(['PZO9', 'CRB']);
});

it('writes two-space JSON, escapes non-ASCII only in the Curation Overlay and keeps the trailing newline', () => {
  const registry = {
    PZO1: {
      title: 'Book',
      notice: 'Book – © 2011',
      checkedAgainst: 'unreviewed',
      checkedOn: '2026-10-07',
      aliases: [],
      reviewStatus: 'unreviewed',
      provenance: ['Owner'],
    },
  };
  expect(formatCatalogData('registry', registry)).toBe(
    JSON.stringify(registry, null, 2) + '\n',
  );
  const curation = formatCatalogData('curation', {
    records: [note('pf1/Alpha', '–2 Intelligence')],
    situations: [],
  });
  expect(curation).toContain('"text": "\\u20132 Intelligence"');
  expect(curation).not.toMatch(/[^\x00-\x7f]/);
  expect(curation.endsWith('}\n')).toBe(true);
});

it('refuses duplicate identities and Situation aliases that two keys claim', () => {
  const record = note('pf1/Alpha', '+1 vs. fear');
  expect(() =>
    formatCatalogData('curation', { records: [record, record] }),
  ).toThrow(/Duplicate identity: records pf1\/Alpha note/);
  expect(() =>
    formatCatalogData('heldNotices', [hold('a', []), hold('a', ['X'])]),
  ).toThrow('Duplicate identity: held notices a.');
  expect(() =>
    formatCatalogData('curation', {
      records: [],
      situations: [situation('fear', ['Fear']), situation('dread', ['fear'])],
    }),
  ).toThrow(/Situation alias "fear" is claimed by both dread and fear/);
});

it('check and the format command find and rewrite a non-canonical file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'catalog-data-format-'));
  temporary.push(root);
  // A small valid five-file set; the committed files' canonicality is the
  // first case's.
  const fixture: Record<CatalogDataFile, unknown> = {
    curation: {
      records: [note('pf1/Alpha', '+1 vs. fear')],
      situations: [situation('fear', ['fear'])],
    },
    assessments: [],
    evidence: { alpha: { content: 'A' } },
    registry: {},
    heldNotices: [hold('a', ['PZO1']), hold('b', ['PZO2'])],
  };
  const canonical = new Map<string, string>();
  for (const [file, value] of Object.entries(fixture)) {
    const path = join(root, catalogDataFiles[file as CatalogDataFile]);
    const text = formatCatalogData(file as CatalogDataFile, value);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text);
    canonical.set(path, text);
  }
  expect(await checkCatalogDataFiles(root)).toEqual([]);
  const held = join(root, catalogDataFiles.heldNotices);
  const original = await readFile(held, 'utf8');
  const holds = JSON.parse(original) as unknown[];
  await writeFile(held, JSON.stringify([...holds].reverse(), null, 2) + '\n');
  expect(await checkCatalogDataFiles(root)).toEqual([
    catalogDataFiles.heldNotices,
  ]);
  const command = (args: string[]) =>
    runCapturedProcess({
      command: process.execPath,
      args: [
        '--import',
        fileURLToPath(import.meta.resolve('tsx')),
        resolve('scripts/catalog-format.ts'),
        '--root',
        root,
        ...args,
      ],
    });
  const check = command(['--check']);
  expect(check.status).toBe(1);
  expect(check.stderr).toContain(catalogDataFiles.heldNotices);
  const write = command([]);
  expect(write.stderr).toBe('');
  expect(write.status).toBe(0);
  expect(write.stdout).toContain(`Formatted ${catalogDataFiles.heldNotices}`);
  for (const [path, text] of canonical)
    expect(await readFile(path, 'utf8'), path).toBe(text);
  expect(command(['--check']).status).toBe(0);
}, 60_000);

it('check refuses legacy, non-canonical, orphaned, dangling and mismatched evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'catalog-data-evidence-'));
  temporary.push(root);
  const empty: Record<CatalogDataFile, unknown> = {
    curation: { records: [], situations: [] },
    assessments: [],
    evidence: {},
    registry: {},
    heldNotices: [],
  };
  for (const [file, value] of Object.entries(empty)) {
    const path = join(root, catalogDataFiles[file as CatalogDataFile]);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, formatCatalogData(file as CatalogDataFile, value));
  }
  const body = JSON.stringify(
    Array.from({ length: 60 }, (_, i) => `Line ${i}.`),
  );
  const plain = { e: { content: `{"lines":${body}}` } };
  const canonical = formatCatalogData('evidence', plain);
  const encoded = JSON.parse(canonical) as {
    evidence: { e: { parts: unknown[] } };
    shared: Record<string, string[]>;
  };
  const [id] = Object.keys(encoded.shared);
  expect(encoded.evidence.e.parts).toEqual(['{"lines":', { ref: id }, '}']);
  const path = join(root, catalogDataFiles.evidence);
  const check = async (text: string) => {
    await writeFile(path, text);
    return checkCatalogDataFiles(root);
  };
  expect(await check(canonical)).toEqual([]);
  for (const stale of [
    JSON.stringify(plain, null, 2) + '\n',
    JSON.stringify(encoded, null, 2) + '\n',
    formatCatalogData('evidence', {}).replace(
      '"shared": {}',
      `"shared": ${JSON.stringify(encoded.shared)}`,
    ),
  ])
    expect(await check(stale)).toEqual([catalogDataFiles.evidence]);
  expect(formatCatalogData('evidence', JSON.parse(JSON.stringify(plain)))).toBe(
    canonical,
  );
  await expect(
    check(canonical.replace(`"${id}": [`, `"${'0'.repeat(24)}": [`)),
  ).rejects.toThrow(`blob ${id} referenced by e is missing`);
  await expect(check(canonical.replace('Line 7.', 'Line 8.'))).rejects.toThrow(
    `blob ${id} does not match its hash`,
  );
  await expect(
    check(
      canonical.replace(
        '"evidence": {\n',
        '"evidence": {\n    "e": { "content": "Earlier." },\n',
      ),
    ),
  ).rejects.toThrow('Duplicate attribution evidence key "e" at evidence.');
});

it('names exactly the five shared catalog data files', () => {
  expect(Object.keys(catalogDataFiles).sort()).toEqual([
    'assessments',
    'curation',
    'evidence',
    'heldNotices',
    'registry',
  ] satisfies CatalogDataFile[]);
});
