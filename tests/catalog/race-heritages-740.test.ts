// @vitest-environment node
import { expect, test } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';
import { buildAssessmentBinding } from '../../scripts/catalog/admission';
import { importCatalog } from '../../scripts/catalog/import';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { raceAbilityTraitKey } from '../../scripts/catalog/racial-trait-rules';
import { materializePinnedTree } from './pinned-sources';
import {
  alternateRow,
  raceSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-719/sheet';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
} from '../../src/lib/character-sheet';
import cases from '../fixtures/race-import-740/heritages.json';

test.each(
  cases.filter((source) => source.mapping !== 'withheld-source-conflict'),
)(
  '$name replaces the base ability line once and restores it on removal',
  async (source) => {
    const tree = await materializePinnedTree(
      [source.raceFile, source.path, ...source.folderFiles],
      { sha256: { [source.path]: source.sourceSha256 } },
    );
    try {
      const artifact = await importCatalog({
        ...tree,
        remaps: [],
        curation: reviewedCuration,
      });
      const definition = artifact.catalog.entries.find(
        (entry) => entry.externalKey === source.externalKey,
      );
      expect(definition?.detail).toMatchObject({
        replaces: [raceAbilityTraitKey(source.race)],
      });
      const definitions = artifact.catalog.entries.map(sheetDefinition);
      const alternate = alternateRow(source.externalKey);
      const input = raceSheet({
        race: source.race,
        definitions,
        entries: [alternate],
      });
      const result = calculateCharacterSheet(input);
      expect(
        abilityKeys.map((ability) => result.abilities[ability].score),
      ).toEqual(source.ordinaryScores);
      expect(
        result.resolvedEntries.find(
          (row) =>
            row.entry.kind === 'racialTrait' &&
            row.entry.catalogEntryId === raceAbilityTraitKey(source.race),
        )?.counting,
      ).toBe(false);
      for (const ability of abilityKeys)
        expect(
          result.breakdowns[abilityTargets[ability]].applied.filter(
            (row) => row.bonusType === 'racial',
          ).length,
        ).toBeLessThanOrEqual(1);
      if (source.shapechangedAbility) {
        expect(
          calculateCharacterSheet(input, {
            situations: [
              { local: 'while shapechanged', sheetEntryId: 'another-entry' },
            ],
          }).abilities,
        ).toEqual(result.abilities);
        const changed = calculateCharacterSheet(input, {
          situations: [
            { local: 'while shapechanged', sheetEntryId: alternate._id },
          ],
        });
        const index = abilityKeys.findIndex(
          (ability) => ability === source.shapechangedAbility,
        );
        expect(
          abilityKeys.map((ability) => changed.abilities[ability].score),
        ).toEqual(
          source.ordinaryScores.map(
            (score, at) => score + (at === index ? 2 : 0),
          ),
        );
      }
      const base = calculateCharacterSheet(
        raceSheet({ race: source.race, definitions }),
      );
      const inactive = calculateCharacterSheet({
        ...input,
        entries: input.entries.map((entry) =>
          entry.kind === 'racialTrait' && entry._id === alternate._id
            ? { ...entry, active: false }
            : entry,
        ),
      });
      expect(inactive.abilities).toEqual(base.abilities);
      expect(calculateCharacterSheet(input).abilities).toEqual(
        result.abilities,
      );
    } finally {
      await tree.dispose();
    }
  },
);

