// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { legalRecordProof } from '../../scripts/catalog/legal-record-proof';
import { encodeLegalRecord } from '../../src/lib/catalog/legal-record-codec';

// The migration proof (legal-record design, "The proof", check 1) on scratch
// repositories. This test is exempt from guard 3: it builds scratch checkouts
// and writes stored bytes, so it names the directory itself.
const legalDirectory = 'scripts/catalog/legal';
const noticesPath = 'scripts/catalog/scopes/campaign-mvp-v1.notices.json';
const scratch = mkdtempSync(join(tmpdir(), 'legal-record-proof-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const body = (topic: string) =>
  `${topic}: `.padEnd(
    160,
    'The spell body text repeats for each linked record. ',
  );
const candidate = (externalKey: string) => ({
  externalKey,
  name: externalKey,
  fullContentReview: { descriptionText: body('Description'), externalKey },
  auditNoticeReview: [{ book: 'Core Rulebook', evidence: body('Evidence') }],
});
const record = {
  reviewedBy: 'curator',
  candidates: ['pf1/a', 'pf1/b', 'pf1/c'].map(candidate),
};
const plainText = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const otherText = plainText({ holds: [{ id: 'hold-1', status: 'held' }] });

let count = 0;
/**
 * A scratch repository whose base commit holds `spells-1.json` (to be
 * encoded; plain unless `baseSpells` is given), `other.json` and the #227
 * file, the notice authority naming the first two; `change` then edits its
 * working tree. Returns root and base.
 */
function repository(
  change: (
    write: (name: string, text: string) => void,
    remove: (name: string) => void,
  ) => void,
  baseSpells = plainText(record),
) {
  count += 1;
  const root = join(scratch, `repo-${count}`);
  mkdirSync(join(root, legalDirectory), { recursive: true });
  mkdirSync(join(root, 'scripts/catalog/scopes'), { recursive: true });
  const write = (name: string, text: string) =>
    writeFileSync(join(root, legalDirectory, name), text);
  write('spells-1.json', baseSpells);
  write('other.json', otherText);
  write('attribution-227.json', plainText({ rule: 1 }));
  write('README.md', 'not a record\n');
  writeFileSync(
    join(root, noticesPath),
    JSON.stringify({
      value: {
        inputs: ['other.json', 'spells-1.json'].map((name) => ({
          locator: `${legalDirectory}/${name}`,
          sha256: '0',
        })),
      },
    }),
  );
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  git('init', '-q');
  git('add', '.');
  git(
    '-c',
    'user.name=proof',
    '-c',
    'user.email=proof@example.invalid',
    'commit',
    '-q',
    '-m',
    'base',
  );
  change(write, (name) => rmSync(join(root, legalDirectory, name)));
  return { root, base: 'HEAD' };
}

const prove = (root: string, base: string) =>
  legalRecordProof({ root, base, encoded: ['spells-1.json'] });

describe('the legal-record migration proof', () => {
  it('passes on a faithful encoding and reports sizes and counts', () => {
    const { root, base } = repository((write) =>
      write('spells-1.json', encodeLegalRecord(record)),
    );
    const { lines, failures } = prove(root, base);
    expect(failures).toEqual([]);
    expect(lines).toContain(
      '3 JSON files at base, 2 of them notice-authority locators (scripts/catalog/scopes/campaign-mvp-v1.notices.json)',
    );
    expect(
      lines.find((line) => line.startsWith('ok   spells-1.json: ')),
    ).toBeDefined();
    expect(lines).toContain('ok   1 locators byte-identical');
    expect(lines).toContain(
      '     not a locator, not compared: attribution-227.json (unchanged)',
    );
    expect(lines.at(-1)).toBe('all checks passed');
  });

  it('passes on a plain record in the set that keeps its value in another layout', () => {
    const { root, base } = repository((write) =>
      write('spells-1.json', JSON.stringify(record)),
    );
    expect(prove(root, base).failures).toEqual([]);
  });

  it('fails by name on a changed value', () => {
    const { root, base } = repository((write) =>
      write(
        'spells-1.json',
        encodeLegalRecord({ ...record, reviewedBy: 'someone else' }),
      ),
    );
    expect(prove(root, base).failures).toEqual([
      expect.stringMatching(/^spells-1\.json: .*; the decoded value differs$/),
    ]);
  });

  it('fails by name on a reordered key', () => {
    const { root, base } = repository((write) =>
      write(
        'spells-1.json',
        encodeLegalRecord({
          candidates: record.candidates,
          reviewedBy: record.reviewedBy,
        }),
      ),
    );
    expect(prove(root, base).failures).toEqual([
      expect.stringMatching(/^spells-1\.json: .*; the decoded value differs$/),
    ]);
  });

  it('fails by name on a dropped candidate', () => {
    const { root, base } = repository((write) =>
      write(
        'spells-1.json',
        encodeLegalRecord({
          ...record,
          candidates: record.candidates.slice(1),
        }),
      ),
    );
    expect(prove(root, base).failures).toEqual([
      expect.stringMatching(/^spells-1\.json: .*; the decoded value differs$/),
    ]);
  });

  it('fails by name on a file outside the encoded set that changed, even to the same value', () => {
    const { root, base } = repository((write) => {
      write('spells-1.json', encodeLegalRecord(record));
      write('other.json', JSON.stringify(JSON.parse(otherText)));
    });
    expect(prove(root, base).failures).toEqual(['other.json: changed bytes']);
  });

  it('reports a changed #227 file, which is not a locator, without failing', () => {
    const { root, base } = repository((write) => {
      write('spells-1.json', encodeLegalRecord(record));
      write('attribution-227.json', plainText({ rule: 2 }));
    });
    const { lines, failures } = prove(root, base);
    expect(failures).toEqual([]);
    expect(lines).toContain(
      '     not a locator, not compared: attribution-227.json (changed)',
    );
  });

  // A BASE may already store a record of the set encoded (legal-l4: the seven
  // Spells records). The proof decodes BASE too, so the value is compared
  // whichever form each side stores.
  describe('decodes BASE too, whichever form it stores', () => {
    const encoded = encodeLegalRecord(record);

    it('passes on a record encoded at base and unchanged, byte for byte', () => {
      const { root, base } = repository(() => undefined, encoded);
      const { lines, failures } = prove(root, base);
      expect(failures).toEqual([]);
      expect(lines).toContain(
        `ok   spells-1.json: encoded at base, byte-identical (${encoded.length.toLocaleString('en-US')} B)`,
      );
      expect(lines.at(-1)).toBe('all checks passed');
    });

    it('fails by name on a record encoded at base and re-encoded with a changed value', () => {
      const { root, base } = repository(
        (write) =>
          write(
            'spells-1.json',
            encodeLegalRecord({ ...record, reviewedBy: 'someone else' }),
          ),
        encoded,
      );
      expect(prove(root, base).failures).toEqual([
        expect.stringMatching(
          /^spells-1\.json: .*; the decoded value differs$/,
        ),
      ]);
    });

    it('fails by name on a record encoded at base that keeps its value in other bytes', () => {
      const { root, base } = repository(
        (write) => write('spells-1.json', JSON.stringify(JSON.parse(encoded))),
        encoded,
      );
      expect(prove(root, base).failures).toEqual([
        expect.stringMatching(
          /^spells-1\.json: .*; encoded at base with the same value, but not byte-identical$/,
        ),
      ]);
    });

    it('fails by name on a plain record of the set whose value changed, still plain', () => {
      const { root, base } = repository((write) =>
        write(
          'spells-1.json',
          plainText({ ...record, reviewedBy: 'someone else' }),
        ),
      );
      expect(prove(root, base).failures).toEqual([
        expect.stringMatching(
          /^spells-1\.json: .*; the decoded value differs$/,
        ),
      ]);
    });
  });

  it('fails by name on a record that does not decode, an added and a removed file', () => {
    const { root, base } = repository((write, remove) => {
      write('spells-1.json', '{"encoding":');
      write('new.json', '{}\n');
      remove('attribution-227.json');
    });
    expect(prove(root, base).failures).toEqual([
      'the same files in the working tree; added new.json; removed attribution-227.json',
      expect.stringMatching(/^spells-1\.json: .*; .*JSON/),
    ]);
  });
});
