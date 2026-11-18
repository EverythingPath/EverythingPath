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
import {
  encodeLegalRecordsIn,
  findLegalRecordProblems,
  legalRecordLabel,
} from './catalog/legal-records.ts';
import {
  encodeLegalRecord,
  parseLegalRecordText,
} from '../src/lib/catalog/legal-record-codec.ts';

/** Rewrites one file with `next(text)`, saying so when it changes. */
async function rewrite(
  path: string,
  next: (text: string) => string,
  verb: string,
) {
  const text = await readFile(path, 'utf8');
  const written = next(text);
  if (written === text) return;
  await writeFile(path, written);
  process.stdout.write(`${verb} ${path}\n`);
}

/** `--encode` and `--expand`: each named legal record, rewritten in place. */
async function rewriteNamed(
  positionals: string[],
  { encode, expand }: { encode?: boolean; expand?: boolean },
) {
  if (encode && expand) throw new Error('Give --encode or --expand, not both.');
  for (const path of positionals)
    await (encode
      ? rewrite(path, (text) => encodeLegalRecord(JSON.parse(text)), 'Encoded')
      : rewrite(
          path,
          (text) => `${JSON.stringify(parseLegalRecordText(text), null, 2)}\n`,
          'Expanded',
        ));
}

/** `--check`: names every file not in its stored form, writing nothing. */
async function check(root: string) {
  const stale = await checkCatalogDataFiles(root);
  const { problems } = findLegalRecordProblems({ root });
  if (problems.length)
    process.stderr.write(
      `Legal records are not as stored:\n${problems.map((problem) => `  ${problem}`).join('\n')}\n`,
    );
  if (stale.length)
    process.stderr.write(
      `Not canonical; run pnpm catalog:format:\n${stale.map((path) => `  ${path}`).join('\n')}\n`,
    );
  if (stale.length || problems.length) process.exitCode = 1;
  else process.stdout.write('Catalog data files are canonical.\n');
}

async function format(root: string) {
  for (const file of catalogDataFileNames) {
    const path = catalogDataFiles[file];
    const target = join(root, path);
    const text = await readFile(target, 'utf8');
    const canonical = formatCatalogData(file, parseCatalogDataText(file, text));
    if (canonical === text) continue;
    await writeFile(target, canonical);
    process.stdout.write(`Formatted ${path}\n`);
  }
  const encoded = encodeLegalRecordsIn(root).flatMap((name) => [
    `Encoded ${legalRecordLabel(name)}\n`,
  ]);
  for (const line of encoded) process.stdout.write(line);
}

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      check: { type: 'boolean' },
      root: { type: 'string' },
      encode: { type: 'boolean' },
      expand: { type: 'boolean' },
      help: { type: 'boolean' },
    },
    strict: true,
    allowPositionals: true,
  });
  if (values.help) {
    process.stdout.write(
      'Usage: pnpm catalog:format [--check] [--root PATH]\n       pnpm catalog:format --encode FILE... | --expand FILE...\nRewrites the five shared catalog data files (Curation Overlay, Attribution Assessments and evidence, Section 15 Registry, held notices) in canonical form, the evidence encoded with shared blobs, and stores each legal record in the encoded set (encodedLegalRecords in scripts/catalog/legal-records.ts) with its repeated entries and texts once. --check writes nothing and exits nonzero when any file is not canonical or the encoded set and the stored records disagree. --root defaults to this checkout. --encode stores each named legal record encoded; --expand writes each back in its plain form (JSON.stringify layout), the same value, to edit it.\n',
    );
    return;
  }
  const named = values.encode === true || values.expand === true;
  if (
    named !== positionals.length > 0 ||
    (named && (values.check || values.root))
  )
    throw new Error(
      'File paths go with --encode or --expand, and only they; run pnpm catalog:format --help.',
    );
  if (named) return rewriteNamed(positionals, values);
  const root = values.root
    ? resolve(values.root)
    : fileURLToPath(new URL('../', import.meta.url));
  return values.check ? check(root) : format(root);
}
main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
