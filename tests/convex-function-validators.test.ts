/// <reference types="vite/client" />

import { convexToJson, v } from 'convex/values';
import { defineSchema, defineTable } from 'convex/server';
import { beforeAll, expect, test } from 'vitest';
import { query } from '../convex/_generated/server';
import schema from '../convex/schema';
import {
  militiaSnapshotCharacterReferencePaths,
  weeklyDraftCharacterReferencePaths,
} from '../src/lib/militia-character-references';

const modules = import.meta.glob<Record<string, unknown>>([
  '../convex/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
  '!../convex/_generated/**',
  '!../convex/**/*.d.ts',
  '!../convex/**/*.{test,spec}.{ts,js}',
  '!../convex/**/convex.config.{ts,js}',
  '!../convex/**/auth.config.{ts,js}',
]);
const loadedModules: [string, Record<string, unknown>][] = [];

beforeAll(async () => {
  for (const [modulePath, load] of Object.entries(modules)) {
    // Mirror Convex entrypoint exclusions, including tests and configuration.
    const basename = modulePath.slice(modulePath.lastIndexOf('/') + 1);
    if (
      basename.split('.').length !== 2 ||
      basename.startsWith('.') ||
      basename.startsWith('#') ||
      modulePath.includes(' ') ||
      basename === 'schema.ts' ||
      basename === 'schema.js'
    )
      continue;
    loadedModules.push([modulePath, await load()]);
  }
}, 60_000);

function validatorJson(validator: unknown): unknown {
  if (
    typeof validator !== 'object' ||
    validator === null ||
    !('json' in validator)
  )
    throw new Error('Validator does not export JSON metadata');
  return validator.json;
}

function characterReferencePaths(
  validator: unknown,
  path = '',
  field = '',
): string[] {
  if (typeof validator !== 'object' || validator === null) return [];
  if (!('type' in validator)) return [];
  if (
    (validator.type === 'id' &&
      'tableName' in validator &&
      validator.tableName === 'character') ||
    (validator.type === 'string' &&
      /^(characterIds?|.*CharacterIds?)$/.test(field))
  )
    return [path];
  if (!('value' in validator)) return [];
  if (validator.type === 'array')
    return characterReferencePaths(validator.value, `${path}.*`, field);
  if (validator.type === 'union' && Array.isArray(validator.value))
    return validator.value.flatMap((member) =>
      characterReferencePaths(member, path, field),
    );
  if (
    validator.type === 'object' &&
    typeof validator.value === 'object' &&
    validator.value !== null
  )
    return Object.entries(validator.value).flatMap(([name, metadata]) => {
      if (
        typeof metadata !== 'object' ||
        metadata === null ||
        !('fieldType' in metadata)
      )
        throw new Error(`Missing validator metadata for ${path}.${name}`);
      return characterReferencePaths(
        metadata.fieldType,
        path ? `${path}.${name}` : name,
        name,
      );
    });
  return [];
}

test('every saved militia snapshot and Weekly Draft Character reference is explicitly listed', () => {
  for (const [table, root, declaredPaths] of [
    [
      schema.tables.canonicalMilitiaState,
      'snapshot',
      militiaSnapshotCharacterReferencePaths,
    ],
    [
      schema.tables.canonicalWeeklyDraft,
      'draft',
      weeklyDraftCharacterReferencePaths,
    ],
    [
      schema.tables.canonicalWeeklyDraft,
      'initialDraft',
      weeklyDraftCharacterReferencePaths,
    ],
  ] as const) {
    const prefix = `${root}.`;
    const schemaPaths = characterReferencePaths(validatorJson(table.validator))
      .filter((path) => path.startsWith(prefix))
      .map((path) => path.slice(prefix.length));
    expect([...new Set(schemaPaths)].sort()).toEqual([...declaredPaths].sort());
  }
});

test('the Character reference coverage guard finds new named fields and Character IDs in nested schema unions', () => {
  const fixture = defineTable({
    nested: v.array(
      v.union(
        v.object({ futureCharacterId: v.optional(v.string()) }),
        v.object({ subject: v.id('character') }),
        v.object({ futureCharacterIds: v.array(v.string()) }),
        v.object({ notes: v.string() }),
      ),
    ),
  });
  expect(characterReferencePaths(validatorJson(fixture.validator))).toEqual([
    'nested.*.futureCharacterId',
    'nested.*.subject',
    'nested.*.futureCharacterIds.*',
  ]);
});

