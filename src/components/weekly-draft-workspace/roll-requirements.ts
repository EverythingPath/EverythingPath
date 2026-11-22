/**
 * The engine reports a missing check die twice: as its dice (`<check>:1d20`,
 * `<choice>:check:1d20` for an Activity check, or `<reaction>:check:1d20` for
 * a Sabotage check `<event>:sabotage:<reaction>`) and as the check's absent
 * roll (`<check>:roll`). Both ask for the same entry, so every list a player
 * reads, and every count of decisions left, keeps only the dice code.
 */
export function withoutDuplicateRollCodes(codes: readonly string[]) {
  const dice = new Set(
    codes.flatMap((code) => /^(.*):\d+d\d+$/.exec(code)?.slice(1, 2) ?? []),
  );
  return codes.filter((code) => {
    const check = /^(.*):roll$/.exec(code)?.[1];
    if (check === undefined) return true;
    const reaction = /:sabotage:(.+)$/.exec(check)?.[1];
    return !(
      dice.has(check) ||
      dice.has(`${check}:check`) ||
      (reaction !== undefined && dice.has(`${reaction}:check`))
    );
  });
}
