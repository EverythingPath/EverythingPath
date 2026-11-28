/**
 * Probes of the loader guard (`legal-loader-reach.ts`): the Spec reviewer's
 * twenty cases of round 2 (`R/pbl-inventory-slim-review-r2/probes/
 * guard-probes.mjs`), two of the implementer's, five of fix r3 (JSDoc, and
 * an unquoted mention that must pass), then seven of fix r4 (a quoted path
 * in a comment, stacked JSDoc blocks, a cast, a callback, and an
 * interpolated template that must pass). Each edits a scratch copy of the graph:
 * `prefix` goes before `path`'s source, and each of `added` before its
 * file's (a new file is the text alone). `expected` is what the guard gives:
 * every reference to the loader in a reachable module fails, naming it.
 */
export type LoaderProbe = {
  name: string;
  path: string;
  prefix: string;
  added?: Readonly<Record<string, string>>;
  expected: readonly string[];
};

const build = 'scripts/catalog/launch-inventory-build.ts';
const loader = 'scripts/catalog/legal-records.ts';
const intermediate = 'scripts/catalog/reviewer-indirect.ts';
const shim = 'scripts/catalog/reviewer-shim.cjs';
const reachedLoader = `${loader}: reachable from the entries`;
const unnamed = `${build}: loads a module it cannot name`;

