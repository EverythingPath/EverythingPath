import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  attribution227MatchesDrift,
  buildAttribution227Matches,
  buildPcgenNameIndex,
  matchesDifferences,
  matchesPath,
  readMatcherInputHashes,
  readPcgenFiles,
  readStoredInputs,
  serializeAttribution227Matches,
  storedBooksOf,
  verifyPcgenCheckout,
} from './catalog/attribution-227-matcher.ts';
import { importCatalog } from './catalog/import.ts';
import { pcgenPin } from './catalog/inventory.ts';
import { readAttribution227Matches } from './catalog/legal/attribution-227-matches.ts';
import { verifyInputs } from './catalog/operator.ts';

/**
 * `pnpm catalog:attribution-227-matches --write | --check`: the #227 scripted
 * match (`legal/attribution-227-matches.json`). Both modes import the whole
 * corpus at the pinned Foundry checkouts and read the PCGen checkout at
 * `pcgenPin` (`~/repos/everythingpath/sources/`, `.ep-cache/`). `--check`
 * writes nothing and fails when the committed file drifted from its pinned
 * inputs or from a fresh generation: its expanded matches compared with the
 * fresh ones record for record, and its text with the fresh text.
 */
const { values } = parseArgs({
  options: {
    write: { type: 'boolean' },
    check: { type: 'boolean' },
    help: { type: 'boolean' },
  },
  strict: true,
  allowPositionals: false,
});
if (values.help || values.write === values.check) {
  process.stdout.write(
    'Usage: pnpm catalog:attribution-227-matches --write | --check\nGenerates the #227 scripted match from the pinned Foundry and PCGen checkouts; --check writes nothing and exits 1 on drift.\n',
  );
  process.exitCode = values.help ? 0 : 64;
} else {
  const root = resolve('.');
  const parent = join(homedir(), 'repos/everythingpath');
  const pcgenCheckout = join(
    parent,
    `.ep-cache/pcgen-${pcgenPin.commit.slice(0, 8)}`,
  );
  verifyPcgenCheckout(pcgenCheckout);
  const system = join(parent, 'sources/foundryvtt-pathfinder1');
  const content = join(parent, 'sources/pf1-content');
  const verification = await verifyInputs({
    system,
    content,
    allowUnverified: false,
  });
  if (verification.status !== 'verified')
    throw new Error('The matcher needs the pinned Foundry checkouts.');
  const read = async (path: string): Promise<unknown> =>
    JSON.parse(await readFile(join(root, path), 'utf8'));
  const artifact = await importCatalog({
    systemPath: system,
    contentPath: content,
    remaps: await read('scripts/catalog/reviewed-remaps.json'),
    curation: await read('scripts/catalog/reviewed-curation.json'),
  });
  const stored = storedBooksOf(await readStoredInputs(root));
  const inputs = await readMatcherInputHashes(root);
  const document = buildAttribution227Matches({
    entries: [...artifact.catalog.entries, ...artifact.catalog.resources],
    index: buildPcgenNameIndex({
      files: await readPcgenFiles(join(pcgenCheckout, pcgenPin.directory)),
    }),
    stored,
    inputs,
  });
  const text = serializeAttribution227Matches(document);
  const counts = `${document.matches.length} records: ${document.matches.filter(({ status }) => status === 'matched').length} matched, ${document.matches.filter(({ status }) => status === 'held').length} held.`;
  if (values.write) {
    await writeFile(join(root, matchesPath), text);
    process.stdout.write(`Wrote ${matchesPath}: ${counts}\n`);
  } else {
    const committedText = await readFile(join(root, matchesPath), 'utf8');
    const committed = readAttribution227Matches(JSON.parse(committedText));
    const problems = [
      ...attribution227MatchesDrift({ document: committed, inputs, stored }),
      ...matchesDifferences(committed.matches, document.matches),
    ];
    if (committedText !== text)
      problems.push(
        `${matchesPath} differs from a fresh generation (${counts}); run --write.`,
      );
    if (problems.length) {
      process.stderr.write(
        `${problems.map((item) => `- ${item}`).join('\n')}\n`,
      );
      process.exitCode = 1;
    } else process.stdout.write(`${matchesPath} is current: ${counts}\n`);
  }
}
