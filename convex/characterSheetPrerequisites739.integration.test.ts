// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { importCatalog } from '../scripts/catalog/import';
import { assessCatalogAdmission } from '../scripts/catalog/admission';
import { reviewedCuration } from '../scripts/catalog/reviewed-curation-data';
import { reviewedAdmission } from '../src/lib/catalog/reviewed-data';
import {
  canonicalReleaseJson,
  parseReleaseJson,
} from '../src/lib/catalog/release-schema';
import { materializePinnedTree } from '../tests/catalog/pinned-sources';
import {
  activationArgs,
  prepare,
  reconcile,
  releaseFixture,
} from '../tests/catalog-release-fixture';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');
const targetFiles = [
  'pf1-content/src/pf-feats/Ironhide_bX7KwmeNRQv2tBTh.yaml',
  'pf1-content/src/pf-feats/Elemental_Strike_hKUr4z34XChiYgY1.yaml',
  'pf1-content/src/pf-feats/Bull_Catcher_Wrangler_htoNOEwtY5Reb7pa.yaml',
  'pf1-content/src/pf-feats/Manipulative_Presence_hB5R3di0387Zb2Uk.yaml',
  'pf1-content/src/pf-feats/Crisis_of_Conscience_kIwMlVVYDRfoLLrH.yaml',
  'pf1-content/src/pf-feats/Ace_Disarm_kty3YnZbUWwB3gUR.yaml',
  'pf1-content/src/pf-feats/Greater_Elemental_Focus_l4yE4RGFbORuDfp7.yaml',
];
const targetKeys = [
  'pf1-content/bX7KwmeNRQv2tBTh',
  'pf1-content/hKUr4z34XChiYgY1',
  'pf1-content/htoNOEwtY5Reb7pa',
  'pf1-content/hB5R3di0387Zb2Uk',
  'pf1-content/kIwMlVVYDRfoLLrH',
  'pf1-content/kty3YnZbUWwB3gUR',
  'pf1-content/l4yE4RGFbORuDfp7',
];

