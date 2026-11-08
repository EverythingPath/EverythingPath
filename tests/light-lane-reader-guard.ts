import { createRequire, syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as NodeFs from 'node:fs';
import type { Plugin } from 'vite';

/**
 * The light landing lane's runtime reader guard (operations.md, "Light landing
 * lane"). light-lane-v1 lets a candidate that changes only lane-eligible files
 * land without this suite, so no test may read one: vitest.setup.ts installs
 * the fs half in every worker and vitest.config.ts adds the Vite plugin for
 * module loads (`?raw` included). Both files and this one are reader pins of
 * scripts/orchestration/light_lane.py, so changing or disabling the guard
 * forces a full gate. isLaneEligible mirrors the rule's allowlist (R2);
 * light-lane.test.py checks that the two agree.
 */

const exact = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  'docs/standards.md',
  '.claude/settings.json',
  '.gitignore',
]);
const markdownPrefixes = ['docs/agents/', 'docs/product/', '.agents/skills/'];

/** Whether light-lane-v1 lets a candidate change this repository path. */
export function isLaneEligible(relative: string) {
  if (exact.has(relative)) return true;
  if (
    relative.endsWith('.md') &&
    markdownPrefixes.some((prefix) => relative.startsWith(prefix))
  ) {
    return true;
  }
  return /^\.claude\/agents\/[^/]+\.md$/.test(relative);
}

type Fs = typeof NodeFs;
type State = { root: string; realRoot: string; violations: string[] };

const stateKey = Symbol.for('everythingpath.light-lane-reader-guard');
const require = createRequire(import.meta.url);
const fs = require('node:fs') as Fs;
// Unpatched, captured before the guard wraps anything.
const realpath = fs.realpathSync.native;

function state() {
  return (globalThis as Record<symbol, State | undefined>)[stateKey];
}

function inside(base: string, absolute: string) {
  const relative = path.relative(base, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return undefined;
  }
  return relative.split(path.sep).join('/');
}

/** The lane-eligible repository path TARGET names, lexically or through a symlink. */
function eligible(target: unknown, guard: State) {
  let file: string;
  if (typeof target === 'string') file = target;
  else if (Buffer.isBuffer(target)) file = target.toString();
  else if (
    target instanceof Object &&
    'href' in target &&
    'protocol' in target
  ) {
    // A WHATWG URL from any realm (jsdom's URL is not Node's).
    if (String(target.protocol) !== 'file:') return undefined;
    file = fileURLToPath(String(target.href));
  } else return undefined;
  const absolute = path.resolve(file);
  const names = [inside(guard.root, absolute)];
  try {
    names.push(inside(guard.realRoot, realpath(absolute)));
  } catch {
    // A missing file has no real path; its lexical name decides.
  }
  return names.find((name) => name !== undefined && isLaneEligible(name));
}

function message(file: string) {
  return (
    `light lane reader guard: a test read ${file}. light-lane-v1 lets a ` +
    'candidate that changes only such files land without this suite, so no ' +
    'test may read one (operations.md, "Light landing lane"); read a fixture ' +
    'copy instead.'
  );
}

function refuse(target: unknown) {
  const guard = state();
  const file = guard && eligible(target, guard);
  if (!file) return;
  guard.violations.push(file);
  throw new Error(message(file));
}

function wrap(owner: object, name: string) {
  const original = Reflect.get(owner, name) as (...args: unknown[]) => unknown;
  Reflect.set(owner, name, function (this: unknown, ...args: unknown[]) {
    refuse(args[0]);
    return original.apply(this, args);
  });
}

/** Patch fs and fs/promises readers in this process, once. */
export function installReaderGuard(root: string) {
  if (state()) return;
  (globalThis as Record<symbol, State>)[stateKey] = {
    root: path.resolve(root),
    realRoot: realpath(path.resolve(root)),
    violations: [],
  };
  for (const name of [
    'readFileSync',
    'readFile',
    'createReadStream',
    'openSync',
    'open',
    'copyFileSync',
    'copyFile',
  ]) {
    wrap(fs, name);
  }
  for (const name of ['readFile', 'open', 'copyFile']) wrap(fs.promises, name);
  syncBuiltinESMExports();
}

/** Every lane-eligible read refused in this process, including caught ones. */
export function readerGuardViolations() {
  return [...(state()?.violations ?? [])];
}

/** Refuses Vite module loads of lane-eligible files, `?raw` imports included. */
export function lightLaneReaderGuardPlugin(root: string): Plugin {
  const guard: State = {
    root: path.resolve(root),
    realRoot: realpath(path.resolve(root)),
    violations: [],
  };
  return {
    name: 'light-lane-reader-guard',
    enforce: 'pre',
    load(id) {
      const file = id.startsWith('\0') ? undefined : id.split('?')[0];
      const hit = file && eligible(file, guard);
      if (hit) this.error(message(hit));
      return null;
    },
  };
}
