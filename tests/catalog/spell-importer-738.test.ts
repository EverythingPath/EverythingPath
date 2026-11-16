// @vitest-environment node
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';
import { importCatalog } from '../../scripts/catalog/import';
import { mapEntry } from '../../scripts/catalog/map';
import { upstreamRecord } from '../../scripts/catalog/records';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import { materializePinnedTree, pinnedPath } from './pinned-sources';

/**
 * #738: the spell importer reads pinned pf1 v11 descriptors and keeps
 * journal-page links into the rules journals as the text they label. Every
 * record is a pinned Foundry PF1 v11.11 or pf1-content 11.4.0 file from the
 * shared store.
 */
const spells = 'pf1/packs/spells';
const files = {
  // Cause Fear (CRB p. 251); pinned Emotion comes from Ultimate Magic.
  causeFear: `${spells}/cause-fear.9tww9fc9049h6iqc.yaml`,
  // [acid, electricity, or fire]: one free-text entry (#542).
  hellmouthLash: `${spells}/hellmouth-lash.vct8uncenmmkf0up.yaml`,
  // No descriptors: the record has no `descriptors` field.
  abeyance: `${spells}/abeyance.iwkrfp38hdgovoj7.yaml`,
  // `Compendium.pf1.pf1e-rules.<entry>.JournalEntryPage.<page>`.
  wingThorns: `${spells}/wing-thorns.wMX7ZG4zBkB873bo.yaml`,
  // `Compendium.pf1.rules.JournalEntry.<entry>.JournalEntryPage.<page>#radiation`.
  irradiate: `${spells}/irradiate.vhnguobyolslgepm.yaml`,
  // The same form, on #506's natural attacks.
  bite: 'pf1/packs/monster-abilities/bite.szjeStouwI3F3WdP.yaml',
  // #431's bag of tricks:
  // `Compendium.pf1.pf1e-rules.JournalEntry.<entry>.JournalEntryPage.<page>`.
  bagOfTricks: 'pf1/packs/items/bag-of-tricks-rust.MxTsmNfAx9OephZX.yaml',
  // `Compendium.pf-content.pf-rules.JournalEntry.<entry>`, no page.
  abendegoPilot:
    'pf1-content/src/pf-traits/Abendego_Pilot__Eye_of_Abendego__Sylph__ggGeZU7iH0vmOunL.yaml',
} as const;
const keys = {
  causeFear: 'pf1/9tww9fc9049h6iqc',
  hellmouthLash: 'pf1/vct8uncenmmkf0up',
  abeyance: 'pf1/iwkrfp38hdgovoj7',
  wingThorns: 'pf1/wMX7ZG4zBkB873bo',
  irradiate: 'pf1/vhnguobyolslgepm',
  bite: 'pf1/szjeStouwI3F3WdP',
  bagOfTricks: 'pf1/MxTsmNfAx9OephZX',
  abendegoPilot: 'pf1-content/ggGeZU7iH0vmOunL',
} as const;

let tree: Awaited<ReturnType<typeof materializePinnedTree>>;
let imported: Awaited<ReturnType<typeof importCatalog>>;
beforeAll(async () => {
  tree = await materializePinnedTree(Object.values(files));
  imported = await importCatalog({ ...tree, remaps });
});
afterAll(async () => {
  await tree.dispose();
});
const entryOf = (key: string) => {
  const entry = imported.catalog.entries.find((row) => row.externalKey === key);
  if (!entry) throw new Error(`Missing ${key}`);
  return entry;
};
const descriptorsOf = (key: string) => {
  const { detail } = entryOf(key);
  if (detail.kind !== 'spell') throw new Error(`${key} is no Spell`);
  return detail.descriptors;
};

describe('spell descriptors (#738, IM-01)', () => {
  it('imports the descriptor keys pinned pf1 v11 stores in system.descriptors', () => {
    expect(descriptorsOf(keys.causeFear)).toEqual([
      'emotion',
      'fear',
      'mindAffecting',
    ]);
  });

  it('keeps a free-text descriptor entry as published', () => {
    expect(descriptorsOf(keys.hellmouthLash)).toEqual([
      'acid, electricity, or fire',
    ]);
  });

  it('imports no descriptors for a Spell whose record has none', () => {
    expect(descriptorsOf(keys.abeyance)).toEqual([]);
  });

  it('falls back to the pre-v10 system.types string', async () => {
    // Cause Fear's descriptors in the shape Foundry migrates from
    // (pf1 module/migration.mjs, _migrateSpellDescriptors): `system.types`.
    const record = upstreamRecord.parse(
      parse(
        await readFile(pinnedPath('pf1', files.causeFear.slice(4)), 'utf8'),
      ),
    );
    const { descriptors: _, ...system } = record.system;
    const entry = mapEntry({
      source: {
        repo: 'pf1',
        pack: 'spells',
        path: files.causeFear.slice(4),
        record: {
          ...record,
          system: { ...system, types: 'emotion; fear; mind-affecting' },
        },
      },
      kind: 'spell',
      resolveKey: () => undefined,
      lookup: new Map(),
      spellClassTags: new Set(),
    });
    expect(entry.detail).toMatchObject({
      kind: 'spell',
      descriptors: ['emotion', 'fear', 'mind-affecting'],
    });
  });
});

