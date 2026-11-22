// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import {
  catalogDataFiles,
  formatCatalogData,
} from '../../scripts/catalog/data-files';
import { mergeCatalogData } from '../../scripts/catalog/data-merge';
import { runCapturedProcess } from '../../scripts/catalog/process';

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

function record(
  externalKey: string,
  text: string,
  outputs: unknown[] = [{ kind: 'note', text: 'Readable.' }],
) {
  return {
    externalKey,
    kind: 'note',
    target: 'save.will',
    text,
    textSha256: createHash('sha256').update(text).digest('hex'),
    status: 'drafted',
    outputs,
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
function notice(title: string, aliases: string[] = []) {
  return {
    title,
    notice: `${title}. © 2011, Paizo Publishing, LLC.`,
    checkedAgainst: 'unreviewed',
    checkedOn: '2026-10-07',
    aliases,
    reviewStatus: 'unreviewed',
    provenance: ['Owner transcription.'],
  };
}
function assessment(externalKey: string, rationale = 'Reviewed.') {
  return {
    externalKey,
    status: 'unresolved',
    contentFingerprint: 'a'.repeat(64),
    mappingFingerprint: 'b'.repeat(64),
    evidenceFingerprints: { [`evidence-${externalKey}`]: 'c'.repeat(64) },
    noticeFingerprints: { CRB: 'd'.repeat(64) },
    requiredNotices: ['CRB'],
    rationale,
    reviewedBy: 'Reviewer',
    reviewedOn: '2026-10-07',
  };
}
const shared = record('pf1/Shared', '+1 vs. fear', [
  { kind: 'note', situation: 'fear', text: 'Bonus against fear.' },
]);
const base = { records: [shared], situations: [situation('fear', ['fear'])] };

it('unions disjoint curation batches by identity into canonical form', () => {
  const ours = {
    records: [shared, record('pf1/Zulu', '+2 vs. poison')],
    situations: [...base.situations, situation('poison', ['poison'])],
  };
  const theirs = {
    records: [record('pf1/Alpha', '+1 vs. charm'), shared],
    situations: [situation('charm', ['charm']), ...base.situations],
  };
  const result = mergeCatalogData({ file: 'curation', base, ours, theirs });
  expect(result.conflicts).toEqual([]);
  expect(result.text).toBe(
    formatCatalogData('curation', {
      records: [...ours.records, theirs.records[0]],
      situations: [...ours.situations, theirs.situations[0]],
    }),
  );
});

it('unions disjoint assessments, evidence, Registry notices and notice holds', () => {
  const merged = (
    file: Parameters<typeof mergeCatalogData>[0]['file'],
    sides: { base: unknown; ours: unknown; theirs: unknown },
  ) => {
    const result = mergeCatalogData({ file, ...sides });
    expect(result.conflicts).toEqual([]);
    return JSON.parse(result.text ?? 'null') as unknown;
  };
  expect(
    merged('assessments', {
      base: [assessment('pf1/B')],
      ours: [assessment('pf1/B'), assessment('pf1/C')],
      theirs: [assessment('pf1/A'), assessment('pf1/B')],
    }),
  ).toEqual([assessment('pf1/A'), assessment('pf1/B'), assessment('pf1/C')]);
  expect(
    merged('evidence', {
      base: {},
      ours: { 'feats-331': { content: 'Ours.' } },
      theirs: { 'feats-332': { content: 'Theirs.' } },
    }),
  ).toEqual({
    evidence: {
      'feats-331': { content: 'Ours.' },
      'feats-332': { content: 'Theirs.' },
    },
    shared: {},
  });
  expect(
    merged('registry', {
      base: { CRB: notice('Core') },
      ours: { CRB: notice('Core'), PZO2: notice('Two') },
      theirs: { CRB: notice('Core'), PZO1: notice('One') },
    }),
  ).toEqual({ CRB: notice('Core'), PZO1: notice('One'), PZO2: notice('Two') });
  expect(
    merged('heldNotices', {
      base: [],
      ours: [hold('feats-331', ['PZO2'])],
      theirs: [hold('feats-332', ['PZO2'])],
    }),
  ).toEqual([hold('feats-331', ['PZO2']), hold('feats-332', ['PZO2'])]);
});

it('takes a change or deletion made on one side only', () => {
  const edited = record('pf1/Shared', '+1 vs. fear', [
    { kind: 'note', situation: 'fear', text: 'Edited.' },
  ]);
  const result = mergeCatalogData({
    file: 'curation',
    base: { ...base, situations: [...base.situations, situation('old', [])] },
    ours: { records: [edited], situations: base.situations },
    theirs: {
      ...base,
      situations: [...base.situations, situation('old', [])],
    },
  });
  expect(result.conflicts).toEqual([]);
  expect(JSON.parse(result.text ?? 'null')).toEqual({
    records: [edited],
    situations: base.situations,
  });
});

it('refuses an identity both sides changed differently and names the fields', () => {
  const result = mergeCatalogData({
    file: 'curation',
    base,
    ours: {
      ...base,
      records: [{ ...shared, status: 'checked', reviewedBy: 'A' }],
    },
    theirs: { ...base, records: [{ ...shared, rationale: 'Other.' }] },
  });
  expect(result.text).toBeUndefined();
  expect(result.conflicts).toEqual([
    expect.stringMatching(
      /^records pf1\/Shared note save\.will sha256:[a-f0-9]{12}: ours and theirs differ in rationale, reviewedBy, status\.$/,
    ),
  ]);
  const added = mergeCatalogData({
    file: 'assessments',
    base: [],
    ours: [assessment('pf1/A', 'Ours.')],
    theirs: [assessment('pf1/A', 'Theirs.')],
  });
  expect(added.conflicts).toEqual([
    'assessments pf1/A: ours and theirs differ in rationale.',
  ]);
  const removed = mergeCatalogData({
    file: 'evidence',
    base: { e: { content: 'Base.' } },
    ours: {},
    theirs: { e: { content: 'Edited.' } },
  });
  expect(removed.conflicts).toEqual([
    'evidence e: deleted by ours but changed by theirs.',
  ]);
});

it('merges plain-map evidence from an earlier branch with the encoded file', () => {
  const body = (name: string) =>
    JSON.stringify({
      name,
      lines: Array.from({ length: 40 }, (_, i) => `${name} line ${i}.`),
    });
  const kept = { content: body('Kept') };
  const added = { content: `#1 header\n${body('Added')}` };
  const encoded = (value: object) =>
    JSON.parse(formatCatalogData('evidence', value)) as unknown;
  const result = mergeCatalogData({
    file: 'evidence',
    base: { kept },
    ours: encoded({ kept, gone: { content: 'Ours.' } }),
    theirs: { kept, added, gone: { content: 'Ours.' } },
  });
  expect(result.conflicts).toEqual([]);
  expect(result.text).toBe(
    formatCatalogData('evidence', { added, gone: { content: 'Ours.' }, kept }),
  );
  const dropped = mergeCatalogData({
    file: 'evidence',
    base: encoded({ kept, added }),
    ours: encoded({ kept }),
    theirs: { kept, added },
  });
  expect(dropped.text).toBe(formatCatalogData('evidence', { kept }));
  expect(
    Object.keys(
      (JSON.parse(dropped.text ?? '{}') as { shared: object }).shared,
    ),
  ).toHaveLength(1);
});

it('refuses Situation definitions that disagree or claim the same alias', () => {
  const disagree = mergeCatalogData({
    file: 'curation',
    base: { records: [], situations: [] },
    ours: { records: [], situations: [situation('charm', ['charm'])] },
    theirs: {
      records: [],
      situations: [situation('charm', ['charm', 'charms'])],
    },
  });
  expect(disagree.conflicts).toEqual([
    'situations charm: ours and theirs differ in aliases.',
  ]);
  const collide = mergeCatalogData({
    file: 'curation',
    base: { records: [], situations: [] },
    ours: { records: [], situations: [situation('charm', ['charm'])] },
    theirs: { records: [], situations: [situation('charms', ['Charm'])] },
  });
  expect(collide.conflicts).toEqual([
    'Situation alias "charm" is claimed by both charm and charms.',
  ]);
  const missing = mergeCatalogData({
    file: 'curation',
    base: { records: [], situations: base.situations },
    ours: { records: [], situations: [] },
    theirs: {
      records: [
        record('pf1/Other', 'vs. fear', [
          { kind: 'note', situation: 'fear', text: 'Fear.' },
        ]),
      ],
      situations: base.situations,
    },
  });
  expect(missing.conflicts).toEqual([
    'Merged curation is invalid: Unreviewed shared Situation: fear',
  ]);
});

it('refuses notice holds and Registry notices that disagree', () => {
  expect(
    mergeCatalogData({
      file: 'heldNotices',
      base: [],
      ours: [hold('chain', ['PZO1'])],
      theirs: [hold('chain', ['PZO1', 'PZO2'])],
    }).conflicts,
  ).toEqual(['held notices chain: ours and theirs differ in notices.']);
  expect(
    mergeCatalogData({
      file: 'registry',
      base: {},
      ours: { PZO1: notice('One', ['ALIAS']) },
      theirs: { PZO2: notice('Two', ['ALIAS']) },
    }).conflicts,
  ).toEqual(['Registry identifier ALIAS is named by both PZO1 and PZO2.']);
});

function git(cwd: string, ...args: string[]) {
  const result = spawnSync(
    'git',
    [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd, encoding: 'utf8', env: { ...process.env, GIT_EDITOR: 'true' } },
  );
  return result;
}

it('refuses evidence whose raw text names an ID twice, and writes nothing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'catalog-data-merge-'));
  temporary.push(root);
  expect(git(root, 'init', '-q', '-b', 'main').status).toBe(0);
  const target = join(root, catalogDataFiles.evidence);
  await mkdir(dirname(target), { recursive: true });
  const ours = formatCatalogData('evidence', { e: { content: 'Ours.' } });
  await writeFile(target, ours);
  await writeFile(join(root, 'ours.json'), ours);
  await writeFile(
    join(root, 'theirs.json'),
    '{ "e": { "content": "Ours." }, "e": { "content": "Theirs." } }\n',
  );
  const result = runCapturedProcess({
    command: process.execPath,
    args: [
      '--import',
      fileURLToPath(import.meta.resolve('tsx')),
      resolve('scripts/catalog-merge.ts'),
      catalogDataFiles.evidence,
      '--ours',
      'ours.json',
      '--theirs',
      'theirs.json',
    ],
    cwd: root,
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'Duplicate attribution evidence key "e" at the root.',
  );
  expect(await readFile(target, 'utf8')).toBe(ours);
}, 30_000);

it('resolves conflicted rebase stages in place and stops on a real conflict', async () => {
  const root = await mkdtemp(join(tmpdir(), 'catalog-data-merge-'));
  temporary.push(root);
  const write = async (file: keyof typeof catalogDataFiles, value: unknown) => {
    const path = join(root, catalogDataFiles[file]);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, formatCatalogData(file, value));
  };
  expect(git(root, 'init', '-q', '-b', 'main').status).toBe(0);
  await write('curation', base);
  await write('heldNotices', [hold('base', ['PZO0'])]);
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'base');
  git(root, 'checkout', '-q', '-b', 'batch-b');
  await write('curation', {
    records: [...base.records, record('pf1/Zulu', '+2 vs. poison')],
    situations: base.situations,
  });
  await write('heldNotices', [hold('base', ['PZO0']), hold('zeta', ['PZO2'])]);
  git(root, 'commit', '-q', '-am', 'batch b');
  git(root, 'checkout', '-q', 'main');
  await write('curation', {
    records: [...base.records, record('pf1/Yankee', '+1 vs. charm')],
    situations: base.situations,
  });
  await write('heldNotices', [hold('base', ['PZO0']), hold('yank', ['PZO1'])]);
  git(root, 'commit', '-q', '-am', 'batch a');
  git(root, 'checkout', '-q', 'batch-b');
  expect(git(root, 'rebase', 'main').status).not.toBe(0);
  const merge = () =>
    runCapturedProcess({
      command: process.execPath,
      args: [
        '--import',
        fileURLToPath(import.meta.resolve('tsx')),
        resolve('scripts/catalog-merge.ts'),
      ],
      cwd: root,
    });
  const resolved = merge();
  expect(resolved.stderr).toBe('');
  expect(resolved.status).toBe(0);
  expect(resolved.stdout).toContain(`Merged ${catalogDataFiles.curation}`);
  expect(resolved.stdout).toContain(`Merged ${catalogDataFiles.heldNotices}`);
  expect(
    JSON.parse(
      await readFile(join(root, catalogDataFiles.heldNotices), 'utf8'),
    ),
  ).toEqual([
    hold('base', ['PZO0']),
    hold('yank', ['PZO1']),
    hold('zeta', ['PZO2']),
  ]);
  const curation = JSON.parse(
    await readFile(join(root, catalogDataFiles.curation), 'utf8'),
  ) as { records: { externalKey: string }[] };
  expect(curation.records.map((entry) => entry.externalKey)).toEqual([
    'pf1/Shared',
    'pf1/Yankee',
    'pf1/Zulu',
  ]);
  git(root, 'add', '.');
  expect(git(root, 'rebase', '--continue').status).toBe(0);

  git(root, 'checkout', '-q', '-b', 'batch-c', 'main~1');
  await write('heldNotices', [hold('base', ['PZO0']), hold('yank', ['PZO9'])]);
  git(root, 'commit', '-q', '-am', 'batch c');
  expect(git(root, 'rebase', 'main').status).not.toBe(0);
  const conflicted = await readFile(
    join(root, catalogDataFiles.heldNotices),
    'utf8',
  );
  const refused = merge();
  expect(refused.status).toBe(1);
  expect(refused.stderr).toContain(
    'held notices yank: ours and theirs differ in notices.',
  );
  expect(await readFile(join(root, catalogDataFiles.heldNotices), 'utf8')).toBe(
    conflicted,
  );
  git(root, 'rebase', '--abort');
}, 60_000);
