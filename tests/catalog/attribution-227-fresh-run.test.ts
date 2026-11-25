// @vitest-environment node
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  attribution227Checkouts,
  attribution227PinnedCheckouts,
  freshComparisonRun,
  isRemoteCi,
} from '../../scripts/catalog/attribution-227-generation';
import {
  foundryCheckout,
  pcgenCheckout,
  verifyPinnedCheckout,
  type PinnedCheckout,
} from '../../scripts/catalog/pinned-checkouts';

// The fresh comparison (attribution-227-matches-fresh.test.ts) may skip only
// where the pinned checkouts cannot exist, remote CI; on the landing host a
// checkout missing, dirty or at another pin fails it, naming why
// (cavalier-master-tactician fix r5).
const root = mkdtempSync(join(tmpdir(), 'fresh-run-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-C', cwd, ...args], {
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .toString()
    .trim();
let made = 0;
/**
 * A checkout with one commit, a file under `directory` (its one input) and a
 * README outside it, at that commit.
 */
function checkout(name: string, directory = 'data'): PinnedCheckout {
  made += 1;
  const path = join(root, `${name}-${made}`);
  mkdirSync(join(path, directory), { recursive: true });
  writeFileSync(join(path, directory, 'list.lst'), 'one\n');
  writeFileSync(join(path, 'README.md'), 'one\n');
  writeFileSync(join(path, '.gitignore'), '*.yaml\n');
  git(path, 'init', '-q');
  git(path, 'add', '-A');
  git(
    path,
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.test',
    'commit',
    '-qm',
    'pin',
  );
  const commit = git(path, 'rev-parse', 'HEAD');
  return {
    name,
    path,
    commit,
    pinName: commit,
    inputs: [directory],
    ignoredInput: (file) => file.endsWith('.yaml'),
  };
}
const landing = { remoteCi: false };
const remote = { remoteCi: true };

describe('the fresh comparison’s run on the landing host and in remote CI', () => {
  const clean = checkout('clean');

  it('runs at the pins, on the landing host and in remote CI alike', () => {
    expect(freshComparisonRun({ checkouts: [clean], ...landing })).toEqual({
      kind: 'run',
    });
    expect(freshComparisonRun({ checkouts: [clean], ...remote })).toEqual({
      kind: 'run',
    });
  });

  const cases: {
    case: string;
    checkout: () => PinnedCheckout;
    problem: (checkout: PinnedCheckout) => string;
  }[] = [
    {
      case: 'a missing checkout',
      checkout: () => pcgenCheckout(join(root, 'absent')),
      problem: ({ path }) => `PCGen checkout ${path} is missing.`,
    },
    {
      case: 'a dirty checkout',
      checkout: () => {
        const dirty = checkout('dirty');
        writeFileSync(join(dirty.path, 'data/list.lst'), 'two\n');
        return dirty;
      },
      problem: ({ path }) =>
        `dirty checkout ${path} has modified or untracked catalog input files.`,
    },
    {
      case: 'a checkout at another pin',
      checkout: () => {
        const moved = checkout('moved');
        return { ...moved, commit: 'b'.repeat(40), pinName: 'b'.repeat(40) };
      },
      problem: ({ path }) =>
        `moved checkout ${path} must be at pinned ${'b'.repeat(40)}, not ${git(path, 'rev-parse', 'HEAD')}.`,
    },
    {
      case: 'an ignored input file the importer would read',
      checkout: () => {
        const ignored = checkout('ignored');
        writeFileSync(join(ignored.path, 'data/extra.yaml'), 'one\n');
        return ignored;
      },
      problem: ({ path }) =>
        `ignored checkout ${path} has ignored catalog input files.`,
    },
    {
      case: 'a folder inside a checkout, not its root',
      checkout: () => {
        const outer = checkout('nested');
        return { ...outer, path: join(outer.path, 'data') };
      },
      problem: ({ path }) =>
        `nested checkout ${path} must be the root of its upstream Git checkout.`,
    },
  ];

  it.each(cases)(
    'refuses $case on the landing host, naming the checkout and why',
    ({ checkout: made, problem }) => {
      const item = made();
      expect(
        freshComparisonRun({ checkouts: [clean, item], ...landing }),
      ).toEqual({
        kind: 'refuse',
        reason: `the fresh comparison of the scripted match cannot run on the landing host, where it is required: ${problem(item)}`,
      });
    },
  );

  it.each(cases)(
    'refuses $case to a generation with the same reason',
    ({ checkout: made, problem }) => {
      const item = made();
      expect(() => verifyPinnedCheckout(item)).toThrow(problem(item));
    },
  );

  it('runs when only a file outside the catalog inputs changed, as a generation does', () => {
    const outside = checkout('outside');
    writeFileSync(join(outside.path, 'README.md'), 'two\n');
    expect(() => verifyPinnedCheckout(outside)).not.toThrow();
    expect(freshComparisonRun({ checkouts: [outside], ...landing })).toEqual({
      kind: 'run',
    });
  });

  it.each(cases)(
    'skips $case in remote CI, visibly',
    ({ checkout: made, problem }) => {
      const item = made();
      expect(freshComparisonRun({ checkouts: [item], ...remote })).toEqual({
        kind: 'skip',
        note: `skipped: no pinned checkouts (remote CI): ${problem(item)}`,
      });
    },
  );

  it('takes remote CI from CI=true on a host without the checkouts’ directory', () => {
    const missing = join(root, 'no-host');
    expect(isRemoteCi({ CI: 'true' }, missing)).toBe(true);
    // capped.sh and bounded.sh set CI=true on local hosts, which have it.
    expect(isRemoteCi({ CI: 'true' }, root)).toBe(false);
    expect(isRemoteCi({ GITHUB_ACTIONS: 'true' }, missing)).toBe(false);
    expect(isRemoteCi({}, missing)).toBe(false);
  });

  it('checks the three checkouts a generation reads, as a generation validates them', () => {
    const { pcgen, system, content } = attribution227Checkouts;
    const view = (checkouts: readonly PinnedCheckout[]) =>
      checkouts.map(({ ignoredInput, ...rest }) => ({
        ...rest,
        ignores: Boolean(ignoredInput),
      }));
    expect(view(attribution227PinnedCheckouts)).toEqual(
      view([
        pcgenCheckout(pcgen),
        foundryCheckout('pf1', system),
        foundryCheckout('pf1-content', content),
      ]),
    );
  });
});

describe('the host-audit list', () => {
  // A local landing requires every listed audit to pass in its full suite
  // (`remote_checks.py landing-audits`), so the list must keep naming it.
  it('names the fresh comparison of the scripted match', () => {
    const listed = JSON.parse(
      readFileSync('scripts/orchestration/host-audits.json', 'utf8'),
    ) as { tests: { file: string; fullName: string }[] };
    expect(listed.tests).toContainEqual({
      file: 'tests/catalog/attribution-227-matches-fresh.test.ts',
      fullName:
        'the committed scripted match against a fresh generation equals a fresh generation over the pinned checkouts, record for record and as text',
    });
  });
});