export const loaderProbes: readonly LoaderProbe[] = [
  {
    name: 'alias',
    expected: [reachedLoader, `${build}:1: names the loader`],
    path: build,
    prefix:
      "import { readLegalRecord as readBatchRecord } from './legal-records.ts';",
  },
  {
    name: 'namespace',
    expected: [reachedLoader, `${build}:1: names the loader`],
    path: build,
    prefix: "import * as records from './legal-records.ts';",
  },
  {
    name: 're-export and call through one intermediary',
    expected: [
      reachedLoader,
      'scripts/catalog/reviewer-indirect.ts:1: names the loader',
    ],
    path: build,
    prefix:
      "import { readLegalRecord } from './reviewer-indirect.ts';\nvoid readLegalRecord('drafts.json');",
    added: {
      [intermediate]: "export { readLegalRecord } from './legal-records.ts';",
    },
  },
  {
    name: 'literal dynamic import',
    expected: [reachedLoader, `${build}:1: names the loader`],
    path: build,
    prefix: "const records = await import('./legal-records.ts');",
  },
  {
    name: 'nonliteral dynamic import',
    expected: [`${build}:1: names the loader`, unnamed],
    path: build,
    prefix:
      "const readerModule = './legal-records.ts';\nconst records = await import(readerModule);",
  },
  {
    name: 'direct readLegalRecordsIn import',
    expected: [reachedLoader, `${build}:1: names the loader`],
    path: build,
    prefix: "import { readLegalRecordsIn } from './legal-records.ts';",
  },
  {
    name: 'allowed label on intermediary',
    expected: [
      reachedLoader,
      'scripts/catalog/reviewer-indirect.ts:1: names the loader',
    ],
    path: intermediate,
    prefix: "import { legalRecordLabel } from './legal-records.ts';",
    added: { [build]: "import './reviewer-indirect.ts';" },
  },
  {
    name: 'default',
    expected: [reachedLoader, `${build}:1: names the loader`],
    path: build,
    prefix: "import records from './legal-records.ts';",
  },
  {
    name: 'literal require',
    expected: [reachedLoader, `${build}:1: names the loader`],
    path: build,
    prefix: "const records = require('./legal-records.ts');",
  },
  {
    name: 'nonliteral require',
    expected: [`${build}:1: names the loader`, unnamed],
    path: build,
    prefix:
      "const path = './legal-records.ts';\nconst records = require(path);",
  },
  {
    name: 'import equals require',
    expected: [reachedLoader, `${build}:1: names the loader`],
    path: build,
    prefix: "import records = require('./legal-records.ts');",
  },
  {
    name: 'same-name alias',
    expected: [reachedLoader, `${build}:1: names the loader`],
    path: build,
    prefix:
      "import { legalRecordLabel as legalRecordLabel } from './legal-records.ts';",
  },
  {
    name: 'bare side-effect import',
    expected: [reachedLoader, `${build}:1: names the loader`],
    path: build,
    prefix: "import './legal-records.ts';",
  },
  {
    name: 'empty named import',
    expected: [reachedLoader, `${build}:1: names the loader`],
    path: build,
    prefix: "import {} from './legal-records.ts';",
  },
  {
    name: 'type import query',
    expected: [reachedLoader, `${build}:1: names the loader`],
    path: build,
    prefix:
      "type Reader = typeof import('./legal-records.ts').readLegalRecord;",
  },
  {
    name: 'Node CommonJS module.require in imported shim',
    expected: [
      reachedLoader,
      'scripts/catalog/reviewer-shim.cjs:1: names the loader',
    ],
    path: build,
    prefix: "import './reviewer-shim.cjs';",
    added: {
      [shim]:
        "module.require('./legal-records.ts').readLegalRecordsIn(process.cwd());",
    },
  },
  {
    name: 'Node ESM createRequire in intermediary',
    expected: ['scripts/catalog/reviewer-indirect.ts:3: names the loader'],
    path: build,
    prefix: "import './reviewer-indirect.ts';",
    added: {
      [intermediate]:
        "import { createRequire } from 'node:module';\nconst load = createRequire(import.meta.url);\nload('./legal-records.ts').readLegalRecordsIn(process.cwd());",
    },
  },
  {
    name: 'nonliteral import in loader itself',
    expected: [],
    path: loader,
    prefix:
      'async function loadAdditionalFormatter(modulePath: string) { return import(modulePath); }',
  },
  {
    name: 'Vite glob of loader',
    // The glob also reaches the legal-record proof, which names the loader.
    expected: [
      reachedLoader,
      'scripts/catalog/legal-record-proof.ts:35: names the loader',
    ],
    path: build,
    prefix:
      "const modules = import.meta.glob('./legal-*.ts', { eager: true });",
  },
  {
    name: 'Vitest importActual literal',
    expected: [reachedLoader, `${build}:1: names the loader`],
    path: build,
    prefix: "const records = await vi.importActual('./legal-records.ts');",
  },
  {
    name: 'a reader reached through two intermediate modules',
    expected: [
      reachedLoader,
      'scripts/catalog/probe-inner.ts:1: names the loader',
    ],
    path: build,
    prefix: "import { readRecord } from './probe-outer.ts';",
    added: {
      'scripts/catalog/probe-outer.ts':
        "export { readRecord } from './probe-inner.ts';",
      'scripts/catalog/probe-inner.ts':
        "export { readLegalRecord as readRecord } from './legal-records.ts';",
    },
  },
  {
    name: "a path to the loader in a reachable JSON-reading helper's string constant",
    expected: ['scripts/catalog/probe-json.ts:2: names the loader'],
    path: build,
    prefix: "import { readHelperJson } from './probe-json.ts';",
    added: {
      'scripts/catalog/probe-json.ts':
        "import { readFileSync } from 'node:fs';\nconst recordsModule = 'scripts/catalog/legal-records.ts';\nexport const readHelperJson = () => JSON.parse(readFileSync(recordsModule, 'utf8'));",
    },
  },
  {
    name: 'a JSDoc @type with an import type in a .mjs helper',
    path: build,
    prefix: "import './probe-doc.mjs';",
    added: {
      'scripts/catalog/probe-doc.mjs':
        "/** @type {typeof import('./legal-records.ts')} */\nexport let records;",
    },
    expected: ['scripts/catalog/probe-doc.mjs:1: names the loader'],
  },
  {
    name: 'a JSDoc @import in a .mjs helper',
    path: build,
    prefix: "import './probe-doc.mjs';",
    added: {
      'scripts/catalog/probe-doc.mjs':
        "/** @import { readLegalRecord } from './legal-records.ts' */\nexport const reader = undefined;",
    },
    expected: ['scripts/catalog/probe-doc.mjs:1: names the loader'],
  },
  {
    name: 'a JSDoc @type with an import type in a .cjs helper',
    path: build,
    prefix: "import './probe-doc.cjs';",
    added: {
      'scripts/catalog/probe-doc.cjs':
        "/** @type {typeof import('./legal-records.ts').readLegalRecord | undefined} */\nlet reader;\nmodule.exports = reader;",
    },
    expected: ['scripts/catalog/probe-doc.cjs:1: names the loader'],
  },
  {
    name: 'a JSDoc @typedef with an import type in a .ts module',
    path: build,
    prefix: "/** @typedef {typeof import('./legal-records.ts')} Records */",
    expected: [`${build}:1: names the loader`],
  },
  {
    name: "an unquoted mention of the loader's path in a comment, which passes",
    path: build,
    prefix:
      '// The loader is scripts/catalog/legal-records.ts; nothing here reads it.',
    expected: [],
  },
  {
    name: 'a quoted loader path in an ordinary comment, now refused',
    path: build,
    prefix: "// Formerly read through './legal-records.ts'.",
    expected: [`${build}:1: names the loader`],
  },
  {
    name: 'two JSDoc blocks stacked on one exported declaration, the path in the first',
    path: build,
    prefix: "import './probe-stacked.mjs';",
    added: {
      'scripts/catalog/probe-stacked.mjs':
        "/** @import { readLegalRecord } from './legal-records.ts' */\n/** @type {unknown} */\nexport let reader;",
    },
    expected: ['scripts/catalog/probe-stacked.mjs:1: names the loader'],
  },
  {
    name: 'two JSDoc blocks stacked on a CommonJS assignment in a .cjs helper',
    path: build,
    prefix: "import './probe-stacked.cjs';",
    added: {
      'scripts/catalog/probe-stacked.cjs':
        "/** @typedef {typeof import('./legal-records.ts')} Records */\n/** @type {number} */\nexports.count = 0;",
    },
    expected: ['scripts/catalog/probe-stacked.cjs:1: names the loader'],
  },
  {
    name: 'an inline JSDoc cast',
    path: build,
    prefix: "import './probe-cast.mjs';",
    added: {
      'scripts/catalog/probe-cast.mjs':
        "export const reader = /** @type {typeof import('./legal-records.ts').readLegalRecord} */ (null);",
    },
    expected: ['scripts/catalog/probe-cast.mjs:1: names the loader'],
  },
  {
    name: 'a @callback with a @returns import type',
    path: build,
    prefix: "import './probe-callback.mjs';",
    added: {
      'scripts/catalog/probe-callback.mjs':
        "/**\n * @callback Reader\n * @returns {typeof import('./legal-records.ts').readLegalRecord}\n */\nexport const format = () => undefined;",
    },
    expected: ['scripts/catalog/probe-callback.mjs:3: names the loader'],
  },
  {
    name: 'an interpolated template that would evaluate to the path, which passes',
    path: build,
    prefix:
      "const recordsName = 'records';\nconst assembled = `./legal-${recordsName}.ts`;",
    expected: [],
  },
];
