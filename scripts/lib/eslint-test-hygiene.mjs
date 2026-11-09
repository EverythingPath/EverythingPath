// The test-hygiene checks that depend on what a name is bound to: skipIf and
// runIf guards, and the host's home directory. A syntactic ratchet, not a
// security boundary; tests/fixtures/eslint-test-hygiene/ lists the forms it
// accepts, refuses and leaves as residuals.
//
// Names resolve two ways, with opposite biases. The home-directory ban asks
// whether a value may be a source (mayBe): a name may be the os module or
// process.env when any of its writes or initializers, a parameter or
// destructuring default included, may be one. The platform guard asks
// whether a value is exactly the module (isExactly): the global process, or
// a name bound once, and never written again, by an import, require() or
// await import(), never the bare import() Promise.
//
// skipIf and runIf are called on the spot with one platform predicate: a
// comparison (===, !==, ==, !=) of a platform read with a string literal, in
// either order, or &&, || and ! over such comparisons. A platform read is
// process.platform or process['platform'], or os.platform() or
// os['platform'](), on exactly the process or os module. Any other reference
// to a skipIf or runIf member, and any destructuring of one, is refused: its
// predicate cannot be checked.
//
// The home directory is refused from its sources: HOME read or destructured
// off process.env, and homedir imported, required, re-exported, destructured
// or read off the os module, where process is the global or the process
// module. Residuals: names computed at run time (os['home' + 'dir'],
// Reflect.get), split templates, and values that pass through a call, an
// array, a spread or a type assertion (read(process.env)).

const skipMethods = new Set(['skipIf', 'runIf']);
const moduleNames = new Map([
  ['os', new Set(['os', 'node:os'])],
  ['process', new Set(['process', 'node:process'])],
]);
const equality = new Set(['===', '!==', '==', '!=']);

// Each banned name with the value it must not be read off: a module and the
// property names that lead from it to that value.
const homeSources = new Map([
  ['HOME', { module: 'process', path: ['env'] }],
  ['homedir', { module: 'os', path: [] }],
]);

