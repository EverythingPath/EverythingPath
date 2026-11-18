import { posix } from 'node:path';
import ts from 'typescript';
import { unwiredLegalRecordScanners } from '../../scripts/catalog/legal-records';

/**
 * Guard 3 of the legal-record design (`legal-record-guard.test.ts`, over every
 * JS or TS module Git tracks): code outside the loader and the codec must not
 * read an encoded record itself; it would see the stores, not the candidates.
 *
 * - (a) A string or template literal naming a record in the encoded set (its
 *   name, a repository or `../` path, a URL) stands only as the direct
 *   argument of `readLegalRecord`, `legalRecordSha256` or `legalRecordLabel`
 *   from `legal-records.ts`, or of a function from a `legalRecordNameHelpers`
 *   module (which must not list or read files), each imported by its own
 *   name. An aliased, default, namespace, dynamic or re-exported import of
 *   the loader fails, and so does declaring a loader or helper name.
 * - (b) A literal naming the directory or a path into it fails in a module
 *   that lists or reads files (`fileReader`, `JSON.parse`, `import()`, by any
 *   name): use `readLegalRecords()` or `readLegalRecord(name)`. A string, a
 *   template's static chunk or a `+` operand names it when it holds
 *   `catalog/legal` ending the text or followed by `/` (or arguments
 *   `'catalog', 'legal…'`); a relative literal (`./`, `../`) is first resolved
 *   from the module's own directory. Allowed: a static import's specifier,
 *   and a complete literal path to one file (`catalog/legal/<file>.<ext>`,
 *   then the literal's end with nothing appended, or text that is not part of
 *   a path, as in a message); rule a covers an encoded name.
 * - (c) Every module in `unwiredLegalRecordScanners` fails.
 * - (d) A template or `+` concatenation that could expand to an encoded
 *   record's path (its static chunks hold `catalog/legal`, and what follows
 *   matches `/<name>` with each substitution or non-literal operand standing
 *   for any text) fails in every module, whether it reads files or not,
 *   unless it is rule a's direct loader argument.
 * - (e) `legalRecordLabel(...)` stands only as an array literal's element, an
 *   object literal's property value, an operand of `===` or `!==`, or a direct
 *   argument of `expect(...)` or of a matcher on its chain (`toBe`, `toEqual`,
 *   `toContain`, `toMatch`, `toStrictEqual`, `toHaveProperty`); a `+` operand
 *   or template span counts as the string it builds. Anywhere else (a
 *   variable, an assignment, a return, another call, a spread, as a value) it
 *   fails. (i) An array or object literal holding a label at any depth fails
 *   when it is read where it stands: a member or element taken, spread,
 *   called or destructured. (ii) An `expect(...)` whose argument holds a label
 *   ends in one listed matcher's call, through `not`, `resolves` or `rejects`
 *   only. Rule a's import forms and rule e hold with nothing encoded.
 *
 * The guarantee (root's decision, 2026-11-15) is the list above, in every
 * Git-tracked JS or TS module but the exempt ones. Outside it by decision:
 * a name computed at run time; a label stored in a variable-held object or
 * array and read back later, in the same module or another (a documented
 * limit in the guard test); readers that are not JS or TS (Python, shell);
 * the modules in `legalRecordGuardExemptions`.
 */
