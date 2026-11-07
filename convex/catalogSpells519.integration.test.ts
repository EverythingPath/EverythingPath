/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { spellFixture } from '../tests/fixtures/spells-519/sheet';
import { calculateCharacterSheetPreview } from '../src/components/character-sheet/calculate-character-sheet-preview';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

test.each([
  {
    className: 'Wizard',
    spells: [
      ['Magic Missile', 1],
      ['Spider Climb', 2],
    ],
  },
] as const)(
  'an isolated $className collection roundtrips real held Spell metadata through public writers',
  async ({ className, spells }) => {
    const t = convexTest(schema, modules);
    const campaignId = await t.run(async (ctx) => {
      for (const [name, orgId] of [
        ['owner', 'org'],
        ['member', 'org'],
        ['outsider', 'other'],
      ] as const) {
        await ctx.db.insert('user', {
          tokenIdentifier: `spell519|${name}`,
          orgIds: [{ orgId, role: 'member' }],
          characterSheetDemo: true,
        });
      }
      return ctx.db.insert('campaign', {
        name: 'Isolated held Spells #519',
        description: '',
        organizationId: 'org',
        ownerId: 'spell519|owner',
        e2eFixture: {
          namespace: 'spells-519',
          version: 1,
          workerKey: '0',
          caseKey: className,
          campaignKey: className,
        },
      });
    });
    const owner = t.withIdentity({ tokenIdentifier: 'spell519|owner' });
    const member = t.withIdentity({ tokenIdentifier: 'spell519|member' });
    const outsider = t.withIdentity({ tokenIdentifier: 'spell519|outsider' });
    const characterId = await owner.mutation(api.characterSheet.create, {
      organizationId: 'org',
      campaignId,
      name: 'Source-backed Spell collection preview',
      kind: 'pc',
      operationId: 'create-spells-519',
    });
    const scope = { organizationId: 'org', campaignId, characterId };
    const initial = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
    const castingClass = initial?.catalogEntries.find(
      (entry) => entry.name === className && entry.detail.kind === 'class',
    );
    if (!level) throw new Error('Missing initial class level');
    if (!castingClass) throw new Error('Missing Wizard baseline');
    const castingClassId = castingClass._id;
    await member.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId: level._id,
      classEntryId: castingClassId,
      operationId: 'class-baseline',
    });
    await member.mutation(api.characterSheet.editBaseScores, {
      ...scope,
      scores: { strength: 10, intelligence: 14, wisdom: 14 },
      operationId: 'base-scores',
    });
    const baseline = await owner.query(api.characterSheet.read, scope);
    if (!baseline) throw new Error('Missing baseline calculation');
    // The internal writer installs only into this convex-test Character catalog.
    // No shipping permission, running Spell Effect or Catalog Release is created.
    const spellIds = await owner.mutation(
      internal.characterSheetSpells.installPreparedCatalog,
      {
        ...scope,
        spells: spells.map(([name]) => spellFixture(name)),
        operationId: 'isolated-spell-catalog',
      },
    );
    const filters = { ...scope, castingClassId };
    const recordedIds: Id<'characterSheetEntry'>[] = [];
    for (const [index, [name, spellLevel]] of spells.entries()) {
      const catalogEntryId = spellIds[index];
      if (!catalogEntryId) throw new Error(`Missing installed Spell: ${name}`);
      const page = await member.query(api.characterSheetSpells.browse, {
        ...filters,
        spellLevel,
        paginationOpts: { cursor: null, numItems: 25 },
      });
      expect(page.page).toContainEqual(
        expect.objectContaining({
          catalogEntryId,
          name,
          spellLevel,
          school: spellFixture(name).detail.school,
        }),
      );
      const entryId = await member.mutation(api.characterSheetSpells.record, {
        ...filters,
        catalogEntryId,
        operationId: `record-${index}`,
      });
      recordedIds.push(entryId);
      const saved = withSheetCatalog(
        await owner.query(api.characterSheet.read, scope),
      );
      if (!saved) throw new Error('Missing isolated saved sheet');
      expect(
        saved.entries.find((entry) => entry._id === entryId),
      ).toMatchObject({
        kind: 'spell',
        state: {
          kind: 'spell',
          castingClassId,
          level: spellLevel,
        },
      });
      const fixture = spellFixture(name);
      expect(
        saved.catalogEntries.find((entry) => entry._id === catalogEntryId),
      ).toMatchObject({
        ruleIdentity: fixture.externalKey,
        sources: fixture.sources,
        modifiers: [],
        detail: {
          kind: 'spell',
          levels: fixture.detail.levels,
          school: fixture.detail.school,
        },
      });
      const collection = saved.calculated.spellCollections.collections.find(
        (row) => row.classEntryId === castingClassId,
      );
      expect(collection).toMatchObject({
        heading: 'Spellbook',
      });
      expect(JSON.stringify(collection)).toContain(entryId);
      expect(saved.calculated.abilities).toEqual(baseline.calculated.abilities);
      expect(saved.calculated.derivedStatistics).toEqual(
        baseline.calculated.derivedStatistics,
      );
      expect(saved.permanentCalculated.abilities).toEqual(
        baseline.permanentCalculated.abilities,
      );
      expect(saved.calculated.spellEffects).toEqual(
        baseline.calculated.spellEffects,
      );
      expect(calculateCharacterSheetPreview(saved).abilities).toEqual(
        saved.calculated.abilities,
      );
      expect(
        (await member.query(api.characterSheet.read, scope))?.calculated
          .abilities,
      ).toEqual(saved.calculated.abilities);
    }
    await expect(
      outsider.query(api.characterSheet.read, scope),
    ).rejects.toThrow();
    await expect(
      outsider.query(api.characterSheetSpells.browse, {
        ...filters,
        paginationOpts: { cursor: null, numItems: 25 },
      }),
    ).rejects.toThrow();
    const firstEntryId = recordedIds[0];
    const firstSpellId = spellIds[0];
    if (!firstEntryId || !firstSpellId)
      throw new Error('Missing recorded Spell');
    await expect(
      outsider.mutation(api.characterSheetSpells.record, {
        ...filters,
        catalogEntryId: firstSpellId,
        operationId: 'outsider-record-refused',
      }),
    ).rejects.toThrow();
    await expect(
      outsider.mutation(api.characterSheetSpells.remove, {
        ...scope,
        entryId: firstEntryId,
        operationId: 'outsider-remove-refused',
      }),
    ).rejects.toThrow();
    expect(
      (await owner.query(api.characterSheet.read, scope))?.entries.some(
        (entry) => entry._id === firstEntryId,
      ),
    ).toBe(true);
    await member.mutation(api.characterSheetSpells.remove, {
      ...scope,
      entryId: firstEntryId,
      operationId: 'member-removes-spell',
    });
    const removed = await owner.query(api.characterSheet.read, scope);
    expect(removed?.entries.some((entry) => entry._id === firstEntryId)).toBe(
      false,
    );
    expect(removed?.entries.some((entry) => entry._id === recordedIds[1])).toBe(
      true,
    );
  },
);