function invalidValidators(validator: unknown, path: string): string[] {
  if (Array.isArray(validator))
    return validator.flatMap((member, index) =>
      invalidValidators(member, `${path}[${index}]`),
    );
  if (typeof validator !== 'object' || validator === null) return [];
  const invalid: string[] = [];
  if (
    'type' in validator &&
    validator.type === 'object' &&
    'value' in validator &&
    typeof validator.value === 'object' &&
    validator.value !== null
  ) {
    for (const field of Object.keys(validator.value))
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field))
        invalid.push(`${path}.value[${field}]: invalid object field`);
  }
  if ('type' in validator && validator.type === 'record') {
    if (
      !('keys' in validator) ||
      typeof validator.keys !== 'object' ||
      validator.keys === null ||
      !('type' in validator.keys) ||
      (validator.keys.type !== 'string' && validator.keys.type !== 'id')
    )
      invalid.push(`${path}.keys: expected string or id`);
  }
  return [
    ...invalid,
    ...Object.entries(validator).flatMap(([key, value]) =>
      invalidValidators(value, `${path}.${key}`),
    ),
  ];
}

const convexIdentifier = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === 'object' && entry !== null,
  );
}

function invalidSchemaIdentifiers(definition: unknown): string[] {
  // Deployment rejects these names; convex-test and codegen accept them.
  if (
    typeof definition !== 'object' ||
    definition === null ||
    !('export' in definition) ||
    typeof definition.export !== 'function'
  )
    throw new Error('Schema does not export Convex schema metadata');
  const exported: unknown = JSON.parse(String(definition.export()));
  if (
    typeof exported !== 'object' ||
    exported === null ||
    !('tables' in exported)
  )
    throw new Error('Schema metadata does not list tables');
  const invalid: string[] = [];
  const check = (name: unknown, path: string) => {
    if (typeof name !== 'string' || !convexIdentifier.test(name))
      invalid.push(`${path}: invalid identifier ${String(name)}`);
  };
  for (const table of records(exported.tables)) {
    const tableName = String(table.tableName);
    check(table.tableName, `${tableName}.tableName`);
    for (const kind of [
      'indexes',
      'stagedDbIndexes',
      'searchIndexes',
      'stagedSearchIndexes',
      'vectorIndexes',
      'stagedVectorIndexes',
    ])
      for (const index of records(table[kind])) {
        const path = `${tableName}.${kind}[${String(index.indexDescriptor)}]`;
        check(index.indexDescriptor, path);
        const fields = [
          ...(Array.isArray(index.fields) ? index.fields : []),
          ...(Array.isArray(index.filterFields) ? index.filterFields : []),
          ...('searchField' in index ? [index.searchField] : []),
          ...('vectorField' in index ? [index.vectorField] : []),
        ];
        for (const field of fields)
          for (const segment of String(field).split('.'))
            check(segment, `${path}.field`);
      }
  }
  return invalid;
}

