import { readFile, stat } from 'node:fs/promises';
import { z } from 'zod';
import { captureReviewInputs } from '../catalog-record-review.ts';
import { runT3ReviewCodeMode } from './t3-review-code-mode.ts';
import {
  prepareT3Dispatch,
  offerT3DispatchReturn,
  stageT3DispatchReturn,
  checkT3DispatchStatus,
  discardT3DispatchReturn,
  nextT3OriginalRead,
  stageT3DispatchEvidence,
  bindT3Dispatch,
  completeT3Review,
  requireTemporaryDirectoryOutside,
} from './t3-review-evidence.ts';

const base = z.object({ dir: z.string().min(1) });
const argsSchema = z.discriminatedUnion('action', [
  base.extend({
    action: z.literal('capture'),
    root: z.string(),
    config: z.string(),
    caller: z.unknown(),
  }),
  base.extend({ action: z.literal('prepare'), caller: z.unknown() }),
  base.extend({ action: z.literal('offer'), returned: z.unknown() }),
  base.extend({ action: z.literal('stage'), returned: z.unknown() }),
  base.extend({
    action: z.literal('check'),
    offer: z.string(),
    response: z.unknown(),
  }),
  base.extend({
    action: z.literal('discard'),
    offer: z.string(),
    evidence: z.string().optional(),
  }),
  // The bounded payloads: the status and the reads, nothing else.
  base.extend({
    action: z.literal('next'),
    response: z.unknown(),
    observations: z.unknown(),
  }),
  base.extend({
    action: z.literal('bind'),
    response: z.unknown(),
    observations: z.unknown(),
  }),
  base.extend({
    action: z.literal('publish'),
    offer: z.string(),
    evidence: z.string(),
  }),
  base.extend({
    action: z.literal('complete'),
    response: z.unknown(),
    report: z.string(),
  }),
]);
async function readBoundedFile(path: string) {
  if ((await stat(path)).size > 1000000)
    throw new Error('Review file exceeds the evidence size bound.');
  return readFile(path);
}
async function main() {
  if (process.argv[2] === '--code-mode') {
    process.stdout.write(
      `(() => { const __name = (value) => value; return (${runT3ReviewCodeMode.toString()}); })()\n`,
    );
    return;
  }
  const bytes = process.argv[2] ?? '';
  if (Buffer.byteLength(bytes) > 60000)
    throw new Error('Bridge input exceeds 60000 bytes.');
  return act(argsSchema.parse(JSON.parse(bytes)));
}
type Args = z.infer<typeof argsSchema>;
/** What to do once TMPDIR is elsewhere, by the operation an action is part of. */
const retryOf = (action: Args['action']) =>
  action === 'capture' || action === 'prepare' || action === 'complete'
    ? `${action} once more`
    : 'bind once more';
async function act(args: Args) {
  // Every action, before anything else: TMPDIR is not, is not inside and
  // does not contain the round it operates on.
  await requireTemporaryDirectoryOutside(
    { kind: 'round', round: args.dir },
    retryOf(args.action),
  );
  switch (args.action) {
    case 'capture': {
      const config: unknown = JSON.parse(
        (await readBoundedFile(args.config)).toString('utf8'),
      );
      const { sha256 } = await captureReviewInputs({ ...args, config });
      return { sha256 };
    }
    case 'prepare':
      return prepareT3Dispatch(args);
    case 'complete': {
      const { run } = await completeT3Review({
        ...args,
        report: await readBoundedFile(args.report),
      });
      return { runId: run.runId };
    }
    default:
      return bindStep(args);
  }
}
/** A code-mode bind's own steps (prepare aside), in the order it runs them. */
async function bindStep(
  args: Exclude<Args, { action: 'capture' | 'prepare' | 'complete' }>,
) {
  switch (args.action) {
    case 'offer':
      return offerT3DispatchReturn(args);
    case 'stage':
      return stageT3DispatchReturn(args);
    case 'check':
      return checkT3DispatchStatus(args);
    case 'next':
      return nextT3OriginalRead(args);
    case 'bind':
      return stageT3DispatchEvidence(args);
    case 'publish':
      await bindT3Dispatch({
        kind: 'staged',
        dir: args.dir,
        offer: args.offer,
        evidence: args.evidence,
      });
      return { bound: true };
    case 'discard':
      return discardT3DispatchReturn(args);
  }
}
main()
  .then((value) => {
    if (value !== undefined) process.stdout.write(`${JSON.stringify(value)}\n`);
  })
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
