import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { conditionDefinitions } from '../../src/lib/character-sheet-conditions.ts';
import type { AdmissionArtifact } from './admission.ts';
import type { PreviewEntry } from './map.ts';

export const conditionReleaseResourcePaths = [
  'src/lib/catalog/data/reviewed-conditions.json',
  'docs/ai/pf1-core-rules/pf1-crb-conditions.md',
  'src/lib/character-sheet-conditions.ts',
  'src/lib/character-sheet.ts',
] as const;

// Historical calculator provenance from the #311 offline rebase review keeps
// unrelated shared-calculator edits from changing accepted condition content.
// The resolver remains review-bound; current hashes enter every release below.
const reviewedConditionCodeHashes: Readonly<Record<string, string>> = {
  'src/lib/character-sheet.ts':
    'f3d4064fbecee5cc5a2326f32197fa98aac890c4c46d5461669c6e39fca28d67',
};

export async function buildConditionCatalogArtifact() {
  const root = new URL('../../', import.meta.url);
  const localResources = await Promise.all(
    conditionReleaseResourcePaths.map(async (path) => ({
      path,
      sha256: createHash('sha256')
        .update(await readFile(new URL(path, root)))
        .digest('hex'),
    })),
  );
  const entries: PreviewEntry[] = conditionDefinitions.map((definition) => ({
    externalKey: definition.ruleIdentity,
    upstreamKey: definition.ruleIdentity,
    pack: 'crb-conditions',
    name: definition.name,
    detail: {
      kind: 'condition',
      conditionKey: definition.key,
      unmodeled: definition.unmodeled,
      deniesDexterityBonus: definition.deniesDexterityBonus,
      citations: definition.citations,
      sourceSections: definition.sourceSections,
      curationInputs: Object.fromEntries(
        localResources.map((resource) => [
          resource.path,
          reviewedConditionCodeHashes[resource.path] ?? resource.sha256,
        ]),
      ),
    },
    description: definition.situationalNotes
      .map((note) => note.text)
      .join('\n'),
    sources: definition.sources,
    modifiers: definition.modifiers,
    situationalNotes: definition.situationalNotes,
    sourceKey: definition.ruleIdentity,
    unsupported: [],
  }));
  const artifact = {
    catalog: { entries, localResources },
    comparison: {
      packs: [
        {
          repo: 'local',
          pack: 'crb-conditions',
          declared: true,
          present: true,
          admitted: entries.length,
          excluded: 0,
          unassigned: 0,
        },
      ],
      records: entries.map((entry) => ({
        repo: 'local',
        pack: entry.pack,
        path: 'src/lib/catalog/data/reviewed-conditions.json',
        externalKey: entry.externalKey,
        name: entry.name,
        status: 'admitted' as const,
        reason:
          'Locally authored CRB condition; ordinary attribution admission still applies.',
      })),
    },
  };
  return artifact;
}

/** Release preparation explicitly opts in to the complete local condition resource. */
export async function appendConditionResources(
  artifact: AdmissionArtifact,
): Promise<AdmissionArtifact> {
  const local = await buildConditionCatalogArtifact();
  const identities = new Set(
    [...artifact.catalog.entries, ...artifact.catalog.resources].map(
      (entry) => entry.externalKey,
    ),
  );
  if (local.catalog.entries.some((entry) => identities.has(entry.externalKey)))
    throw new Error('Condition resources are already present');
  const summary = {
    ...artifact.catalog.summary,
    admitted: artifact.catalog.summary.admitted + local.catalog.entries.length,
    byKind: {
      ...artifact.catalog.summary.byKind,
      condition:
        (artifact.catalog.summary.byKind.condition ?? 0) +
        local.catalog.entries.length,
    },
  };
  return {
    ...artifact,
    catalog: {
      ...artifact.catalog,
      summary,
      entries: [...artifact.catalog.entries, ...local.catalog.entries],
      localResources: [
        ...(artifact.catalog.localResources ?? []),
        ...local.catalog.localResources,
      ],
    },
    comparison: {
      ...artifact.comparison,
      summary,
      records: [...artifact.comparison.records, ...local.comparison.records],
      packs: [...artifact.comparison.packs, ...local.comparison.packs],
    },
  };
}
