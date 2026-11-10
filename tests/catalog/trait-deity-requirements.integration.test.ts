/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { preview as traits370 } from '../fixtures/traits-370/data';
import { preview as traits371 } from '../fixtures/traits-371/data';
import { preview as traits373 } from '../fixtures/traits-373/data';
import { preview as traits375 } from '../fixtures/traits-375/data';
import { preview as traits376 } from '../fixtures/traits-376/data';
import { preview as traits378 } from '../fixtures/traits-378/data';
import { preview as traits379 } from '../fixtures/traits-379/data';
import { preview as traits384 } from '../fixtures/traits-384/data';
import { preview as traits385 } from '../fixtures/traits-385/data';

const modules = import.meta.glob('../../convex/**/*.ts');

/**
 * trait-reqs-cd (route C): the TR1 traits whose Requirements line names one
 * reviewed deity, each from its batch's committed fixture entry (the entry
 * each batch test ties to a fresh import), with the deity it requires.
 */
const rows = [
  [traits371, 'Loreseeker (Lissala)', 'Lissala'],
  [traits371, 'Magic is Life (Nethys)', 'Nethys'],
  [traits384, 'Patient Optimist (Erastil)', 'Erastil'],
  [traits370, 'Starchild (Desna)', 'Desna'],
  [traits385, 'Fortified Drinker (Cayden Cailean)', 'Cayden Cailean'],
  [traits375, 'Undead Slayer (Pharasma)', 'Pharasma'],
  [traits373, 'Asmodean Demon Hunter (Asmodeus)', 'Asmodeus'],
  [traits371, 'Wisdom in the Flesh (Irori)', 'Irori'],
  [traits376, 'Flame of the Dawnflower (Sarenrae)', 'Sarenrae'],
  [traits378, 'Child of Nature (Gozreh)', 'Gozreh'],
  [traits379, 'Calistrian Courtesan (Calistria)', 'Calistria'],
] as const;

function fixtureEntry(preview: { entries: readonly unknown[] }, name: string) {
  const entry = importedCatalogEntrySchema.parse(
    preview.entries.find(
      (candidate) =>
        typeof candidate === 'object' &&
        candidate !== null &&
        'name' in candidate &&
        candidate.name === name,
    ),
  );
  const { detail } = entry;
  if (detail.kind !== 'trait') throw new Error(`${name} is no trait`);
  return { ...entry, detail };
}

test.each(rows.map(([preview, name, deity]) => ({ preview, name, deity })))(
  'the saved sheet checks $name’s deity Requirements: unresolved with no deity, unmet with another, met with its own',
  async ({ preview, name, deity }) => {
    const entry = fixtureEntry(preview, name);
    // The importer structures the Requirements line as the deity clause.
    expect(entry.prerequisiteText).toBe(deity);
    expect(entry.prerequisites).toEqual([{ kind: 'deity', deity }]);
    const t = convexTest(schema, modules);
    const campaignId = await t.run(async (ctx) => {
      await ctx.db.insert('user', {
        tokenIdentifier: 'trcd|owner',
        orgIds: [{ orgId: 'org', role: 'member' }],
        characterSheetDemo: true,
      });
      return ctx.db.insert('campaign', {
        name: 'Deity Requirements',
        description: '',
        organizationId: 'org',
        ownerId: 'trcd|owner',
        e2eFixture: {
          namespace: 'trait-reqs-cd',
          version: 1,
          workerKey: '0',
          caseKey: 'deity',
          campaignKey: 'deity',
        },
      });
    });
    const owner = t.withIdentity({ tokenIdentifier: 'trcd|owner' });
    const characterId = await owner.mutation(api.characterSheet.create, {
      organizationId: 'org',
      campaignId,
      name: 'Faithful',
      kind: 'pc',
      operationId: 'create',
    });
    const scope = { organizationId: 'org', campaignId, characterId };
    const catalogEntryId = await t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        name: entry.name,
        ruleIdentity: entry.externalKey,
        description: entry.description,
        sources: entry.sources,
        prerequisiteText: entry.prerequisiteText,
        prerequisites: entry.prerequisites,
        modifiers: [],
        detail: entry.detail,
        stacksWithItself: false,
      }),
    );
    const entryId = await owner.mutation(api.characterSheet.fillSelectionSlot, {
      ...scope,
      slotId: 'trait:general',
      position: 0,
      catalogEntryId,
      operationId: 'select',
    });
    let edits = 0;
    const record = (name: string) =>
      owner.mutation(api.characterSheet.editCreationSettings, {
        ...scope,
        settings: {},
        deity: name,
        operationId: `deity-${(edits += 1)}`,
      });
    /** The Selection's current clause results and its prerequisite warnings. */
    const verdict = async () => {
      const sheet = withSheetCatalog(
        await owner.query(api.characterSheet.read, scope),
      );
      if (!sheet) throw new Error('Missing saved sheet');
      expect(
        sheet.catalogEntries.find((row) => row._id === catalogEntryId)
          ?.prerequisites,
      ).toEqual([{ kind: 'deity', deity }]);
      return {
        met: sheet.calculated.prerequisites
          .filter((row) => row.entryId === entryId && row.view === 'current')
          .map((row) => row.met),
        warnings: sheet.calculated.warnings
          .filter(
            (warning) =>
              warning.check.startsWith('prerequisites.') &&
              warning.target.kind === 'entry' &&
              warning.target.entryId === entryId,
          )
          .map((warning) => warning.check),
      };
    };
    const unmet = { met: [false], warnings: ['prerequisites.current'] };
    const met = { met: [true], warnings: [] };
    // No deity recorded: the clause can't be checked, and says so without a
    // warning.
    expect(await verdict()).toEqual({ met: [null], warnings: [] });
    // No row requires Iomedae, the one deity reviewed before route C.
    const other = 'Iomedae';
    await record(other);
    expect(await verdict()).toEqual(unmet);
    await record(` ${deity.toUpperCase()} `);
    expect(await verdict()).toEqual(met);
    await record(other);
    expect(await verdict()).toEqual(unmet);
  },
);
