// Exit statuses: 0 a report or the help, 2 when no report could be produced
// (`runNoticeCoverageCommand`), a module that fails to load included.
try {
  const { runNoticeCoverageCommand } =
    await import('./catalog/notice-coverage-report.ts');
  const { status, stdout, stderr } = await runNoticeCoverageCommand(
    process.argv.slice(2),
  );
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  process.exitCode = status;
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 2;
}
