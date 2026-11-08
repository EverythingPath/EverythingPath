/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  oracleClassFixture,
  spellFixture,
} from '../tests/fixtures/spells-518/sheet';
import { findReviewedClassCasting } from '../src/lib/character-sheet-casting-tables';
import { calculateCharacterSheetPreview } from '../src/components/character-sheet/calculate-character-sheet-preview';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

test.each([
  {
    className: 'Oracle',
    spells: [
      ['Bane', 1],
      ['Command', 1],
    ],
  },
  {
    className: 'Wizard',
    spells: [
      ['Reduce Person', 1],
      ['Shocking Grasp', 1],
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
          tokenIdentifier: `spell518|${name}`,
          orgIds: [{ orgId, role: 'member' }],
          characterSheetDemo: true,
        });
      }
      return ctx.db.insert('campaign', {
        name: 'Isolated held Spells #518',
        description: '',
        organizationId: 'org',
        ownerId: 'spell518|owner',
        e2eFixture: {
          namespace: 'spells-518',
          version: 1,
          workerKey: '0',
          caseKey: className,
          campaignKey: className,
        },
      });
    });
    const owner = t.withIdentity({ tokenIdentifier: 'spell518|owner' });
    const member = t.withIdentity({ tokenIdentifier: 'spell518|member' });
    const outsider = t.withIdentity({ tokenIdentifier: 'spell518|outsider' });
    const characterId = await owner.mutation(api.characterSheet.create, {
      organizationId: 'org',
      campaignId,
      name: 'Source-backed Spell collection preview',
      kind: 'pc',
      operationId: 'create-spells-518',
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
    const castingClassId =
      castingClass?._id ??
      (await t.run(async (ctx) => {
        if (className !== 'Oracle')
          throw new Error(`Missing ${className} baseline`);
        const context = oracleClassFixture();
        const casting = findReviewedClassCasting(context.detail.tag);
        if (!casting) throw new Error('Missing reviewed Oracle casting table');
        // Pinned Oracle context is not a candidate or admitted class. Only the
        // class metadata needed for its real Spell collection is installed here.
        return ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          name: context.name,
          ruleIdentity: context.externalKey,
          sources: context.sources,
          modifiers: [],
          stacksWithItself: false,
          detail: {
            kind: 'class',
            hitDie: context.detail.hitDie,
            bab: context.detail.bab,
            saves: context.detail.saves,
            classSkills: context.detail.classSkills,
            classKind: context.detail.classKind,
            skillRanksPerLevel: context.detail.skillRanksPerLevel,
            featuresByLevel: [],
            picksByLevel: [],
            casting,
          },
        });
      }));
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
        heading: className === 'Wizard' ? 'Spellbook' : 'Spells known',
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
    if (className === 'Oracle') {
      // Bane, CRB p.246, applies -1 attack and -1 fear saves only while running.
      // This user-created test definition proves the public effect writer;
      // it does not admit or curate an imported Spell Effect.
      const effectId = await member.mutation(
        api.characterSheet.createSheetEntry,
        {
          ...scope,
          name: 'Isolated running Bane',
          modifiers: [
            { target: 'attack', bonusType: 'untyped', value: -1 },
            {
              target: 'saves',
              bonusType: 'untyped',
              value: -1,
              condition: { situation: 'fear' },
            },
          ],
          detail: {
            kind: 'spellEffect',
            spellKey: 'pf1/3etxlex8u32g0hrx',
            defaultCasterLevel: 1,
            lastsOverOneDay: false,
          },
          operationId: 'separate-running-bane',
        },
      );
      const running = withSheetCatalog(
        await owner.query(api.characterSheet.read, scope),
      );
      if (!running) throw new Error('Missing running-effect preview');
      expect(running.calculated.breakdowns['attack.melee'].total).toBe(
        baseline.calculated.breakdowns['attack.melee'].total - 1,
      );
      expect(running.permanentCalculated.breakdowns['attack.melee'].total).toBe(
        baseline.permanentCalculated.breakdowns['attack.melee'].total,
      );
      expect(running.calculated.derivedStatistics.will.total).toBe(
        baseline.calculated.derivedStatistics.will.total,
      );
      const fearful = calculateCharacterSheetPreview(
        running,
        {},
        { situations: ['fear'] },
      );
      expect(fearful.derivedStatistics.will.total).toBe(
        baseline.calculated.derivedStatistics.will.total - 1,
      );
      expect(running.permanentCalculated.derivedStatistics.will.total).toBe(
        baseline.permanentCalculated.derivedStatistics.will.total,
      );
      expect(
        calculateCharacterSheetPreview(
          running,
          {},
          { situations: ['fear'], permanentOnly: true },
        ).derivedStatistics.will.total,
      ).toBe(baseline.permanentCalculated.derivedStatistics.will.total);
      expect(
        calculateCharacterSheetPreview(running).breakdowns['attack.melee']
          .total,
      ).toBe(running.calculated.breakdowns['attack.melee'].total);
      await member.mutation(api.characterSheet.editSheetEntry, {
        ...scope,
        entryId: effectId,
        active: false,
        operationId: 'stop-running-effect',
      });
      expect(
        (await owner.query(api.characterSheet.read, scope))?.calculated
          .breakdowns['attack.melee'].total,
      ).toBe(baseline.calculated.breakdowns['attack.melee'].total);
    }
    const otherCampaignId = await t.run((ctx) =>
      ctx.db.insert('campaign', {
        name: 'Other campaign',
        description: '',
        organizationId: 'org',
        ownerId: 'spell518|owner',
      }),
    );
    await expect(
      member.query(api.characterSheet.read, {
        ...scope,
        campaignId: otherCampaignId,
      }),
    ).rejects.toThrow();
    await expect(
      member.query(api.characterSheetSpells.browse, {
        ...filters,
        campaignId: otherCampaignId,
        paginationOpts: { cursor: null, numItems: 25 },
      }),
    ).rejects.toThrow();
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
