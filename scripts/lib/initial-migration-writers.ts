import { readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import ts from 'typescript';

const rawBuilders = new Set([
  'mutation',
  'internalMutation',
  'action',
  'internalAction',
  'httpAction',
  'mutationGeneric',
  'internalMutationGeneric',
  'actionGeneric',
  'internalActionGeneric',
  'httpActionGeneric',
]);
const gatedBuilders = new Set([
  'gatedMutation',
  'gatedInternalMutation',
  'generalInternalMutation',
  'gatedWebhookMutation',
  'campaignMutation',
  'campaignInternalMutation',
  'legacyCharacterMutation',
]);
const characterTables = new Set([
  'characterLinkedInput',
  'character',
  'characterSheetEntry',
  'characterMove',
  'characterMoveDefinition',
  'characterMoveReference',
  'companionRelationship',
  'catalogEntry',
  'campaignSpellMembership',
  'acceptedWarning',
  'characterSpell',
  'spell',
  'spellCatalogIndex',
  'spellCatalogSummary',
]);
const reviewed: Record<string, string> = {
  'convex/initialCharacterBackfill.ts:start':
    'Operator: private candidate preparation requires the closed legacy gate, current run, epoch and input capture',
  'convex/initialCharacterBackfill.ts:batch':
    'Operator: private candidate preparation requires the closed legacy gate, current run, epoch and input capture',
  'convex/initialCharacterBackfill.ts:resume':
    'Operator: private candidate preparation requires the closed legacy gate, current run, epoch and input capture',
  'convex/initialCharacterBackfill.ts:validate':
    'Operator: private candidate preparation requires the closed legacy gate, current run, epoch and input capture',
  'convex/initialCharacterBackfill.ts:startValidation':
    'Operator: private candidate preparation requires the closed legacy gate, current run, epoch and input capture',
  'convex/initialCharacterBackfill.ts:startDriver':
    'Operator: private candidate preparation requires the closed legacy gate, current run, epoch and input capture',
  'convex/initialCharacterBackfill.ts:drive':
    'Operator: private candidate preparation requires the closed legacy gate, current run, epoch and input capture',
  'convex/initialCharacterBackfill.ts:stopDriver':
    'Operator: private candidate preparation requires the closed legacy gate, current run, epoch and input capture',
  'convex/initialCharacterBackfill.ts:abortBeforeActivation':
    'Operator: aborts the current capture and reopens only its unactivated run',
  'convex/characterMoves.ts:cleanup':
    'Housekeeping: bounded cleanup of private obsolete move preparation; never changes live Character or catalog state',
  'convex/initialMigration.ts:start':
    'Operator: atomically closes the gate and records the run',
  'convex/initialMigration.ts:abortBeforeActivation':
    'Operator: reopens only the current unactivated run and advances the epoch',
  'convex/canonicalDraftPersistence.ts:retireClosedDraft':
    'Write gate (maintenance defers); accepted draft retirement is idempotent across epochs and Character authority',
  'convex/organizationDepartures.ts:drive':
    'Write gate (maintenance defers); trusted departure driver records failed steps and retries, running each return step under the legacy Character gate with the current epoch',
  'convex/accountDeletions.ts:drive':
    'Write gate (maintenance defers); trusted account deletion driver records failed steps and retries, running each Character step under the legacy Character gate with the current epoch',
  'convex/campaignDeletions.ts:drive':
    'Write gate (maintenance defers); trusted campaign deletion driver records failed steps and retries, running each return and purge step under the legacy Character gate with the current epoch, and deletes the campaign row once no Character remains',
  'convex/organizationDeletions.ts:drive':
    'Write gate (maintenance defers); trusted organization deletion driver records failed steps and retries, running each stage step under the general write gate with the current epoch',
  'convex/characterSheetSpells.ts:cleanupCatalog':
    'Housekeeping: completes an authorized Character deletion; refuses live Characters, including during maintenance',
  'convex/canonicalPersistenceFixtures.ts:inspect':
    'Read-only fixture inspection; no writes or scheduling',
  'convex/clerk.ts:fulfill':
    'Signature verification only; no writes or scheduling',
  'convex/http.ts:httpAction#1':
    'Webhook: verifies signature before database access; delegates to gated user mutations with signed event time',
};

type Writer = {
  name: string;
  policy: string;
  writerClass:
    | 'legacyCharacter'
    | 'general'
    | 'operator'
    | 'retired'
    | 'housekeeping'
    | 'readOnly';
};

function propertyValue(node: ts.Node | undefined, name: string) {
  if (!node || !ts.isObjectLiteralExpression(node)) return undefined;
  const property = node.properties.find(
    (entry) => entry.name?.getText() === name,
  );
  if (property && ts.isPropertyAssignment(property))
    return property.initializer;
  if (property && ts.isShorthandPropertyAssignment(property))
    return property.name;
  if (property && ts.isMethodDeclaration(property)) return property;
  return undefined;
}

function acceptsWriteEpoch(options: ts.Node | undefined, retired: boolean) {
  const args = propertyValue(options, 'args');
  if (retired && args?.getText() === 'v.any()') return true;
  return (
    propertyValue(args, 'writeEpoch')?.getText().replace(/\s/g, '') ===
    'v.optional(v.number())'
  );
}

type ImportedName = { name: string; module: string };
type Imports = {
  names: Map<string, ImportedName>;
  namespaces: Map<string, string>;
};

function collectImports(ast: ts.SourceFile): Imports {
  const names = new Map<string, ImportedName>();
  const namespaces = new Map<string, string>();
  for (const node of ast.statements) {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteral(node.moduleSpecifier)
    )
      continue;
    const module = node.moduleSpecifier.text.startsWith('.')
      ? posix.normalize(
          posix.join(posix.dirname(ast.fileName), node.moduleSpecifier.text),
        )
      : node.moduleSpecifier.text;
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const entry of bindings.elements)
        names.set(entry.name.text, {
          name: entry.propertyName?.text ?? entry.name.text,
          module,
        });
    } else if (bindings && ts.isNamespaceImport(bindings)) {
      namespaces.set(bindings.name.text, module);
    }
  }
  return { names, namespaces };
}

