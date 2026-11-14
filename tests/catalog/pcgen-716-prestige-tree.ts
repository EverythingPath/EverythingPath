import { parse } from 'yaml';
import { z } from 'zod';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { buildEffectiveView } from '../../scripts/catalog/pcgen/effective';
import { readPcgenTree, type PcgenTree } from '../../scripts/catalog/pcgen/lst';
import { mapPrestigeClass } from '../../scripts/catalog/pcgen/prestige';
import type { PrestigeReferences } from '../../scripts/catalog/pcgen/requirements';
import { pcgen716PrestigeFiles } from '../fixtures/pcgen-716/prestige-files';
import { materializePinnedTree, readPinned } from './pinned-sources';

/** Reads #716 P4's pinned PCGen class files (`pcgen716PrestigeFiles`) as one PCGen data folder. */
export async function readPcgen716PrestigeTree() {
  const materialized = await materializePinnedTree(
    pcgen716PrestigeFiles.map((path) => `pcgen/${pcgenPin.directory}/${path}`),
  );
  try {
    return await readPcgenTree(materialized.pcgenPath);
  } finally {
    await materialized.dispose();
  }
}

/**
 * The Foundry records P4's fixtures cite, at the pf1 pin: feats by name, and
 * the alchemist class features Master Chymist requires.
 */
const foundryFeats = [
  'packs/feats/dodge.JreaiTHdyWFNj3Tb.yaml',
  'packs/feats/magical-aptitude.CLSsMyNmdcNAOUKC.yaml',
  'packs/feats/mobility.R7L4SlGRlnThqFrP.yaml',
  'packs/feats/point-blank-shot.8rsFtye3PwM6CKli.yaml',
  'packs/feats/precise-shot.53urYIbYYpQuoSLd.yaml',
  'packs/feats/weapon-finesse.vWiTqHC4Y3Xn1Pme.yaml',
  'packs/feats/weapon-focus.n250dFlbykAIAg5Z.yaml',
];
/** A test crosswalk: PCGen Special Ability KEY → Foundry class ability record. */
const foundryClassFeatures = {
  'Alchemist ~ Mutagen': 'packs/class-abilities/mutagen.zrTVb83VhkFnEv6G.yaml',
  'Discovery ~ Feral Mutagen':
    'packs/class-abilities/feral-mutagen.4R0YV2SQZvZWsjoV.yaml',
  'Discovery ~ Infuse Mutagen':
    'packs/class-abilities/infuse-mutagen.7vDgnmTR2EA4kxqE.yaml',
};
const foundryRecordSchema = z.object({ _id: z.string(), name: z.string() });
async function readFoundryRecord(path: string) {
  const record = foundryRecordSchema.parse(
    parse(await readPinned('pf1', path)),
  );
  return { key: `pf1/${record._id}`, name: record.name };
}

/** References resolved against the pinned Foundry records; anything else is unresolved. */
export async function pinnedFoundryReferences(): Promise<PrestigeReferences> {
  const feats = new Map(
    (await Promise.all(foundryFeats.map(readFoundryRecord))).map(
      ({ key, name }) => [name.toLowerCase(), key],
    ),
  );
  const features = new Map(
    await Promise.all(
      Object.entries(foundryClassFeatures).map(
        async ([pcgenKey, path]) =>
          [pcgenKey.toLowerCase(), await readFoundryRecord(path)] as const,
      ),
    ),
  );
  return {
    feat: (key) => feats.get(key.toLowerCase()),
    classFeature: (key) => {
      const feature = features.get(key.toLowerCase());
      return (
        feature && {
          classFeature: feature.key,
          classFeatureName: feature.name,
        }
      );
    },
    race: () => undefined,
    spell: () => undefined,
    className: () => undefined,
  };
}

