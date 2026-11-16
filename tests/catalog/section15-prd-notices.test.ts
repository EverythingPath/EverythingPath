// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';

// Notice-hold clearance (owner decisions 2026-10-30): one Registry record per
// book on the PRD licence page that had no identity, holding the book's line
// from the pinned capture verbatim. Defects are recorded, not fixed.
const page = readFileSync(
  new URL('../fixtures/pinned/prd/pages/openGameLicense.html', import.meta.url),
);
const sha256 = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');
const pageSha256 =
  '552d56722ea94e94373427d6864d58682f08671a6cb3426b4f5079222225387c';
const lines = page.toString('utf8').split('\n');
const books: [line: number, code: string][] = [
  [370, 'PZO1112'],
  [371, 'PZO1116'],
  [372, 'PZO1120'],
  [373, 'PZO1127'],
  [374, 'PZO1133'],
  [375, 'PZO1114'],
  [376, 'PZO1129'],
  [377, 'PZO1115'],
  [378, 'PZO1121'],
  [379, 'PZO1130'],
  [380, 'PZO1126'],
  [381, 'PZO1124'],
  [382, 'PZO1132'],
  [383, 'PZO1131'],
  [384, 'PZO1117'],
  [385, 'PZO1125'],
  [387, 'PZO1123'],
  [388, 'PZO9272'],
];
const defects: Record<string, string> = {
  PZO1115: 'lacks its final period',
  PZO1116: '"Authors Wolfgang Baur" with no colon',
  PZO1133: '"AUthors"',
  PZO1114: '"Wolfgang Buar"',
};

it('pins the capture the records were read from', () => {
  expect(sha256(page)).toBe(pageSha256);
});

it.each(books)(
  'records line %i verbatim as %s, with its hashes and any defect',
  (line, code) => {
    const raw = lines[line - 1]!;
    const decoded = raw
      .replace(/<[^>]+>/g, '')
      .replace('&copy;', '©')
      .trim();
    const record = section15Registry[code];
    expect(record).toMatchObject({
      title: /^<p><b>([^<]+)<\/b>/.exec(raw)?.[1],
      notice: decoded,
      checkedAgainst: 'prd',
      aliases: [],
    });
    const provenance = record?.provenance.join('\n') ?? '';
    expect(provenance).toContain(`file sha256:${pageSha256}`);
    expect(provenance).toContain(
      `line ${line}, raw HTML line sha256:${sha256(raw)}`,
    );
    expect(provenance).toContain(`decoded notice sha256:${sha256(decoded)}`);
    const defect = defects[code];
    if (defect) expect(provenance).toContain(defect);
    else expect(provenance).not.toContain('Defect recorded');
  },
);
