import { runAndReport } from './support/runner';

process.exitCode = await runAndReport(process.argv.slice(2));
