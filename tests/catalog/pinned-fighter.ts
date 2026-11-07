import { importCatalog } from '../../scripts/catalog/import';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import { materializePinnedTree } from './pinned-sources';

/**
 * S3: the CRB Fighter (pp. 55-57) and its seven features, Armor Mastery
 * included, from the pinned store. Its reviewed schedule gives it 27 rows,
 * 20 of them increments the importer emits with it.
 */
export const fighter = 'pf1/WLqBCT5DqmGAx8Wd';
export const fighterFeatures = {
  bonusFeats: 'pf1/CV8BsY3ciUb9TA1Y',
  bravery: 'pf1/h0Brxw6khcjlEf1T',
  armorTraining: 'pf1/5JFfSqLMCpbRmERa',
  weaponTraining: 'pf1/RzEzudurxQFirFoF',
  heavyArmor: 'pf1/iqeyCQIIVnNt0p3h',
  armorMastery: 'pf1/NwTe1Q2utlsmOAqK',
  weaponMastery: 'pf1/McXAM1BoPHZLO1n4',
};
const files = [
  'classes/fighter.WLqBCT5DqmGAx8Wd.yaml',
  'class-abilities/bonus-feats-fgt.CV8BsY3ciUb9TA1Y.yaml',
  'class-abilities/bravery.h0Brxw6khcjlEf1T.yaml',
  'class-abilities/armor-training.5JFfSqLMCpbRmERa.yaml',
  'class-abilities/weapon-training.RzEzudurxQFirFoF.yaml',
  'class-abilities/armor-training-heavy-armor.iqeyCQIIVnNt0p3h.yaml',
  'class-abilities/armor-mastery.NwTe1Q2utlsmOAqK.yaml',
  'class-abilities/weapon-mastery.McXAM1BoPHZLO1n4.yaml',
].map((file) => `pf1/packs/${file}`);

/** The importer's artifact for the pinned Fighter, with the committed curation. */
export async function importPinnedFighter() {
  const tree = await materializePinnedTree(files);
  try {
    return await importCatalog({
      systemPath: tree.systemPath,
      contentPath: tree.contentPath,
      remaps: [],
      curation,
    });
  } finally {
    await tree.dispose();
  }
}
