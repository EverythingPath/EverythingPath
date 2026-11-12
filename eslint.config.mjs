import { readFileSync } from 'node:fs';
import { defineConfig, globalIgnores } from 'eslint/config';
import pluginQuery from '@tanstack/eslint-plugin-query';
import eslintConfigPrettier from 'eslint-config-prettier';
import convexPlugin from '@convex-dev/eslint-plugin';
import nextPlugin from '@next/eslint-plugin-next';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import vitest from '@vitest/eslint-plugin';
import { testHygieneRule } from './scripts/lib/eslint-test-hygiene.mjs';

// No `as` casts or `x!` non-null assertions in application code. Inline
// ESLint config stays off, so an assertion that validation or the platform
// makes safe carries its reason in a line comment block starting
// `// Safe cast: <why>`, right above the assertion's line or its statement.
// Each reason covers one assertion, and a reason with no assertion after it
// is an error too.
const safeCast = /^ Safe cast: \S/;
const typeAssertions = tseslint.plugin.rules['consistent-type-assertions'];
const nonNullAssertions = tseslint.plugin.rules['no-non-null-assertion'];
const reasonedAssertions = {
  meta: {
    ...typeAssertions.meta,
    messages: {
      ...typeAssertions.meta.messages,
      ...nonNullAssertions.meta.messages,
      unusedReason:
        'No type assertion or non-null assertion follows this safe-cast reason.',
    },
  },
  defaultOptions: typeAssertions.defaultOptions,
  create(context) {
    const { sourceCode } = context;
    // Each reason by the line right after its comment block.
    const reasons = new Map();
    for (const comment of sourceCode.getAllComments()) {
      if (comment.type !== 'Line' || !safeCast.test(comment.value)) continue;
      let last = comment;
      for (;;) {
        const next = sourceCode.getTokenAfter(last, { includeComments: true });
        if (
          next?.type !== 'Line' ||
          next.loc.start.line !== last.loc.end.line + 1 ||
          safeCast.test(next.value)
        )
          break;
        last = next;
      }
      reasons.set(last.loc.end.line + 1, comment);
    }
    const used = new Set();
    // A reason covers one assertion: on the line below it, else in the
    // statement.
    const reasonLine = (node) => {
      let statement = node.parent;
      while (statement && !/(Statement|Declaration)$/.test(statement.type))
        statement = statement.parent;
      return [node.loc.start.line, statement?.loc.start.line].find(
        (line) => reasons.has(line) && !used.has(line),
      );
    };
    const reasonedContext = Object.create(context, {
      report: {
        value(descriptor) {
          const line = reasonLine(descriptor.node);
          if (line === undefined) context.report(descriptor);
          else used.add(line);
        },
      },
    });
    const visitors = [
      typeAssertions.create(reasonedContext),
      nonNullAssertions.create(reasonedContext),
      {
        'Program:exit'() {
          for (const [line, comment] of reasons)
            if (!used.has(line))
              context.report({ loc: comment.loc, messageId: 'unusedReason' });
        },
      },
    ];
    const merged = {};
    for (const visitor of visitors)
      for (const [selector, visit] of Object.entries(visitor)) {
        const previous = merged[selector];
        merged[selector] = previous
          ? (node) => {
              previous(node);
              visit(node);
            }
          : visit;
      }
    return merged;
  },
};

// One plugin object, shared by every block that names it.
const localPlugin = {
  rules: {
    'reasoned-assertions': reasonedAssertions,
    'test-hygiene': testHygieneRule,
  },
};

const testImports = {
  group: ['**/*-test-*', '**/*.test', '**/*.test.*'],
  message: 'Test fixtures and doubles belong in tests only.',
};
// The project service skips the contents of non-TypeScript files over 4 MiB,
// so a large data file imported directly turns `any` once it outgrows that.
// Each goes through one schema-parsed loader instead.
const catalogDataLoaders = [
  'scripts/catalog/reviewed-curation-data.ts',
  'src/lib/catalog/reviewed-data.ts',
];
const catalogDataImports = {
  group: [
    '**/reviewed-curation.json',
    '**/attribution-assessments.json',
    '**/attribution-evidence.json',
  ],
  message:
    'Import large catalog data through its loader: reviewedCuration or reviewedAdmission.',
};

// Tests must not bind to the machine they run on: its home directory, local
// checkouts, disposable Git history or skips on what is installed.
// local/test-hygiene (scripts/lib/eslint-test-hygiene.mjs) holds the checks
// that depend on bindings: skipIf/runIf guards and the home directory. The
// textual checks stay here. Regexes spell `/` as \x2F, which esquery's regex
// syntax cannot hold. tests/fixtures/eslint-test-hygiene/ lists the routes
// each rule refuses and the residuals; tests/eslint-test-hygiene.test.ts
// checks them. Both are a syntactic ratchet, not a security boundary; the
// residuals: names computed at run time (os['home' + 'dir'], Reflect.get),
// templates split across interpolations, and values that pass through a
// call, an array, a spread or a type assertion (read(process.env)). Aliases
// of process.env or of an os binding are refused: a name written from a
// source may be it.

// A string literal by its value, and a template's text both cooked (escapes
// decoded, as an untagged template evaluates) and raw (what String.raw and
// other tags read, and the only text of a tagged template with an invalid
// escape). A path split across interpolations (`/ho${''}me/`) has no literal
// part that names it and passes.
const textMatching = (literal, template = literal) =>
  `:matches(Literal[value=${literal}], TemplateElement:matches([value.cooked=${template}], [value.raw=${template}]))`;
