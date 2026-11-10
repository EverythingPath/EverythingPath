/**
 * How "Rules used" and its chooser name a class version on a prepared sheet
 * (#583). Every prepared sheet seeds its representative classes on the
 * Character itself, so each version carries that scope, as `versionLabel`
 * in `src/components/character-sheet/class-switch-copy.ts` words it.
 */
export function seededClassVersionLabel(name: string) {
  return `${name} (this Character)`;
}
