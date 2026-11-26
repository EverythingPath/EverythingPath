// @vitest-environment node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { readPinnedJournalTargets } from '../../scripts/catalog-journal-targets';
import targets from '../../scripts/catalog/rules-journal-targets.json';
import { pins } from '../../scripts/catalog/inventory';
import { isRulesJournalLink } from '../../scripts/catalog/records';
import { pinnedStore } from './pinned-sources';

it('verifies the index against committed pinned journal bytes, including every page rather than just linked pages', () => {
  let verified = 0;
  for (const journal of targets.journals) {
    const path = join(pinnedStore, journal.repo, journal.path);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, 'utf8');
    const record = z
      .object({
        _id: z.string(),
        pages: z.array(z.object({ _id: z.string() })),
      })
      .parse(parse(text));
    expect(createHash('sha256').update(text).digest('hex'), path).toBe(
      journal.sha256,
    );
    expect(record._id).toBe(journal.id);
    expect(record.pages.map((page) => page._id).sort()).toEqual(journal.pages);
    const prefix = journal.repo === 'pf1' ? 'pf1.rules' : 'pf-content.pf-rules';
    const uuid = `Compendium.${prefix}.JournalEntry.${record._id}`;
    expect(isRulesJournalLink(uuid)).toBe(true);
    for (const page of record.pages)
      expect(isRulesJournalLink(`${uuid}.JournalEntryPage.${page._id}`)).toBe(
        true,
      );
    expect(isRulesJournalLink(`${uuid}.JournalEntryPage.Missing`)).toBe(false);
    verified++;
  }
  expect(verified).toBeGreaterThanOrEqual(8);
  expect(targets.pins).toEqual({
    pf1: pins.pf1.commit,
    'pf1-content': pins['pf1-content'].commit,
  });
});

const sources = join(homedir(), 'repos/everythingpath/sources');
const roots = {
  pf1: join(sources, 'foundryvtt-pathfinder1'),
  'pf1-content': join(sources, 'pf1-content'),
};
it.skipIf(!Object.values(roots).every(existsSync))(
  'reproduces the entire target index from both pinned Git trees',
  () => {
    expect(readPinnedJournalTargets(roots)).toEqual(targets);
  },
);