test('all registered Convex functions and schema tables export supported validator metadata', () => {
  // Deployment consumes these exports; convex-test does not validate their shape.
  const checked: string[] = [];
  const invalid: string[] = [];
  for (const [modulePath, module] of loadedModules) {
    for (const [name, registeredFunction] of Object.entries(module)) {
      if (
        registeredFunction === null ||
        (typeof registeredFunction !== 'object' &&
          typeof registeredFunction !== 'function') ||
        (!('exportArgs' in registeredFunction) &&
          !('exportReturns' in registeredFunction))
      )
        continue;
      const path = `${modulePath}:${name}`;
      if (
        !('exportArgs' in registeredFunction) ||
        typeof registeredFunction.exportArgs !== 'function' ||
        !('exportReturns' in registeredFunction) ||
        typeof registeredFunction.exportReturns !== 'function'
      )
        throw new Error(`${path} does not export Convex function metadata`);
      checked.push(path);
      const args: unknown = registeredFunction.exportArgs();
      const returns: unknown = registeredFunction.exportReturns();
      for (const [kind, metadata] of Object.entries({ args, returns })) {
        if (typeof metadata !== 'string')
          throw new Error(`${path}.${kind} metadata is not a string`);
        const validator: unknown = JSON.parse(metadata);
        invalid.push(...invalidValidators(validator, `${path}.${kind}`));
      }
    }
  }
  for (const [tableName, table] of Object.entries(schema.tables)) {
    const path = `../convex/schema.ts:${tableName}`;
    checked.push(path);
    invalid.push(
      ...invalidValidators(
        validatorJson(table.validator),
        `${path}.documentType`,
      ),
    );
  }
  expect(checked).toContain('../convex/characterSheet.ts:read');
  expect(checked).toContain('../convex/initialMigration.ts:start');
  expect(checked).toContain('../convex/clerk.ts:fulfill');
  expect(checked).toContain('../convex/schema.ts:character');
  expect(checked).toContain('../convex/schema.ts:catalogEntry');
  expect(invalid).toEqual([]);
});

test('the schema metadata guard catches nested dotted fields and literal-union record keys', () => {
  const fixture = defineSchema({
    malformed: defineTable({
      nested: v.array(
        v.union(
          v.object({ 'ability.str': v.number() }),
          v.record(v.union(v.literal('hp'), v.literal('bab')), v.number()),
        ),
      ),
    }),
  });
  expect(
    invalidValidators(
      validatorJson(fixture.tables.malformed.validator),
      'malformed.documentType',
    ),
  ).toEqual([
    'malformed.documentType.value.nested.fieldType.value.value[0].value[ability.str]: invalid object field',
    'malformed.documentType.value.nested.fieldType.value.value[1].keys: expected string or id',
  ]);
});

test('the schema metadata guard accepts nested string and id record keys', () => {
  const fixture = defineSchema({
    supported: defineTable({
      nested: v.array(
        v.union(
          v.object({ values: v.record(v.string(), v.number()) }),
          v.object({ values: v.record(v.id('character'), v.number()) }),
        ),
      ),
    }),
  });
  expect(
    invalidValidators(
      validatorJson(fixture.tables.supported.validator),
      'supported.documentType',
    ),
  ).toEqual([]);
});

test('the validator metadata guard rejects a leading-digit object field', () => {
  const fixture = defineTable({
    nested: v.array(v.object({ '1stLevel': v.number() })),
  });
  expect(
    invalidValidators(validatorJson(fixture.validator), 'documentType'),
  ).toEqual([
    'documentType.value.nested.fieldType.value.value[1stLevel]: invalid object field',
  ]);
});

function functionValidatorJson(
  registeredFunction: unknown,
  kind: 'args' | 'returns',
): unknown {
  if (
    registeredFunction === null ||
    (typeof registeredFunction !== 'object' &&
      typeof registeredFunction !== 'function') ||
    !('exportArgs' in registeredFunction) ||
    typeof registeredFunction.exportArgs !== 'function' ||
    !('exportReturns' in registeredFunction) ||
    typeof registeredFunction.exportReturns !== 'function'
  )
    throw new Error(`Fixture does not export Convex ${kind} metadata`);
  const metadata: unknown =
    kind === 'args'
      ? registeredFunction.exportArgs()
      : registeredFunction.exportReturns();
  if (typeof metadata !== 'string')
    throw new Error(`Fixture ${kind} metadata is not a string`);
  return JSON.parse(metadata);
}

test.each([
  'hybrid-full',
  '1stLevel',
  'ability score',
  'ability.str',
  'ability/str',
  'name\n',
  '$reserved',
  'éclair',
  '',
])(
  'the metadata guard rejects object field %j in args, returns and schema',
  (field) => {
    const object = v.object({ [field]: v.number() });
    const fields = {
      [field]: v.number(),
      nested: v.optional(
        v.array(v.union(v.null(), v.record(v.string(), object))),
      ),
    };
    const registeredFunction = query({
      args: fields,
      returns: v.union(v.null(), v.object(fields)),
      handler: () => null,
    });
    const table = defineTable(fields);
    for (const [kind, metadata] of [
      ['args', functionValidatorJson(registeredFunction, 'args')],
      ['returns', functionValidatorJson(registeredFunction, 'returns')],
      ['documentType', validatorJson(table.validator)],
    ] as const)
      expect(invalidValidators(metadata, kind), kind).toEqual([
        expect.stringContaining(`[${field}]: invalid object field`),
        expect.stringContaining(`[${field}]: invalid object field`),
      ]);
  },
);

