// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

// Fix r3: the executing checkout's committed matches file is decoded when its
// module loads, before a command reads its frozen items, so a row dropped
// there (a bad merge in place: Diverse Obedience, which leaves its PCGen list
// unused) ends with the same restore guidance (`readCommittedMatchesOrRestore`).
vi.mock(
  '../../scripts/catalog/legal/attribution-227-matches.json',
  async (importOriginal) => {
    const { default: committed } = await importOriginal<{
      default: { matches: { name: string }[] };
    }>();
    return {
      default: {
        ...committed,
        matches: committed.matches.filter(
          ({ name }) => name !== 'Diverse Obedience',
        ),
      },
    };
  },
);

describe('the committed matches decoded at load', () => {
  it('ends a failed decode with the restore guidance', async () => {
    // Through the matcher, which every match command loads, and which loads it.
    await expect(
      import('../../scripts/catalog/attribution-227-matcher'),
    ).rejects.toThrow(
      /^scripts\/catalog\/legal\/attribution-227-matches\.json cannot be read intact for its frozen stored-assessment evidence: No match names [^]*\nNothing was written\. A frozen item cannot be regenerated: restore the file from the last good commit/,
    );
  });
});
