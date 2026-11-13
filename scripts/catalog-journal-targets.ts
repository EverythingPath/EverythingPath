import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
import { pins, type Repository } from './catalog/inventory.ts';

const journalSchema = z.object({
  _id: z.string(),
  _key: z.string(),
  pages: z.array(z.object({ _id: z.string() })).default([]),
});

/** Read the pinned Git blobs, never mutable working-copy bytes or link strings. */
export function readPinnedJournalTargets(roots: Record<Repository, string>) {
  const journals = Object.entries(roots).flatMap(([repository, root]) => {
    const repo = z.enum(['pf1', 'pf1-content']).parse(repository);
    const pin = pins[repo].commit;
    const directory = repo === 'pf1' ? 'packs/rules' : 'src/pf-rules';
    const git = (args: string[]) =>
      execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    const paths = git(['ls-tree', '-r', '--name-only', pin, directory])
      .trim()
      .split('\n')
      .filter((path) => /\.ya?ml$/.test(path))
      .sort();
    return paths.flatMap((path) => {
      const text = git(['show', `${pin}:${path}`]);
      const record = journalSchema.parse(parse(text));
      if (!record._key.startsWith('!journal!')) return [];
      return [
        {
          repo,
          path,
          sha256: createHash('sha256').update(text).digest('hex'),
          id: record._id,
          pages: record.pages.map((page) => page._id).sort(),
        },
      ];
    });
  });
  return {
    pins: { pf1: pins.pf1.commit, 'pf1-content': pins['pf1-content'].commit },
    journals,
  };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const [systemPath, contentPath, output] = process.argv.slice(2);
  if (!systemPath || !contentPath || !output)
    throw new Error(
      'Usage: tsx scripts/catalog-journal-targets.ts SYSTEM_CHECKOUT CONTENT_CHECKOUT OUTPUT',
    );
  writeFileSync(
    output,
    `${JSON.stringify(
      readPinnedJournalTargets({
        pf1: systemPath,
        'pf1-content': contentPath,
      }),
      null,
      2,
    )}\n`,
  );
}