test.each(['name', 'Name', '_name', 'level1', 'ability_score'])(
  'the metadata guard accepts object field %j in args, returns and schema',
  (field) => {
    const fields = {
      [field]: v.optional(
        v.array(v.union(v.null(), v.object({ [field]: v.number() }))),
      ),
    };
    const registeredFunction = query({
      args: fields,
      returns: v.union(v.null(), v.object(fields)),
      handler: () => null,
    });
    expect(
      invalidValidators(
        functionValidatorJson(registeredFunction, 'args'),
        'args',
      ),
    ).toEqual([]);
    expect(
      invalidValidators(
        functionValidatorJson(registeredFunction, 'returns'),
        'returns',
      ),
    ).toEqual([]);
    expect(
      invalidValidators(
        validatorJson(defineTable(fields).validator),
        'documentType',
      ),
    ).toEqual([]);
  },
);

test.each([
  'hybrid-full',
  '1stLevel',
  'ability score',
  'ability.str',
  'ability/str',
])('the metadata guard permits string-record data key %j', (key) => {
  const fields = {
    values: v.record(v.string(), v.object({ label: v.literal(key) })),
  };
  const registeredFunction = query({
    args: fields,
    returns: v.object(fields),
    handler: () => ({ values: { [key]: { label: key } } }),
  });
  expect(
    invalidValidators(
      functionValidatorJson(registeredFunction, 'args'),
      'args',
    ),
  ).toEqual([]);
  expect(
    invalidValidators(
      functionValidatorJson(registeredFunction, 'returns'),
      'returns',
    ),
  ).toEqual([]);
  expect(
    invalidValidators(
      validatorJson(defineTable(fields).validator),
      'documentType',
    ),
  ).toEqual([]);
  expect(convexToJson({ [key]: { label: key } })).toEqual({
    [key]: { label: key },
  });
});

test('the metadata guard catches nested dotted fields and literal-union record keys', () => {
  const registeredFunction: unknown = query({
    args: {
      nested: v.array(
        v.union(
          v.object({ 'ability.str': v.number() }),
          v.record(v.union(v.literal('hp'), v.literal('bab')), v.number()),
        ),
      ),
    },
    returns: v.null(),
    handler: () => null,
  });
  if (
    typeof registeredFunction !== 'function' ||
    !('exportArgs' in registeredFunction) ||
    typeof registeredFunction.exportArgs !== 'function'
  )
    throw new Error('Fixture does not export Convex function metadata');
  const metadata: unknown = registeredFunction.exportArgs();
  if (typeof metadata !== 'string')
    throw new Error('Fixture args metadata is not a string');
  const validator: unknown = JSON.parse(metadata);
  expect(invalidValidators(validator, 'args')).toEqual([
    'args.value.nested.fieldType.value.value[0].value[ability.str]: invalid object field',
    'args.value.nested.fieldType.value.value[1].keys: expected string or id',
  ]);
});

test('schema table, index and indexed field names are valid Convex identifiers', () => {
  expect(invalidSchemaIdentifiers(schema)).toEqual([]);
});

test('the schema identifier guard catches over-long and malformed names', () => {
  const fixture = defineSchema({
    malformed: defineTable({ name: v.string(), level: v.number() })
      .index(`by_${'x'.repeat(62)}`, ['name'])
      .index('1_by_name', ['name'])
      .searchIndex('search-name', {
        searchField: 'name',
        filterFields: ['level'],
      }),
  });
  expect(invalidSchemaIdentifiers(fixture)).toEqual([
    `malformed.indexes[by_${'x'.repeat(62)}]: invalid identifier by_${'x'.repeat(62)}`,
    'malformed.indexes[1_by_name]: invalid identifier 1_by_name',
    'malformed.searchIndexes[search-name]: invalid identifier search-name',
  ]);
});
