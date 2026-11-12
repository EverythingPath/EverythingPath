import reviewedCastingTables from './reviewed-casting-tables.json' with { type: 'json' };
import { representativeRaceCatalog } from '../../convex/lib/representativeRaceCatalog.ts';
import {
  representativeClassCatalog,
  representativeClassCounterparts,
  representativeClassFeatureSchedules,
} from '../../convex/lib/representativeClassCatalog.ts';
import { representativeArchetypeCatalog } from '../../convex/lib/representativeArchetypeCatalog.ts';
import { representativeSelectionCatalog } from '../../convex/lib/representativeSelectionCatalog.ts';
import { representativeGrantedSpellCatalog } from '../../convex/lib/representativeSpellcastingCatalog.ts';
import { readFile } from 'node:fs/promises';
import { parserDependencies } from './package-resolution.ts';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

/** Follow only the importer's explicit local dependency graph, never app code. */
export async function catalogImplementationInputs() {
  const files = await collectImplementationSources();
  const { dependencyVersions, dependencyResolution } =
    await parserDependencies();
  return {
    parsers: {
      files: Object.fromEntries(
        [...files].sort(([a], [b]) => a.localeCompare(b)),
      ),
      dependencyVersions,
      dependencyResolution,
    },
    sanitizers: {
      source: files.get('scripts/catalog/sanitize.ts'),
      parse5: dependencyVersions.parse5,
    },
    ruleResources: await readAuthoredRuleResources(),
  };
}

async function collectImplementationSources() {
  const files = new Map<string, string>();
  async function collectSource(path: string) {
    const absolute = resolve(projectRoot, path);
    const key = relative(projectRoot, absolute).replaceAll('\\', '/');
    if (files.has(key)) return;
    const source = await readFile(absolute, 'utf8');
    files.set(key, source);
    if (extname(absolute) !== '.ts') return;
    for (const match of source.matchAll(
      /\bfrom\s+['"](\.[^'"]+)['"]|\bimport\s+['"](\.[^'"]+)['"]/g,
    )) {
      const specifier = match[1] ?? match[2];
      if (!specifier) continue;
      const target = resolve(dirname(absolute), specifier);
      await collectSource(extname(target) ? target : `${target}.ts`);
    }
  }
  for (const entry of [
    'scripts/catalog/import.ts',
    'scripts/catalog/admission.ts',
    'scripts/catalog/release.ts',
    'src/lib/catalog/legal-page-data.ts',
  ])
    await collectSource(entry);
  return files;
}

async function readAuthoredRuleResources() {
  return {
    representativeClassCatalog: {
      source: await readFile(
        resolve(projectRoot, 'convex/lib/representativeClassCatalog.ts'),
        'utf8',
      ),
      definitions: representativeClassCatalog,
      counterparts: representativeClassCounterparts,
      featureSchedules: representativeClassFeatureSchedules,
    },
    representativeArchetypeCatalog: {
      source: await readFile(
        resolve(projectRoot, 'convex/lib/representativeArchetypeCatalog.ts'),
        'utf8',
      ),
      definitions: representativeArchetypeCatalog,
    },
    representativeSelectionCatalog: {
      source: await readFile(
        resolve(projectRoot, 'convex/lib/representativeSelectionCatalog.ts'),
        'utf8',
      ),
      definitions: representativeSelectionCatalog,
    },
    representativeSpellcastingCatalog: {
      source: await readFile(
        resolve(projectRoot, 'convex/lib/representativeSpellcastingCatalog.ts'),
        'utf8',
      ),
      definitions: representativeGrantedSpellCatalog,
    },
    castingTables: {
      source: await readFile(
        resolve(projectRoot, 'scripts/catalog/reviewed-casting-tables.json'),
        'utf8',
      ),
      definitions: reviewedCastingTables,
    },
    representativeRaceCatalog: {
      source: await readFile(
        resolve(projectRoot, 'convex/lib/representativeRaceCatalog.ts'),
        'utf8',
      ),
      definitions: representativeRaceCatalog,
    },
  };
}
