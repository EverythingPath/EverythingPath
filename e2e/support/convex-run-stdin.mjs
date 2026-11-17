// Runs `convex run` with its JSON arguments read from stdin (#754), so a
// fixture call's capability never appears in any process's argv, where any
// local user can read it (`ps`, /proc/<pid>/cmdline).
//
//   node convex-run-stdin.mjs <cli entry> run <function> [...flags] < args.json
//
// It hands the installed CLI exactly `[node, <cli entry>, 'run', <function>,
// <json>, ...flags]`: the CLI parses `process.argv` when it loads, and
// replacing it in JavaScript does not change the kernel's command line.
// Messages are fixed text: nothing read from stdin is ever printed.
import { pathToFileURL } from 'node:url';

const maxArgumentBytes = 1024 * 1024;
// Exit statuses of failures before the CLI loads, so before any network I/O.
const refusedArguments = 86;
const cliUnavailable = 87;

function refuse(status, reason) {
  process.stderr.write(`E2E fixture arguments refused (${reason})\n`);
  process.exit(status);
}

const [node, , cliEntry, command, functionName, ...flags] = process.argv;
if (!cliEntry || command !== 'run' || !functionName)
  refuse(refusedArguments, 'usage');

const chunks = [];
let size = 0;
for await (const chunk of process.stdin) {
  size += chunk.length;
  // Stop reading at once: the harness sees its pipe close early.
  if (size > maxArgumentBytes) refuse(refusedArguments, 'too large');
  chunks.push(chunk);
}
const text = Buffer.concat(chunks).toString('utf8');
let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  refuse(refusedArguments, 'not JSON');
}
if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
  refuse(refusedArguments, 'not an object');

process.argv = [node, cliEntry, command, functionName, text, ...flags];
// The CLI reports crashes to Sentry unless CI is set and VERCEL is not "1"
// (convex/src/cli/lib/utils/sentry.ts); a report could carry the arguments.
// Opt out in this process only: the runner's own environment is unchanged.
process.env.CI = 'true';
delete process.env.VERCEL;
try {
  await import(pathToFileURL(cliEntry).href);
} catch {
  process.stderr.write('E2E fixture CLI could not load\n');
  process.exit(cliUnavailable);
}