test('pinned prerequisite repairs survive isolated release conversion and public saved-sheet reads while real content stays held', async () => {
  const tree = await materializePinnedTree([
    ...targetFiles,
    'pf1/packs/races/ifrit.TPHe88Yhy4SsDpKo.yaml',
    'pf1/packs/races/oread.4qEXPDlfIj1cIvCe.yaml',
    'pf1/packs/races/sylph.pbX1xj9Z0ZhUfKvZ.yaml',
    'pf1/packs/races/undine.iqJvhd7NbmybUl0y.yaml',
    'pf1-content/src/pf-feats/Bull_Catcher_Style_QmQVSgZBDBcECMRz.yaml',
    'pf1-content/src/pf-feats/Bull_Catcher_Toss_HjPc9WT7tHZfSOuL.yaml',
    'pf1/packs/feats/improved-grapple.ZmQkRk93nbHxsQSt.yaml',
    'pf1/packs/feats/improved-unarmed-strike.2aTFNMs3pW6nUBlr.yaml',
    'pf1/packs/classes/brawler.iDlGMIezGuqqt8Us.yaml',
    'pf1/packs/classes/monk.W8dxwZ1CZiwLKsqr.yaml',
    'pf1/packs/class-abilities/brawler.5K2nfB7kaAhKEruh.yaml',
    'pf1-content/src/pf-class-abilities/Monk_hDdONmiC8ZlK1pXt.yaml',
    'pf1/packs/races/dwarf.nEltI9y37rKJTeWo.yaml',
    'pf1/packs/races/half-orc.dCAXgdA6Db1Z3ccz.yaml',
    'pf1/packs/races/orc.JOuAdPAOTat7d5v6.yaml',
    'pf1-content/src/pf-racial-traits/Dwarf_cHfF0MzvRePtnPBS.yaml',
    'pf1-content/src/pf-racial-traits/Orc_l7CqdrmNxsmEsBBG.yaml',
    'pf1-content/src/pf-feats/Elemental_Focus_1frgqDSnQFiTq0MC.yaml',
    'pf1/packs/class-abilities/elemental-focus.x9TM9MHoUl4cv9Ht.yaml',
    'pf1/packs/classes/kineticist.vh9TZBE6BRu9sCfE.yaml',
    'pf1-content/src/pf-feats/Ranged_Disarm_Y0QdKaSOgwgVWFgL.yaml',
    'pf1/packs/feats/deadly-aim.K4FEFu94JKOP2l51.yaml',
  ]);
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps: [],
      candidateKeys: targetKeys,
      curation: {
        records: reviewedCuration.records.filter((row) =>
          targetKeys.includes(row.externalKey),
        ),
        situations: reviewedCuration.situations,
      },
    });
    const admission = assessCatalogAdmission({
      artifact,
      ...reviewedAdmission,
    });
    expect(admission.admitted).toEqual([]);
    expect(admission.held.map((row) => row.externalKey).sort()).toEqual(
      [...targetKeys].sort(),
    );
    const imported = artifact.catalog.entries;
    expect(imported).toHaveLength(7);
    expect(
      imported.find((row) => row.name === 'Greater Elemental Focus')
        ?.prerequisites,
    ).toEqual([{ kind: 'feat', feat: 'pf1-content/1frgqDSnQFiTq0MC' }]);
    expect(
      imported.find((row) => row.name === 'Ace Disarm')?.prerequisites?.[2],
    ).toEqual({ kind: 'feat', feat: 'pf1-content/Y0QdKaSOgwgVWFgL' });

    // The fixture's legal reports qualify transport only; the admission above is unchanged.
    const { t, owner, outsider, scope } = await releaseFixture(modules);
    const ids = await t.run(async (ctx) => {
      const rows: Record<string, Id<'catalogEntry'>> = {};
      for (const entry of imported)
        rows[entry.externalKey] = await ctx.db.insert('catalogEntry', {
          scope: 'global',
          ruleIdentity: entry.externalKey,
          name: entry.name,
          stacksWithItself: false,
          sources: [],
          modifiers: [],
          detail: { kind: 'feat' },
        });
      return rows;
    });
    await prepare(
      t,
      imported.map((entry) => ({
        kind: 'definition',
        key: entry.externalKey,
        payload: parseReleaseJson(JSON.parse(canonicalReleaseJson(entry))),
      })),
    );
    const runId = await reconcile(t, scope.characterId);
    await t.mutation(
      internal.catalogReleaseActivation.activate,
      activationArgs(runId),
    );
    await owner.mutation(api.characterSheet.editCreationSettings, {
      ...scope,
      settings: {},
      alignment: 'LN',
      operationId: 'alignment',
    });
    const savedIds: Id<'characterSheetEntry'>[] = [];
    for (const entry of imported) {
      const catalogEntryId = ids[entry.externalKey];
      if (!catalogEntryId) throw new Error('Missing fixture catalog identity');
      savedIds.push(
        await owner.mutation(api.characterSheet.selectEntry, {
          ...scope,
          catalogEntryId,
          operationId: `select-${entry.externalKey}`,
        }),
      );
    }
    const saved = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!saved) throw new Error('Missing saved sheet');
    for (const entry of imported) {
      const stored = saved.catalogEntries.find(
        (row) => row.ruleIdentity === entry.externalKey,
      );
      expect(stored?.prerequisites).toEqual(entry.prerequisites);
      expect(stored?.prerequisiteText).toBe(entry.prerequisiteText);
      expect(stored?.description).toBe(entry.description);
    }
    const ironhide =
      savedIds[imported.findIndex((row) => row.name === 'Ironhide')];
    const crisis =
      savedIds[
        imported.findIndex((row) => row.name === 'Crisis of Conscience')
      ];
    expect(
      saved.entries.filter((row) => savedIds.includes(row._id)),
    ).toHaveLength(7);
    expect(
      saved.calculated.prerequisites
        .filter((row) => row.entryId === ironhide && row.view === 'current')
        .map((row) => row.met),
    ).toEqual([false, null]);
    expect(
      saved.calculated.prerequisites
        .filter((row) => row.entryId === crisis && row.view === 'current')
        .map((row) => row.met),
    ).toEqual([true, null]);
    expect(
      saved.calculated.warnings.some(
        (row) =>
          row.check === 'prerequisites.current' &&
          row.subject.startsWith(`${ironhide}:`),
      ),
    ).toBe(true);
    expect(
      withSheetCatalog(
        await owner.query(api.characterSheet.read, scope),
      )?.entries.filter((row) => savedIds.includes(row._id)),
    ).toEqual(saved.entries.filter((row) => savedIds.includes(row._id)));
    await expect(
      outsider.query(api.characterSheet.read, scope),
    ).rejects.toThrow();
  } finally {
    await tree.dispose();
  }
});
