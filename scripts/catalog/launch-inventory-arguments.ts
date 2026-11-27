const flags = [
  '--write',
  '--check',
  '--verify',
  '--report',
  '--expanded',
  '--diagnostics',
];

/**
 * `catalog:launch-inventory`'s arguments, parsed: the flags it knows and the
 * modes they go together in. Reads no file; the script reads its inputs in
 * its own steps after this.
 */
export function launchInventoryArguments(argv: readonly string[]) {
  const args = new Set(argv);
  if (args.has('--write') && args.has('--check'))
    throw new Error('Choose either --write or read-only --check.');
  for (const arg of args)
    if (!flags.includes(arg))
      throw new Error(`Unknown inventory argument ${arg}.`);
  if (args.has('--verify') && !args.has('--write') && !args.has('--check'))
    throw new Error('--verify needs --write or --check.');
  return args;
}
