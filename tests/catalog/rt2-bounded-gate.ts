import { expect } from 'vitest';

/**
 * Racial-trait wave RT2's admissions (cur388rt2), an independent literal: 16
 * Racial Traits of #389-#401, admitted at full corpus on confirmed,
 * content-bound assessments.
 */
export const rt2AdmittedKeys: ReadonlySet<string> = new Set([
  'pf1-content/7LSKyC0eM1uQgBvm', // Deep Warrior (#389)
  'pf1-content/DEowtAtiVIQOh2dj', // Dual Minded (#390)
  'pf1-content/D8D7iC2Mp8Z5RHvt', // Outrider (#390)
  'pf1-content/HFKHorjMw2dERwBo', // Craftsman (#392)
  'pf1-content/HzKBmWjSHjYSNsU9', // Relentless (#392)
  'pf1-content/NApPIjNkVNBxzQS3', // Gatecrasher (#393)
  'pf1-content/QdzlzrqWtgfjE4Fs', // Ancient Enmity (#394)
  'pf1-content/O4c045wJE5lLweg3', // Eternal Grudge (#394)
  'pf1-content/O79h8E0bytNQ3Wte', // Integrated (#394)
  'pf1-content/StOjhD9mqHZqSELy', // Desert Runner (#395)
  'pf1-content/eew9hWENxwAiLP8S', // Stubborn (#399)
  'pf1-content/f9g94BzVWjntaNQg', // Warden of Nature (#399)
  'pf1-content/hpHlEjDVM9x8Fuim', // Rock Climber (#400)
  'pf1-content/iSHRZjOWa5TnYKXe', // Underfoot (#400)
  'pf1-content/nWMwiyydGWx5S05m', // Bestial (#401)
  'pf1-content/o8YypRycSCackHdm', // Plagueborn (#401)
]);

/**
 * The wave's named content holds (fix r1, root ruling), an independent
 * literal: Skilled (Tiefling) and its eight bloodline heritages, whose only
 * PCGen rows are Core Essentials leads with no SOURCELONG book, and Skilled's
 * bloodline sentence has no permitted text. Each supersedes its whole-content
 * hold.
 */
export const rt2NamedHolds: ReadonlyMap<string, string> = new Map([
  // Skilled (Tiefling) (#389)
  [
    'pf1-content/AKuDJrwJUZULsJcS',
    'racial-traits-389-owner-owed-content-AKuDJrwJUZULsJcS',
  ],
  // Skilled (Tiefling - Faultspawn) (#391)
  [
    'pf1-content/FVArwvrXwcHJtdNz',
    'racial-traits-391-owner-owed-content-FVArwvrXwcHJtdNz',
  ],
  // Skilled (Tiefling - Beastbrood) (#392)
  [
    'pf1-content/IMoj6UWbaCG3nGLM',
    'racial-traits-392-owner-owed-content-IMoj6UWbaCG3nGLM',
  ],
  // Skilled (Tiefling - Pitborn) (#392)
  [
    'pf1-content/JpCDy27IK3xb1DeK',
    'racial-traits-392-owner-owed-content-JpCDy27IK3xb1DeK',
  ],
  // Skilled (Tiefling - Hungerseed) (#394)
  [
    'pf1-content/OKOj8Njd7R51xoXM',
    'racial-traits-394-owner-owed-content-OKOj8Njd7R51xoXM',
  ],
  // Skilled (Tiefling - Shackleborn) (#398)
  [
    'pf1-content/cML095CltG7ZpUSM',
    'racial-traits-398-owner-owed-content-cML095CltG7ZpUSM',
  ],
  // Skilled (Tiefling - the Motherless) (#400)
  [
    'pf1-content/iMdXJ73UwSIDDJdk',
    'racial-traits-400-owner-owed-content-iMdXJ73UwSIDDJdk',
  ],
  // Skilled (Tiefling - Grimspawn) (#401)
  [
    'pf1-content/ntICYwpS9NmCaXKI',
    'racial-traits-401-owner-owed-content-ntICYwpS9NmCaXKI',
  ],
  // Skilled (Tiefling - Hellspawn) (#401)
  [
    'pf1-content/lrZtYK3baHZY6JnK',
    'racial-traits-401-owner-owed-content-lrZtYK3baHZY6JnK',
  ],
]);

/**
 * What a batch fixture's bounded gate does with the wave's admissions. It
 * reads only that batch's content closure, where each standard trait an
 * alternate replaces (`detail.replaces`) is closure context whose own race
 * and notices lie outside the fixture, so the gate omits the alternate on
 * it, as wave CL5's Gnome Magic on its linked cantrips. A wave row that
 * replaces nothing, and every earlier admission, the gate admits.
 */
export function rt2BoundedGate(
  admittedKeys: Iterable<string>,
  replacesOf: (key: string) => readonly string[],
) {
  const omitted = new Map<string, readonly string[]>();
  const admitted: string[] = [];
  for (const key of admittedKeys) {
    const replaces = replacesOf(key);
    if (rt2AdmittedKeys.has(key) && replaces.length) omitted.set(key, replaces);
    else admitted.push(key);
  }
  return { admitted: admitted.sort(), omitted };
}

/**
 * The gate's dependent omissions among the batch's rows include each wave
 * alternate, omitted on standard traits it replaces (the gate lists every
 * omitted dependency, comma-separated).
 */
export function expectRt2Omissions(
  omissions: readonly { externalKey: string; reason: string }[],
  omitted: ReadonlyMap<string, readonly string[]>,
) {
  for (const [key, replaces] of omitted) {
    const reason = omissions.find(
      (omission) => omission.externalKey === key,
    )?.reason;
    const on = /^Dependent omission: (.+)\.$/.exec(reason ?? '')?.[1];
    expect(on, key).toBeDefined();
    const keys = on?.split(', ') ?? [];
    expect(keys.length, key).toBeGreaterThan(0);
    for (const replaced of keys) expect(replaces, key).toContain(replaced);
  }
}
