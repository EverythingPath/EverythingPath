import type { AuditIndexes } from './launch-audit-shared.ts';
import { launchAuthority as authority } from './launch-inventory-authority.ts';
import { launchOwner } from './launch-inventory-coverage.ts';
import type { LaunchManifest } from './launch-inventory-schema.ts';
import { campaignMvpRoots, launchInventoryHash } from './launch-inventory.ts';

export const launchResourceInputs = [
  [
    'builtin:casting-tables',
    'scripts/catalog/reviewed-casting-tables.json',
    716,
  ],
  [
    'builtin:representative-class-catalog',
    'convex/lib/representativeClassCatalog.ts',
    310,
  ],
  [
    'builtin:representative-selection-catalog',
    'convex/lib/representativeSelectionCatalog.ts',
    310,
  ],
  [
    'builtin:representative-archetype-catalog',
    'convex/lib/representativeArchetypeCatalog.ts',
    310,
  ],
  [
    'builtin:representative-spellcasting-catalog',
    'convex/lib/representativeSpellcastingCatalog.ts',
    310,
  ],
  [
    'builtin:representative-race-catalog',
    'convex/lib/representativeRaceCatalog.ts',
    310,
  ],
  [
    'companion-progression-rules',
    'src/lib/catalog/representative-companion-rules.ts',
    707,
  ],
  ['section15-registry', 'src/lib/catalog/data/section15-registry.json', 257],
  ['legal-resources', 'src/lib/catalog/data/resources.json', 257],
] as const;

export function resourceOwners({
  name,
  locator,
  issue,
}: {
  name: string;
  locator: string;
  issue: number;
}) {
  const owner = launchOwner(issue, `Existing ${name} resource input`, [
    locator,
    `#${issue}`,
  ]);
  return {
    inventoryOwner: owner,
    implementationOwner: launchOwner(
      770,
      'Scope and bind actual resource output without weakening existing gates',
      ['scripts/catalog/release-operator.ts', '#770'],
    ),
    publicTestOwner: owner,
  };
}

export function resourceEdges({
  name,
  locator,
}: {
  name: string;
  locator: string;
}): LaunchManifest['edges'] {
  return campaignMvpRoots.map((root) => ({
    from: root.key,
    to: `resource/${name}`,
    kind: 'resource',
    reason: `Required existing ${name} resource/binding; its presence is not source or launch qualification.`,
    condition: null,
    evidence: [locator, 'scripts/catalog/release-inputs.ts'],
  }));
}

export function checkLaunchResources({
  manifest,
  fail,
  indexes,
}: {
  manifest: LaunchManifest;
  indexes: AuditIndexes;
  fail: (code: string, key: string, reason: string) => void;
}) {
  const { rows, edges } = indexes;
  for (const [name, locator, issue] of launchResourceInputs) {
    const key = `resource/${name}`;
    const row = rows.get(key);
    const binding = authority.resourceBindings.find(
      (entry) => entry.key === key,
    )?.source;
    if (
      row?.kind !== 'resource' ||
      row.catalogKey !== null ||
      row.requirement !== 'required' ||
      row.name !== name
    )
      fail(
        'resource-required',
        key,
        'Every independently required governing resource must remain required with its original identity.',
      );
    if (
      binding?.locator !== locator ||
      launchInventoryHash(row?.sources) !== launchInventoryHash([binding])
    )
      fail(
        'resource-source',
        key,
        `Required resource must retain its independently bound whole-file source ${locator}.`,
      );
    const owners = resourceOwners({ name, locator, issue });
    if (
      launchInventoryHash(
        row && {
          inventoryOwner: row.inventoryOwner,
          implementationOwner: row.implementationOwner,
          publicTestOwner: row.publicTestOwner,
        },
      ) !== launchInventoryHash(owners)
    )
      fail(
        'resource-owner',
        key,
        'Required resource inventory, implementation and public-test ownership must survive.',
      );
    for (const edge of resourceEdges({ name, locator }))
      if (!edges.has(launchInventoryHash(edge)))
        fail(
          'resource-edge',
          key,
          `Missing required incoming resource path from ${edge.from}.`,
        );
    for (const contract of ['#251 acceptance appendix', '#732'])
      if (
        !manifest.coverage
          .find((entry) => entry.contract === contract)
          ?.keys.includes(key)
      )
        fail(
          'resource-coverage',
          key,
          `Missing required resource reference in ${contract}.`,
        );
  }
  for (const entry of manifest.coverage)
    for (const key of entry.keys.filter((key) => key.startsWith('resource/')))
      if (!rows.has(key))
        fail(
          'resource-coverage',
          key,
          `Dangling resource reference in ${entry.contract}.`,
        );
}

export function missingResourceContext({ key }: { key: string }) {
  const input = launchResourceInputs.find(
    ([name]) => key === `resource/${name}`,
  );
  if (!input) return undefined;
  const [name, locator, issue] = input;
  return {
    owner: resourceOwners({ name, locator, issue }).implementationOwner,
    paths: resourceEdges({ name, locator }).map((edge) => ({
      keys: [edge.from, edge.to],
      reasons: [edge.reason],
    })),
  };
}