/** Modules the guard does not read, each with the reason. */
export const legalRecordGuardExemptions = new Map([
  ['scripts/catalog/legal-records.ts', 'the loader: the one reader'],
  [
    'scripts/catalog/legal-record-proof.ts',
    'the migration proof: stored bytes at two revisions',
  ],
  [
    'tests/catalog/legal-record-proof.test.ts',
    'the proof test: scratch repositories',
  ],
  ['src/lib/catalog/legal-record-codec.ts', 'the codec: it reads no file'],
  ['tests/catalog/legal-records.test.ts', 'the loader test: stored bytes'],
  ['tests/catalog/legal-record-guard.ts', 'the guard: refused forms'],
  ['tests/catalog/legal-record-guard.test.ts', 'the fixtures: refused forms'],
]);
/** Modules whose functions take a record's name and read only by the loader. */
export const legalRecordNameHelpers = [
  'tests/catalog/batch-ownership.ts',
  'tests/catalog/legal-inventory.ts',
];
/** The loader's functions that take a record's name. */
const takers = ['readLegalRecord', 'legalRecordSha256', 'legalRecordLabel'];
const nameTakers = new Set(takers);
/** Every loader function, each imported only under its own name. */
const loaderFunctions = new Set([
  ...takers,
  'readLegalRecords',
  'readLegalRecordsIn',
  'legalRecordNamesIn',
  'encodeLegalRecordsIn',
]);
/** The matchers a label may be the argument of (rule e). */
const labelMatcher = /^to(Be|Equal|Contain|Match|StrictEqual|HaveProperty)$/;
const loaderModule = /(^|\/)legal-records(\.ts)?$/;
/** The directory in a literal: `catalog/legal` ending it or followed by `/`. */
const legalDirectory = /(^|\/)catalog\/legal(?=\/|$)/;
/** After the directory: one complete file path, `/<file>.<ext>` (rule b). */
const completeFile = /^\/(?:[\w-][\w.-]*\/)*[\w-][\w.-]*\.[A-Za-z0-9]+/;
const fileReader =
  /^((readdir|opendir|readFile)\w*|glob(Sync|Stream|Iterate)?|createReadStream|require)$/;
const allowedForm =
  'names an encoded legal record (rule a); name it only as the argument of readLegalRecord, legalRecordSha256 or legalRecordLabel, imported from legal-records.ts, or of a function imported from a module in legalRecordNameHelpers';
const labelForm =
  'legalRecordLabel stands where a path could be read (rule e); use the label only in an array or object literal, a === or !== comparison, a message built in one of those, or an expect(...) assertion.';
const helperForm =
  'lists or reads files in a module in legalRecordNameHelpers (rule a); read a record there only through the loader.';
type Problem = { node: ts.Node; text: string };

/**
 * Transparent syntax: one operand, its value left as it is (parentheses, a
 * type assertion, `!`).
 */
const isWrapper = (
  node: ts.Node,
): node is ts.Node & { expression: ts.Expression } =>
  ts.isParenthesizedExpression(node) ||
  ts.isAsExpression(node) ||
  ts.isSatisfiesExpression(node) ||
  ts.isNonNullExpression(node) ||
  ts.isTypeAssertionExpression(node) ||
  ts.isPartiallyEmittedExpression(node);

/** Whether `parent` is transparent syntax around `node`. */
const isTransparent = (parent: ts.Node, node: ts.Node) =>
  isWrapper(parent) && parent.expression === node;

