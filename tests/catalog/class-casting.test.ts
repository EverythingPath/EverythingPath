// @vitest-environment node
import { readFile, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import { importCatalog } from '../../scripts/catalog/import';
import { mapEntry } from '../../scripts/catalog/map';
import type { LoadedRecord } from '../../scripts/catalog/records';
import { readObject } from '../../scripts/catalog/values';
import { findReviewedClassCasting } from '../../src/lib/character-sheet-casting-tables';
import { loadPinnedClass } from './pinned-classes';
import { materializePinnedTree } from './pinned-sources';

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

/**
 * The 44 class records the store held when this test was written, pinned so
 * a store addition (pbl-catalog-digest added the Gunslinger, no caster)
 * leaves the casters it checks as they were.
 */
const pinnedClassFiles = [
  'adept.5nxfoXZ5KpOFYpLm.yaml',
  'alchemist.JcaqlAawhf14q1lq.yaml',
  'antipaladin.uynVENa0deVdmf53.yaml',
  'arcanist.GK6rAenFfgJNNJCX.yaml',
  'barbarian-unchained.W3EjUgYLJ1D9qDKw.yaml',
  'barbarian.g3pq7xWWdUVYw6ai.yaml',
  'bard.6GjOjO6r3R06fLwE.yaml',
  'bloodrager.E27lMw9YNOAjS009.yaml',
  'brawler.iDlGMIezGuqqt8Us.yaml',
  'cavalier.u1ed3H9xtYQXTP5v.yaml',
  'cleric.SjFqQceVeVBzBwgn.yaml',
  'druid.7eZQP0MzeO2svmVF.yaml',
  'fighter.WLqBCT5DqmGAx8Wd.yaml',
  'hunter.Immo2BuSe5WGdRW9.yaml',
  'inquisitor.Fv3FbmXptuDRiL5y.yaml',
  'investigator.s27zdYVFenYBVtfu.yaml',
  'kineticist.vh9TZBE6BRu9sCfE.yaml',
  'magus.xZLcyrEKYZoJPS2k.yaml',
  'medium.xtRbNEKYYq4cRiwI.yaml',
  'mesmerist.fLU25FvuRWMCSxPP.yaml',
  'monk-unchained.5mQIOIw4hDhlREPo.yaml',
  'monk.W8dxwZ1CZiwLKsqr.yaml',
  'ninja.DGDOm05afSJj454X.yaml',
  'occultist.5uUzVl0gLZ23vY96.yaml',
  'oracle.5S0u8yFcP861wgd1.yaml',
  'paladin.ohptcds1d5oG6Bjh.yaml',
  'psychic.0ahLHNR2864mih3n.yaml',
  'ranger.w3wjj6s3N69BsMc3.yaml',
  'rogue-unchained.5tsZI6zk29yX1ckA.yaml',
  'rogue.24b0LaabeAlUx5gN.yaml',
  'samurai.yM8xfml1Xrccfwux.yaml',
  'shaman.jMi3GBtvdG0WhH8L.yaml',
  'shifter.16mfrGi2UHTsME4W.yaml',
  'skald.G2SqFdNKFxbujzbH.yaml',
  'slayer.cOY76lMUkupH534m.yaml',
  'sorcerer.AoWSbnuTSGIxmv61.yaml',
  'spiritualist.iYAQs7zjFbgcmect.yaml',
  'summoner-unchained.5iDrtRQMuIhLymUA.yaml',
  'summoner.BrnHPJ2EVSQSyNQ8.yaml',
  'swashbuckler.Q3rbWILULpQfpjjZ.yaml',
  'vigilante.Yf5Wv9X09SUHYCqM.yaml',
  'warpriest.KgxFsHNv0g1GbvmS.yaml',
  'witch.RC4D4WFT5kRKkdqp.yaml',
  'wizard.0c4lYDywj6bQ0i8r.yaml',
];

describe('imported class casting', () => {
  it('gives every pinned caster its reviewed casting’s ability, kind, offset and type', async () => {
    const directory = 'packs/classes';
    const files = pinnedClassFiles.map((name) => `${directory}/${name}`);
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
          wholeCorpus: false,
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