/** Maps the prestige class whose record line is `file:line`. */
export function mapPinnedPrestige({
  tree,
  file,
  line,
  externalKey,
  references,
}: {
  tree: PcgenTree;
  file: string;
  line: number;
  externalKey: string;
  references: PrestigeReferences;
}) {
  const view = buildEffectiveView(tree);
  const record = tree.prestigeClasses.find(
    ({ locator }) => locator.file === file && locator.line === line,
  );
  const effective = record && view.records.get(record);
  if (!record || !effective)
    throw new Error(`No effective prestige class at ${file}:${line}`);
  return mapPrestigeClass({
    effective: { ...effective, record },
    externalKey,
    references,
  });
}

/**
 * Appendix E's reading for whole-tree totals: every feat, class feature,
 * race, spell and class reference resolves, so a tag counts as typed when
 * its references can be crosswalked.
 */
export const resolvingReferences: PrestigeReferences = {
  feat: (key) => `feat:${key.toLowerCase()}`,
  classFeature: (key) => ({
    classFeature: `classFeature:${key.toLowerCase()}`,
  }),
  race: (key) => `race:${key.toLowerCase()}`,
  spell: (key) => `spell:${key.toLowerCase()}`,
  className: (key) => `class:${key.toLowerCase()}`,
};

const tally = (values: readonly string[]) =>
  Object.fromEntries(
    [
      ...values.reduce(
        (counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1),
        new Map<string, number>(),
      ),
    ].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );

/** The prestige mapper's totals over a tree (`prestige-evidence.json`). */
export function prestigeEvidence(tree: PcgenTree) {
  const view = buildEffectiveView(tree);
  const mapped = tree.prestigeClasses.flatMap((record) => {
    const effective = view.records.get(record);
    return effective
      ? [
          {
            record,
            mapping: mapPrestigeClass({
              effective: { ...effective, record },
              externalKey: 'everythingpath/evidence',
              references: resolvingReferences,
            }),
          },
        ]
      : [];
  });
  const clauses = mapped.flatMap(({ mapping }) =>
    mapping.requirements.flatMap(({ clauses: found }) => found),
  );
  const withUnchecked = mapped.filter(({ mapping }) =>
    mapping.items.some(({ kind }) => kind === 'uncheckedRequirement'),
  );
  const at = ({ record }: (typeof mapped)[number]) =>
    `${record.locator.file}:${record.locator.line}`;
  const advanceTokens = tree.prestigeClasses.flatMap((record) =>
    record.levelLines.flatMap((line) =>
      line.tokens
        .slice(1)
        .filter((token) => token.startsWith('ADD:SPELLCASTER|'))
        .map((token) => {
          const argument = token.slice('ADD:SPELLCASTER|'.length);
          return /^(ANY|Arcane|Divine)$/.test(argument)
            ? argument
            : 'class-named or counted';
        }),
    ),
  );
  return {
    pcgen: { commit: pcgenPin.commit, directory: pcgenPin.directory },
    prestigeRecords: tree.prestigeClasses.length,
    mapped: mapped.length,
    advanceLevelTokens: tally(advanceTokens),
    rules: tally(clauses.map(({ rule }) => rule)),
    uncheckedClauses: clauses.filter(({ rule }) =>
      rule.startsWith('unchecked:'),
    ).length,
    classesWithUnchecked: {
      records: withUnchecked.length,
      names: new Set(
        withUnchecked.map(({ record }) => record.locator.key.toLowerCase()),
      ).size,
      of: new Set(
        tree.prestigeClasses.map(({ locator }) => locator.key.toLowerCase()),
      ).size,
    },
    items: tally(
      mapped.flatMap(({ mapping }) => mapping.items.map(({ kind }) => kind)),
    ),
    reviewItems: mapped.flatMap((found) =>
      found.mapping.items
        .filter(
          ({ kind }) => kind === 'conflict' || kind === 'uncheckedCasting',
        )
        .map(({ kind, id }) => ({
          owner: at(found),
          key: found.record.locator.key,
          kind,
          id,
        })),
    ),
  };
}
