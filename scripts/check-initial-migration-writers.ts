import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  auditWriters,
  readWriterSources,
  writerInventory,
} from './lib/initial-migration-writers.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const { writers, errors } = auditWriters(readWriterSources(root));
const inventory = writerInventory(writers);
const doc = readFileSync(
  new URL('../docs/initial-character-migration-write-gate.md', import.meta.url),
  'utf8',
);
if (!doc.includes(inventory))
  errors.push(
    'Writer inventory is stale. Review registrations and update docs/initial-character-migration-write-gate.md.',
  );
if (errors.length) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exitCode = 1;
} else
  process.stdout.write(
    `Initial migration write gate: ${writers.length} registrations checked.\n`,
  );
