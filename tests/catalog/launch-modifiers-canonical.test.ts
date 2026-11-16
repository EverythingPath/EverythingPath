// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pins } from '../../scripts/catalog/inventory';
import {
  evidenceShown,
  importedEvidence,
  loadControlRows,
} from './launch-modifier-evidence';

// A gate-host audit (scripts/orchestration/host-audits.json): the
// plain-Modifiers control (`launch-modifiers.test.ts`) imports its rows from
// the pinned store with the importer's context; this holds it to the build
// `catalog:launch-inventory --verify` runs over the whole pinned checkouts.
const checkouts = {
  pf1: join(homedir(), 'repos/everythingpath/sources/foundryvtt-pathfinder1'),
  'pf1-content': join(homedir(), 'repos/everythingpath/sources/pf1-content'),
} as const;
const atPins = (['pf1', 'pf1-content'] as const).every((repo) => {
  try {
    return (
      execFileSync('git', ['-C', checkouts[repo], 'rev-parse', 'HEAD'], {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim() === pins[repo].commit
    );
  } catch {
    return false;
  }
});

describe('the plain-Modifiers control against the canonical build', () => {
  // Over every Modifier row: an entry exactly where the build emits one, with
  // the same kind, outputs and disqualifying issues. Only issues the family
  // does not read may differ: links only the whole corpus resolves
  // (`description.link`, `weaponProf`, `spellKey`).
  it.skipIf(!atPins)(
    'gives every Modifier row exactly the entry, outputs and disqualifying issues the build gives it',
    async () => {
      const { modifierRows, real } = await loadControlRows();
      const built = await importedEvidence({
        systemPath: checkouts.pf1,
        contentPath: checkouts['pf1-content'],
      });
      const mismatches = modifierRows.flatMap(({ key }) => {
        const found = real.get(key);
        const control = evidenceShown(found?.entry, found?.issues ?? []);
        const canonical = evidenceShown(
          built.entries.get(key),
          built.issues.get(key) ?? [],
        );
        return JSON.stringify(control) === JSON.stringify(canonical)
          ? []
          : [{ key, control, canonical }];
      });
      expect(modifierRows.length).toBe(513);
      expect(mismatches).toEqual([]);
    },
    600_000,
  );
});