const hostPath = String.raw`/~\x2Frepos|^~\x2F|\x2Fhome\x2F|\x2FUsers\x2F/`;

const testHygiene = [
  {
    selector: textMatching(hostPath),
    message: 'No absolute or home-relative paths in tests.',
  },
  {
    selector: textMatching(
      String.raw`/^[0-9a-f]{7,40}:\S/`,
      '/^[0-9a-f]{7,40}:/',
    ),
    message:
      'Tests must not read disposable Git history (<sha>:<path>); commit the expectation.',
  },
];
// The sanctioned source-dependent audits (owner 2026-11-02): they read sources
// only the gate host has, so the test-hygiene rules do not apply to them. The
// pinned list is the one source; eslint-host-audits.test.ts keeps it and this
// exception in step.
const hostAuditFiles = [
  ...new Set(
    JSON.parse(
      readFileSync(
        new URL('./scripts/orchestration/host-audits.json', import.meta.url),
        'utf8',
      ),
    ).tests.map((test) => test.file),
  ),
];

// Ratchet (owner 2026-11-02): max-params, complexity, react/no-multi-comp,
// the test-hygiene rules (local/test-hygiene and no-restricted-syntax) and vitest/require-to-throw-message
// are errors. eslint-suppressions.json records their violations, for one
// reason: pre-existing at the W3 baseline (owner 2026-11-02). Both lint:eslint
// scripts read it, and an unused suppression fails lint, so the count only
// goes down: fix a site when you touch it, then run the script with
// --prune-suppressions. Never add to the file.

export default defineConfig([
  globalIgnores([
    'node_modules/**',
    '.local-convex/**',
    '.convex/**',
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'convex/_generated/**',
    // Agent worktrees and local scratch files are not part of the project.
    '.claude/**',
    '.scratch/**',
  ]),
  {
    name: 'defaultconfig',
    files: ['**/*.ts', '**/*.tsx'],
    extends: [
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      eslintConfigPrettier,
    ],
    plugins: {
      '@next/next': nextPlugin,
      react: react,
      local: localPlugin,
    },
    rules: {
      'no-console': 'error',
      'max-params': ['error', 3],
      complexity: ['error', 10],
      'react/no-array-index-key': 'error',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/require-await': 'off',
      'local/reasoned-assertions': ['error', { assertionStyle: 'never' }],
      'no-implicit-coercion': [
        'error',
        { boolean: true, number: false, string: false },
      ],
      'no-restricted-imports': [
        'error',
        { patterns: [testImports, catalogDataImports] },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "Property:matches([key.name='sheetDemo'], [key.value='sheetDemo']):matches([value.value=true], [value.expression.value=true])",
          message:
            'Only demo and fixture seeding may hard-code `sheetDemo: true`; allow the file in the sheet-demo-writers block.',
        },
      ],
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      ...eslintConfigPrettier.rules,
      // Rules from next/core-web-vitals and next/typescript
      '@next/next/no-html-link-for-pages': 'off', // Example, adjust as needed
      // Add other Next.js specific rules here if needed
    },
    settings: {
      react: { version: 'detect' },
    },
    languageOptions: {
      // The project service keeps one TypeScript program per tsconfig alive
      // for the whole run, and the root and convex/ programs together
      // outgrow a 4 GB heap. `pnpm lint:eslint` therefore lints convex/ in
      // its own process (lint:eslint:app, lint:eslint:convex).
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    name: 'react-hooks',
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/set-state-in-effect': 'error',
      'react/no-multi-comp': ['error', { ignoreStateless: false }],
    },
  },
  {
    name: 'test-files',
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      'vitest.config.ts',
      'vitest.setup.ts',
    ],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    // Tests and their fixtures assert, coerce, import test code and seed
    // sheet demos freely.
    name: 'test-code',
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*-test-*.ts',
      '**/*-test-*.tsx',
      'tests/**',
      'e2e/**',
    ],
    rules: {
      'local/reasoned-assertions': 'off',
      'no-implicit-coercion': 'off',
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    name: 'catalog-data-in-tests',
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*-test-*.ts',
      '**/*-test-*.tsx',
      'tests/**',
      'e2e/**',
    ],
    rules: {
      'no-restricted-imports': ['error', { patterns: [catalogDataImports] }],
    },
  },
  {
    name: 'test-hygiene',
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.test.mjs', 'tests/**'],
    plugins: { vitest, local: localPlugin },
    rules: {
      'local/test-hygiene': 'error',
      'no-restricted-syntax': ['error', ...testHygiene],
      'vitest/require-to-throw-message': 'error',
    },
  },
  {
    name: 'host-audits',
    files: hostAuditFiles,
    rules: {
      'local/test-hygiene': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    name: 'catalog-data-loaders',
    files: catalogDataLoaders,
    rules: {
      'no-restricted-imports': ['error', { patterns: [testImports] }],
    },
  },
  {
    // Files that may hard-code `sheetDemo: true`.
    name: 'sheet-demo-writers',
    files: [
      // create: a private sheet, refused unless the user holds the
      // server-seeded characterSheetDemo grant.
      'convex/characterSheet.ts',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
      noInlineConfig: true,
    },
  },
  ...convexPlugin.configs.recommended,
  ...pluginQuery.configs['flat/recommended'],
]);
