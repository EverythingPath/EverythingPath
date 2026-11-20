import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import ts from 'typescript';

/**
 * The TypeScript tables every curation batch appends rows to, by repository
 * path: the table's variable and the properties that identify a row.
 */
export const appendOnlyTables: Record<
  string,
  { variable: string; identity: readonly string[] }
> = {
  'scripts/catalog/reviewed-change-replacements.ts': {
    variable: 'reviewedChangeReplacements',
    identity: ['externalKey', 'change'],
  },
  'tests/catalog/cross-batch-bindings.ts': {
    variable: 'danglingCatalogLinks',
    identity: ['uuid'],
  },
};

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

type Row = { identity: string; label: string; text: string };
type Table = { outside: string; rows: Row[]; head: string; tail: string };

/** The value of a literal, or undefined for anything else. */
function literalValue(node: ts.Expression): unknown {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(node)) {
    const values = node.elements.map(literalValue);
    return values.includes(undefined) ? undefined : values;
  }
  if (ts.isObjectLiteralExpression(node)) return objectValue(node);
  return undefined;
}

/** The value of an object literal of literals, keys sorted, or undefined. */
function objectValue(
  node: ts.ObjectLiteralExpression,
): Record<string, unknown> | undefined {
  const entries: [string, unknown][] = [];
  for (const property of node.properties) {
    if (
      !ts.isPropertyAssignment(property) ||
      !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
    )
      return undefined;
    const value = literalValue(property.initializer);
    if (value === undefined) return undefined;
    entries.push([property.name.text, value]);
  }
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

function findTable(source: ts.SourceFile, variable: string) {
  const found: ts.Expression[] = [];
  for (const statement of source.statements)
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === variable &&
          declaration.initializer
        )
          found.push(declaration.initializer);
  return found.length === 1 ? found[0] : undefined;
}

/** Splits a table file into its rows and the text around the table literal. */
function parseTable(
  text: string,
  { variable, identity }: { variable: string; identity: readonly string[] },
): Table | string {
  const source = ts.createSourceFile(
    'table.ts',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const table = findTable(source, variable);
  if (!table || !ts.isArrayLiteralExpression(table))
    return `has no array literal ${variable}.`;
  const rows: Row[] = [];
  for (const element of table.elements) {
    const value = ts.isObjectLiteralExpression(element)
      ? objectValue(element)
      : undefined;
    if (!value)
      return `has a ${variable} row that is not a plain object literal: ${element.getText().slice(0, 80)}`;
    const key = identity.map((name) => value[name]);
    if (key.includes(undefined))
      return `has a ${variable} row without ${identity.join(' and ')}: ${element.getText().slice(0, 80)}`;
    rows.push({
      identity: JSON.stringify(key),
      label: key
        .map((part) => (typeof part === 'string' ? part : JSON.stringify(part)))
        .join(' '),
      text: element.getFullText().trim(),
    });
  }
  const head = text.slice(0, table.elements.pos);
  const tail = text
    .slice(table.elements.at(-1)?.end ?? table.elements.pos)
    .replace(/^\s*,?\s*/, '');
  return { outside: `${head}\0${tail}`, rows, head, tail };
}

/** Formats with this repository's Prettier configuration and plugins, from any working directory. */
async function formatTable(path: string, text: string) {
  const config = await resolveConfig(resolve(repositoryRoot, path));
  return format(text, {
    ...config,
    plugins: config?.plugins?.map((plugin) =>
      typeof plugin === 'string'
        ? fileURLToPath(import.meta.resolve(plugin))
        : plugin,
    ),
    filepath: path,
  });
}

/**
 * Three-way merges one append-only table file (appendOnlyTables) by row
 * identity: the base's rows, then the rows ours added, then those theirs
 * added, formatted with Prettier. A row changed on one side only takes that
 * change; a row removed on either side, changed differently on both, added
 * differently on both or reordered, and any change outside the table literal,
 * is reported, never chosen.
 */
export async function mergeAppendOnlyTable({
  path,
  base,
  ours,
  theirs,
}: {
  path: string;
  base?: string;
  ours: string;
  theirs: string;
}): Promise<{ text?: string; conflicts: string[] }> {
  const table = appendOnlyTables[path];
  if (!table) return { conflicts: [`${path} is not an append-only table.`] };
  if (base === undefined)
    return { conflicts: ['Both sides added the file; there is no base.'] };
  const parsed = {
    base: parseTable(base, table),
    ours: parseTable(ours, table),
    theirs: parseTable(theirs, table),
  };
  if (
    typeof parsed.base === 'string' ||
    typeof parsed.ours === 'string' ||
    typeof parsed.theirs === 'string'
  )
    return {
      conflicts: Object.entries(parsed).flatMap(([side, result]) =>
        typeof result === 'string' ? [`${side} ${result}`] : [],
      ),
    };
  const sides = { base: parsed.base, ours: parsed.ours, theirs: parsed.theirs };
  const conflicts: string[] = [];
  const describe = (row: Row) => `${table.variable} row ${row.label}`;
  const byIdentity = (side: 'base' | 'ours' | 'theirs') => {
    const rows = new Map<string, Row>();
    for (const row of sides[side].rows) {
      if (rows.has(row.identity))
        conflicts.push(`${side} has two ${describe(row)}.`);
      rows.set(row.identity, row);
    }
    return rows;
  };
  const rows = {
    base: byIdentity('base'),
    ours: byIdentity('ours'),
    theirs: byIdentity('theirs'),
  };
  for (const side of ['ours', 'theirs'] as const) {
    if (sides[side].outside !== sides.base.outside)
      conflicts.push(`${side} changed ${path} outside ${table.variable}.`);
    const kept = sides[side].rows
      .filter((row) => rows.base.has(row.identity))
      .map((row) => row.identity);
    const expected = sides.base.rows
      .map((row) => row.identity)
      .filter((identity) => rows[side].has(identity));
    if (kept.join('\n') !== expected.join('\n'))
      conflicts.push(`${side} reordered the ${table.variable} rows.`);
  }
  const merged: Row[] = [];
  for (const original of sides.base.rows) {
    const mine = rows.ours.get(original.identity);
    const other = rows.theirs.get(original.identity);
    if (!mine || !other)
      conflicts.push(
        `${describe(original)}: removed by ${mine ? 'theirs' : 'ours'}.`,
      );
    else if (mine.text === original.text || mine.text === other.text)
      merged.push(other);
    else if (other.text === original.text) merged.push(mine);
    else
      conflicts.push(
        `${describe(original)}: changed differently by ours and theirs.`,
      );
  }
  const added = (side: 'ours' | 'theirs') =>
    sides[side].rows.filter((row) => !rows.base.has(row.identity));
  merged.push(...added('ours'));
  for (const row of added('theirs')) {
    const mine = rows.ours.get(row.identity);
    if (!mine) merged.push(row);
    else if (mine.text !== row.text)
      conflicts.push(`${describe(row)}: added differently by ours and theirs.`);
  }
  if (conflicts.length) return { conflicts };
  const { head, tail } = sides.base;
  const text = `${head}${merged.map((row) => `\n${row.text},`).join('')}\n${tail}`;
  try {
    return { text: await formatTable(path, text), conflicts };
  } catch (error) {
    return {
      conflicts: [
        `The merged file could not be formatted: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}
