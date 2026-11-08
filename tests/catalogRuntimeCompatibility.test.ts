import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import ts from 'typescript';
import {
  catalogCalculationV1Files,
  catalogRuntimeCompatibility,
} from '../src/lib/catalog/runtime-compatibility';

test('v1 calculation identity matches its pinned implementation and militia projection', () => {
  const expectedIdentity =
    'sha256:494b2a54bf200f0da65d23018b92f5e56850007579b988f81c947f33823830c9';
  const compatibilityChangeMessage =
    'Calculation compatibility changed. Before the first Catalog Release activation, ' +
    'review the intentional change, run `pnpm catalog:pin` and rotate the identities in ' +
    'src/lib/catalog/calculation-identities.ts, this independent expected identity and current recorded expectations in the same change. ' +
    'After first activation, retain the old implementation and provide new identity dispatch ' +
    'and coordinated activation (#318/#319); updating the pin alone is unsafe. ' +
    'See docs/catalog-import/releases.md for the procedure.';
  expect(
    catalogRuntimeCompatibility.calculation,
    compatibilityChangeMessage,
  ).toBe(expectedIdentity);
  expect(catalogCalculationV1Files).toEqual([
    'src/lib/character-sheet.ts',
    'src/lib/character-sheet-advancement.ts',
    'src/lib/character-sheet-formulas.ts',
    'convex/lib/militiaCharacterFacts.ts',
    'src/lib/character-sheet-grants.ts',
    'src/lib/character-sheet-entries.ts',
    'src/lib/character-sheet-skills.ts',
    'src/lib/character-sheet-conditions.ts',
    'src/lib/catalog/data/reviewed-conditions.json',
    'src/lib/character-sheet-spellcasting.ts',
    'src/lib/character-sheet-spell-collections.ts',
    'src/lib/character-sheet-spell-warnings.ts',
    'src/lib/character-sheet-casting-tables.ts',
    'src/lib/character-sheet-permanent-statistics.ts',
    'scripts/catalog/reviewed-casting-tables.json',
    'src/lib/character-sheet-abilities.ts',
    'src/lib/character-sheet-racial.ts',
    'src/lib/character-sheet-equipment.ts',
    'src/lib/character-sheet-proficiencies.ts',
    'src/lib/character-sheet-proficiency-prerequisites.ts',
    'src/lib/character-sheet-armor-categories.ts',
    'src/lib/character-sheet-class-levels.ts',
    'src/lib/character-sheet-archetypes.ts',
    'src/lib/character-sheet-archetype-helpers.ts',
    'src/lib/character-sheet-attacks.ts',
    'src/lib/character-sheet-prerequisites.ts',
    'src/lib/character-sheet-selection-rules.ts',
    'src/lib/character-sheet-proficiency-schema.ts',
    'src/lib/character-sheet-prerequisite-schema.ts',
    'src/lib/character-sheet-prerequisite-evaluation.ts',
    'src/lib/character-sheet-selection-slots.ts',
    'src/lib/character-sheet-selection.ts',
    'src/lib/character-sheet-linked-inputs.ts',
    'src/lib/catalog/representative-companion-rules.ts',
    'src/lib/character-sheet-linked-input-evaluation.ts',
    'src/lib/catalog/calculation-dispatch.ts',
    'convex/lib/catalogReleaseCompatibility.ts',
    'convex/lib/representativeSelectionCatalog.ts',
    'src/lib/character-sheet-familiar.ts',
    'src/lib/catalog/representative-familiars.ts',
    'convex/lib/characterSheetCompanion.ts',
    'convex/lib/characterSheetLinkedInputs.ts',
    'src/lib/character-sheet-skill-definitions.ts',
    'src/lib/character-sheet-familiar-targets.ts',
    'convex/lib/characterSheetData.ts',
    'convex/lib/characterSheetLinkedInputReader.ts',
    'convex/lib/companionRelationshipGraph.ts',
    'convex/lib/preparedCharacterSheet.ts',
    'src/lib/character-sheet-situations.ts',
    'src/lib/character-sheet-companion-progression.ts',
    'src/lib/catalog/representative-animal-companions.ts',
    'src/lib/character-sheet-companion-warnings.ts',
    'src/lib/character-sheet-creature-sizes.ts',
    'src/lib/character-sheet-unresolved-targets.ts',
    'src/lib/character-sheet-natural-attacks.ts',
    'src/lib/character-sheet-attack-types.ts',
    'src/lib/character-sheet-spellcasting-features.ts',
    'src/lib/catalog-rule-lookups.ts',
    'src/lib/character-sheet-routine-options.ts',
    'src/lib/character-sheet-items.ts',
    'src/lib/character-sheet-spell-effects.ts',
    'src/lib/character-sheet-companion-sources.ts',
    'src/lib/character-sheet-eidolon-progression.ts',
    'src/lib/character-sheet-eidolon-warnings.ts',
    'src/lib/catalog/representative-eidolons.ts',
    'src/lib/character-sheet-companion-rank-warnings.ts',
    'src/lib/catalog/representative-unchained-eidolons.ts',
    'src/lib/character-sheet-spell-labels.ts',
    'src/lib/character-sheet-companion-components.ts',
    'src/lib/character-sheet-combined-form.ts',
    'src/lib/character-sheet-cohort.ts',
    'src/lib/character-sheet-cohort-schema.ts',
    'src/lib/catalog/representative-cohorts.ts',
    'src/lib/character-sheet-archetype-casting.ts',
    'src/lib/character-sheet-casting-copy.ts',
    'src/lib/character-sheet-flurry.ts',
    'src/lib/character-sheet-rule-keys.ts',
  ]);
  const fingerprint = createHash('sha256');
  for (const path of catalogCalculationV1Files) {
    fingerprint.update(`${path}\0`);
    fingerprint.update(readFileSync(path));
    fingerprint.update('\0');
  }
  expect(
    `sha256:${fingerprint.digest('hex')}`,
    compatibilityChangeMessage,
  ).toBe(expectedIdentity);
  const importsByFile = [
    [
      './character-sheet-unresolved-targets',
      './character-sheet-companion-progression',
      './character-sheet-cohort',
      './character-sheet-attacks',
      './character-sheet-archetypes',
      './character-sheet-attack-types',
      './character-sheet-selection-rules',
      './character-sheet-prerequisites',
      'zod',
      './character-sheet-grants',
      './character-sheet-skills',
      './character-sheet-familiar',
      './character-sheet-combined-form',
      './catalog/representative-familiars',
      './character-sheet-equipment',
      './character-sheet-proficiencies',
      './character-sheet-conditions',
      './character-sheet-spellcasting',
      './character-sheet-spell-collections',
      './character-sheet-situations',
      './character-sheet-racial',
      './character-sheet-advancement',
      './character-sheet-formulas',
      './character-sheet-items',
      './character-sheet-spell-effects',
      './character-sheet-abilities',
      './character-sheet-creature-sizes',
    ],
    [
      './character-sheet-companion-progression',
      './character-sheet-archetypes',
      './character-sheet-grants',
      './character-sheet-class-levels',
      './character-sheet',
      './character-sheet-companion-components',
      './character-sheet-skills',
    ],
    [],
    [
      './characterSheetData',
      'convex/values',
      '../../src/lib/character-sheet',
      './preparedCharacterSheet',
    ],
    [
      './character-sheet-archetype-helpers',
      './character-sheet-archetypes',
      './character-sheet',
      './character-sheet-racial',
      './character-sheet-spell-effects',
      './character-sheet-entries',
    ],
    ['./character-sheet-items'],
    ['./character-sheet', './character-sheet-skill-definitions'],
    ['zod', 'convex/values', './catalog/data/reviewed-conditions.json'],
    [],
    [
      './character-sheet-casting-tables',
      './character-sheet-permanent-statistics',
      './character-sheet-grants',
      './character-sheet-archetypes',
      './character-sheet-archetype-casting',
      './character-sheet-spellcasting-features',
    ],
    [
      './character-sheet-spellcasting-features',
      './character-sheet-archetype-casting',
      './character-sheet-spell-warnings',
    ],
    [],
    [
      '../../scripts/catalog/reviewed-casting-tables.json',
      'zod',
      './character-sheet-abilities',
    ],
    ['./character-sheet'],
    [],
    [],
    ['./character-sheet', './character-sheet-skills'],
    [
      './character-sheet',
      './character-sheet-proficiencies',
      './character-sheet-items',
    ],
    [
      './character-sheet-grants',
      './character-sheet-class-levels',
      './character-sheet-armor-categories',
    ],
    [
      './character-sheet-grants',
      './character-sheet-class-levels',
      './character-sheet-selection',
      './character-sheet-proficiencies',
    ],
    [],
    ['./character-sheet-grants', './character-sheet-rule-keys'],
    ['./character-sheet-archetype-helpers'],
    [],
    [
      './character-sheet-attack-types',
      './character-sheet-items',
      './character-sheet-creature-sizes',
      './character-sheet-spell-effects',
      './character-sheet',
      './character-sheet-proficiencies',
      './character-sheet-casting-copy',
      './character-sheet-flurry',
      './character-sheet-natural-attacks',
      './character-sheet-routine-options',
    ],
    [
      './character-sheet-grants',
      './character-sheet-class-levels',
      './character-sheet-selection',
      './character-sheet-proficiencies',
      './character-sheet-proficiency-prerequisites',
      './character-sheet-prerequisite-evaluation',
    ],
    [
      './character-sheet-grants',
      './character-sheet-proficiency-prerequisites',
      './character-sheet-prerequisite-schema',
      './character-sheet-selection-slots',
    ],
    ['zod'],
    [
      'zod',
      './character-sheet-abilities',
      './character-sheet-proficiency-schema',
    ],
    [
      './character-sheet-archetype-helpers',
      './character-sheet-grants',
      './character-sheet-skills',
      './character-sheet-class-levels',
      './character-sheet-spellcasting',
      './character-sheet-archetype-casting',
      './character-sheet-racial',
      './character-sheet-proficiencies',
      './character-sheet-proficiency-prerequisites',
      './character-sheet-prerequisite-schema',
      './character-sheet-linked-input-evaluation',
    ],
    [
      './character-sheet',
      './character-sheet-grants',
      './character-sheet-proficiency-prerequisites',
      './character-sheet-advancement',
      './character-sheet-prerequisite-schema',
    ],
    [],
    [
      'zod',
      './character-sheet',
      './character-sheet-class-levels',
      './character-sheet-skills',
      './character-sheet-abilities',
    ],
    [
      'zod',
      '../character-sheet-skill-definitions',
      '../character-sheet-linked-input-evaluation',
      './representative-cohorts',
    ],
    [],
    ['../character-sheet', './calculation-identities'],
    [
      './catalogFixturePolicy',
      'convex/values',
      '../../src/lib/catalog/calculation-dispatch',
      '../../src/lib/catalog/runtime-compatibility',
    ],
    [],
    [
      './character-sheet-familiar-targets',
      './catalog/representative-familiars',
      './character-sheet-linked-input-evaluation',
      './character-sheet-skill-definitions',
      './character-sheet-creature-sizes',
    ],
    ['zod'],
    [
      'convex/values',
      './catalogReleaseCompatibility',
      './characterAccess',
      './characterSheetLinkedInputReader',
      './characterSheetData',
      './companionRelationshipGraph',
      '../../src/lib/character-sheet-companion-sources',
      '../../src/lib/character-sheet-companion-components',
      '../../src/lib/character-sheet-eidolon-progression',
      '../../src/lib/character-sheet-companion-progression',
      '../../src/lib/character-sheet-familiar',
      '../../src/lib/character-sheet-cohort-schema',
      '../../src/lib/character-sheet-linked-inputs',
    ],
    [
      'convex/values',
      './characterSheet',
      './characterAccess',
      '../../src/lib/character-sheet-linked-inputs',
      './characterSheetLinkedInputReader',
    ],
    [],
    [],
    [
      './catalogReleaseBoundary',
      '../../src/lib/catalog-copy-references',
      './catalogCopies',
      'convex/values',
      '../../src/lib/json-bytes',
      '../../src/lib/character-sheet-attack-types',
      '../../src/lib/catalog-rule-lookups',
      '../../src/lib/character-sheet',
      './catalogReleaseCompatibility',
    ],
    [
      '../../src/lib/catalog/representative-companion-rules',
      'convex/values',
      './companionRelationshipGraph',
      '../../src/lib/character-sheet-linked-inputs',
    ],
    [
      '../../src/lib/catalog/representative-companion-rules',
      '../../src/lib/character-sheet-linked-inputs',
      'convex/values',
      './characterSheetData',
      '../../src/lib/character-sheet-grants',
      '../../src/lib/character-sheet-companion-sources',
      '../../src/lib/character-sheet-companion-components',
      '../../src/lib/character-sheet-rule-keys',
    ],
    ['convex/values', './characterSheetCompanion', './characterSheetData'],
    [],
    [
      'zod',
      './catalog/representative-animal-companions',
      './catalog/representative-companion-rules',
      './character-sheet-abilities',
      './character-sheet-creature-sizes',
      './character-sheet-companion-sources',
      './character-sheet-eidolon-progression',
    ],
    ['zod'],
    [
      './catalog/representative-animal-companions',
      './character-sheet-companion-sources',
      './character-sheet-companion-rank-warnings',
      './character-sheet-eidolon-progression',
      './character-sheet-eidolon-warnings',
    ],
    [],
    [
      'zod',
      './character-sheet-abilities',
      './character-sheet-skill-definitions',
    ],
    [],
    [],
    [
      './character-sheet-casting-tables',
      './character-sheet-grants',
      './character-sheet-archetype-casting',
    ],
    [
      './character-sheet-proficiencies',
      './character-sheet-prerequisite-schema',
    ],
    ['./character-sheet-flurry'],
    ['./character-sheet-attack-types', './character-sheet-situations'],
    [
      './character-sheet-attack-types',
      './character-sheet-casting-tables',
      './character-sheet-items',
      './character-sheet-spellcasting',
    ],
    [
      'zod',
      './character-sheet-companion-components',
      './character-sheet-creature-sizes',
      './character-sheet-skill-definitions',
      './character-sheet-linked-input-evaluation',
      './catalog/representative-companion-rules',
    ],
    [
      'zod',
      './catalog/representative-eidolons',
      './catalog/representative-unchained-eidolons',
      './character-sheet-abilities',
      './character-sheet-attack-types',
      './character-sheet-companion-sources',
      './character-sheet-companion-components',
      './character-sheet-creature-sizes',
      './character-sheet-skill-definitions',
      './character-sheet-natural-attacks',
      './character-sheet-spell-labels',
    ],
    [
      './catalog/representative-eidolons',
      './catalog/representative-unchained-eidolons',
      './character-sheet-abilities',
      './character-sheet-companion-components',
      './character-sheet-companion-sources',
      './character-sheet-companion-rank-warnings',
      './character-sheet-eidolon-progression',
    ],
    ['zod', '../character-sheet-abilities'],
    [],
    ['../character-sheet-abilities', './representative-eidolons'],
    [],
    [
      'zod',
      './catalog/representative-eidolons',
      './catalog/representative-companion-rules',
      './character-sheet-creature-sizes',
    ],
    [
      'zod',
      './character-sheet-archetype-helpers',
      './character-sheet-companion-sources',
      './character-sheet-creature-sizes',
      './catalog/representative-companion-rules',
      './character-sheet-class-levels',
      './catalog/representative-eidolons',
      './character-sheet-rule-keys',
    ],
    [
      'zod',
      './character-sheet-linked-input-evaluation',
      './catalog/representative-cohorts',
    ],
    [
      'zod',
      './character-sheet-linked-inputs',
      './character-sheet-cohort',
      './catalog/representative-cohorts',
    ],
    ['zod'],
    [
      'zod',
      './character-sheet-abilities',
      './character-sheet-casting-tables',
      './character-sheet-casting-copy',
    ],
    [],
    ['./character-sheet-class-levels', './character-sheet-rule-keys'],
    [],
  ];
  const exportsByFile: Record<string, string[]> = {
    'src/lib/character-sheet-companion-progression.ts': [
      './character-sheet-companion-warnings',
    ],
    'src/lib/character-sheet-familiar-targets.ts': [
      './character-sheet-unresolved-targets',
    ],

    'src/lib/character-sheet-skills.ts': [
      './character-sheet-skill-definitions',
    ],
    'src/lib/character-sheet-linked-inputs.ts': [
      './character-sheet-linked-input-evaluation',
    ],
    'src/lib/character-sheet.ts': [
      './character-sheet-abilities',
      './character-sheet-creature-sizes',
      './character-sheet-proficiencies',
    ],
    'src/lib/character-sheet-grants.ts': [
      './character-sheet-archetype-helpers',
    ],
    'src/lib/character-sheet-proficiencies.ts': [
      './character-sheet-proficiency-schema',
    ],
    'src/lib/character-sheet-prerequisites.ts': [
      './character-sheet-prerequisite-evaluation',
    ],
  };
  for (const [index, path] of catalogCalculationV1Files.entries()) {
    const ast = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
    );
    const imports = ast.statements
      .filter(ts.isImportDeclaration)
      .filter((node) => !node.importClause?.isTypeOnly)
      .map((node) =>
        ts.isStringLiteral(node.moduleSpecifier)
          ? node.moduleSpecifier.text
          : 'unsupported',
      );
    expect(
      imports,
      `Runtime imports changed in ${path}. Review calculator dependencies and update ` +
        'the explicit closure and independent import expectations before recomputing its identity. ' +
        'See docs/catalog-import/releases.md for the preactivation and postactivation procedure.',
    ).toEqual(importsByFile[index]);
    const exports = ast.statements
      .filter(ts.isExportDeclaration)
      .filter((node) => node.moduleSpecifier && !node.isTypeOnly)
      .map((node) =>
        node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
          ? node.moduleSpecifier.text
          : 'unsupported',
      );
    expect(
      exports,
      `Runtime reexports changed in ${path}. Review calculator dependencies and update ` +
        'the explicit closure and independent reexport expectations before recomputing its identity. ' +
        'See docs/catalog-import/releases.md for the preactivation and postactivation procedure.',
    ).toEqual(exportsByFile[path] ?? []);
  }
});
