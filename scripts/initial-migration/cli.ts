import { runInitialMigrationOperator } from './operator.ts';

runInitialMigrationOperator({ args: process.argv.slice(2) })
  .then((report) => {
    process.stdout.write(
      'usage' in report
        ? report.usage
        : `Target: ${report.target}\n${report.did}\nNext: ${report.next}\n${JSON.stringify(report.details, null, 2)}\n`,
    );
  })
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
