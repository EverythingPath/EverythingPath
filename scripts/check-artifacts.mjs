#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, constants } from 'node:fs';
import { lstat, readFile, readlink } from 'node:fs/promises';

const budgetPath = 'scripts/artifact-budgets.json';

async function git(args) {
  const child = spawn('git', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const errors = [];
  child.stderr.on('data', (chunk) => errors.push(chunk));
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `git ${args[0]} failed: ${Buffer.concat(errors).toString().trim()}`,
            ),
          ),
    );
  });
  // Metadata only. Artifact bodies go through countStream, never this buffer.
  const chunks = [];
  for await (const chunk of child.stdout) chunks.push(chunk);
  await done;
  return new TextDecoder('utf-8', { fatal: true }).decode(
    Buffer.concat(chunks),
  );
}

async function resolveCommit(ref) {
  if (typeof ref !== 'string' || !ref || ref.includes('\0'))
    throw new Error('Missing or invalid comparison commit');
  try {
    return (
      await git([
        'rev-parse',
        '--verify',
        '--end-of-options',
        `${ref}^{commit}`,
      ])
    ).trim();
  } catch {
    throw new Error(
      `Comparison commit unavailable or invalid: ${JSON.stringify(ref)} (fetch required history)`,
    );
  }
}

function validateKeys(value, keys, label) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join() !== [...keys].sort().join()
  ) {
    throw new Error(`Invalid ${label} schema`);
  }
}

function validateLimits(value, keys) {
  for (const key of keys) {
    if (!Number.isSafeInteger(value[key]) || value[key] < 0)
      throw new Error(
        `Invalid limit ${key}: expected nonnegative safe integer`,
      );
  }
}

// Intentionally narrow: literal repo-relative paths, optionally ending in one '*'.
// A trailing '*' matches every suffix, including '/' and all extensions.
function pathPrefix(pattern) {
  if (
    typeof pattern !== 'string' ||
    !pattern ||
    pattern === '*' ||
    /[\\\0\r\n?\[\]{}!]/.test(pattern) ||
    pattern.startsWith('/') ||
    pattern.split('/').some((part) => !part || part === '.' || part === '..') ||
    pattern.split('/').includes('.git') ||
    pattern.slice(0, -1).includes('*')
  ) {
    throw new Error(`Invalid artifact path: ${JSON.stringify(pattern)}`);
  }
  return pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
}

function matches(pattern, path) {
  return pattern.endsWith('*')
    ? path.startsWith(pattern.slice(0, -1))
    : path === pattern;
}

function parseBudget(text) {
  const config = JSON.parse(text);
  validateKeys(config, ['version', 'unbudgeted', 'families'], 'budget');
  if (config.version !== 1 || !Array.isArray(config.families))
    throw new Error('Unsupported artifact budget version or families');
  const general = [
    'maxNewFileBytes',
    'maxPositiveGrowthBytes',
    'maxAddedLines',
  ];
  validateKeys(config.unbudgeted, general, 'unbudgeted');
  validateLimits(config.unbudgeted, general);
  const ids = new Set();
  const patterns = [];
  for (const family of config.families) {
    validateKeys(
      family,
      ['id', 'paths', 'maxBytes', 'maxLines', 'reason', 'issue'],
      'family',
    );
    validateLimits(family, ['maxBytes', 'maxLines']);
    if (
      typeof family.id !== 'string' ||
      !/^[a-z0-9][a-z0-9-]*$/.test(family.id) ||
      ids.has(family.id)
    )
      throw new Error('Invalid or duplicate family id');
    ids.add(family.id);
    if (
      typeof family.reason !== 'string' ||
      !family.reason.trim() ||
      !Number.isSafeInteger(family.issue) ||
      family.issue <= 0 ||
      !Array.isArray(family.paths) ||
      !family.paths.length
    )
      throw new Error(`Invalid family metadata: ${family.id}`);
    for (const pattern of family.paths) {
      pathPrefix(pattern);
      for (const previous of patterns) {
        if (
          matches(previous, pathPrefix(pattern)) ||
          matches(pattern, pathPrefix(previous))
        )
          throw new Error(
            `Ambiguous overlapping artifact paths: ${previous}, ${pattern}`,
          );
      }
      patterns.push(pattern);
    }
  }
  return config;
}

