import preparedSpells from '../data/preparedSpellCatalog.json';
import {
  importedCatalogEntrySchema,
  importedSpellDetailSchema,
} from '../../src/lib/catalog/imported-entry-schema';

// Exact normalized Spells from the #253 importer demonstration, not a release.
export const representativeSpellCatalog = importedCatalogEntrySchema
  .extend({ detail: importedSpellDetailSchema })
  .array()
  .parse(preparedSpells);
