import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  catalogDataFileNames,
  catalogDataFiles,
  checkCatalogDataFiles,
  formatCatalogData,
  parseCatalogDataText,
} from './catalog/data-files.ts';

async function main() {
  const { values } = parseArgs({
    options: {
      check: { type: 'boolean' },
      root: { type: 'string' },
      help: { type: 'boolean' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.help) {
    process.stdout.write(
      'Usage: pnpm catalog:format [--check] [--root PATH]\nRewrites the five shared catalog data files (Curation Overlay, Attribution Assessments and evidence, Section 15 Registry, held notices) in canonical form, the evidence encoded with shared blobs. --check writes nothing and exits nonzero when any file is not canonical. --root defaults to this checkout.\n',
    );
    return;
  }
  const root = values.root
    ? resolve(values.root)
    : fileURLToPath(new URL('../', import.meta.url));
  if (values.check) {
    const stale = await checkCatalogDataFiles(root);
    if (stale.length) {
      process.stderr.write(
        `Not canonical; run pnpm catalog:format:\n${stale.map((path) => `  ${path}`).join('\n')}\n`,
      );
      process.exitCode = 1;
    } else process.stdout.write('Catalog data files are canonical.\n');
    return;
  }
  for (const file of catalogDataFileNames) {
    const path = catalogDataFiles[file];
    const target = join(root, path);
    const text = await readFile(target, 'utf8');
    const canonical = formatCatalogData(file, parseCatalogDataText(file, text));
    if (canonical === text) continue;
    await writeFile(target, canonical);
    process.stdout.write(`Formatted ${path}\n`);
  }
}
main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