function resolveImport(
  node: ts.Node,
  imports: Imports,
): ImportedName | undefined {
  if (ts.isIdentifier(node)) return imports.names.get(node.text);
  if (!ts.isPropertyAccessExpression(node) || !ts.isIdentifier(node.expression))
    return undefined;
  const module = imports.namespaces.get(node.expression.text);
  return module === undefined ? undefined : { name: node.name.text, module };
}

function isBuilder(imported: ImportedName | undefined) {
  return (
    imported &&
    (rawBuilders.has(imported.name) || gatedBuilders.has(imported.name))
  );
}

function isDirectCall(node: ts.Node) {
  return ts.isCallExpression(node.parent) && node.parent.expression === node;
}

function checkEscapes(
  node: ts.Node,
  imports: Imports,
  path: string,
  errors: string[],
) {
  if (
    path === 'convex/lib/writeGate.ts' ||
    path === 'convex/lib/campaignRuntime.ts'
  )
    return;
  if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) {
    const imported = resolveImport(node, imports);
    if (imported && isBuilder(imported) && !isDirectCall(node))
      errors.push(
        `${path} raw builder ${imported.name} escapes a direct registration`,
      );
  }
  if (
    ts.isIdentifier(node) &&
    imports.namespaces.has(node.text) &&
    !(
      ts.isPropertyAccessExpression(node.parent) &&
      node.parent.expression === node
    )
  )
    errors.push(`${path} server namespace escapes a direct registration`);
  if (
    ts.isExportDeclaration(node) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  )
    errors.push(`${path} re-exports require explicit writer review`);
}

function classifyRegistration(
  imported: ImportedName,
  retired: boolean,
  name: string,
) {
  if (imported.module === 'convex/lib/writeGate') {
    switch (imported.name) {
      case 'gatedMutation':
      case 'gatedInternalMutation':
        return 'Shared write gate (epoch + maintenance + legacy Character authority)';
      case 'generalInternalMutation':
        return 'Shared write gate (epoch + maintenance)';
      case 'gatedWebhookMutation':
        return 'Write gate (maintenance); idempotent webhook, epoch exempt';
    }
  }
  if (
    imported.module === 'convex/lib/campaignRuntime' &&
    [
      'campaignMutation',
      'campaignInternalMutation',
      'legacyCharacterMutation',
    ].includes(imported.name)
  )
    return imported.name === 'legacyCharacterMutation'
      ? 'Shared write gate (epoch + maintenance + legacy Character authority)'
      : 'Shared write gate (epoch + maintenance)';
  return retired ? 'Retired: always rejects; never mutates' : reviewed[name];
}

