// Fixture-only review plans. Expected scopes come from Git, independent of the driver.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
const [mode, file, baseOrManifest, ...worktrees] = process.argv.slice(2);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const git = (wt, ...args) =>
  execFileSync('git', ['-C', wt, ...args], { encoding: 'utf8' }).trim();
function scope(wt) {
  const commit = git(wt, 'rev-parse', 'HEAD'),
    parent = git(wt, 'rev-parse', 'HEAD^'),
    tree = git(wt, 'rev-parse', 'HEAD^{tree}');
  const patchSha256 = execFileSync(
    'bash',
    [
      '-o',
      'pipefail',
      '-c',
      'git -C "$1" diff --binary --no-ext-diff --no-textconv "$2" "$3" | sha256sum',
      'fixture',
      wt,
      parent,
      commit,
    ],
    { encoding: 'utf8' },
  ).split(' ')[0];
  return { commit, parent, tree, patchSha256 };
}
const plan =
  mode === 'create'
    ? {
        base: baseOrManifest,
        items: worktrees.map((wt, i) => ({
          issue: 902 + i,
          item: `${git(wt, 'branch', '--show-current')}:${wt}`,
          review: {
            reports: ['standards', 'spec'].map((axis) => ({
              axis,
              path: path.join(path.dirname(file), `${i}-${axis}.md`),
            })),
            exceptions: [],
            status: 'completed',
            disposition: 'land',
            unresolved: [],
          },
        })),
      }
    : JSON.parse(readFileSync(file));
if (mode === 'renew') {
  const manifest = JSON.parse(readFileSync(baseOrManifest));
  plan.resume = {
    manifest: baseOrManifest,
    sha256: hash(readFileSync(baseOrManifest)),
  };
  plan.items.forEach((item, i) =>
    Object.assign(item.review, manifest.stages[i]),
  );
} else {
  plan.base = baseOrManifest;
  delete plan.resume;
  plan.items.forEach((item, i) => {
    const current = scope(worktrees[i]);
    Object.assign(item, { commit: current.commit, tree: current.tree });
    Object.assign(item.review, current);
  });
}
plan.items.forEach((item) =>
  item.review.reports.forEach((report) => {
    const text = `LAND ${item.review.commit}\n`;
    writeFileSync(report.path, text);
    report.sha256 = hash(text);
  }),
);
writeFileSync(file, JSON.stringify(plan));
