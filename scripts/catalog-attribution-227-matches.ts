import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  attribution227MatchesCheck,
  generateAttribution227Matches,
} from './catalog/attribution-227-generation.ts';
import { matchesPath } from './catalog/attribution-227-matcher.ts';

/**
 * `pnpm catalog:attribution-227-matches --write | --check`: the #227 scripted
 * match (`legal/attribution-227-matches.json`). Both modes import the whole
 * corpus at the pinned Foundry checkouts and read the PCGen checkout at
 * `pcgenPin` (`~/repos/everythingpath/sources/`, `.ep-cache/`;
 * `attribution-227-generation.ts`). `--check` writes nothing and fails when
 * the committed file drifted from its pinned inputs or from a fresh
 * generation: its expanded matches compared with the fresh ones record for
 * record, and its text with the fresh text.
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
  if (values.write) {
    const { text, counts } = await generateAttribution227Matches(root);
    await writeFile(join(root, matchesPath), text);
    process.stdout.write(`Wrote ${matchesPath}: ${counts}\n`);
  } else {
    const { problems, counts } = await attribution227MatchesCheck(root);
    if (problems.length) {
      process.stderr.write(
        `${problems.map((item) => `- ${item}`).join('\n')}\n`,
      );
      process.exitCode = 1;
    } else process.stdout.write(`${matchesPath} is current: ${counts}\n`);
  }
}