function checkRegistration(
  node: ts.CallExpression,
  imported: ImportedName,
  imports: Imports,
  name: string,
  errors: string[],
  checker: ts.TypeChecker,
): Writer {
  const options = node.arguments[0];
  const handler = propertyValue(options, 'handler');
  const rejection =
    handler && ts.isIdentifier(handler)
      ? imports.names.get(handler.text)
      : undefined;
  const retired =
    rejection?.name === 'rejectRetiredWorkflow' &&
    rejection.module === 'convex/lib/retiredWorkflow';
  const policy = classifyRegistration(imported, retired, name);
  if (!policy) errors.push(`${name} is not gated or a reviewed exception`);
  if (
    name.startsWith('convex/initialCharacterBackfill.ts:') &&
    reviewed[name] &&
    (imported.name !== 'internalMutation' ||
      imported.module !== 'convex/_generated/server')
  )
    errors.push(
      `${name} candidate operator must use internalMutation from the generated server`,
    );
  if (
    ['mutation', 'mutationGeneric'].includes(imported.name) &&
    !acceptsWriteEpoch(options, retired)
  )
    errors.push(`${name} public mutation must accept optional writeEpoch`);
  if (
    (policy?.startsWith('Read-only') || policy?.startsWith('Signature')) &&
    /\.(insert|patch|replace|delete|runMutation|runAfter|runAt)\s*\(/.test(
      node.getText(),
    )
  )
    errors.push(`${name} read-only exception now writes or schedules work`);
  const writerClass = retired
    ? 'retired'
    : [
          'gatedMutation',
          'gatedInternalMutation',
          'legacyCharacterMutation',
        ].includes(imported.name)
      ? 'legacyCharacter'
      : policy?.startsWith('Operator:')
        ? 'operator'
        : policy?.startsWith('Housekeeping:')
          ? 'housekeeping'
          : policy?.startsWith('Read-only') || policy?.startsWith('Signature')
            ? 'readOnly'
            : 'general';
  if (policy && writerClass === 'general' && handler) {
    const tables = new Set<string>();
    const visited = new Set<ts.Node>();
    const argumentTables = new Map<ts.Symbol, Map<string, string>>();
    function localValue(node: ts.Identifier) {
      const symbol = ts.isShorthandPropertyAssignment(node.parent)
        ? checker.getShorthandAssignmentValueSymbol(node.parent)
        : checker.getSymbolAtLocation(node);
      const declaration = symbol?.valueDeclaration;
      if (declaration && ts.isFunctionDeclaration(declaration))
        return declaration;
      if (declaration && ts.isVariableDeclaration(declaration))
        return declaration.initializer;
      return undefined;
    }
    function idTable(type: ts.TypeNode | undefined) {
      if (!type || !ts.isTypeReferenceNode(type)) return undefined;
      const table = type.typeArguments?.[0];
      return type.typeName.getText() === 'Id' &&
        table &&
        ts.isLiteralTypeNode(table) &&
        ts.isStringLiteral(table.literal)
        ? table.literal.text
        : undefined;
    }
    function tableForId(node: ts.Expression): string | undefined {
      if (ts.isIdentifier(node)) {
        const declaration = checker.getSymbolAtLocation(node)?.valueDeclaration;
        if (
          declaration &&
          (ts.isParameter(declaration) || ts.isVariableDeclaration(declaration))
        ) {
          const table = idTable(declaration.type);
          if (table) return table;
          if (ts.isVariableDeclaration(declaration) && declaration.initializer)
            return tableForId(declaration.initializer);
        }
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression)
      ) {
        const symbol = checker.getSymbolAtLocation(node.expression);
        return symbol && argumentTables.get(symbol)?.get(node.name.text);
      }
      return undefined;
    }
    function visit(node: ts.Node, isHandler = false, isCalled = false) {
      if (ts.isParenthesizedExpression(node)) {
        visit(node.expression, isHandler, isCalled);
        return;
      }
      if (
        !isHandler &&
        !isCalled &&
        (ts.isFunctionDeclaration(node) ||
          ts.isFunctionExpression(node) ||
          ts.isArrowFunction(node) ||
          ts.isMethodDeclaration(node))
      )
        return;
      if (visited.has(node)) return;
      visited.add(node);
      if ((isHandler || isCalled) && ts.isIdentifier(node)) {
        const value = localValue(node);
        if (value) visit(value, isHandler, true);
      }
      if (
        isHandler &&
        (ts.isArrowFunction(node) ||
          ts.isFunctionExpression(node) ||
          ts.isFunctionDeclaration(node) ||
          ts.isMethodDeclaration(node))
      ) {
        const args = node.parameters[1];
        const symbol = args && checker.getSymbolAtLocation(args.name);
        const validators = propertyValue(options, 'args');
        if (symbol && validators && ts.isObjectLiteralExpression(validators)) {
          const fields = new Map<string, string>();
          for (const property of validators.properties) {
            if (!ts.isPropertyAssignment(property)) continue;
            const validator = property.initializer;
            if (
              ts.isCallExpression(validator) &&
              ts.isPropertyAccessExpression(validator.expression) &&
              validator.expression.name.text === 'id'
            ) {
              const table = validator.arguments[0];
              if (table && ts.isStringLiteral(table))
                fields.set(property.name.getText(), table.text);
            }
          }
          argumentTables.set(symbol, fields);
        }
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        node.expression.expression.name.text === 'db' &&
        ['insert', 'patch', 'delete', 'replace'].includes(
          node.expression.name.text,
        )
      ) {
        const target = node.arguments[0];
        const table =
          target &&
          (ts.isStringLiteral(target)
            ? target.text
            : node.expression.name.text !== 'insert'
              ? tableForId(target)
              : undefined);
        if (table && characterTables.has(table)) tables.add(table);
      }
      ts.forEachChild(node, (child) =>
        visit(
          child,
          false,
          ts.isCallExpression(node) &&
            (node.expression === child ||
              node.arguments.some((argument) => argument === child)),
        ),
      );
    }
    visit(handler, true);
    for (const table of tables)
      errors.push(`${name} writes ${table} without a legacy Character builder`);
  }
  return { name, policy: policy ?? 'UNGATED', writerClass };
}