// A property name written out in the source: an identifier after a dot or
// in a pattern, a string literal, or a template without interpolations.
function staticName(key, computed) {
  if (!computed && key.type === 'Identifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  if (key.type === 'TemplateLiteral' && key.expressions.length === 0)
    return key.quasis[0].value.cooked;
  return undefined;
}

const memberName = (node) =>
  node.type === 'MemberExpression'
    ? staticName(node.property, node.computed)
    : undefined;

const isStringLiteral = (node) =>
  node.type === 'Literal' && typeof node.value === 'string';

const isModuleName = (node, module) =>
  isStringLiteral(node) && moduleNames.get(module).has(node.value);

const isOsSource = (node) => isModuleName(node, 'os');

const pathEquals = (left, right) =>
  left.length === right.length && left.every((name, i) => right[i] === name);

// What a value must be for value.<path> to be the target, or undefined when
// the path cannot lead to it.
function stripPath(target, path) {
  const keep = target.path.length - path.length;
  if (keep < 0 || !pathEquals(target.path.slice(keep), path)) return undefined;
  return { module: target.module, path: target.path.slice(0, keep) };
}

// The property path an import binding takes from its module: [] for the
// namespace or default, [name] for a named export.
function importedPath(specifier) {
  if (specifier.type !== 'ImportSpecifier') return [];
  const name = staticName(specifier.imported);
  return name === 'default' ? [] : [name];
}

const isPatternProperty = (parent, node) =>
  parent.type === 'Property' &&
  parent.value === node &&
  parent.parent.type === 'ObjectPattern';

// The value a declarator or an assignment gives its left-hand side.
function assignedValue(parent, node) {
  if (parent.type === 'VariableDeclarator' && parent.id === node)
    return parent.init;
  if (parent.type === 'AssignmentExpression' && parent.left === node)
    return parent.right;
  return undefined;
}

// The values a binding name or a pattern receives, each with the property
// names that lead from the value to it: in `{ env: { HOME } = d } = process`
// the inner pattern receives d through [] and process through ['env'].
// Defaults count at every level. The walk ends at a function or catch
// parameter, whose value the caller passes.
function valuesOf(node) {
  const values = [];
  let path = [];
  for (let step = node; step; ) {
    const { parent } = step;
    if (parent.type === 'AssignmentPattern' && parent.left === step) {
      values.push({ value: parent.right, path });
      step = parent;
    } else if (isPatternProperty(parent, step)) {
      path = [staticName(parent.key, parent.computed), ...path];
      step = parent.parent;
    } else {
      const value = assignedValue(parent, step);
      if (value) values.push({ value, path });
      step = undefined;
    }
  }
  return values;
}

export const testHygieneRule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      environmentSkip:
        'Tests must not skip on their environment; pin the fixture (tests/fixtures/pinned/README.md), or list a gate-host audit in scripts/orchestration/host-audits.json.',
      skipAlias:
        'Call skipIf/runIf directly, with a platform predicate; a reference that is not called on the spot cannot be checked.',
      homeDirectory: 'No home-directory paths in tests.',
    },
  },
  create(context) {
    const { sourceCode } = context;

    // The scope manager's reference for this identifier node, never a lookup
    // by name: a parameter default resolves outside the function body.
    function findReference(identifier) {
      let scope = sourceCode.getScope(identifier);
      for (; scope; scope = scope.upper) {
        const found = scope.references.find(
          (ref) => ref.identifier === identifier,
        );
        if (found) return found;
      }
      return undefined;
    }

    // The variable a reference resolves to; undefined for a global or a name
    // that is not a reference.
    function resolveVariable(identifier) {
      const variable = findReference(identifier)?.resolved;
      return variable && variable.defs.length > 0 ? variable : undefined;
    }

    // The global, not a local binding of the same name: a reference that
    // resolves to no declaration.
    function isGlobal(node, name) {
      if (node.type !== 'Identifier' || node.name !== name) return false;
      return (
        findReference(node) !== undefined && resolveVariable(node) === undefined
      );
    }

    // require('<module>') or await import('<module>'); the bare import()
    // is a Promise, not the module.
    function isModuleExpression(node, module) {
      if (node.type === 'AwaitExpression')
        return (
          node.argument.type === 'ImportExpression' &&
          isModuleName(node.argument.source, module)
        );
      return (
        node.type === 'CallExpression' &&
        isGlobal(node.callee, 'require') &&
        node.arguments.length === 1 &&
        isModuleName(node.arguments[0], module)
      );
    }

    function importIs(def, target) {
      return (
        def.type === 'ImportBinding' &&
        isModuleName(def.parent.source, target.module) &&
        pathEquals(importedPath(def.node), target.path)
      );
    }

    // mayBe, conservative, for the bans.
    function mayBe(node, target) {
      if (node.type === 'Identifier') return bindingMayBe(node, target);
      if (node.type === 'MemberExpression') {
        const outer = stripPath(target, [memberName(node)]);
        return outer !== undefined && mayBe(node.object, outer);
      }
      return (
        target.path.length === 0 && isModuleExpression(node, target.module)
      );
    }

    function valueMayBe({ value, path }, target) {
      const outer = stripPath(target, path);
      return outer !== undefined && mayBe(value, outer);
    }

    function writtenValues(variable) {
      const names = new Set(variable.defs.map((def) => def.name));
      for (const ref of variable.references)
        if (ref.isWrite()) names.add(ref.identifier);
      return [...names].flatMap(valuesOf);
    }

    // Bindings being resolved, so a cycle of writes ends.
    const resolving = new Set();

    function bindingMayBe(identifier, target) {
      if (isGlobal(identifier, 'process'))
        return target.module === 'process' && target.path.length === 0;
      const variable = resolveVariable(identifier);
      if (!variable || resolving.has(variable)) return false;
      resolving.add(variable);
      try {
        return (
          variable.defs.some((def) => importIs(def, target)) ||
          writtenValues(variable).some((value) => valueMayBe(value, target))
        );
      } finally {
        resolving.delete(variable);
      }
    }

    // isExactly, strict, for the platform guard.
    function isExactly(node, module) {
      if (isGlobal(node, 'process')) return module === 'process';
      if (node.type !== 'Identifier') return false;
      const variable = resolveVariable(node);
      return (
        variable?.defs.length === 1 &&
        variable.references.every((ref) => !ref.isWrite() || ref.init) &&
        isExactDefinition(variable.defs[0], module)
      );
    }

    function isExactDefinition(def, module) {
      if (def.type === 'ImportBinding')
        return importIs(def, { module, path: [] });
      return (
        def.type === 'Variable' &&
        def.node.id === def.name &&
        def.node.init != null &&
        isModuleExpression(def.node.init, module)
      );
    }

    function isPlatformRead(node) {
      if (node.type === 'CallExpression')
        return (
          node.arguments.length === 0 &&
          memberName(node.callee) === 'platform' &&
          isExactly(node.callee.object, 'os')
        );
      return (
        memberName(node) === 'platform' && isExactly(node.object, 'process')
      );
    }

    function isPlatformComparison(node) {
      return (
        equality.has(node.operator) &&
        ((isPlatformRead(node.left) && isStringLiteral(node.right)) ||
          (isStringLiteral(node.left) && isPlatformRead(node.right)))
      );
    }

    function isPlatformPredicate(node) {
      switch (node.type) {
        case 'UnaryExpression':
          return node.operator === '!' && isPlatformPredicate(node.argument);
        case 'LogicalExpression':
          return (
            node.operator !== '??' &&
            isPlatformPredicate(node.left) &&
            isPlatformPredicate(node.right)
          );
        case 'BinaryExpression':
          return isPlatformComparison(node);
        default:
          return false;
      }
    }

    function readsHome(name, object) {
      const target = homeSources.get(name);
      return target !== undefined && mayBe(object, target);
    }

    function destructuresHome(name, pattern) {
      const target = homeSources.get(name);
      return (
        target !== undefined &&
        valuesOf(pattern).some((value) => valueMayBe(value, target))
      );
    }

    const report = (node, messageId) => context.report({ node, messageId });

    function checkSkipCall(member) {
      const call = member.parent;
      if (call.type !== 'CallExpression' || call.callee !== member)
        report(member, 'skipAlias');
      else if (
        call.arguments.length !== 1 ||
        !isPlatformPredicate(call.arguments[0])
      )
        report(call, 'environmentSkip');
    }

    return {
      MemberExpression(node) {
        const name = memberName(node);
        if (skipMethods.has(name)) checkSkipCall(node);
        else if (readsHome(name, node.object)) report(node, 'homeDirectory');
      },
      'ObjectPattern > Property'(node) {
        const name = staticName(node.key, node.computed);
        if (skipMethods.has(name)) report(node, 'skipAlias');
        else if (destructuresHome(name, node.parent))
          report(node, 'homeDirectory');
      },
      ImportSpecifier(node) {
        if (
          staticName(node.imported) === 'homedir' &&
          isOsSource(node.parent.source)
        )
          report(node, 'homeDirectory');
      },
      ExportSpecifier(node) {
        if (
          node.parent.source &&
          isOsSource(node.parent.source) &&
          staticName(node.local) === 'homedir'
        )
          report(node, 'homeDirectory');
      },
      ExportAllDeclaration(node) {
        if (isOsSource(node.source)) report(node, 'homeDirectory');
      },
    };
  },
};
