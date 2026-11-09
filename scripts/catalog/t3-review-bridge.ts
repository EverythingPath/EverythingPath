import { readFile, stat } from 'node:fs/promises';
import { z } from 'zod';
import { captureReviewInputs } from '../catalog-record-review.ts';
import { runT3ReviewCodeMode } from './t3-review-code-mode.ts';
import {
  prepareT3Dispatch,
  saveT3DispatchReturn,
  nextT3OriginalRead,
  bindT3Dispatch,
  completeT3Review,
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
  base.extend({ action: z.literal('returned'), response: z.unknown() }),
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
  const args = argsSchema.parse(JSON.parse(bytes));
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
    case 'returned':
      await saveT3DispatchReturn(args);
      return { saved: true };
    case 'next':
      return nextT3OriginalRead(args);
    case 'bind':
      await bindT3Dispatch(args);
      return { bound: true };
    case 'complete': {
      const { run } = await completeT3Review({
        ...args,
        report: await readBoundedFile(args.report),
      });
      return { runId: run.runId };
    }
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
