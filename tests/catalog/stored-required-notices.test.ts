// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  committedStoredNotices,
  storedNoticesOf,
  storedRequiredNoticesSchema,
} from '../../scripts/catalog/stored-required-notices';
import { readCommittedReviewedAdmission } from '../../scripts/catalog/reviewed-data-files';

// pbl-register-only (root decision D4 as amended a second time, 2026-11-26):
// the notices each stored Attribution Assessment required, frozen as
// `stored-required-notices.json`, which the gate reads in place of the
// assessments.

const document = (lists: { notices: string[]; keys: string[] }[]): unknown => ({
  description: 'Fixture.',
  lists,
});
const issues = (value: unknown) =>
  storedRequiredNoticesSchema
    .safeParse(value)
    .error?.issues.map(({ message }) => message);

describe('the frozen stored notices', () => {
  // Temporary: this proof goes with attribution-assessments.json (slice C6),
  // after which the frozen file is the only source.
  it('equal, key for key and list for list, what the committed assessments require', async () => {
    const { assessments } = await readCommittedReviewedAdmission();
    expect(committedStoredNotices).toEqual(storedNoticesOf(assessments));
    expect(Object.keys(committedStoredNotices)).toHaveLength(10_778);
    const committed = storedRequiredNoticesSchema.parse(
      JSON.parse(
        await readFile('scripts/catalog/stored-required-notices.json', 'utf8'),
      ),
    );
    expect(committed.lists).toHaveLength(1_928);
  });

  it('refuses an unsorted file, a key listed twice and an empty list', () => {
    expect(
      issues(
        document([
          { notices: ['PZO1116'], keys: ['pf1/b'] },
          { notices: ['PZO1110'], keys: ['pf1/a'] },
        ]),
      ),
    ).toEqual(['The lists must be sorted by their notices, each list once.']);
    expect(
      issues(
        document([
          { notices: ['PZO1110'], keys: ['pf1/a'] },
          { notices: ['PZO1110'], keys: ['pf1/b'] },
        ]),
      ),
    ).toEqual(['The lists must be sorted by their notices, each list once.']);
    expect(
      issues(
        document([
          { notices: ['PZO1110'], keys: ['pf1/a'] },
          { notices: ['PZO1116'], keys: ['pf1/a'] },
        ]),
      ),
    ).toEqual(['Key pf1/a is listed twice.']);
    expect(
      issues(document([{ notices: ['PZO1110'], keys: ['pf1/b', 'pf1/a'] }])),
    ).toEqual(['The key must be sorted, each once.']);
    expect(
      issues(document([{ notices: ['PZO1116', 'PZO1110'], keys: ['pf1/a'] }])),
    ).toEqual(['The notice must be sorted, each once.']);
    expect(issues(document([{ notices: [], keys: ['pf1/a'] }]))).toEqual([
      'An empty notice list.',
    ]);
    expect(issues(document([{ notices: ['PZO1110'], keys: [] }]))).toEqual([
      'An empty key list.',
    ]);
  });

  it('read from assessments, refuse a key assessed twice as the gate does', () => {
    expect(
      storedNoticesOf([
        { externalKey: 'pf1/a', requiredNotices: ['PZO1116', 'PZO1110'] },
        { externalKey: 'pf1/b', requiredNotices: [] },
      ]),
    ).toEqual({ 'pf1/a': ['PZO1110', 'PZO1116'] });
    expect(() =>
      storedNoticesOf([
        { externalKey: 'pf1/a', requiredNotices: ['PZO1110'] },
        { externalKey: 'pf1/a', requiredNotices: ['PZO1116'] },
      ]),
    ).toThrow('pf1/a: Duplicate Attribution Assessment.');
  });
});
