// @vitest-environment edge-runtime
// stats-d2 fix r1 (PRD #251; GLOSSARY: Land speed): per-copy stacking is
// release content. Fleet's body says "You can take this feat multiple times.
// The effects stack." (PCGen cr_feats.lst:70 STACK:YES); once its reviewed
// replacement is checked, the importer marks the entry `stacksWithItself`,
// and the app's candidate conversion stores it, so each copy's +5 counts on
// the saved sheet. A body without the field doesn't stack with itself.
import { expect, test } from 'vitest';
import { prepare, releaseFixture } from '../tests/catalog-release-fixture';
import {
  canonicalReleaseJson,
  parseReleaseJson,
} from '../src/lib/catalog/release-schema';
import { candidateDefinition } from './lib/catalogCandidateDefinition';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

const race = 'pf1/speedStackingRace';
const fleet = 'pf1/speedStackingFleet';
const once = 'pf1/speedStackingOnce';
/** A body shaped as the importer emits it. */
const body = ({
  externalKey,
  name,
  detail,
  modifiers,
  stacksWithItself,
}: {
  externalKey: string;
  name: string;
  detail: Record<string, unknown>;
  modifiers: Record<string, unknown>[];
  stacksWithItself?: true;
}) => ({
  externalKey,
  upstreamKey: externalKey,
  pack: detail.kind === 'race' ? 'races' : 'feats',
  name,
  detail,
  description: `${name}.`,
  sources: [{ book: 'PZO1110', pages: '1' }],
  modifiers,
  ...(stacksWithItself ? { stacksWithItself } : {}),
  unsupported: [],
});
const feat = { kind: 'feat', featTypes: ['General'], repeatable: 'unreviewed' };
const plusFive = {
  target: 'speed.land',
  bonusType: 'untyped',
  value: 5,
  condition: { armorAtMost: 'light' },
};
const bodies = [
  body({
    externalKey: race,
    name: 'Speed Stacking Race',
    detail: {
      kind: 'race',
      racialHitDice: 0,
      creatureTypes: ['humanoid'],
      creatureSubtypes: [],
      racialTraits: [],
      size: 'medium',
    },
    modifiers: [{ target: 'speed.land', bonusType: 'base', value: 30 }],
  }),
  // Fleet as the importer gives it once its row is checked.
  body({
    externalKey: fleet,
    name: 'Fleet',
    detail: feat,
    modifiers: [plusFive],
    stacksWithItself: true,
  }),
  // The same bonus on a body without the field.
  body({
    externalKey: once,
    name: 'Fleet Without Stacking',
    detail: feat,
    modifiers: [plusFive],
  }),
];

async function fixture() {
  const { t, owner, scope } = await releaseFixture(modules);
  const ids: Record<string, Id<'catalogEntry'>> = await t.run(async (ctx) => {
    const ids: Record<string, Id<'catalogEntry'>> = {};
    for (const { externalKey, name, detail } of bodies)
      ids[externalKey] = await ctx.db.insert('catalogEntry', {
        scope: 'global',
        name,
        ruleIdentity: externalKey,
        modifiers: [],
        sources: [],
        stacksWithItself: false,
        detail:
          detail.kind === 'race'
            ? { kind: 'race', racialHitDice: 0, racialTraits: [] }
            : { kind: 'feat' },
      });
    return ids;
  });
  await prepare(
    t,
    bodies.map((entry) => ({
      kind: 'definition',
      key: entry.externalKey,
      payload: parseReleaseJson(JSON.parse(canonicalReleaseJson(entry))),
    })),
  );
  const stored = await t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    if (!release) throw new Error('Missing release');
    const stored: Record<string, boolean> = {};
    for (const [key, id] of Object.entries(ids)) {
      const identity = await ctx.db.get('catalogEntry', id);
      if (!identity) throw new Error('Missing stored identity');
      const { _id, _creationTime, ...definition } = await candidateDefinition(
        ctx,
        release,
        identity,
      );
      await ctx.db.replace('catalogEntry', _id, definition);
      stored[key] = definition.stacksWithItself;
    }
    return stored;
  });
  const id = (key: string) => {
    const found = ids[key];
    if (!found) throw new Error(`Missing ${key}`);
    return found;
  };
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: id(race),
    operationId: 'race',
  });
  const take = async (key: string, copies: number) => {
    for (let copy = 1; copy <= copies; copy += 1)
      await owner.mutation(api.characterSheet.selectEntry, {
        ...scope,
        catalogEntryId: id(key),
        operationId: `${key}-${copy}`,
      });
  };
  const speed = async () =>
    (await owner.query(api.characterSheet.read, scope))?.calculated
      .derivedStatistics.landSpeed?.total;
  return { stored, take, speed };
}

test('the candidate conversion stores per-copy stacking from the release body, and only from it', async () => {
  const { stored } = await fixture();
  expect(stored).toEqual({ [race]: false, [fleet]: true, [once]: false });
});

test('each copy of a body that stacks with itself adds on the saved sheet: Fleet twice gives 40 ft., three times 45 ft.', async () => {
  const { take, speed } = await fixture();
  expect(await speed()).toBe(30);
  await take(fleet, 2);
  expect(await speed()).toBe(40);
  await take(fleet, 1);
  expect(await speed()).toBe(45);
});

test('copies of a body without it give their bonus once', async () => {
  const { take, speed } = await fixture();
  await take(once, 2);
  expect(await speed()).toBe(35);
});