describe('journal target validation (#738 S3)', () => {
  it.each([
    ['Compendium.pf1.rules.JournalEntry.Missing', true],
    [
      'Compendium.pf1.rules.JournalEntry.Missing.JournalEntryPage.7LwCMwrX3tchvrjW',
      true,
    ],
    [
      'Compendium.pf1.rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.Missing',
      true,
    ],
    ['Compendium.pf-content.pf-rules.JournalEntry.Missing', true],
    ['Compendium.pf1.rules.JournalEntry.NSqfXaj4MevUR2uJ', false],
    [
      'Compendium.pf1.rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.7LwCMwrX3tchvrjW#sickened',
      false,
    ],
    [
      'Compendium.pf1.pf1e-rules.NSqfXaj4MevUR2uJ.JournalEntryPage.7LwCMwrX3tchvrjW',
      false,
    ],
    ['Compendium.pf-content.pf-rules.TGNihLM3XTYgf6MV', false],
  ])(
    'keeps escaped text and diagnoses unresolved target %s',
    async (uuid, unresolved) => {
      // Fault-injection into a temporary copy of the pinned Wing Thorns spell.
      const isolated = await materializePinnedTree([files.wingThorns]);
      try {
        const record = upstreamRecord.parse(
          parse(
            await readFile(
              pinnedPath('pf1', files.wingThorns.slice(4)),
              'utf8',
            ),
          ),
        );
        record.system.description = {
          value: `<p>@UUID[${uuid}]{&lt;unsafe &amp; label&gt;}</p>`,
        };
        await writeFile(
          join(isolated.systemPath, files.wingThorns.slice(4)),
          stringify(record),
        );
        const result = await importCatalog({ ...isolated, remaps });
        const entry = result.catalog.entries.find(
          (row) => row.externalKey === keys.wingThorns,
        );
        expect(entry?.description).toBe('<p>&lt;unsafe &amp; label&gt;</p>');
        expect(
          entry?.unsupported.filter(
            (issue) => issue.field === 'description.link',
          ),
        ).toEqual(
          unresolved
            ? [
                {
                  field: 'description.link',
                  reason: 'Unresolved catalog link stripped.',
                  value: uuid,
                },
              ]
            : [],
        );
      } finally {
        await isolated.dispose();
      }
    },
  );
});

describe('journal-page links (#738, IM-02)', () => {
  // Links into mapped packs the tree lacks, such as the bag of tricks' link
  // to Summon Nature's Ally III, still strip: only journal links are counted.
  const linkDiagnostics = (key: string) =>
    entryOf(key).unsupported.filter(
      (issue) =>
        issue.field === 'description.link' &&
        String(issue.value).includes('Journal'),
    );

  it('keeps a Spell’s link to a rules journal page as its label, with no broken reference', () => {
    const entry = entryOf(keys.wingThorns);
    expect(entry.description).toContain('sickened');
    expect(entry.description).not.toContain('Reference unavailable');
    expect(linkDiagnostics(keys.wingThorns)).toEqual([]);
    expect(linkDiagnostics(keys.irradiate)).toEqual([]);
    expect(entryOf(keys.irradiate).description).toContain('radiation');
  });

  it('resolves the natural attacks’ and bag of tricks’ journal-page links too', () => {
    expect(linkDiagnostics(keys.bite)).toEqual([]);
    expect(entryOf(keys.bite).description).toMatch(/Natural\s+Attacks/);
    expect(linkDiagnostics(keys.bagOfTricks)).toEqual([]);
    expect(entryOf(keys.bagOfTricks).description).toMatch(/Handle\s+Animal/);
  });

  it('resolves a link to a whole pf-content rules journal entry', () => {
    expect(linkDiagnostics(keys.abendegoPilot)).toEqual([]);
    expect(entryOf(keys.abendegoPilot).description).toContain('Wind');
  });
});
