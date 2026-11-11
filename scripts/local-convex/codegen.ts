import { describeCodegenFailure, generateLocalBindings } from './generate';

generateLocalBindings(process.cwd()).catch((error: unknown) => {
  // Only the failure's phase and its redacted CLI output tail are printed.
  process.stderr.write(`${describeCodegenFailure(error).join('\n')}\n`);
  process.exitCode = 1;
});
