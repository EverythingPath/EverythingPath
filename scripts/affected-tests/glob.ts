import { posix } from 'node:path';
import ts from 'typescript';

/**
 * `import.meta.glob` calls for `scripts/affected-tests.ts`. A call is readable
 * only when its first argument is one pattern string or an array of them, its
 * optional second argument is an object literal naming only `eager`, `import`
 * or `query` (which change how a match loads, not which files match), and
 * every pattern fits this grammar:
 *
 *   pattern  = ["!"] ("./" | "../" | "/") { "../" } segment { "/" segment }
 *   segment  = "**" | piece { piece }
 *   piece    = literal | "*" | "{" alt "," alt { "," alt } "}"
 *   alt      = (literal | "*") { literal | "*" }, without ".."
 *   literal  = one of A-Z a-z 0-9 _ . $ ~ @ + -
 *
 * Two `*` side by side only as a whole segment. Anything else, such as `?`,
 * `[...]` classes, extglobs (`@(...)`, `!(...)`, `+(...)`), escapes, nested or
 * range braces, a `base` or any other option, leaves the call unreadable.
 * A readable call's `!` exclusions are then ignored (see `globTargets`).
 */
export type GlobCall = {
  file: string;
  position: number;
  /** null when the call is unreadable. */
  patterns: string[] | null;
};

const literalChar = '[A-Za-z0-9_.$~@+-]';
const star = String.raw`\*(?!\*)`;
const alt = `(?:${literalChar}|${star})+`;
const brace = String.raw`\{${alt}(?:,${alt})+\}`;
const segment = String.raw`(?:\*\*|(?:${literalChar}|${star}|${brace})+)`;
const grammar = new RegExp(
  String.raw`^!?(?:\.\.?/|/)(?:\.\./)*${segment}(?:/${segment})*$`,
);
const braceRange = /\{[^}]*\.\.[^}]*\}/;
const harmlessOptions = new Set(['eager', 'import', 'query']);

export const isImportMetaGlob = (
  node: ts.Node,
): node is ts.PropertyAccessExpression =>
  ts.isPropertyAccessExpression(node) &&
  ts.isMetaProperty(node.expression) &&
  node.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
  node.name.text.startsWith('glob');

const literal = (node: ts.Node | undefined) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined;

const inGrammar = (pattern: string | undefined): pattern is string =>
  pattern !== undefined && grammar.test(pattern) && !braceRange.test(pattern);

const harmlessOption = (property: ts.ObjectLiteralElementLike) =>
  (ts.isPropertyAssignment(property) ||
    ts.isShorthandPropertyAssignment(property)) &&
  (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
  harmlessOptions.has(property.name.text);

const harmlessOptionsArgument = (argument: ts.Expression | undefined) =>
  argument === undefined ||
  (ts.isObjectLiteralExpression(argument) &&
    argument.properties.every(harmlessOption));

/** The patterns of `import.meta.glob(...)`, or null when unreadable. */
export function globPatterns(
  access: ts.PropertyAccessExpression,
): string[] | null {
  const call = access.parent;
  if (
    access.name.text !== 'glob' ||
    !ts.isCallExpression(call) ||
    call.expression !== access ||
    call.arguments.length > 2 ||
    !harmlessOptionsArgument(call.arguments[1])
  )
    return null;
  const argument = call.arguments[0];
  const elements =
    argument && ts.isArrayLiteralExpression(argument)
      ? [...argument.elements]
      : [argument];
  const patterns = elements.map(literal);
  return patterns.every(inGrammar) ? patterns : null;
}

// A pattern in the grammar as a matcher of repository-relative paths; `/` is
// the repository root.
const globTokens: Readonly<Record<string, string>> = {
  '**/': '(?:.*/)?',
  '**': '.*',
  '*': '[^/]*',
  '{': '(?:',
  '}': ')',
  ',': '|',
};
function globMatcher(from: string, pattern: string): RegExp {
  const path = pattern.startsWith('/')
    ? posix.normalize(pattern.slice(1))
    : posix.normalize(posix.join(posix.dirname(from), pattern));
  const body = path.replace(
    /\*\*\/|\*\*|[*{},]|[.+$]/g,
    (token) => globTokens[token] ?? `\\${token}`,
  );
  return new RegExp(`^${body}$`);
}

/**
 * The paths a readable glob call may load: any that an include matches.
 * `!` exclusions are ignored, which can only over-select: this matcher lets
 * `*` match a leading dot where Vite does not, so honouring an exclusion
 * could drop a dotfile Vite keeps.
 */
export function globTargets(
  call: GlobCall,
  paths: readonly string[],
): string[] {
  const include = (call.patterns ?? [])
    .filter((pattern) => !pattern.startsWith('!'))
    .map((pattern) => globMatcher(call.file, pattern));
  return paths.filter((path) => include.some((matcher) => matcher.test(path)));
}