async function readTree(ref) {
  if (!ref) return new Map();
  const records = (await git(['ls-tree', '-rlz', '--full-tree', ref]))
    .split('\0')
    .filter(Boolean);
  return new Map(
    records.map((record) => {
      const tab = record.indexOf('\t');
      const [mode, type, oid, bytes] = record.slice(0, tab).trim().split(/\s+/);
      return [record.slice(tab + 1), { mode, type, oid, bytes: Number(bytes) }];
    }),
  );
}

async function countStream(stream) {
  const contentHash = createHash('sha256');
  let bytes = 0,
    lines = 0,
    last = -1,
    binary = false;
  for await (const chunk of stream) {
    contentHash.update(chunk);
    bytes += chunk.length;
    for (const byte of chunk) {
      if (byte === 10) lines++;
      if (byte === 0) binary = true;
    }
    if (chunk.length) last = chunk[chunk.length - 1];
  }
  return {
    bytes,
    lines: binary ? 0 : lines + Number(last !== -1 && last !== 10),
    binary,
    contentHash: contentHash.digest('hex'),
  };
}

async function countBlob(entry) {
  if (entry.type !== 'blob')
    throw new Error(
      'Gitlinks are not artifact files; budget or change the submodule separately',
    );
  const child = spawn('git', ['cat-file', 'blob', entry.oid], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Cannot read blob ${entry.oid}`)),
    );
  });
  const counts = await countStream(child.stdout);
  await done;
  return { ...counts, symlink: entry.mode === '120000' };
}

async function countLocal(path) {
  const parts = path.split('/');
  for (let i = 1; i < parts.length; i++) {
    let parent;
    try {
      parent = await lstat(parts.slice(0, i).join('/'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
    if (!parent.isDirectory() || parent.isSymbolicLink())
      throw new Error(`Unsafe artifact parent: ${JSON.stringify(path)}`);
  }
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  if (info.isSymbolicLink()) {
    const bytes = await readlink(path, { encoding: 'buffer' });
    return { ...(await countStream([bytes])), symlink: true };
  }
  if (!info.isFile())
    throw new Error(
      `Unsupported artifact file (directory, gitlink or special file): ${JSON.stringify(path)}`,
    );
  return countStream(
    createReadStream(path, {
      flags: constants.O_RDONLY | constants.O_NOFOLLOW,
      highWaterMark: 64 * 1024,
    }),
  );
}

function requireSha(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/.test(value))
    throw new Error('Malformed GitHub event commit SHA');
  return value;
}

async function ciComparison(head) {
  if (!process.env.GITHUB_EVENT_PATH)
    throw new Error('GITHUB_EVENT_PATH is required for --ci');
  const event = JSON.parse(
    await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'),
  );
  if (!event || typeof event !== 'object' || Array.isArray(event))
    throw new Error('Malformed GitHub event: expected object');
  if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
    const base = await resolveCommit(requireSha(event.pull_request?.base?.sha));
    const eventHead = await resolveCommit(
      requireSha(event.pull_request?.head?.sha),
    );
    if (head !== eventHead) {
      const parents = (await git(['rev-list', '--parents', '-n', '1', head]))
        .trim()
        .split(' ')
        .slice(1);
      if (
        parents.length !== 2 ||
        parents[0] !== base ||
        parents[1] !== eventHead
      )
        throw new Error(
          'Checkout does not match pull_request head or synthetic merge',
        );
    }
    return {
      base,
      source: `pull_request base ${base}, event head ${eventHead}`,
    };
  }
  if (process.env.GITHUB_EVENT_NAME !== 'push')
    throw new Error('Unsupported GitHub event (expected push or pull_request)');
  const after = await resolveCommit(requireSha(event.after));
  const before = requireSha(event.before);
  if (
    after !== head ||
    typeof event.ref !== 'string' ||
    !event.ref.startsWith('refs/heads/')
  )
    throw new Error('Checkout or ref does not match push event');
  if (!/^0+$/.test(before))
    return { base: await resolveCommit(before), source: 'push before' };
  const defaultBranch = event.repository?.default_branch;
  if (
    typeof defaultBranch !== 'string' ||
    !defaultBranch ||
    /[\s~^:?*\[\\]/.test(defaultBranch) ||
    defaultBranch.startsWith('-')
  )
    throw new Error('New-branch push requires a valid default branch');
  if (event.ref === `refs/heads/${defaultBranch}`) {
    // A newly created default branch has no prior branch state: count its whole tree.
    return { base: null, source: 'new default branch: empty tree' };
  }
  const defaultTip = await resolveCommit(
    `refs/remotes/origin/${defaultBranch}`,
  );
  const base = (await git(['merge-base', head, defaultTip])).trim();
  if (!base)
    throw new Error('No default-branch merge base; fetch required history');
  return {
    base,
    source: `new branch: merge base with origin/${defaultBranch}`,
  };
}

async function comparison(args, head) {
  if (!args.length)
    return { base: head, source: 'HEAD (local changes)', committed: false };
  if (args.length === 2 && args[0] === '--base')
    return {
      base: await resolveCommit(args[1]),
      source: 'fixed task base',
      committed: false,
    };
  if (args.length === 1 && args[0] === '--ci')
    return { ...(await ciComparison(head)), committed: true };
  throw new Error(
    'Usage: node scripts/check-artifacts.mjs [--base <commit> | --ci]',
  );
}

async function addedLines({ base, head, committed }) {
  if (!base) return new Map();
  const args = [
    'diff',
    '--no-ext-diff',
    '--no-textconv',
    '--no-renames',
    '--numstat',
    '-z',
    base,
  ];
  if (committed) args.push(head);
  args.push('--');
  const records = (await git(args)).split('\0').filter(Boolean);
  return new Map(
    records.map((record) => {
      const first = record.indexOf('\t'),
        second = record.indexOf('\t', first + 1);
      return [
        record.slice(second + 1),
        record.slice(0, first) === '-' ? null : Number(record.slice(0, first)),
      ];
    }),
  );
}

function familyFor(config, path) {
  return config.families.find((family) =>
    family.paths.some((pattern) => matches(pattern, path)),
  );
}

function printBudgetChanges(before, after) {
  if (before === after) return;
  process.stdout.write(
    'Budget changes (explicit Standards disposition required):\n',
  );
  if (before === null) process.stdout.write('  NEW budget configuration\n');
  else parseBudget(before);
  const oldConfig = before === null ? null : JSON.parse(before);
  const newConfig = JSON.parse(after);
  for (const key of ['unbudgeted', 'families']) {
    if (JSON.stringify(oldConfig?.[key]) !== JSON.stringify(newConfig[key])) {
      process.stdout.write(
        `  ${key} before: ${JSON.stringify(oldConfig?.[key] ?? null)}\n  ${key} after: ${JSON.stringify(newConfig[key])}\n`,
      );
    }
  }
}

async function listComparisonPaths({ selected, beforeTree, headTree }) {
  let currentPaths, changed;
  const untracked = new Set();
  if (selected.committed) {
    currentPaths = new Set(headTree.keys());
    changed = new Set(
      [...beforeTree.keys(), ...headTree.keys()].filter(
        (path) =>
          beforeTree.get(path)?.oid !== headTree.get(path)?.oid ||
          beforeTree.get(path)?.mode !== headTree.get(path)?.mode,
      ),
    );
  } else {
    for (const path of (
      await git(['ls-files', '--others', '--exclude-standard', '-z'])
    )
      .split('\0')
      .filter(Boolean))
      untracked.add(path);
    currentPaths = new Set([
      ...(await git(['ls-files', '--cached', '-z']))
        .split('\0')
        .filter(Boolean),
      ...untracked,
    ]);
    changed = new Set(
      (
        await git([
          'diff',
          '--no-ext-diff',
          '--no-textconv',
          '--no-renames',
          '--name-only',
          '-z',
          selected.base,
          '--',
        ])
      )
        .split('\0')
        .filter(Boolean),
    );
    for (const path of untracked) changed.add(path);
    for (const path of currentPaths)
      if (!beforeTree.has(path)) changed.add(path);
  }
  return { currentPaths, changed, untracked };
}

async function readBudget({ selected, head, beforeTree, headTree }) {
  const configEntry = selected.committed ? headTree.get(budgetPath) : null;
  if (
    configEntry &&
    configEntry.mode !== '100644' &&
    configEntry.mode !== '100755'
  )
    throw new Error('Budget configuration must be a regular file');
  if (!selected.committed) await countLocal(budgetPath);
  if (!selected.committed && !(await lstat(budgetPath)).isFile())
    throw new Error('Budget configuration must be a regular file');
  const configText = selected.committed
    ? await git(['show', `${head}:${budgetPath}`])
    : await readFile(budgetPath, 'utf8');
  const config = parseBudget(configText);
  const beforeConfig = beforeTree.has(budgetPath)
    ? await git(['show', `${selected.base}:${budgetPath}`])
    : null;
  return { config, configText, beforeConfig };
}

async function measureArtifacts({
  config,
  selected,
  beforeTree,
  headTree,
  currentPaths,
  changed,
  untracked,
  lineAdditions,
}) {
  const totals = new Map(
    config.families.map((family) => [
      family.id,
      {
        beforeBytes: 0,
        afterBytes: 0,
        beforeLines: 0,
        afterLines: 0,
        binary: 0,
      },
    ]),
  );
  for (const [path, entry] of beforeTree) {
    const family = familyFor(config, path);
    if (!family) continue;
    const counts = await countBlob(entry),
      total = totals.get(family.id);
    total.beforeBytes += counts.bytes;
    total.beforeLines += counts.lines;
  }
  let positiveBytes = 0,
    added = 0;
  const contributors = [],
    violations = [];
  for (const path of [...currentPaths].sort()) {
    const family = familyFor(config, path);
    if (!family && !changed.has(path)) continue;
    const counts = selected.committed
      ? await countBlob(headTree.get(path))
      : await countLocal(path);
    if (!counts) continue;
    const previous = beforeTree.get(path);
    if (previous?.type === 'commit')
      throw new Error(
        `Changed gitlink is unsupported: ${JSON.stringify(path)}`,
      );
    const growth = Math.max(0, counts.bytes - (previous?.bytes ?? 0));
    contributors.push({ path, ...counts, growth });
    if (family) {
      const total = totals.get(family.id);
      total.afterBytes += counts.bytes;
      total.afterLines += counts.lines;
      total.binary += Number(counts.binary);
      continue;
    }
    positiveBytes += growth;
    let pathAdded = lineAdditions.has(path)
      ? lineAdditions.get(path)
      : previous
        ? 0
        : counts.lines;
    // Unavailable stats charge current text conservatively, except identical
    // content (e.g. a mode-only change under -diff attributes).
    if (
      !counts.binary &&
      !untracked.has(path) &&
      pathAdded === null &&
      previous &&
      (await countBlob(previous)).contentHash === counts.contentHash
    )
      pathAdded = 0;
    added += counts.binary
      ? 0
      : untracked.has(path)
        ? counts.lines
        : (pathAdded ?? counts.lines);
    if (!previous && counts.bytes > config.unbudgeted.maxNewFileBytes)
      violations.push(
        `New unbudgeted file ${JSON.stringify(path)}: ${counts.bytes} > ${config.unbudgeted.maxNewFileBytes} bytes`,
      );
  }
  return { totals, positiveBytes, added, contributors, violations };
}

function printMeasurements({
  config,
  totals,
  positiveBytes,
  added,
  contributors,
  violations,
}) {
  for (const family of config.families) {
    const total = totals.get(family.id);
    process.stdout.write(
      `${family.id}: ${total.beforeBytes} -> ${total.afterBytes} bytes; ${total.beforeLines} -> ${total.afterLines} lines; limits ${family.maxBytes} bytes / ${family.maxLines} lines; binary files ${total.binary}\n`,
    );
    if (total.afterBytes > family.maxBytes)
      violations.push(
        `${family.id}: ${total.afterBytes} > ${family.maxBytes} bytes`,
      );
    if (total.afterLines > family.maxLines)
      violations.push(
        `${family.id}: ${total.afterLines} > ${family.maxLines} lines`,
      );
  }
  process.stdout.write(
    `Unbudgeted: +${positiveBytes} bytes (limit ${config.unbudgeted.maxPositiveGrowthBytes}); ${added} added lines (limit ${config.unbudgeted.maxAddedLines})\nLargest contributors (current bytes / positive growth / lines):\n`,
  );
  contributors.sort(
    (a, b) =>
      b.bytes - a.bytes || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
  );
  for (const item of contributors.slice(0, 10))
    process.stdout.write(
      `  ${item.bytes} / +${item.growth} / ${item.binary ? 'binary (n/a)' : item.lines} ${JSON.stringify(item.path)}${item.symlink ? ' (symlink target only)' : ''}\n`,
    );
  if (positiveBytes > config.unbudgeted.maxPositiveGrowthBytes)
    violations.push(
      `Unbudgeted positive growth: ${positiveBytes} > ${config.unbudgeted.maxPositiveGrowthBytes} bytes`,
    );
  if (added > config.unbudgeted.maxAddedLines)
    violations.push(
      `Unbudgeted added lines: ${added} > ${config.unbudgeted.maxAddedLines}`,
    );
  for (const violation of violations)
    process.stdout.write(`FAIL ${violation}\n`);
  process.stdout.write(
    violations.length
      ? 'Artifact budgets failed\n'
      : 'Artifact budgets passed (limits are inclusive)\n',
  );
  process.exitCode = violations.length ? 1 : 0;
}

async function checkArtifacts() {
  const root = (await git(['rev-parse', '--show-toplevel'])).trim();
  process.chdir(root);
  const head = await resolveCommit('HEAD');
  const selected = await comparison(process.argv.slice(2), head);
  const beforeTree = await readTree(selected.base);
  const headTree = await readTree(head);
  const { config, configText, beforeConfig } = await readBudget({
    selected,
    head,
    beforeTree,
    headTree,
  });
  const { currentPaths, changed, untracked } = await listComparisonPaths({
    selected,
    beforeTree,
    headTree,
  });
  const lineAdditions = await addedLines({ ...selected, head });
  const localStatus = (await git([
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=normal',
  ]))
    ? 'worktree edits present'
    : 'worktree clean';
  process.stdout.write(
    `Artifacts: base ${selected.base ?? 'empty tree'}; head ${head}; ${selected.source}; ${selected.committed ? 'committed tree' : 'local changes included'}; ${localStatus}\n`,
  );
  printBudgetChanges(beforeConfig, configText);
  const measurements = await measureArtifacts({
    config,
    selected,
    beforeTree,
    headTree,
    currentPaths,
    changed,
    untracked,
    lineAdditions,
  });
  printMeasurements({ config, ...measurements });
}

checkArtifacts().catch((error) => {
  process.stderr.write(`Artifact check error: ${error.message}\n`);
  process.exitCode = 1;
});
