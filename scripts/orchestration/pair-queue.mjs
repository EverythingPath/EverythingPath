// Exactly two frozen items; queue-owned scratch and the existing canonical gate.
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const main = process.env.MAIN;
const orch = process.env.EP_ORCH;
const feature = process.env.FEATURE || 'feature/pf1-character-builder';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) =>
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const requireThat = (condition, message) => {
  if (!condition) throw new Error(message);
};
const git = (wt, ...args) =>
  execFileSync('git', ['-C', wt, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const sha = (value) =>
  typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const clean = (wt) =>
  git(wt, 'status', '--porcelain', '--untracked-files=all') === '';
const ancestor = (a, b) => {
  try {
    git(main, 'merge-base', '--is-ancestor', a, b);
    return true;
  } catch {
    return false;
  }
};
const patch = (parent, commit) =>
  execFileSync(
    'bash',
    [
      '-o',
      'pipefail',
      '-c',
      'git -C "$1" diff --binary --no-ext-diff --no-textconv "$2" "$3" | sha256sum',
      'pair-patch',
      main,
      parent,
      commit,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).split(' ')[0];
function scope(commit) {
  const parent = git(main, 'rev-parse', `${commit}^`);
  const paths = execFileSync(
    'git',
    [
      '-C',
      main,
      'diff-tree',
      '--no-commit-id',
      '--no-renames',
      '--name-only',
      '-r',
      '-z',
      parent,
      commit,
    ],
    { encoding: 'utf8' },
  ).split('\0');
  requireThat(
    paths.every(
      (file) =>
        !file
          .split('/')
          .some((part) => part.startsWith('.env') && part !== '.env.example') &&
        !/^e2e\/\.private(?:\/|$)/.test(file),
    ),
    'forbidden input paths; patch contents were not read',
  );
  return {
    commit,
    parent,
    tree: git(main, 'rev-parse', `${commit}^{tree}`),
    patchSha256: patch(parent, commit),
  };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ownerStart = (pid) => {
  const fields = fs
    .readFileSync(`/proc/${pid}/stat`, 'utf8')
    .split(') ')[1]
    .split(' ');
  requireThat(!['Z', 'X'].includes(fields[0]), 'queue owner has exited');
  return fields[19];
};

function target(item) {
  requireThat(typeof item === 'string', 'item token required');
  const values = execFileSync(
    'bash',
    [
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        'queue-target.sh',
      ),
      item,
      feature,
    ],
    { encoding: 'utf8' },
  ).split('\0');
  requireThat(
    values.length === 8 && values[7] === '',
    'malformed target result',
  );
  const [kind, number, branch, wt, , , suppliedWt] = values;
  requireThat(
    path.isAbsolute(suppliedWt) &&
      fs.realpathSync(suppliedWt) === suppliedWt &&
      suppliedWt === wt,
    'pair requires canonical absolute worktree root',
  );
  requireThat(clean(wt), 'pair input is dirty; prepare and review it first');
  return {
    branch,
    wt,
    kind,
    number: number ? Number(number) : null,
  };
}

function review(item, expected) {
  const value = item.review;
  requireThat(
    value?.status === 'completed' &&
      value.disposition === 'land' &&
      Array.isArray(value.unresolved) &&
      value.unresolved.length === 0,
    `#${item.issue}: completed accepted review with no unresolved findings required`,
  );
  requireThat(
    value &&
      ['commit', 'parent', 'tree', 'patchSha256'].every(
        (key) => value[key] === expected[key],
      ),
    `#${item.issue}: review scope must match exact commit, parent, tree and patch`,
  );
  requireThat(
    Array.isArray(value.exceptions) &&
      value.exceptions.every((entry) => typeof entry === 'string'),
    'review exceptions must be explicit strings',
  );
  const axes = item.kind === 'cur' ? ['curation'] : ['standards', 'spec'];
  requireThat(
    Array.isArray(value.reports) &&
      value.reports.length === axes.length &&
      axes.every(
        (axis) =>
          value.reports.filter((report) => report.axis === axis).length === 1,
      ),
    'appropriate completed review reports required',
  );
  for (const report of value.reports) {
    requireThat(
      path.isAbsolute(report.path) &&
        report.sha256 === hash(fs.readFileSync(report.path)),
      'review report missing or changed',
    );
    requireThat(fs.statSync(report.path).size > 0, 'empty review report');
  }
}

function inputs(plan) {
  requireThat(
    sha(plan.base) && Array.isArray(plan.items) && plan.items.length === 2,
    'pair plan requires frozen base and exactly two items',
  );
  requireThat(
    git(main, 'symbolic-ref', '--short', 'HEAD') === feature &&
      git(main, 'rev-parse', 'HEAD') === plan.base,
    'integration base moved or wrong branch',
  );
  const items = plan.items.map((item) => {
    requireThat(
      Number.isSafeInteger(item.issue) &&
        item.issue > 0 &&
        sha(item.commit) &&
        sha(item.tree),
      'issue and frozen input commit/tree required',
    );
    const result = { ...item, ...target(item.item) };
    requireThat(
      result.kind !== 'cur' || result.number === result.issue,
      'curation discriminator differs from issue',
    );
    requireThat(
      git(result.wt, 'rev-parse', 'HEAD') === result.commit &&
        git(result.wt, 'rev-parse', `${result.branch}^{tree}`) === result.tree,
      'input head/tree moved',
    );
    const current = scope(result.commit);
    requireThat(
      current.tree === result.tree &&
        git(main, 'rev-list', '--parents', '-n', '1', result.commit).split(' ')
          .length === 2 &&
        current.tree !== git(main, 'rev-parse', `${current.parent}^{tree}`),
      'one nonempty non-merge issue commit required',
    );
    return { ...result, original: current };
  });
  requireThat(
    new Set(items.map((item) => item.issue)).size === 2 &&
      new Set(items.map((item) => item.branch)).size === 2 &&
      new Set(items.map((item) => item.wt)).size === 2 &&
      items[0].commit !== items[1].commit,
    'duplicate issue/ref/worktree/input',
  );
  requireThat(
    ancestor(items[0].original.parent, plan.base),
    'A has multiple or unassigned issue commits',
  );
  requireThat(
    ancestor(items[1].original.parent, plan.base) ||
      items[1].original.parent === items[0].commit,
    'B has multiple or ambiguous issue commits',
  );
  return items;
}

let child;
let stopped;
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    stopped = signal;
    if (child) {
      try {
        process.kill(-child.pid, signal);
      } catch {
        /* already exited */
      }
    }
  });
let sequence = 0;
let context;
async function run(command, args, cwd, directory, env = {}) {
  requireThat(!stopped, `cancelled: ${stopped}`);
  const id = `${String(++sequence).padStart(2, '0')}-${path.basename(command)}`;
  write(path.join(directory, `${id}.json`), {
    command,
    args,
    cwd,
    boundedId: process.env.BOUNDED_ID || null,
    reservation: process.env.BOUNDED_RESERVATION || null,
  });
  const log = fs.openSync(path.join(directory, `${id}.log`), 'wx');
  try {
    const status = await new Promise((resolve, reject) => {
      child = spawn(command, args, {
        cwd,
        env: { ...process.env, ...env, PAIR_QUEUE_PID: String(process.pid) },
        detached: true,
        stdio: ['ignore', log, log],
      });
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
    child = undefined;
    write(path.join(directory, `${id}-result.json`), status);
    requireThat(
      !stopped && status.code === 0,
      `${command} failed (${status.code ?? status.signal}); see ${directory}/${id}.log`,
    );
  } finally {
    fs.closeSync(log);
  }
}

function snapshotFiles(snapshot) {
  return Object.fromEntries(
    fs
      .readdirSync(snapshot)
      .sort()
      .filter(
        (name) =>
          name !== 'queue.log' &&
          fs.statSync(path.join(snapshot, name)).isFile(),
      )
      .map((name) => [name, hash(fs.readFileSync(path.join(snapshot, name)))]),
  );
}

function environment() {
  return Object.fromEntries(
    [
      'CI',
      'VITEST_MAX_WORKERS',
      'VITEST_MIN_WORKERS',
      'VITEST_POOL',
      'TZ',
      'NODE_OPTIONS',
      'BOUNDED_WORKERS',
      'BOUNDED_CPU',
    ].map((key) => [key, process.env[key] ?? null]),
  );
}

function checkedEvidence(item, stage, directory, branch, base) {
  const file = path.join(directory, `checked-${item.issue}.json`);
  const checked = json(file);
  const lines = checked.key.trimEnd().split('\n');
  const key = Object.fromEntries(
    lines.map((line) => {
      const separator = line.indexOf('=');
      requireThat(separator > 0, 'malformed checked receipt key');
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
  );
  const fields = [
    'branch',
    'worktree',
    'commit',
    'tree',
    'base',
    'integrationBase',
    'lockfile',
    'scripts',
    'env',
    'mode',
    'config',
  ];
  requireThat(
    lines.length === fields.length &&
      fields.every(
        (field) => typeof key[field] === 'string' && key[field].length > 0,
      ),
    'missing or duplicate checked receipt key',
  );
  requireThat(
    key.commit === stage.commit &&
      key.tree === stage.tree &&
      key.base === stage.parent &&
      key.integrationBase === base &&
      key.branch === branch &&
      key.worktree === path.join(directory, 'assembly'),
    'checked identity does not match staged scope/context',
  );
  requireThat(
    key.lockfile ===
      `${git(main, 'rev-parse', `${stage.commit}:pnpm-lock.yaml`)} ${git(main, 'rev-parse', `${stage.commit}:package.json`)}`,
    'checked dependencies differ from staged scope',
  );
  requireThat(
    checked.identity ===
      `${key.commit} ${key.tree} ${key.integrationBase} ${key.base} ${hash('').slice(0, 16)} ${key.branch} ${key.worktree}`,
    'checked identity differs from receipt key',
  );
  requireThat(
    /^[a-f0-9]{64}$/.test(key.scripts) &&
      /^[a-f0-9]{64}$/.test(key.config) &&
      ['light', 'full'].includes(key.mode),
    'malformed checked receipt context',
  );
  const expectedEnv = [
    'CI',
    'VITEST_MAX_WORKERS',
    'VITEST_MIN_WORKERS',
    'VITEST_POOL',
    'TZ',
  ]
    .map((name) => `${name}=${process.env[name] || '-'}`)
    .join(' ');
  requireThat(key.env === expectedEnv, 'checked test environment changed');
  return { path: file, sha256: hash(fs.readFileSync(file)), ...checked };
}

function itemEvidence(item, stage, directory, branch, base) {
  const checked = checkedEvidence(item, stage, directory, branch, base);
  const files = [
    'package.json',
    'pnpm-lock.yaml',
    'scripts/check-artifacts.mjs',
    'scripts/artifact-budgets.json',
  ];
  const dependencies = Object.fromEntries(
    files.map((file) => [
      file,
      git(main, 'rev-parse', `${stage.commit}:${file}`),
    ]),
  );
  const receiptPath = path.join(
    directory,
    `prep-${item.issue}`,
    `cur-${item.issue}-prep.receipt`,
  );
  const prepReceipt =
    item.kind === 'cur'
      ? {
          path: receiptPath,
          sha256: hash(fs.readFileSync(receiptPath)),
          sharedStoreCount: fs
            .readFileSync(receiptPath, 'utf8')
            .split('\n')
            .find((line) => line.startsWith('sharedStoreCount='))
            ?.slice(17),
        }
      : null;
  requireThat(
    item.kind !== 'cur' || prepReceipt.sha256 === checked.prepReceiptSha256,
    'checked prep receipt changed',
  );
  return {
    issue: item.issue,
    checked,
    dependencies,
    prepReceipt,
    original: item.original,
    staged: stage,
    inheritedContext: {
      before: item.original.parent,
      after: stage.parent,
      changedPaths: git(
        main,
        'diff',
        '--name-only',
        item.original.parent,
        stage.parent,
      )
        .split('\n')
        .filter(Boolean),
    },
    reviewDisposition:
      stage.commit === item.commit ? 'retained' : 'fresh review required',
  };
}

function manifestRepository(manifest) {
  requireThat(
    manifest.version === 1 &&
      manifest.main === fs.realpathSync(main) &&
      manifest.orch === fs.realpathSync(orch) &&
      manifest.feature === feature,
    'wrong retained repository/root/feature',
  );
}

function retained(manifest, snapshot) {
  manifestRepository(manifest);
  requireThat(
    same(manifest.scripts, snapshotFiles(manifest.snapshot)) &&
      same(manifest.scripts, snapshotFiles(snapshot)) &&
      same(manifest.environment, environment()),
    'snapshot or check environment changed',
  );
  requireThat(
    fs.realpathSync(manifest.directory) ===
      path.join(
        fs.realpathSync(orch),
        'logs',
        path.basename(manifest.snapshot),
        'pair',
      ) && manifest.wt === path.join(manifest.directory, 'assembly'),
    'assembly is not queue-owned scratch',
  );
  target(`${manifest.branches[1]}:${manifest.wt}`);
  requireThat(
    clean(manifest.wt) &&
      git(manifest.wt, 'symbolic-ref', '--short', 'HEAD') ===
        manifest.branches[1],
    'assembly dirty or wrong branch',
  );
  for (const [i, stage] of manifest.stages.entries()) {
    requireThat(
      git(main, 'rev-parse', manifest.branches[i]) === stage.commit &&
        same(scope(stage.commit), stage),
      'staged tip/scope moved',
    );
    requireThat(
      git(main, 'rev-parse', `refs/archive/${manifest.branches[i]}/input`) ===
        manifest.items[i].commit,
      'frozen archive moved',
    );
  }
  requireThat(
    git(manifest.wt, 'rev-parse', 'HEAD') === manifest.stages[1].commit,
    'assembly HEAD moved',
  );
  for (const archive of manifest.archives)
    requireThat(
      git(main, 'rev-parse', archive.ref) === archive.commit,
      'historical archive moved',
    );
  for (const [i, evidence] of manifest.checks.entries())
    requireThat(
      same(
        evidence,
        itemEvidence(
          manifest.items[i],
          manifest.stages[i],
          manifest.directory,
          manifest.branches[i],
          manifest.base,
        ),
      ),
      'item dependency/prep receipt evidence changed',
    );
}

function bindings(plan, manifest, snapshot) {
  const items = inputs(plan);
  requireThat(
    plan.base === manifest.base &&
      items.every((item, i) =>
        ['issue', 'item', 'commit', 'tree', 'branch', 'wt', 'kind'].every(
          (key) => item[key] === manifest.items[i][key],
        ),
      ),
    'frozen inputs differ from retained assembly',
  );
  retained(manifest, snapshot);
  items.forEach((item, i) => review(item, manifest.stages[i]));
}

function observeAttempt(plan, manifest, snapshot) {
  // Observation never authorizes another gate or FF, even if scratch moved.
  manifestRepository(manifest);
  const observedIntegration = git(main, 'rev-parse', 'HEAD');
  const landed =
    observedIntegration === manifest.stages[1].commit &&
    git(main, 'symbolic-ref', '--short', 'HEAD') === feature;
  write(path.join(snapshot, 'observed.json'), {
    observedIntegration,
    combinedTip: manifest.stages[1].commit,
    landed,
    tipInHistory: ancestor(manifest.stages[1].commit, observedIntegration),
    noLandingAtFrozenBase: observedIntegration === manifest.base,
    retainedManifest: plan.resume.manifest,
  });
  requireThat(
    landed,
    'gate already attempted; retained observed state, diagnose before separate ordered qualification',
  );
  process.stdout.write(
    `already landed exact combined tip ${observedIntegration}; observation only, no gate or FF repeated\n`,
  );
}

async function resumeAssembly(plan, snapshot, dry) {
  const manifest = json(plan.resume.manifest);
  requireThat(
    plan.resume.sha256 === hash(fs.readFileSync(plan.resume.manifest)),
    'retained manifest changed',
  );
  if (fs.existsSync(path.join(manifest.directory, 'gate-started.json'))) {
    observeAttempt(plan, manifest, snapshot);
    return;
  }
  bindings(plan, manifest, snapshot);
  if (dry === '1') {
    process.stdout.write(
      'pair dry run: exact retained assembly and renewed reviews match\n',
    );
    return;
  }
  return gate(plan, manifest);
}

function initializeAssembly(plan, items, snapshot) {
  const directory = path.join(snapshot, 'pair');
  fs.mkdirSync(directory);
  const scripts = snapshotFiles(snapshot),
    checkEnvironment = environment();
  write(path.join(directory, 'inputs.json'), {
    base: plan.base,
    items,
    scripts,
    environment: checkEnvironment,
  });
  context = { directory, base: plan.base, items };
  write(path.join(directory, 'split-plan.json'), {
    policy: 'diagnosis-before-retry; plan only, no automatic gates',
    groups: [
      { issues: [items[0].issue], base: plan.base },
      { issues: [items[1].issue], base: `accepted #${items[0].issue} tip` },
    ],
    suspectsOnly: items.map((item) => ({
      issue: item.issue,
      files: git(
        main,
        'diff',
        '--name-only',
        item.original.parent,
        item.commit,
      ).split('\n'),
    })),
    qualification:
      'Each selected group needs renewed matching review and its own complete strict canonical gate. No prefix was independently qualified.',
  });
  const wt = path.join(directory, 'assembly');
  const branches = items.map(
    (_, i) => `queue-pair/${path.basename(snapshot)}/${i + 1}`,
  );

  return { directory, wt, branches, scripts, checkEnvironment };
}

function retainArchives(items, branches, directory, wt) {
  const archives = items.flatMap((item, index) => {
    const objects = [
      { ref: `refs/archive/${branches[index]}/input`, commit: item.commit },
    ];
    const file = `${item.commit}:scripts/catalog/review-receipts.json`;
    let exists = true;
    try {
      git(main, 'cat-file', '-e', file);
    } catch {
      exists = false;
    }
    if (exists) {
      const receipts = JSON.parse(git(main, 'show', file));
      for (const [i, receipt] of receipts.receipts.entries()) {
        if (receipt.evidence?.kind !== 't3') continue;
        const commit = receipt.evidence.reviewedCommit;
        requireThat(sha(commit), 'historical reviewed commit is invalid');
        git(main, 'cat-file', '-e', `${commit}^{commit}`);
        objects.push({
          ref: `refs/archive/${branches[index]}/reviewed-${i}`,
          commit,
        });
      }
    }
    return objects;
  });
  write(path.join(directory, 'ownership.json'), { wt, branches, archives });
  for (const archive of archives)
    git(
      main,
      'update-ref',
      archive.ref,
      archive.commit,
      '0000000000000000000000000000000000000000',
    );

  return archives;
}

async function assembleItems(plan, items, snapshot, directory, wt, branches) {
  let parent = plan.base;
  const stages = [];
  for (const [index, item] of items.entries()) {
    if (index === 0)
      git(
        main,
        'worktree',
        'add',
        '-q',
        '-b',
        branches[index],
        wt,
        item.commit,
      );
    else git(wt, 'checkout', '-q', '-b', branches[index], item.commit);
    await run(
      'bash',
      [path.join(snapshot, 'pair-rebase.sh'), parent, item.original.parent],
      wt,
      directory,
    );
    await run(
      'bash',
      [
        path.join(snapshot, 'pair-stage.sh'),
        wt,
        parent,
        item.kind,
        String(item.issue),
        path.join(directory, `checked-${item.issue}.json`),
      ],
      wt,
      directory,
    );
    const checked = json(path.join(directory, `checked-${item.issue}.json`));
    const checkedCommit = checked.key
      .split('\n')
      .filter((line) => line.startsWith('commit='));
    requireThat(
      checkedCommit.length === 1 && sha(checkedCommit[0].slice(7)),
      'missing/malformed checked commit',
    );
    const staged = scope(checkedCommit[0].slice(7));
    checkedEvidence(item, staged, directory, branches[index], plan.base);
    requireThat(
      git(wt, 'rev-parse', 'HEAD') === staged.commit,
      'HEAD moved after staged checks',
    );
    requireThat(
      staged.parent === parent &&
        staged.tree !== git(main, 'rev-parse', `${parent}^{tree}`) &&
        clean(wt),
      'stage must contain one nonempty clean issue commit',
    );
    write(path.join(directory, `stage-${index + 1}.json`), {
      ...staged,
      issue: item.issue,
    });
    stages.push(staged);
    parent = staged.commit;
  }

  return stages;
}

function publishAssembly(plan, items, snapshot, assembly, archives, stages) {
  const { directory, wt, branches, scripts, checkEnvironment } = assembly;
  const checks = items.map((item, i) =>
    itemEvidence(item, stages[i], directory, branches[i], plan.base),
  );
  const manifest = {
    version: 1,
    main: fs.realpathSync(main),
    orch: fs.realpathSync(orch),
    feature,
    base: plan.base,
    items,
    stages,
    checks,
    directory,
    wt,
    branches,
    archives,
    snapshot,
    scripts,
    environment: checkEnvironment,
  };
  write(path.join(directory, 'assembly.json'), manifest);

  return manifest;
}

async function execute() {
  const [planPath, snapshot, dry] = process.argv.slice(2);
  const plan = json(planPath);
  if (plan.resume) return resumeAssembly(plan, snapshot, dry);
  const items = inputs(plan);
  items.forEach((item) => review(item, item.original));
  if (dry === '1') {
    process.stdout.write(
      'pair dry run: two frozen reviewed inputs; nothing rebased, checked or landed\n',
    );
    return;
  }
  const assembly = initializeAssembly(plan, items, snapshot);
  const { directory, wt, branches } = assembly;
  const archives = retainArchives(items, branches, directory, wt);
  const stages = await assembleItems(
    plan,
    items,
    snapshot,
    directory,
    wt,
    branches,
  );
  const manifest = publishAssembly(
    plan,
    items,
    snapshot,
    assembly,
    archives,
    stages,
  );
  requireThat(
    stages.every((stage, i) => stage.commit === items[i].commit),
    `fresh review required; retained exact staged scopes: ${directory}/assembly.json`,
  );
  bindings(plan, manifest, snapshot);
  return gate(plan, manifest);
}

async function gate(plan, manifest) {
  const { directory, snapshot, branches, wt, stages } = manifest;
  context = {
    directory,
    base: manifest.base,
    items: manifest.items,
    combinedTip: stages[1].commit,
  };
  const frozenPlan = path.join(directory, 'gate-plan.json');
  write(frozenPlan, plan);
  const planHash = hash(fs.readFileSync(frozenPlan));
  write(path.join(directory, 'gate-started.json'), {
    planSha256: planHash,
    owner: { pid: process.pid, start: ownerStart(process.pid) },
    invocation: process.env.BOUNDED_ID || null,
    reservation: process.env.BOUNDED_RESERVATION || null,
  });
  const gateDirectory = path.join(directory, 'gate');
  fs.mkdirSync(gateDirectory);
  await run(
    'bash',
    [
      path.join(snapshot, 'cur-land.sh'),
      branches[1],
      wt,
      path.basename(snapshot),
    ],
    wt,
    gateDirectory,
    {
      LAND_LOCK_HELD: '1',
      LAND_EXPECTED_BASE: manifest.base,
      LAND_EXPECTED_TIP: stages[1].commit,
      LAND_PAIR_MANIFEST: path.join(directory, 'assembly.json'),
      LAND_PAIR_PLAN_HASH: planHash,
      TRIAGE_EVIDENCE: path.join(directory, 'triage'),
    },
  );
  const tip = stages[1].commit;
  requireThat(
    git(main, 'rev-parse', 'HEAD') === tip,
    'gate returned without landing exact combined tip',
  );
  write(path.join(directory, 'landed.json'), { combinedTip: tip, stages });
  for (const [i, item] of plan.items.entries()) {
    const invocation = process.env.BOUNDED_ID;
    const bounded = invocation
      ? path.join(orch, 'bounded', invocation, 'receipt.json')
      : `command reservation ${process.env.BOUNDED_RESERVATION || 'unavailable (fixture/unbounded caller)'}`;
    fs.writeFileSync(
      path.join(directory, `comment-${item.issue}.md`),
      `Landed locally on \`${feature}\` as ${stages[i].commit} (not pushed)\n\nPaired issues: ${plan.items.map((entry) => `#${entry.issue}`).join(', ')}. Combined tip ${tip} passed the complete strict canonical gate. This item's prefix was not independently gated.\n\nShared gate evidence: ${directory}; bounded invocation: ${invocation || 'unavailable'}; receipt: ${bounded}.\n\nReviewed scope: ${JSON.stringify(stages[i])}. Reports: ${JSON.stringify(item.review.reports)}. Accepted exceptions: ${item.review.exceptions.join('; ') || 'none'}.\n`,
      { flag: 'wx' },
    );
  }
  process.stdout.write(
    `pair landed combined tip ${tip}; evidence ${directory}\n`,
  );
}

function guard() {
  const [, manifestPath, planHash] = process.argv.slice(2);
  const manifest = json(manifestPath);
  const { owner } = json(path.join(manifest.directory, 'gate-started.json'));
  requireThat(
    ownerStart(owner.pid) === owner.start,
    'queue owner no longer alive; orphan cannot land',
  );
  const file = path.join(manifest.directory, 'gate-plan.json');
  requireThat(
    hash(fs.readFileSync(file)) === planHash,
    'frozen gate review plan changed',
  );
  bindings(json(file), manifest, manifest.snapshot);
  const filePath = path.join(manifest.directory, 'before-ff.json');
  const boundary = {
    base: manifest.base,
    combinedTip: manifest.stages[1].commit,
    planHash,
  };
  if (fs.existsSync(filePath))
    requireThat(
      same(json(filePath), boundary),
      'landing boundary evidence changed',
    );
  else write(filePath, boundary);
}

const guarding = process.argv[2] === '--guard';
try {
  if (guarding) guard();
  else await execute();
} catch (error) {
  if (context)
    write(path.join(context.directory, `stopped-${Date.now()}.json`), {
      ...context,
      error: error.message,
      signal: stopped || null,
      observedIntegration: git(main, 'rev-parse', 'HEAD'),
      note: 'An exact combined tip already on integration is landed; recover closeout without repeating a gate or FF. Other movement is a blocker.',
    });
  process.stderr.write(`${error.message}\n`);
  process.exitCode = stopped === 'SIGINT' ? 130 : stopped ? 143 : 1;
} finally {
  if (!guarding) fs.writeFileSync(path.join(orch, 'land.lock'), '');
}
