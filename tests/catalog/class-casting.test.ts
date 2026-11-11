// @vitest-environment node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import { importCatalog } from '../../scripts/catalog/import';
import { mapEntry } from '../../scripts/catalog/map';
import type { LoadedRecord } from '../../scripts/catalog/records';
import { readObject } from '../../scripts/catalog/values';
import { findReviewedClassCasting } from '../../src/lib/character-sheet-casting-tables';
import { loadPinnedClass } from './pinned-classes';
import { materializePinnedTree, pinnedPath } from './pinned-sources';

/**
 * S3: a class's imported casting names its ability as stored casting does
 * (`intelligence`, not Foundry's `int`), so the stored candidate adapter's
 * identity comparison accepts every pinned caster's reviewed record.
 */
const loadClass = loadPinnedClass;
function importClass(source: LoadedRecord) {
  const entry = mapEntry({
    source,
    kind: 'class',
    resolveKey: (key) => key,
    lookup: new Map(),
    spellClassTags: new Set(),
  });
  if (entry.detail.kind !== 'class') throw new Error('No class body.');
  return { ...entry, detail: entry.detail };
}

describe('imported class casting', () => {
  it('gives every pinned caster its reviewed casting’s ability, kind, offset and type', async () => {
    const directory = 'packs/classes';
    const files = (await readdir(pinnedPath('pf1', directory))).map(
      (name) => `${directory}/${name}`,
    );
    const casters: string[] = [];
    for (const file of files) {
      const entry = importClass(await loadClass(file));
      const { casting, tag } = entry.detail;
      if (!casting) continue;
      casters.push(tag);
      const reviewed = findReviewedClassCasting(tag);
      expect(reviewed, tag).toBeDefined();
      // The adapter's comparison: every imported value equals the stored one.
      for (const [key, value] of Object.entries(casting))
        if (value !== undefined)
          expect(value, `${tag} ${key}`).toBe(
            reviewed?.[key as keyof typeof reviewed],
          );
      expect(
        entry.unsupported.filter(({ field }) => field === 'casting.ability'),
        tag,
      ).toEqual([]);
    }
    expect(casters).toHaveLength(28);
    expect(casters).toContain('wizard');
  });

  it('maps each Foundry ability code to its stored name', async () => {
    const wizard = await loadClass(
      'packs/classes/wizard.0c4lYDywj6bQ0i8r.yaml',
    );
    const withAbility = (ability: string): LoadedRecord => ({
      ...wizard,
      record: {
        ...wizard.record,
        system: {
          ...wizard.record.system,
          casting: { ...readObject(wizard.record.system.casting), ability },
        },
      },
    });
    expect(
      ['str', 'dex', 'con', 'int', 'wis', 'cha'].map(
        (code) => importClass(withAbility(code)).detail.casting?.ability,
      ),
    ).toEqual([
      'strength',
      'dexterity',
      'constitution',
      'intelligence',
      'wisdom',
      'charisma',
    ]);
    // An unknown code is refused, never guessed, even one that is a stored
    // name: the class keeps Foundry's value and reports it.
    for (const code of ['int2', 'intelligence']) {
      const unknown = importClass(withAbility(code));
      expect(unknown.detail.casting?.ability, code).toBe(code);
      expect(unknown.unsupported, code).toContainEqual({
        field: 'casting.ability',
        reason: 'Unknown Foundry casting ability code.',
        value: code,
      });
    }
  });

  it('fails a class with an unknown ability code at the gate, so it never converts', async () => {
    const file = 'packs/classes/wizard.0c4lYDywj6bQ0i8r.yaml';
    const tree = await materializePinnedTree([`pf1/${file}`]);
    try {
      const path = join(tree.systemPath, file);
      const original = await readFile(path, 'utf8');
      expect(original).toContain('    ability: int\n');
      for (const code of ['int2', 'intelligence']) {
        await writeFile(
          path,
          original.replace('    ability: int\n', `    ability: ${code}\n`),
        );
        const artifact = await importCatalog({
          systemPath: tree.systemPath,
          contentPath: tree.contentPath,
          remaps: [],
        });
        const gate = assessCatalogAdmission({
          artifact,
          assessments: [],
          evidence: {},
          registry: {},
        });
        expect(gate.failures, code).toContainEqual({
          externalKey: 'pf1/0c4lYDywj6bQ0i8r',
          reason: `Unknown casting ability code: ${code}.`,
        });
      }
    } finally {
      await tree.dispose();
    }
  });
});
