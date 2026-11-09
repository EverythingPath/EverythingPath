// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  findCommittedBatchOwnershipProblems,
  readBatchInventory,
} from './batch-ownership';

// The #749 ownership checks swept over every batch inventory they apply to,
// whichever batch changed the shared data. Light prep (#759) runs this file
// instead of every earlier batch's tests, so a batch that alters an earlier
// batch's own rows fails before review, not only at the landing gate.

const legalDir = 'scripts/catalog/legal';

/**
 * Inventories from before the formats the ownership checks read (recorded
 * binding snapshots or recorded evidence baselines). Their own tests still
 * check them; `readBatchInventory` can't.
 */
const earlierFormats = new Set([
  'feats-330',
  'feats-331',
  'feats-332',
  'feats-333',
  'feats-334',
  'feats-335',
  'feats-336',
  'feats-337',
  'feats-338',
  'feats-339',
  'feats-340',
  'feats-341',
  'feats-342',
  'feats-344',
  'races-328',
  'racial-hd-329',
  'spells-516-evidence',
  'spells-517',
  'spells-518',
  'spells-519',
  'spells-520',
  'spells-521',
  'spells-522',
  'spells-523',
  'spells-524',
]);

/**
 * Problems on the feature head when the sweep was added (#759), pinned so any
 * further change to these rows still fails. #356's inventory records holds its
 * Attribution Assessments have never carried (since 4424ef8b).
 */
const knownProblems: Record<string, string[]> = {
  'feats-356': [
    'Implement Mastery (pf1-content/f6205iAK11nSvJ4h): hold feats-356-pfs-single-class-item-mastery-origin is gone from the assessment',
    'Letter Fury (pf1-content/fH2aOis8zndL85fw): hold feats-356-pfs-single-class-item-mastery-origin is gone from the assessment',
    'Skill Focus (Artistry) (pf1-content/fyP8yuS4Wd8RxV5r): hold feats-356-artistry-unchained-specialty is gone from the assessment',
    'Divine Interference (pf1-content/gCKYnpTqxnbublRb): hold feats-356-divine-interference-appended-fighting-technique is gone from the assessment',
    'Summon Neutral Monster (pf1-content/gOf4s0CoELJVx1gj): hold feats-356-summon-neutral-full-list-template-origins is gone from the assessment',
    'Curative Mastery (pf1-content/gTmSnfMnPmDVkdOj): hold feats-356-pfs-single-class-item-mastery-origin is gone from the assessment',
  ],
};

/** Batch inventories that own content rows: a non-empty `candidates` list. */
function listContentInventories() {
  return readdirSync(legalDir)
    .filter((name) => /^[a-z]+(-[a-z]+)*-\d+(-evidence)?\.json$/.test(name))
    .map((name) => name.replace(/\.json$/, ''))
    .filter((batch) => {
      const data: unknown = JSON.parse(
        readFileSync(`${legalDir}/${batch}.json`, 'utf8'),
      );
      const candidates =
        typeof data === 'object' && data !== null && 'candidates' in data
          ? data.candidates
          : undefined;
      return Array.isArray(candidates) && candidates.length > 0;
    })
    .sort();
}

const swept = listContentInventories().filter(
  (batch) => !earlierFormats.has(batch),
);

describe('the batch ownership sweep', () => {
  it('covers every content inventory but the listed earlier formats', () => {
    expect(swept.length).toBeGreaterThanOrEqual(57);
    expect(swept).toContain('feats-343');
    expect(swept).toContain('traits-378');
  });

  it.each([...earlierFormats])(
    'leaves out %s only while the checks cannot read it',
    (batch) => {
      expect(() =>
        readBatchInventory(`${legalDir}/${batch}.json`),
      ).toThrow();
    },
  );

  it.each(swept)('finds %s rows unchanged in the shared data', (batch) => {
    expect(
      findCommittedBatchOwnershipProblems(`${legalDir}/${batch}.json`),
    ).toEqual(knownProblems[batch] ?? []);
  });
});