function auditSource(
  path: string,
  source: string,
  writers: Writer[],
  errors: string[],
) {
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const imports = collectImports(ast);
  const compilerOptions = { noLib: true, noResolve: true };
  const program = ts.createProgram([path], compilerOptions, {
    ...ts.createCompilerHost(compilerOptions),
    getSourceFile: (fileName) => (fileName === path ? ast : undefined),
  });
  const checker = program.getTypeChecker();
  let anonymous = 0;
  function visit(node: ts.Node, parentOwner?: string) {
    if (ts.isImportDeclaration(node)) return;
    checkEscapes(node, imports, path, errors);
    const owner =
      ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
        ? node.name.text
        : parentOwner;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isIdentifier(node.initializer)
    ) {
      let initializer: ts.Expression | undefined = node.initializer;
      const seen = new Set<ts.Symbol>();
      while (initializer && ts.isIdentifier(initializer)) {
        const symbol = checker.getSymbolAtLocation(initializer);
        if (!symbol || seen.has(symbol)) break;
        seen.add(symbol);
        const declaration = symbol.valueDeclaration;
        initializer =
          declaration && ts.isVariableDeclaration(declaration)
            ? declaration.initializer
            : undefined;
      }
      if (initializer && ts.isCallExpression(initializer)) {
        const imported = resolveImport(initializer.expression, imports);
        if (imported && isBuilder(imported))
          writers.push(
            checkRegistration(
              initializer,
              imported,
              imports,
              `${path}:${node.name.text}`,
              errors,
              checker,
            ),
          );
      }
    }
    if (ts.isCallExpression(node)) {
      const imported = resolveImport(node.expression, imports);
      if (imported && isBuilder(imported)) {
        const name = `${path}:${owner ?? `${imported.name}#${++anonymous}`}`;
        writers.push(
          checkRegistration(node, imported, imports, name, errors, checker),
        );
      }
    }
    ts.forEachChild(node, (child) => visit(child, owner));
  }
  visit(ast);
}

export function auditWriters(sources: Record<string, string>) {
  const writers: Writer[] = [];
  const errors: string[] = [];
  for (const [path, source] of Object.entries(sources).sort())
    auditSource(path, source, writers, errors);
  writers.sort((a, b) => a.name.localeCompare(b.name));
  return { writers, errors };
}

export function readWriterSources(root: string) {
  const sources: Record<string, string> = {};
  function walk(directory: string) {
    for (const entry of readdirSync(join(root, directory), {
      withFileTypes: true,
    })) {
      const path = posix.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '_generated') walk(path);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'))
        sources[path] = readFileSync(join(root, path), 'utf8');
    }
  }
  walk('convex');
  return sources;
}

export function writerInventory(writers: Writer[]) {
  return [
    '| Registered writer | Class | Gate or reviewed exception |',
    '| --- | --- | --- |',
    ...writers.map(
      ({ name, policy, writerClass }) =>
        `| \`${name}\` | ${writerClass} | ${policy} |`,
    ),
  ].join('\n');
}