const logical = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);
const lastOperand = new Set([
  ts.SyntaxKind.CommaToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

/**
 * Whether `parent` may hand `node`'s value on as its own: transparent syntax,
 * `await`, a conditional's branch, a logical operand, or the last operand of
 * a comma or a logical assignment. Rule e(i) climbs these from a literal,
 * where climbing only refuses more; elsewhere a value among others fails.
 */
function handsOn(parent: ts.Node, node: ts.Node) {
  if (isWrapper(parent) || ts.isAwaitExpression(parent))
    return parent.expression === node;
  if (ts.isConditionalExpression(parent)) return parent.condition !== node;
  if (!ts.isBinaryExpression(parent)) return false;
  const { kind } = parent.operatorToken;
  return logical.has(kind) || (lastOperand.has(kind) && parent.right === node);
}

/**
 * Where a value is consumed: climbed from `start` through transparent syntax
 * (or what `through` allows), the outermost such node (`node`) and what holds
 * it (`parent`). Rule a and rule e ask every "what holds, consumes or calls
 * this" through it; `unwrap` is the other direction.
 */
function consumerOf(start: ts.Node, through = isTransparent) {
  let node = start;
  while (through(node.parent, node)) node = node.parent;
  return { node, parent: node.parent };
}

/** The expression transparent syntax stands for. */
function unwrap(start: ts.Node): ts.Node {
  let node = start;
  while (isWrapper(node)) node = node.expression;
  return node;
}

/** Whether `node`, unwrapped, is the identifier `name`. */
const isNamed = (node: ts.Node, name: string) => {
  const inner = unwrap(node);
  return ts.isIdentifier(inner) && inner.text === name;
};

function stringText(node: ts.Node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : undefined;
}

/** The literal text a node gives a record's name with: a string, or a template's last part. */
function nameText(node: ts.Node) {
  if (ts.isTemplateExpression(node))
    return node.templateSpans.at(-1)?.literal.text;
  return stringText(node);
}

/** The literal parts of a string or template. */
function literalParts(node: ts.Node) {
  if (ts.isTemplateExpression(node))
    return [
      node.head.text,
      ...node.templateSpans.map((span) => span.literal.text),
    ];
  const text = stringText(node);
  return text === undefined ? [] : [text];
}

/** Every node of a module, in source order. */
function nodesOf(source: ts.SourceFile) {
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    nodes.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return nodes;
}

const isLoader = (specifier: string | undefined) =>
  specifier !== undefined && loaderModule.test(specifier);

function staticSpecifier(node: ts.Node) {
  return (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier
    ? stringText(node.moduleSpecifier)
    : undefined;
}

/** The specifier of `import x = require()`, `import()` or `require()`. */
function dynamicSpecifier(node: ts.Node) {
  if (
    ts.isImportEqualsDeclaration(node) &&
    ts.isExternalModuleReference(node.moduleReference)
  )
    return stringText(node.moduleReference.expression);
  if (!ts.isCallExpression(node)) return undefined;
  const callee = node.expression;
  const loads =
    callee.kind === ts.SyntaxKind.ImportKeyword || isNamed(callee, 'require');
  const [first] = node.arguments;
  return loads && first ? stringText(unwrap(first)) : undefined;
}

function loaderForm(node: ts.Node, form: string): Problem {
  return {
    node,
    text: `${form} of the legal record loader; import its functions by their own names: import { readLegalRecord } from '…/legal-records'.`,
  };
}

function wholeImportForms(node: ts.ImportDeclaration): Problem[] {
  const clause = node.importClause;
  if (clause?.name) return [loaderForm(node, 'a default import')];
  const bindings = clause?.namedBindings;
  return bindings && ts.isNamespaceImport(bindings)
    ? [loaderForm(node, 'a namespace import')]
    : [];
}

/** An import's own-name bindings join `imported`; a loader alias is refused. */
function importForms(node: ts.ImportDeclaration, imported: Set<string>) {
  const problems: Problem[] = [];
  const bindings = node.importClause?.namedBindings;
  const elements =
    bindings && ts.isNamedImports(bindings) ? bindings.elements : [];
  for (const element of elements) {
    const name = (element.propertyName ?? element.name).text;
    if (!element.propertyName) imported.add(name);
    else if (loaderFunctions.has(name))
      problems.push(loaderForm(element, `an aliased import (${name})`));
  }
  return problems;
}

/** Whether a relative specifier in the module at `path` names a helper module. */
function isHelper(path: string, specifier: string | undefined) {
  if (!specifier?.startsWith('.')) return false;
  const target = posix.join(posix.dirname(path), specifier);
  return legalRecordNameHelpers.some(
    (helper) => helper.replace(/\.ts$/, '') === target.replace(/\.ts$/, ''),
  );
}

const declarations = new Set([
  ts.SyntaxKind.VariableDeclaration,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.Parameter,
  ts.SyntaxKind.BindingElement,
]);

/** A guarded name (`names`) that a node declares other than by its import. */
function declaredName(node: ts.Node, path: string, names: Set<string>) {
  const name = (node as { name?: ts.Node }).name;
  const specifier = ts.isImportSpecifier(node)
    ? stringText(node.parent.parent.parent.moduleSpecifier)
    : undefined;
  const declares =
    declarations.has(node.kind) ||
    (ts.isImportSpecifier(node) &&
      !isLoader(specifier) &&
      !isHelper(path, specifier));
  return declares && name && ts.isIdentifier(name) && names.has(name.text)
    ? name.text
    : undefined;
}

function isLocalReExport(node: ts.Node) {
  return (
    ts.isExportSpecifier(node) &&
    !node.parent.parent.moduleSpecifier &&
    loaderFunctions.has((node.propertyName ?? node.name).text)
  );
}

/** One node's import problems; its own-name imports join `names`. */
function importProblems(
  node: ts.Node,
  path: string,
  names: { imported: Set<string>; helpers: Set<string> },
): Problem[] {
  const specifier = staticSpecifier(node);
  if (ts.isImportDeclaration(node) && isLoader(specifier))
    return [...wholeImportForms(node), ...importForms(node, names.imported)];
  if (isLoader(specifier) || isLocalReExport(node))
    return [loaderForm(node, 'a re-export')];
  if (isLoader(dynamicSpecifier(node)))
    return [loaderForm(node, 'a dynamic import')];
  if (ts.isImportDeclaration(node) && isHelper(path, specifier))
    importForms(node, names.helpers);
  return [];
}

/** How a module imports the loader: its problems; the callees rule a allows. */
function loaderImports(source: ts.SourceFile, nodes: readonly ts.Node[]) {
  const names = { imported: new Set<string>(), helpers: new Set<string>() };
  const path = source.fileName;
  const problems = nodes.flatMap((node) => importProblems(node, path, names));
  const guarded = new Set([...loaderFunctions, ...names.helpers]);
  for (const node of nodes) {
    const declared = declaredName(node, path, guarded);
    if (declared)
      problems.push(loaderForm(node, `a declaration of ${declared} outside`));
  }
  const callees = [...names.imported].filter((name) => nameTakers.has(name));
  return { callees: new Set([...callees, ...names.helpers]), problems };
}

/** Whether a node lists or reads files, by any name. */
function isFileRead(node: ts.Node, source: ts.SourceFile) {
  return (
    (ts.isIdentifier(node) && fileReader.test(node.text)) ||
    (ts.isPropertyAccessExpression(node) &&
      unwrap(node.expression).getText(source) === 'JSON' &&
      node.name.text === 'parse') ||
    (ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword)
  );
}

function isAllowedNameArgument(node: ts.Node, callees: ReadonlySet<string>) {
  const { node: argument, parent: call } = consumerOf(node);
  const callee = ts.isCallExpression(call) ? unwrap(call.expression) : call;
  return (
    ts.isCallExpression(call) &&
    call.arguments.includes(argument as ts.Expression) &&
    ts.isIdentifier(callee) &&
    callees.has(callee.text)
  );
}

const operator = (node: ts.Node) =>
  ts.isBinaryExpression(node) ? ts.tokenToString(node.operatorToken.kind) : '';

/** The string a `+` operand or a template span builds, climbed to the top. */
function builtString(start: ts.Node): ts.Node {
  const { node, parent } = consumerOf(start);
  if (ts.isTemplateSpan(parent)) return builtString(parent.parent);
  return operator(parent) === '+' ? builtString(parent) : node;
}

const isExpectCall = ({ expression }: ts.CallExpression) =>
  isNamed(expression, 'expect');

/** The modifiers an `expect(...)` chain may pass through before a matcher. */
const chainModifiers = new Set(['not', 'resolves', 'rejects']);

/**
 * Whether an `expect(...)` chain ends in one listed matcher's call, through
 * the listed modifiers only (`.toSatisfy(cb)`, a kept assertion fail).
 */
function isListedChain(expectCall: ts.CallExpression) {
  let node: ts.Node = expectCall;
  for (;;) {
    const { node: object, parent: access } = consumerOf(node);
    if (!ts.isPropertyAccessExpression(access) || access.expression !== object)
      return false;
    const { text } = access.name;
    if (chainModifiers.has(text)) node = access;
    else {
      const { node: callee, parent: call } = consumerOf(access);
      return (
        labelMatcher.test(text) &&
        ts.isCallExpression(call) &&
        call.expression === callee &&
        !ts.isPropertyAccessExpression(consumerOf(call).parent)
      );
    }
  }
}

/** A listed matcher's call on an `expect(...)` chain, `expect` itself included. */
function isExpectation(call: ts.CallExpression) {
  if (isExpectCall(call)) return true;
  const expression = unwrap(call.expression);
  if (!ts.isPropertyAccessExpression(expression)) return false;
  if (!labelMatcher.test(expression.name.text)) return false;
  let callee: ts.Node = expression;
  while (ts.isPropertyAccessExpression(callee) || ts.isCallExpression(callee))
    callee = unwrap(callee.expression);
  return isNamed(callee, 'expect');
}

/** Whether `parent` spreads `node` into an array literal: its elements stay held. */
const spreadsInto = (parent: ts.Node) =>
  ts.isSpreadElement(parent) && ts.isArrayLiteralExpression(parent.parent);

/**
 * Whether `parent` takes a member or element of `node`, calls it, or spreads
 * it but into an array literal.
 */
const readsExpression = (parent: ts.Node, node: ts.Node) =>
  (ts.isPropertyAccessExpression(parent) ||
    ts.isElementAccessExpression(parent) ||
    ts.isCallExpression(parent) ||
    (ts.isSpreadElement(parent) && !spreadsInto(parent)) ||
    ts.isSpreadAssignment(parent)) &&
  parent.expression === node;

/** Whether `parent` destructures `node`: a pattern's initialiser, or `[a] = node`. */
function destructures(parent: ts.Node, node: ts.Node) {
  if (ts.isBinaryExpression(parent))
    return operator(parent) === '=' && parent.right === node;
  const { name, initializer } = parent as {
    name?: ts.Node;
    initializer?: ts.Node;
  };
  return (
    initializer === node &&
    name !== undefined &&
    (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name))
  );
}

/** A literal read back where it stands: its member, element, spread, pattern or call. */
function isReadInPlace(literal: ts.Node) {
  const { node, parent } = consumerOf(literal, handsOn);
  return readsExpression(parent, node) || destructures(parent, node);
}

/**
 * The array or object literal `place` stands in, if any, climbed through
 * `through`; an array spread into an array literal stands in that literal.
 */
function containerOf(place: ts.Node, through = isTransparent) {
  const { node, parent } = consumerOf(place, through);
  if (ts.isArrayLiteralExpression(parent)) return parent;
  const literal =
    ts.isArrayLiteralExpression(place) || ts.isObjectLiteralExpression(place);
  if (literal && spreadsInto(parent)) return parent.parent;
  return ts.isPropertyAssignment(parent) && parent.initializer === node
    ? parent.parent
    : undefined;
}

/** Rule e(i): every literal around a label, at any depth, stays unread in place. */
function isUnreadContainer(place: ts.Node) {
  for (
    let container = containerOf(place, handsOn);
    container;
    container = containerOf(container, handsOn)
  )
    if (isReadInPlace(container)) return false;
  return true;
}

/** Rule e(ii): an `expect(...)` whose argument holds the label ends in a listed matcher. */
function isListedAssertion(call: ts.Node) {
  for (let node: ts.Node = call; node.parent; node = node.parent) {
    const { parent } = node;
    if (
      ts.isCallExpression(parent) &&
      isExpectCall(parent) &&
      parent.arguments.includes(node as ts.Expression)
    )
      return isListedChain(parent);
  }
  return true;
}

/** Rule e: whether a label call's string stands where a label may. */
function isLabelPlace(call: ts.Node) {
  const place = builtString(call);
  const { node: value, parent } = consumerOf(place);
  const placed =
    containerOf(place) !== undefined ||
    /^[!=]==$/.test(operator(parent) ?? '') ||
    (ts.isCallExpression(parent) &&
      parent.arguments.includes(value as ts.Expression) &&
      isExpectation(parent));
  return placed && isUnreadContainer(place) && isListedAssertion(call);
}

/** Rule e over one module: every use of `legalRecordLabel` not in a label's place. */
function labelProblems(nodes: readonly ts.Node[]): Problem[] {
  return nodes.flatMap((node) => {
    if (!ts.isIdentifier(node) || node.text !== 'legalRecordLabel') return [];
    const { node: callee, parent } = consumerOf(node);
    const called = ts.isCallExpression(parent) && parent.expression === callee;
    return ts.isImportSpecifier(node.parent) || (called && isLabelPlace(parent))
      ? []
      : [{ node, text: labelForm }];
  });
}

function directoryProblem(node: ts.Node, text: string): Problem {
  return {
    node,
    text: `${text} names the legal record directory in a module that lists or reads files (rule b); scan the records with readLegalRecords(), or readLegalRecordsIn(root) for a scratch checkout.`,
  };
}

const isPlus = (node: ts.Node) =>
  ts.isBinaryExpression(node) &&
  node.operatorToken.kind === ts.SyntaxKind.PlusToken;

/** Whether text follows `node` in the string it builds: a `+` or a template span. */
function isAppended(start: ts.Node) {
  for (let node = start; ; ) {
    const { node: value, parent } = consumerOf(node);
    if (ts.isTemplateSpan(parent)) return true;
    if (!isPlus(parent)) return false;
    if ((parent as ts.BinaryExpression).left === value) return true;
    node = parent;
  }
}

/** Whether `node` begins the string it builds: no `+` or template text before it. */
function isLeading(start: ts.Node) {
  for (let node = start; ; ) {
    const { node: value, parent } = consumerOf(node);
    if (ts.isTemplateSpan(parent)) return false;
    if (!isPlus(parent)) return true;
    if ((parent as ts.BinaryExpression).right === value) return false;
    node = parent;
  }
}

/**
 * A relative literal (`./`, `../`) resolved from the module's directory when
 * it lands in the legal directory; any other text as it is.
 */
function resolvedFrom(path: string, text: string) {
  if (!/^\.\.?\//.test(text)) return text;
  const resolved = posix.join(posix.dirname(path), text);
  return /^scripts\/catalog\/legal(\/|$)/.test(resolved) ? resolved : text;
}

/**
 * Whether literal parts (a string, or a template's chunks in order; `last`:
 * whether the string ends with the last part) name the directory or a path
 * into it other than one complete file path (rule b).
 */
function namesDirectoryIn(parts: readonly string[], last: boolean) {
  return parts.some((part, index) => {
    const found = legalDirectory.exec(part);
    if (!found) return false;
    const tail = part.slice(found.index + found[0].length);
    const file = completeFile.exec(tail);
    if (!file) return true;
    const rest = tail.slice(file[0].length);
    if (rest === '') return !(last && index === parts.length - 1);
    return /^[\w.$*{/-]/.test(rest);
  });
}

/** Rule b: a literal naming the directory, unless a static import's specifier. */
function directoryLiteralProblems(
  node: ts.Node,
  source: ts.SourceFile,
  path: string,
) {
  const [first, ...rest] = literalParts(node);
  if (first === undefined || staticSpecifier(node.parent) !== undefined)
    return [];
  const parts = [isLeading(node) ? resolvedFrom(path, first) : first, ...rest];
  return namesDirectoryIn(parts, !isAppended(node))
    ? [directoryProblem(node, node.getText(source))]
    : [];
}

/** Rule b: adjacent arguments `'catalog', 'legal…'` (a string or a template). */
function segmentProblems(node: ts.Node, source: ts.SourceFile) {
  if (!ts.isCallExpression(node) && !ts.isNewExpression(node)) return [];
  const args = node.arguments ?? [];
  return args.flatMap((argument, index) => {
    const previous = args[index - 1];
    const before = previous && stringText(unwrap(previous));
    const [first, ...rest] = literalParts(unwrap(argument));
    return first !== undefined &&
      /^legal(\/|$)/.test(first) &&
      /(^|\/)catalog\/?$/.test(before ?? '') &&
      namesDirectoryIn([`catalog/${first}`, ...rest], true)
      ? [directoryProblem(argument, `'${before}', ${argument.getText(source)}`)]
      : [];
  });
}

/** Text that a template substitution or a non-literal operand may stand for. */
const anyText = Symbol('any text');
type Piece = string | typeof anyText;

/** The pieces a template or a `+` concatenation builds its string from, in order. */
function piecesOf(start: ts.Node): Piece[] {
  const node = unwrap(start);
  const text = stringText(node);
  if (text !== undefined) return [text];
  if (ts.isTemplateExpression(node))
    return [
      node.head.text,
      ...node.templateSpans.flatMap((span) => [
        ...piecesOf(span.expression),
        span.literal.text,
      ]),
    ];
  if (isPlus(node)) {
    const { left, right } = node as ts.BinaryExpression;
    return [...piecesOf(left), ...piecesOf(right)];
  }
  return [anyText];
}

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/**
 * Rule d: whether a built string's pieces could expand to the path of a
 * record in `encoded`: a literal piece holds `catalog/legal`, and the pieces
 * after it match `/<name>`.
 */
function expandsToRecord(
  pieces: readonly Piece[],
  path: string,
  encoded: ReadonlySet<string>,
) {
  const [first] = pieces;
  const resolved =
    typeof first === 'string'
      ? [resolvedFrom(path, first), ...pieces.slice(1)]
      : pieces;
  const at = resolved.findIndex(
    (piece) => typeof piece === 'string' && legalDirectory.test(piece),
  );
  if (at === -1) return false;
  const piece = resolved[at] as string;
  const found = legalDirectory.exec(piece)!;
  const after = [
    piece.slice(found.index + found[0].length),
    ...resolved.slice(at + 1),
  ];
  const pattern = new RegExp(
    `^${after.map((part) => (part === anyText ? '[\\s\\S]*' : escaped(part))).join('')}$`,
  );
  return [...encoded].some((name) => pattern.test(`/${name}`));
}

/** Rule d over one module: every built string that could expand to a record's path. */
function expansionProblems(
  source: ts.SourceFile,
  nodes: readonly ts.Node[],
  {
    encoded,
    callees,
  }: { encoded: ReadonlySet<string>; callees: ReadonlySet<string> },
): Problem[] {
  return nodes.flatMap((node) => {
    const built = ts.isTemplateExpression(node) || isPlus(node);
    if (!built || unwrap(builtString(node)) !== node) return [];
    if (isAllowedNameArgument(node, callees)) return [];
    if (!expandsToRecord(piecesOf(node), source.fileName, encoded)) return [];
    return [
      {
        node,
        text: `${node.getText(source)} could expand to an encoded legal record's path (rule d); read the record with readLegalRecord(name), or scan with readLegalRecords().`,
      },
    ];
  });
}

/** Rule a for names and rule b, over one module's literals. */
function literalProblems(
  source: ts.SourceFile,
  nodes: readonly ts.Node[],
  allowed: (node: ts.Node, text: string) => boolean,
) {
  const scans = nodes.some((node) => isFileRead(node, source));
  return nodes.flatMap((node): Problem[] => {
    const text = nameText(node);
    const named: Problem[] =
      text === undefined || allowed(node, text)
        ? []
        : [{ node, text: `${node.getText(source)} ${allowedForm}.` }];
    if (!scans) return named;
    return [
      ...named,
      ...directoryLiteralProblems(node, source, source.fileName),
      ...segmentProblems(node, source),
    ];
  });
}

/** Whether a module may name the legal records: worth parsing. */
function mayName(text: string, encoded: ReadonlySet<string>) {
  return (
    /legal/i.test(text) ||
    (text.match(/[\w.-]+\.json/g) ?? []).some((token) => encoded.has(token))
  );
}

/** One module's problems, each `file:line: problem`. */
function moduleProblems(
  path: string,
  text: string,
  encoded: ReadonlySet<string>,
) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const nodes = nodesOf(source);
  const { callees, problems } = loaderImports(source, nodes);
  const allowed = (node: ts.Node, literal: string) =>
    !encoded.has(literal.slice(literal.lastIndexOf('/') + 1)) ||
    isAllowedNameArgument(node, callees);
  problems.push(...labelProblems(nodes));
  if (legalRecordNameHelpers.includes(path))
    for (const node of nodes.filter((node) => isFileRead(node, source)))
      problems.push({ node, text: helperForm });
  if (encoded.size) {
    problems.push(...literalProblems(source, nodes, allowed));
    problems.push(...expansionProblems(source, nodes, { encoded, callees }));
  }
  return problems.map(({ node, text: problem }) => {
    const { line } = source.getLineAndCharacterOfPosition(
      node.getStart(source),
    );
    return `${path}:${line + 1}: ${problem}`;
  });
}

/**
 * Guard 3's problems in `files` (path to source text) with the records in
 * `encoded` (file names) stored encoded; each names `file:line`, the literal
 * and the form that is allowed.
 */
export function findLegalRecordGuardProblems({
  files,
  encoded,
  unwired = unwiredLegalRecordScanners,
}: {
  files: ReadonlyMap<string, string | null>;
  encoded: readonly string[];
  unwired?: readonly string[];
}) {
  const encodedNames = new Set(encoded);
  const problems: string[] = [];
  for (const [path, text] of files)
    if (
      typeof text === 'string' &&
      !legalRecordGuardExemptions.has(path) &&
      mayName(text, encodedNames)
    )
      problems.push(...moduleProblems(path, text, encodedNames));
  if (encodedNames.size)
    for (const path of unwired)
      problems.push(
        `${path}:1: is in unwiredLegalRecordScanners (rule c); wire it to readLegalRecords() and drop it from the list before any record is encoded.`,
      );
  return problems.sort();
}
