// @vitest-environment node
import { execFileSync } from 'node:child_process';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  encodedLegalRecords,
  unwiredLegalRecordScanners,
} from '../../scripts/catalog/legal-records';
import {
  findLegalRecordGuardProblems,
  legalRecordGuardExemptions,
  legalRecordNameHelpers,
} from './legal-record-guard';

// Guard 3 of the legal-record design: a reader that parses an encoded record
// itself sees its stores, not its candidates, and a schema's `safeParse` would
// then drop them silently. The guard allows one syntactic form and refuses
// whatever it cannot verify.

const moduleFile = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const git = (root: string, ...args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
    .split('\0')
    .filter(Boolean);

/**
 * Every JS or TS module of the checkout at `root` that Git tracks (and those
 * it would: untracked files not ignored), path to source text, in every
 * directory of the repository; the guard reads them all.
 */
function trackedModules(root: string) {
  const files = new Map<string, string>();
  for (const path of git(
    root,
    'ls-files',
    '-z',
    '--cached',
    '--others',
    '--exclude-standard',
  )) {
    const stat = lstatSync(join(root, path), { throwIfNoEntry: false });
    if (moduleFile.test(path) && stat?.isFile())
      files.set(path, readFileSync(join(root, path), 'utf8'));
  }
  return files;
}

const files = trackedModules(process.cwd());
const seven = [530, 531, 532, 533, 534, 535, 536].map(
  (batch) => `spells-${batch}.json`,
);
const filesOf = (problems: string[]) => [
  ...new Set(problems.map((problem) => problem.slice(0, problem.indexOf(':')))),
];

describe('guard 3: a legal record is read only through the loader', () => {
  it(
    encodedLegalRecords.length
      ? 'finds nothing in the tracked code'
      : 'finds nothing in the tracked code (no record is encoded yet)',
    () => {
      expect(
        findLegalRecordGuardProblems({ files, encoded: encodedLegalRecords }),
      ).toEqual([]);
    },
  );

  it('with the seven Spells records 530 to 536 encoded, finds nothing: every scanner is wired', () => {
    expect([...encodedLegalRecords]).toEqual(seven);
    expect(unwiredLegalRecordScanners).toEqual([]);
    expect(
      filesOf(findLegalRecordGuardProblems({ files, encoded: seven })),
    ).toEqual([]);
  });

  // Fix round 1 of legal-l2: four tests read an encoded record by a template
  // path (`scripts/catalog/legal/spells-${batch}.json`) and got its wrapper;
  // no local run included them. Rule d needs no record read and no test run
  // beyond this one: for every encoded record, no tracked module (reading
  // files or not) holds a template or concatenation that could expand to its
  // path.
  it('no tracked module builds a string that could expand to an encoded record’s path (rule d)', () => {
    const expanding = findLegalRecordGuardProblems({
      files,
      encoded: encodedLegalRecords,
      unwired: [],
    }).filter((problem) => problem.includes('(rule d)'));
    expect(encodedLegalRecords.length).toBeGreaterThan(0);
    expect(expanding).toEqual([]);
  });

  it('exempts only the loader, its test, the codec, the migration proof, its test and itself, each for a reason', () => {
    expect([...legalRecordGuardExemptions.keys()].sort()).toEqual([
      'scripts/catalog/legal-record-proof.ts',
      'scripts/catalog/legal-records.ts',
      'src/lib/catalog/legal-record-codec.ts',
      'tests/catalog/legal-record-guard.test.ts',
      'tests/catalog/legal-record-guard.ts',
      'tests/catalog/legal-record-proof.test.ts',
      'tests/catalog/legal-records.test.ts',
    ]);
    for (const reason of legalRecordGuardExemptions.values())
      expect(reason).toMatch(/^the .+: .+/);
  });

  it('lists only tracked name-taking helper modules', () => {
    expect(legalRecordNameHelpers).toEqual([
      'tests/catalog/batch-ownership.ts',
    ]);
    for (const helper of legalRecordNameHelpers)
      expect(files.has(helper), helper).toBe(true);
  });

  describe('reads every JS or TS module Git tracks', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'legal-record-guard-'));
    afterAll(() => rmSync(scratch, { recursive: true, force: true }));

    it('in every directory and at the root, configuration included', () => {
      const tracked = git(process.cwd(), 'ls-files', '-z').filter((path) =>
        moduleFile.test(path),
      );
      const directories = new Set(
        tracked
          .filter((path) => path.includes('/'))
          .map((path) => path.split('/')[0]),
      );
      expect(directories.size).toBeGreaterThan(5);
      for (const directory of directories)
        expect(
          [...files.keys()].some((path) => path.startsWith(`${directory}/`)),
          directory,
        ).toBe(true);
      for (const config of [
        'next.config.ts',
        'playwright.config.ts',
        'eslint.config.mjs',
        'postcss.config.js',
      ])
        expect(files.has(config), config).toBe(true);
      for (const path of tracked) expect(files.has(path), path).toBe(true);
    });

    it('so a root-level module with a bare read fails', () => {
      const bare = `import { readFileSync } from 'node:fs';\nexport default JSON.parse(readFileSync('scripts/catalog/legal/example-1.json', 'utf8'));\n`;
      git(scratch, 'init', '-q');
      writeFileSync(join(scratch, 'next.config.ts'), bare);
      mkdirSync(join(scratch, 'docs'));
      writeFileSync(join(scratch, 'docs/setup.mjs'), bare);
      writeFileSync(join(scratch, 'notes.md'), bare);
      git(scratch, 'add', '.');
      const problems = findLegalRecordGuardProblems({
        files: trackedModules(scratch),
        encoded: ['example-1.json'],
        unwired: [],
      });
      expect(problems.map((problem) => problem.split(':')[0])).toEqual([
        'docs/setup.mjs',
        'next.config.ts',
      ]);
    });
  });

  describe('in fixture modules, with example-1.json and example-2.json encoded', () => {
    const loader = `import { readLegalRecord, legalRecordSha256, readLegalRecords, readLegalRecordsIn, legalRecordLabel } from '../../scripts/catalog/legal-records';\n`;
    // Round 2's byte reader, which round 3 removed from the loader.
    const bytes = `import { readLegalRecordBytes } from '../../scripts/catalog/legal-records';\n`;
    const helper = `import { findCommittedBatchOwnershipProblems, readBatchInventory } from './batch-ownership';\n`;
    const path = 'tests/catalog/reader.test.ts';
    const check = (
      sources: Record<string, string>,
      encoded = ['example-1.json', 'example-2.json'],
    ) =>
      findLegalRecordGuardProblems({
        files: new Map(Object.entries(sources)),
        encoded,
        unwired: [],
      });
    const rules = (source: string, encoded?: string[]) =>
      check({ [path]: source }, encoded).map(
        (problem) =>
          /\(rule [abcde]\)|of the legal record loader/.exec(problem)?.[0],
      );
    const a = '(rule a)';
    const b = '(rule b)';
    const d = '(rule d)';
    const e = '(rule e)';
    const loaderForm = 'of the legal record loader';

    // Every reproduction from the round 1 and round 2 reviews, and the forms
    // the brief lists: each fails because its form is not allowed.
    it.each([
      [
        'r1: a local helper that parses bare, beside a loader read',
        `${loader}readLegalRecord('example-2.json');\nfunction snapshot(p) { return JSON.parse(readFileSync(p, 'utf8')); }\nsnapshot('../../scripts/catalog/legal/example-1.json');`,
        [a],
      ],
      [
        'r1: a loader scan beside a bare directory scan',
        `${loader}for (const { record } of readLegalRecords()) use(record);\nfor (const file of readdirSync('scripts/catalog/legal')) use(JSON.parse(readFileSync(join('scripts/catalog/legal', file), 'utf8')));`,
        [b, b],
      ],
      [
        'r2: paths.map(snapshot), a local callback that parses bare',
        `${loader}const dir = 'scripts/catalog/legal';\nfor (const { record } of readLegalRecords()) use(record);\nconst snapshot = (p) => JSON.parse(readFileSync(p, 'utf8'));\nconst paths = readdirSync(dir).map((n) => join(dir, n));\npaths.map(snapshot);`,
        [b],
      ],
      [
        'r2: paths.map(snapshot), an imported callback',
        `${loader}import { snapshot } from '../fixtures/spells-530/data';\nconst dir = 'scripts/catalog/legal';\nreadLegalRecords();\nconst paths = readdirSync(dir).map((n) => join(dir, n));\npaths.map(snapshot);`,
        [b],
      ],
      [
        'r2: paths[0] parsed bare',
        `${loader}const dir = 'scripts/catalog/legal';\nreadLegalRecords();\nconst paths = readdirSync(dir).map((n) => join(dir, n));\nJSON.parse(readFileSync(paths[0], 'utf8'));`,
        [b],
      ],
      [
        'r2: a second scan through readFileSync as readText',
        `${loader}import { readFileSync as readText } from 'node:fs';\nconst dir = 'scripts/catalog/legal';\nfor (const { record } of readLegalRecords()) use(record);\nfor (const file of list()) use(JSON.parse(readText(join(dir, file), 'utf8')));`,
        [b],
      ],
      [
        'r2: a helper with a loader call and an object method that parses bare',
        `${loader}const snapshot = { record: (name) => readLegalRecord(name), raw(p) { return JSON.parse(readFileSync(p, 'utf8')); } };\nsnapshot.raw('scripts/catalog/legal/example-1.json');`,
        [a],
      ],
      [
        "r2: a text handed to the loader's parser and to parseSnapshot",
        `${loader}const text = readFileSync('scripts/catalog/legal/example-1.json', 'utf8');\nparseLegalRecordText(text);\nparseSnapshot(text);\nfunction parseSnapshot(t) { return JSON.parse(t); }`,
        [a],
      ],
      [
        'r2: a text handed to an alias of JSON.parse',
        `${loader}const parse = JSON.parse;\nconst text = readFileSync('scripts/catalog/legal/example-1.json', 'utf8');\nparseLegalRecordText(text);\nparse(text);`,
        [a],
      ],
      [
        'r2: a text copied to another variable and parsed',
        `${loader}const text = readFileSync('scripts/catalog/legal/example-1.json', 'utf8');\nparseLegalRecordText(text);\nconst legacy = text;\nJSON.parse(legacy);`,
        [a],
      ],
      [
        'a module with one loader read and one bare read',
        `${loader}readLegalRecord('example-2.json');\nJSON.parse(readFileSync('scripts/catalog/legal/example-1.json', 'utf8'));`,
        [a],
      ],
      [
        'a JSON-module import',
        `import record from '../../scripts/catalog/legal/example-1.json';`,
        [a],
      ],
      [
        'a require of the record',
        `const record = require('../../scripts/catalog/legal/example-1.json');`,
        [a],
      ],
      [
        'a path kept in a variable, even for the loader',
        `${loader}const path = 'scripts/catalog/legal/example-1.json';\nreadLegalRecord(path);`,
        [a],
      ],
      [
        'a name kept in an array',
        `${loader}for (const name of ['example-1.json']) readLegalRecord(name);`,
        [a],
      ],
      [
        'a name in a test table',
        `${loader}it.each([['a record', 'scripts/catalog/legal/example-1.json']])('reads %s', (_, p) => readLegalRecord(p));`,
        [a],
      ],
      [
        'a path built by URL for a bare read',
        `JSON.parse(await readFile(new URL('../../scripts/catalog/legal/example-1.json', import.meta.url), 'utf8'));`,
        [a],
      ],
      [
        'a name the loader is given inside another expression',
        `${loader}readLegalRecord(true ? 'example-1.json' : 'x.json');`,
        [a],
      ],
      [
        'an aliased import of the loader',
        `import { readLegalRecord as read } from '../../scripts/catalog/legal-records';\nread('example-1.json');`,
        [loaderForm, a],
      ],
      [
        'a namespace import of the loader',
        `import * as loader from '../../scripts/catalog/legal-records';\nloader.readLegalRecord('example-1.json');`,
        [loaderForm, a],
      ],
      [
        'a default import of the loader',
        `import loader from '../../scripts/catalog/legal-records';`,
        [loaderForm],
      ],
      [
        'a dynamic import of the loader',
        `const { readLegalRecord } = await import('../../scripts/catalog/legal-records');\nreadLegalRecord('example-1.json');`,
        [loaderForm, loaderForm, a],
      ],
      [
        'a re-export of the loader',
        `export { readLegalRecord } from '../../scripts/catalog/legal-records';`,
        [loaderForm],
      ],
      [
        'a local function named like the loader',
        `const readLegalRecord = (p) => JSON.parse(readFileSync(p, 'utf8'));\nreadLegalRecord('example-1.json');`,
        [loaderForm, a],
      ],
      [
        'a directory named by adjacent path segments',
        `${loader}readdirSync(join(root, 'scripts', 'catalog', 'legal'));`,
        [b],
      ],
      [
        'a directory named by URL',
        `${loader}readdirSync(new URL('../../scripts/catalog/legal/', import.meta.url));`,
        [b],
      ],
      [
        'a path built from the directory by template',
        `const batch = 'spells';\nJSON.parse(readFileSync(\`scripts/catalog/legal/\${batch}.json\`, 'utf8'));`,
        [b, d],
      ],
      // Fix round 1: a path into the directory that is not one complete
      // file path (the wave tests' template head, a concatenation, a later
      // template chunk) fails like the directory itself (rule b), and a
      // built string that can expand to an encoded record's path fails in
      // every module (rule d).
      [
        'f1: a template with the directory and part of a name in its head (the wave tests)',
        `const BATCHES = [1, 2];\nBATCHES.flatMap((batch) => JSON.parse(readFileSync(\`scripts/catalog/legal/example-\${batch}.json\`, 'utf8')).candidates);`,
        [b, d],
      ],
      [
        'f1: a concatenation from the directory and part of a name',
        `JSON.parse(readFileSync('scripts/catalog/legal/example-' + n + '.json', 'utf8'));`,
        [b, d],
      ],
      [
        'f1: a concatenation with a literal directory prefix',
        `JSON.parse(readFileSync('scripts/catalog/legal' + '/example-' + n + '.json', 'utf8'));\nconst dir = 'scripts/catalog/legal';\nJSON.parse(readFileSync(dir + '/example-' + n + '.json', 'utf8'));`,
        [b, b, d],
      ],
      [
        'f1: a template with the directory in a later chunk',
        `JSON.parse(readFileSync(\`\${root}/scripts/catalog/legal/example-\${n}.json\`, 'utf8'));`,
        [b, d],
      ],
      [
        'f1: a template naming the directory, then the whole name',
        `JSON.parse(readFileSync(\`../../scripts/catalog/legal/\${name}\`, 'utf8'));`,
        [b, d],
      ],
      [
        'f1: a complete path with more appended',
        `JSON.parse(readFileSync('scripts/catalog/legal/example.1' + suffix, 'utf8'));`,
        [b],
      ],
      [
        "f1: the directory as a template's segment after 'catalog'",
        `readdirSync(join(root, 'scripts', 'catalog', \`legal/example-\${n}.json\`));`,
        [b],
      ],
      [
        'f1: a path builder in a module that reads no file (rule d)',
        `export const pathOf = (n) => \`scripts/catalog/legal/example-\${n}.json\`;\nexport const other = (n) => 'scripts/catalog/legal/' + n;\nexport const wrapped = (n) => ('scripts/catalog/legal/' + n) as string;`,
        [d, d, d],
      ],
      // Round 3: no route takes a readable path out of the loader.
      [
        'r3: a label read and parsed bare',
        `${loader}JSON.parse(readFileSync(legalRecordLabel('example-1.json'), 'utf8'));`,
        [e],
      ],
      [
        'r3: a label kept in a variable, then read',
        `${loader}const p = legalRecordLabel('example-1.json');\nJSON.parse(readFileSync(p, 'utf8'));`,
        [e],
      ],
      [
        'r3: a label assigned, then read',
        `${loader}let p;\np = legalRecordLabel('example-1.json');\nJSON.parse(readFileSync(p, 'utf8'));`,
        [e],
      ],
      [
        'r3: labels made in an array callback',
        `${loader}['example-1.json'].map((n) => legalRecordLabel(n)).map((p) => JSON.parse(readFileSync(p, 'utf8')));`,
        [a, e],
      ],
      [
        'r3: the label function passed as a callback',
        `${loader}names.map(legalRecordLabel).map((p) => JSON.parse(readFileSync(p, 'utf8')));`,
        [e],
      ],
      [
        'r3: a local helper that reads a label',
        `${loader}function snapshot(name) { return JSON.parse(readFileSync(legalRecordLabel(name), 'utf8')); }\nsnapshot('example-1.json');`,
        [a, e],
      ],
      [
        'r3: a local helper that returns a label',
        `${loader}const pathOf = (name) => legalRecordLabel(name);\nJSON.parse(readFileSync(pathOf('example-1.json'), 'utf8'));`,
        [a, e],
      ],
      [
        'r3: a label handed to an imported helper',
        `${loader}import { snapshot } from '../fixtures/spells-530/data';\nsnapshot(legalRecordLabel('example-1.json'));`,
        [e],
      ],
      [
        'r3: a label spread',
        `${loader}const parts = [...legalRecordLabel('example-1.json')];`,
        [e],
      ],
      [
        'r3: a label built into a bare string by + or a template',
        `${loader}readFileSync(legalRecordLabel('example-1.json') + '');\nreadFileSync(\`\${legalRecordLabel('example-1.json')}\`);`,
        [e, e],
      ],
      [
        'r3: a label in a matcher that is not listed',
        `${loader}expect(x).toSatisfy(legalRecordLabel('example-1.json'));`,
        [e],
      ],
      // Round 4: a label in a container literal read back in the same
      // expression, and an assertion whose matcher is not listed.
      [
        'r4: an object holding a label, its member read',
        `${loader}JSON.parse(readFileSync({ evidence: legalRecordLabel('example-1.json') }.evidence, 'utf8'));`,
        [e],
      ],
      [
        'r4: an array holding a label, its element read',
        `${loader}JSON.parse(readFileSync([legalRecordLabel('example-1.json')][0], 'utf8'));`,
        [e],
      ],
      [
        'r4: an array holding a label, mapped',
        `${loader}[legalRecordLabel('example-1.json')].map((p) => JSON.parse(readFileSync(p, 'utf8')));`,
        [e],
      ],
      [
        'r4: an object holding a label, destructured',
        `${loader}const { evidence } = { evidence: legalRecordLabel('example-1.json') };\nconst [first] = [legalRecordLabel('example-2.json')];`,
        [e, e],
      ],
      [
        'r4: a label nested in literals, read through parentheses',
        `${loader}({ hold: { evidence: [legalRecordLabel('example-1.json')] } }).hold.evidence[0];`,
        [e],
      ],
      [
        'r4: an array holding a label, spread',
        `${loader}use(...[legalRecordLabel('example-1.json')]);\nconst copy = { ...{ evidence: legalRecordLabel('example-2.json') } };`,
        [e, e],
      ],
      [
        'r4: an assertion on a label with a matcher that is not listed',
        `${loader}expect(legalRecordLabel('example-1.json')).toSatisfy((p) => JSON.parse(readFileSync(p, 'utf8')));`,
        [e],
      ],
      [
        'r4: an assertion on a label in a literal, through resolves, a matcher not listed',
        `${loader}await expect([legalRecordLabel('example-1.json')]).resolves.toSatisfy(cb);\nexpect({ evidence: legalRecordLabel('example-2.json') }).not.toSatisfy(cb);`,
        [e, e],
      ],
      [
        'r4: an assertion on a label that is kept, not matched',
        `${loader}const assertion = expect(legalRecordLabel('example-1.json'));`,
        [e],
      ],
      [
        'r3: the stored bytes parsed bare (the byte reader is gone)',
        `${bytes}JSON.parse(readLegalRecordBytes('example-1.json').toString('utf8'));`,
        [a],
      ],
      [
        'r3: the stored bytes handed to an imported parser',
        `${bytes}import { parseSnapshot } from '../fixtures/spells-530/data';\nparseSnapshot(readLegalRecordBytes('example-1.json'));`,
        [a],
      ],
      [
        'r3: a helper imported under another name',
        `import { readBatchInventory as read } from './batch-ownership';\nread('example-1.json');`,
        [a],
      ],
      [
        'r3: a helper from a module not on the list',
        `import { readBatchInventory } from './other-ownership';\nreadBatchInventory('example-1.json');`,
        [a],
      ],
      [
        "r3: a helper's name redeclared",
        `${loader}${helper}function check(readBatchInventory) { return readBatchInventory('example-1.json'); }`,
        [loaderForm],
      ],
    ])('refuses %s', (_, source, expected) => {
      expect(rules(source).sort()).toEqual([...expected].sort());
      // With nothing encoded only the loader's import forms and rule e hold.
      expect(rules(source, [])).toEqual(
        expected.filter((rule) => rule === loaderForm || rule === e),
      );
    });

    it('refuses a file read in a name-taking helper module', () => {
      expect(
        check({
          'tests/catalog/batch-ownership.ts': `${loader}export const raw = (p) => JSON.parse(readFileSync(p, 'utf8'));\nexport const inventory = (name) => readLegalRecord(name);`,
        }),
      ).toEqual([
        'tests/catalog/batch-ownership.ts:2: lists or reads files in a module in legalRecordNameHelpers (rule a); read a record there only through the loader.',
        'tests/catalog/batch-ownership.ts:2: lists or reads files in a module in legalRecordNameHelpers (rule a); read a record there only through the loader.',
      ]);
    });

    it('accepts a label where it stands as a reference', () => {
      expect(
        check({
          [path]: `${loader}const evidence = [legalRecordLabel('example-1.json')];
const hold = { evidence: legalRecordLabel('example-1.json') };
const cites = (cited) => cited === legalRecordLabel('example-1.json') || cited !== legalRecordLabel('example-2.json');
const problems = [\`\${legalRecordLabel('example-1.json')}: changed\`, 'see ' + legalRecordLabel('example-2.json')];
expect(legalRecordLabel('example-1.json')).toBe(x);
expect(paths).not.toContain(legalRecordLabel('example-1.json'));
expect(problems).toEqual([\`\${legalRecordLabel(name)}: missing\`]);
expect(row).toHaveProperty('evidence', legalRecordLabel('example-2.json'));
holds.push({ name, evidence: [legalRecordLabel('example-2.json')] });
expect([legalRecordLabel('example-1.json')]).not.toEqual([]);
await expect(found).resolves.toContain(legalRecordLabel('example-1.json'));
await expect({ evidence: [legalRecordLabel('example-2.json')] }).resolves.toStrictEqual(x);`,
        }),
      ).toEqual([]);
    });

    // A documented limit of the guarantee (root's decision 2026-11-15): a
    // label put into a variable-held object and read back later is not seen.
    it('documented limit: passes a label stored in an object and read back later in the same module', () => {
      expect(
        check({
          [path]: `${loader}const hold = { evidence: legalRecordLabel('example-1.json') };\nJSON.parse(readFileSync(hold.evidence, 'utf8'));`,
        }),
      ).toEqual([]);
    });

    // Round 5: transparent syntax (parentheses, type assertions, `!`) is
    // looked through in both directions wherever rule a or rule e asks what
    // holds, consumes or calls a node. Rule e(i) also climbs from a literal
    // through syntax that may hand its value on (`await`, a conditional's
    // branch, a comma's last operand, a logical operand); a label or a name
    // there still fails, as before.
    describe('looks through syntax that hands a value on', () => {
      const label = "legalRecordLabel('example-1.json')";
      const transparent: [string, (x: string) => string][] = [
        ['parentheses', (x) => `(${x})`],
        ['as const', (x) => `${x} as const`],
        ['as a type', (x) => `${x} as string[]`],
        ['satisfies', (x) => `${x} satisfies object`],
        ['a non-null assertion', (x) => `${x}!`],
        ['an angle-bracket assertion', (x) => `<const>${x}`],
        ['nested: !, as const, parentheses', (x) => `((${x} as const)!)`],
        ['nested: <const>, satisfies', (x) => `<const>(${x} satisfies object)`],
      ];
      const choosing: [string, (x: string) => string][] = [
        ['await', (x) => `await ${x}`],
        ['a conditional branch', (x) => `(c ? 0 : ${x})`],
        ["a comma's last operand", (x) => `(0, ${x})`],
        ['a logical operand', (x) => `(x ?? ${x})`],
        ['nested: a branch, as const', (x) => `(c ? (${x} as const) : 0)`],
      ];
      const wrappers = [...transparent, ...choosing];
      // A container read where it stands; `o` is the outer literal.
      const consumers: [string, (o: string) => string][] = [
        [
          'a member taken',
          (o) => `JSON.parse(readFileSync((${o}).evidence[0], 'utf8'));`,
        ],
        [
          'an element taken',
          (o) => `JSON.parse(readFileSync((${o})['evidence'], 'utf8'));`,
        ],
        ['spread', (o) => `const copy = { ...${o} };`],
        ['destructured', (o) => `const { evidence } = ${o};`],
        ['called', (o) => `(${o})();`],
      ];
      // The wrapper stands between the nested literals and around the outer one.
      const read = wrappers.flatMap(([wrapper, wrap]) =>
        consumers.map(([consumer, consume]) => {
          const outer = wrap(`{ evidence: ${wrap(`[${label}]`)} }`);
          return [wrapper, consumer, `${loader}${consume(outer)}`];
        }),
      );
      it.each(read)(
        'refuses a label in literals around %s, %s',
        (_, __, source) => {
          expect(rules(source)).toEqual([e]);
          expect(rules(source, [])).toEqual([e]);
        },
      );

      it('keeps an array spread into an array literal held, and refuses it read', () => {
        const spread = `[...(c ? [] : [\`\${${label}}: changed\`])]`;
        expect(rules(`${loader}const problems = ${spread};`)).toEqual([]);
        expect(
          rules(`${loader}JSON.parse(readFileSync(${spread}[0]));`),
        ).toEqual([e]);
        expect(rules(`${loader}[...${label}];`)).toEqual([e]);
      });

      it('refuses the review round 5 reproductions', () => {
        expect(
          rules(
            `${loader}JSON.parse(readFileSync(({ evidence: [${label}] as const }).evidence[0], 'utf8'));\nJSON.parse(readFileSync(({ hold: ({ evidence: ${label} }) }).hold.evidence, 'utf8'));\n({ hold: c ? { evidence: ${label} } : {} }).hold.evidence;`,
          ),
        ).toEqual([e, e, e]);
      });

      const places: [string, (l: string) => string][] = [
        ['an array element', (l) => `const evidence = [${l}];`],
        ['an object value', (l) => `const hold = { evidence: ${l} };`],
        ['an operand of ===', (l) => `const cited = p === ${l};`],
        ['an expect argument', (l) => `expect(${l}).toBe(x);`],
      ];
      const placed = (list: typeof wrappers) =>
        list.flatMap(([wrapper, wrap]) =>
          places.map(([place, put]) => {
            const wrapped = wrap(label).replace(' as string[]', ' as string');
            return [
              place,
              wrapper,
              `${loader}${put(wrapped)}\n${put(`(${wrapped})`)}`,
            ];
          }),
        );
      it.each(placed(transparent))(
        'accepts a label in %s, through %s',
        (_, __, source) => {
          expect(rules(source)).toEqual([]);
        },
      );
      it.each(placed(choosing))(
        'refuses a label in %s, through %s, as before',
        (_, __, source) => {
          expect(rules(source)).toEqual([e, e]);
        },
      );

      it('passes a wrapped name to the loader as it passes the bare one (rule a)', () => {
        const source = `${loader}readLegalRecord(('example-1.json'));\nreadLegalRecord('example-1.json' as string);\n(readLegalRecord)(<string>'example-2.json');`;
        expect(rules(source)).toEqual([]);
        expect(
          rules(
            `${loader}readFileSync(('scripts/catalog/legal/example-1.json' as string));`,
          ),
        ).toEqual([a]);
      });

      it('follows an expect chain and a label call through the same syntax', () => {
        expect(
          rules(
            `${loader}(expect((${label}))).toBe(x);\n(expect(${label})!.not.toEqual)(x);\n[(legalRecordLabel)('example-1.json')];`,
          ),
        ).toEqual([]);
        expect(
          rules(
            `${loader}(expect(${label}))!.toSatisfy(cb);\n(expect([${label}] as const).not).toSatisfy(cb);`,
          ),
        ).toEqual([e, e]);
      });
    });

    it('accepts a complete path to one file that is not encoded, in a module that reads files (rules b and d)', () => {
      expect(
        rules(`JSON.parse(readFileSync('scripts/catalog/legal/held-notices.json', 'utf8'));
JSON.parse(readFileSync(\`\${root}/scripts/catalog/legal/held-notices.json\`, 'utf8'));
JSON.parse(readFileSync(root + '/scripts/catalog/legal/held-notices.json', 'utf8'));
problems.push(\`\${key}: scripts/catalog/legal/feats-000.json records no candidate\`);
import { x } from '../../scripts/catalog/legal/attribution-227';`),
      ).toEqual([]);
    });

    it('refuses a path into another inventory family in a module that reads files, but not where nothing is read (rules b and d)', () => {
      const builder = `export const pathOf = (n) => \`scripts/catalog/legal/racial-traits-\${n}.json\`;`;
      expect(rules(builder)).toEqual([]);
      expect(
        rules(`${builder}\nJSON.parse(readFileSync(pathOf(402), 'utf8'));`),
      ).toEqual([b]);
    });

    it("resolves a relative literal from the module's own directory (rules b and d)", () => {
      const scripts = (source: string) =>
        check({ 'scripts/catalog/reader.ts': source }).map(
          (problem) => /\(rule [abcde]\)/.exec(problem)?.[0],
        );
      expect(
        scripts(
          `JSON.parse(readFileSync(new URL(\`./legal/example-\${n}.json\`, import.meta.url), 'utf8'));\nreaddirSync(new URL('./legal/', import.meta.url));`,
        ).sort(),
      ).toEqual([b, b, d]);
      expect(
        scripts(
          `import held from './legal/held-notices.json';\nimport { x } from './legal/attribution-227';\nreadFileSync(new URL('./legal/held-notices.json', import.meta.url));`,
        ),
      ).toEqual([]);
      // From tests/catalog the same literal names another directory.
      expect(
        rules(
          `readFileSync(new URL(\`./legal/example-\${n}.json\`, import.meta.url));`,
        ),
      ).toEqual([]);
    });

    it('names the file, the line, the literal and the allowed form', () => {
      expect(
        check({
          [path]: `${loader}\nJSON.parse(readFileSync('scripts/catalog/legal/example-1.json', 'utf8'));`,
        }),
      ).toEqual([
        `${path}:3: 'scripts/catalog/legal/example-1.json' names an encoded legal record (rule a); name it only as the argument of readLegalRecord, legalRecordSha256 or legalRecordLabel, imported from legal-records.ts, or of a function imported from a module in legalRecordNameHelpers.`,
      ]);
    });

    it('refuses every listed unwired scanner while a record is encoded (rule c)', () => {
      const problems = (encoded: string[]) =>
        findLegalRecordGuardProblems({
          files: new Map(),
          encoded,
          unwired: ['scripts/catalog/scan.ts'],
        });
      expect(problems(['example-1.json'])).toEqual([
        'scripts/catalog/scan.ts:1: is in unwiredLegalRecordScanners (rule c); wire it to readLegalRecords() and drop it from the list before any record is encoded.',
      ]);
      expect(problems([])).toEqual([]);
    });

    it("accepts the wired callers' forms", () => {
      expect(
        check({
          'tests/catalog/reader.test.ts': `${loader}${helper}readLegalRecord('example-1.json');
legalRecordSha256('example-1.json');
expect(heldNotices[0]).toMatchObject({ evidence: [legalRecordLabel('example-1.json')] });
expect(findCommittedBatchOwnershipProblems('example-2.json')).toEqual([]);
readBatchInventory('example-1.json');
readLegalRecord(\`\${batch}.json\`);
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
JSON.parse(readFileSync('scripts/catalog/legal/held-notices.json', 'utf8'));`,
          'tests/catalog/scan.test.ts': `${loader}for (const { name, record } of readLegalRecords((name) => name !== 'held-notices.json')) use(name, record);
for (const { record } of readLegalRecordsIn(root, isInventory)) use(record);`,
          'scripts/catalog/legal/notice-tool.ts': `import { section15 } from '../legal';\nimport { x } from '../catalog/legal';\nreadFileSync('notes.json');`,
          'tests/fixtures/spells-530/data.ts': `${loader}export function snapshot(p) { return JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8')); }\nexport const review = readLegalRecord('example-1.json');\nexport const preview = snapshot('preview.json');`,
        }),
      ).toEqual([]);
    });
  });
});