// The pinned Skinwalker baseline supplies +2 Wis / -2 Int. These are fallback
// totals, not a proposed implementation of either disputed heritage line.
test.each(
  cases.filter((source) => source.mapping === 'withheld-source-conflict'),
)(
  '$name preserves unresolved manual replacement and the baseline even while shapechanged',
  async (source) => {
    const tree = await materializePinnedTree(
      [source.raceFile, source.path, ...source.folderFiles],
      { sha256: { [source.path]: source.sourceSha256 } },
    );
    try {
      const artifact = await importCatalog({
        ...tree,
        remaps: [],
        curation: reviewedCuration,
      });
      const definition = artifact.catalog.entries.find(
        (entry) => entry.externalKey === source.externalKey,
      );
      expect(definition?.detail).toMatchObject({
        replaces: [],
        unresolvedReplacements: ['Base Statistics'],
      });
      expect(definition?.modifiers).toEqual([]);
      expect(definition?.description).toContain(source.line);
      const definitions = artifact.catalog.entries.map(sheetDefinition);
      const alternate = alternateRow(source.externalKey);
      const input = raceSheet({
        race: source.race,
        definitions,
        entries: [alternate],
      });
      const selected = calculateCharacterSheet(input);
      expect(
        abilityKeys.map((ability) => selected.abilities[ability].score),
      ).toEqual([10, 10, 10, 8, 12, 10]);
      expect(
        selected.resolvedEntries.find(
          (row) =>
            row.entry.kind === 'racialTrait' &&
            row.entry.catalogEntryId === raceAbilityTraitKey(source.race),
        )?.counting,
      ).toBe(true);
      expect(selected.warnings).toContainEqual(
        expect.objectContaining({ check: 'racialReplacementUnresolved' }),
      );
      const shapechanged = calculateCharacterSheet(input, {
        situations: [
          { local: 'while shapechanged', sheetEntryId: alternate._id },
        ],
      });
      expect(shapechanged.abilities).toEqual(selected.abilities);
      const removed = calculateCharacterSheet(
        raceSheet({ race: source.race, definitions }),
      );
      expect(removed.abilities).toEqual(selected.abilities);
      expect(
        removed.warnings.some(
          (warning) => warning.check === 'racialReplacementUnresolved',
        ),
      ).toBe(false);
      expect(calculateCharacterSheet(input).abilities).toEqual(
        selected.abilities,
      );
    } finally {
      await tree.dispose();
    }
  },
);

test.each(cases)(
  '$name rejects description drift as a source-bound ability claim',
  async (source) => {
    const tree = await materializePinnedTree(
      [source.raceFile, source.path, ...source.folderFiles],
      { sha256: { [source.path]: source.sourceSha256 } },
    );
    try {
      const path = join(
        tree.contentPath,
        source.path.replace('pf1-content/', ''),
      );
      const originalBytes = await readFile(path);
      expect(createHash('sha256').update(originalBytes).digest('hex')).toBe(
        source.sourceSha256,
      );
      const original = await importCatalog({
        ...tree,
        remaps: [],
        curation: reviewedCuration,
      });
      const originalEntry = original.catalog.entries.find(
        (entry) => entry.externalKey === source.externalKey,
      );
      if (!originalEntry) throw new Error('Missing original heritage');
      const binding = buildAssessmentBinding({
        entry: originalEntry,
        artifact: original,
        registry: {},
        evidence: {},
        requiredNotices: [],
        evidenceIds: [],
      });
      const changed = parse(originalBytes.toString('utf8'));
      changed.system.description.value += '<p>Changed source description.</p>';
      await writeFile(path, JSON.stringify(changed));
      const drift = await importCatalog({
        ...tree,
        remaps: [],
        curation: reviewedCuration,
      });
      const entry = drift.catalog.entries.find(
        (entry) => entry.externalKey === source.externalKey,
      );
      if (!entry) throw new Error('Missing drifted heritage');
      expect(entry.detail).toMatchObject({
        replaces: [],
        unresolvedReplacements: ['Base Statistics'],
      });
      expect(entry.modifiers).toEqual([]);
      expect(
        buildAssessmentBinding({
          entry,
          artifact: drift,
          registry: {},
          evidence: {},
          requiredNotices: [],
          evidenceIds: [],
        }).contentFingerprint,
      ).not.toBe(binding.contentFingerprint);
    } finally {
      await tree.dispose();
    }
  },
);
