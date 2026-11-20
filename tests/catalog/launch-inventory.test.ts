// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  inspectLaunchInventory,
  launchScopeIdentity,
  serializeLaunchInventory,
  renderLaunchInventoryReport,
} from '../../scripts/catalog/launch-inventory';
import {
  parseLaunchInventory,
  launchInventoryDocument,
} from '../../scripts/catalog/launch-inventory-document';
import { launchInventoryHash } from '../../scripts/catalog/launch-inventory';
import { readPinned } from './pinned-sources';
import { createHash } from 'node:crypto';
import { launchManifestCopies } from './launch-manifest';
import type { LaunchManifest } from '../../scripts/catalog/launch-inventory-schema';

const manifest: unknown = JSON.parse(
  await readFile(
    new URL(
      '../../scripts/catalog/scopes/campaign-mvp-v1.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const freshManifest = launchManifestCopies(manifest);

describe('campaign MVP inventory contract', () => {
  it('retains original core Item Abilities when the pinned body cites a later reprint', () => {
    const value = freshManifest();
    const pool = value.pools.find(
      ({ name }) => name === 'CRB/APG Item Abilities',
    );
    const names = value.rows
      .filter(({ key }) => pool?.members.includes(key))
      .map(({ name }) => name);
    expect(names).toEqual(
      expect.arrayContaining(['Flaming', 'Frost', 'Keen', 'Speed', 'Bashing']),
    );
    const speed = value.rows.find(
      ({ key }) => key === 'pf1-content/E5jfgma2vpopfrkr',
    );
    expect(
      speed?.sources.some(
        ({ repository, locator }) =>
          repository === 'pcgen' && locator.includes('cr_equipmods.lst:252'),
      ),
    ).toBe(true);
    expect(speed?.implementationOwner.issue).toBe(764);
    const originalNotices = value.edges
      .filter(
        ({ from, kind }) =>
          from ===
            'rule/pcgen/roleplaying_game/core_rulebook/cr_equipmods.lst:252' &&
          kind === 'notice',
      )
      .map(({ to }) => to);
    expect(originalNotices).toContain('notice/PZO1110');
    expect(originalNotices).not.toContain('notice/PZO1129');
    expect(inspectLaunchInventory(value).launchQualified).toBe(false);
  });
  it('retains the published Great Cleave prerequisite chain as prerequisites, separately from citations', () => {
    const value = freshManifest();
    expect(value.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'pf1/6HSMdwX1VS6nZ6Zf',
          to: 'pf1/Zeq6RWYv5otvg8q7',
          kind: 'prerequisite',
        }),
        expect.objectContaining({
          from: 'pf1/Zeq6RWYv5otvg8q7',
          to: 'pf1/FUW5mIXHNBBIQ1Sq',
          kind: 'prerequisite',
        }),
      ]),
    );
    const source = value.rows.find(({ key }) => key === 'pf1/6HSMdwX1VS6nZ6Zf');
    expect(
      source?.mechanisms.some(
        ({ name, contract }) =>
          name === 'Source prerequisites' &&
          contract.includes('Str 13') &&
          contract.includes('base attack bonus +4'),
      ),
    ).toBe(true);
  });
  it('preserves the inherited before-reliance condition only when a real legacy key is required: committed scope', () => {
    const value = freshManifest();
    expect(
      inspectLaunchInventory(value).launchFailures.some(
        ({ code }) => code === 'before-reliance',
      ),
    ).toBe(false);
  });
  it('preserves the inherited before-reliance condition only when a real legacy key is required: required legacy key', () => {
    const value = freshManifest();
    value.coverage = value.coverage.filter(
      ({ contract }) => contract !== '#716 nine inherited rationale decisions',
    );
    value.edges.push({
      from: 'pf1/W8dxwZ1CZiwLKsqr',
      to: 'everythingpath/monk-windstep-master',
      kind: 'option',
      reason:
        'Attempt to require the published Windstep Master in a future scope revision.',
      condition: null,
      evidence: [
        'pcgen:player_companion/elemental_masters_handbook/emh_abilities_class.lst:145',
      ],
    });
    const failure = inspectLaunchInventory(value).launchFailures.find(
      ({ code, key }) =>
        code === 'before-reliance' &&
        key === 'everythingpath/monk-windstep-master',
    );
    expect(failure?.owner?.issue).toBe(716);
    expect(
      failure?.paths.some(
        ({ keys }) =>
          keys[0] === 'pf1/W8dxwZ1CZiwLKsqr' &&
          keys.at(-1) === 'everythingpath/monk-windstep-master',
      ),
    ).toBe(true);
  });
  it('accounts for the fixed roots and every printed class level independently of launch holds', () => {
    const report = inspectLaunchInventory(manifest);
    expect(report.roots).toHaveLength(31);
    expect(report.checkpoints).toHaveLength(420);
    const value = freshManifest();
    expect(
      report.checkpoints
        .flatMap(({ scheduledKeys }) => scheduledKeys)
        .every((key) => value.rows.some((row) => row.key === key)),
    ).toBe(true);
    expect(
      new Set(
        report.checkpoints
          .filter(
            ({ scheduleStatus }) => scheduleStatus === 'outstanding schedule',
          )
          .map(({ className }) => className),
      ),
    ).toEqual(new Set());
    expect(report.roots.find(({ name }) => name === 'Monk')?.key).toBe(
      'pf1/W8dxwZ1CZiwLKsqr',
    );
    expect(report.roots.find(({ name }) => name === 'Summoner')?.key).toBe(
      'pf1/BrnHPJ2EVSQSyNQ8',
    );
    expect(
      report.roots.find(({ name }) => name === 'Exploiter Wizard')?.key,
    ).toBe('everythingpath/wizard-exploiter-wizard');
    expect(report.party.status).toBe('pending');
    expect(report.launchQualified).toBe(false);
    expect(
      report.checkpoints.find(
        ({ className, level }) => className === 'Wizard' && level === 1,
      )?.sourceColumns,
    ).toMatchObject({
      'column-0': '1st',
      'column-6': '3',
      'column-7': '1',
      'column-8': '—',
    });
  });

  it('shows Tiefling Darkness as an owned requirement with its complete root path', () => {
    const value = freshManifest();
    value.rows = value.rows.filter(({ key }) => key !== 'pf1/tsndfcfijmgxs37p');
    const report = inspectLaunchInventory(value);
    const failure = report.launchFailures.find(
      ({ key, code }) =>
        key === 'pf1/tsndfcfijmgxs37p' && code === 'dependency-missing',
    );
    expect(failure?.owner?.issue).toBe(541);
    expect(failure?.paths).toContainEqual({
      keys: ['pf1/nVjKDLZSRONzYm8f', 'pf1/tsndfcfijmgxs37p'],
      reasons: [
        "Tiefling's once-per-day Darkness spell-like ability, with caster level equal to class level.",
      ],
    });
    expect(report.genericComplete).toBe(false);
    expect(report.launchQualified).toBe(false);
  });

  it('keeps the exact three-key Wizard batch and all original nonlaunch remainders', () => {
    const value = freshManifest();
    expect(value.batches.find(({ issue }) => issue === 587)).toMatchObject({
      originalInventory: [
        'pf1/0ahLHNR2864mih3n',
        'pf1/0c4lYDywj6bQ0i8r',
        'pf1/16mfrGi2UHTsME4W',
      ],
      requiredKeys: ['pf1/0c4lYDywj6bQ0i8r'],
      remainderKeys: ['pf1/0ahLHNR2864mih3n', 'pf1/16mfrGi2UHTsME4W'],
    });
    value.batches.find(({ issue }) => issue === 587)?.remainderKeys.pop();
    expect(
      inspectLaunchInventory(value).inventoryErrors.some(
        ({ code }) => code === 'batch-partition',
      ),
    ).toBe(true);
  });

  it('retains all incoming reasons when a required spell is shared and cycles exist', () => {
    const value = freshManifest();
    const darkness = value.rows.find(
      ({ key }) => key === 'pf1/tsndfcfijmgxs37p',
    );
    expect(darkness).toBeDefined();
    const root = value.roots.find(({ name }) => name === 'Cleric');
    expect(root).toBeDefined();
    const report = inspectLaunchInventory(value);
    expect(
      report.incoming['pf1/tsndfcfijmgxs37p']?.some(
        ({ keys }) => keys[0] === 'pf1/SjFqQceVeVBzBwgn',
      ),
    ).toBe(true);
    expect(
      report.incoming['pf1/tsndfcfijmgxs37p']?.some(
        ({ keys }) => keys[0] === 'pf1/nVjKDLZSRONzYm8f',
      ),
    ).toBe(true);
    expect(
      value.rows.filter(({ key }) => key === 'pf1/tsndfcfijmgxs37p'),
    ).toHaveLength(1);
    const elementalSchoolPaths = report.incoming['pf1/9lXaxRP47Ju9xjPr'];
    expect(
      elementalSchoolPaths?.some(
        ({ keys }) =>
          keys.includes('pf1/sMg9DfGz9NDMFA3r') &&
          keys.at(-1) === 'pf1/9lXaxRP47Ju9xjPr',
      ),
    ).toBe(true);
  });

  const darknessBinding = () => {
    const value = freshManifest();
    const row = value.rows.find(({ key }) => key === 'pf1/tsndfcfijmgxs37p');
    const source = row?.sources[0];
    if (!row || !source) throw new Error('Missing actual Darkness source.');
    const bindings = value.rows.flatMap(({ sources }) => sources);
    return { value, row, source, bindings };
  };

  it('binds the actual Darkness bytes and rejects changed source bindings: actual bytes', async () => {
    const { value, source, bindings } = darknessBinding();
    const hash = createHash('sha256')
      .update(await readPinned('pf1', source.locator))
      .digest('hex');
    expect(source.rawSha256).toBe(hash);
    expect(
      inspectLaunchInventory(value, { bindings }).inventoryErrors.some(
        ({ code }) => code === 'source-hash',
      ),
    ).toBe(false);
  });

  it('binds the actual Darkness bytes and rejects changed source bindings: changed binding', () => {
    const { value, row, source, bindings } = darknessBinding();
    row.sources = [{ ...source, effectiveSha256: '0'.repeat(64) }];
    expect(inspectLaunchInventory(value, { bindings }).inventoryErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: row.key, code: 'source-hash' }),
      ]),
    );
  });

  // Each part rebuilds the earlier edits in order. The duplicate is pushed and
  // popped again before the rename, so the later parts start from the copy.
  const tiefling = () => {
    const value = freshManifest();
    const row = value.rows.find(({ key }) => key === 'pf1/nVjKDLZSRONzYm8f');
    if (!row) throw new Error('Missing Tiefling.');
    return { value, row };
  };
  const unallocatedTiefling = () => {
    const { value, row } = tiefling();
    row.key = 'everythingpath/not-an-allocated-identity';
    row.catalogKey = row.key;
    return { value, row };
  };
  const proseTiefling = () => {
    const { value, row } = unallocatedTiefling();
    row.mechanisms[0] = {
      name: 'Fiendish Sorcery',
      disposition: 'permitted prose',
      status: 'permitted',
      contract:
        'Fiendish Sorcery remains a promised conditional numeric benefit.',
      evidence: ['packs/races/tiefling.nVjKDLZSRONzYm8f.yaml'],
    };
    return { value, row };
  };

  it('rejects duplicate and unallocated identities, missing ownership and blanket prose exceptions: duplicate key', () => {
    const { value, row } = tiefling();
    value.rows.push(row);
    expect(
      inspectLaunchInventory(value).inventoryErrors.some(
        ({ code }) => code === 'duplicate-key',
      ),
    ).toBe(true);
  });

  it('rejects duplicate and unallocated identities, missing ownership and blanket prose exceptions: unallocated identity', () => {
    const { value } = unallocatedTiefling();
    expect(
      inspectLaunchInventory(value).inventoryErrors.some(
        ({ code }) => code === 'unallocated-identity',
      ),
    ).toBe(true);
  });

  it('rejects duplicate and unallocated identities, missing ownership and blanket prose exceptions: blanket prose', () => {
    const { value } = proseTiefling();
    expect(
      inspectLaunchInventory(value).inventoryErrors.some(
        ({ code }) => code === 'prose-authority',
      ),
    ).toBe(true);
  });

  it('rejects duplicate and unallocated identities, missing ownership and blanket prose exceptions: missing ownership', () => {
    const { value, row } = proseTiefling();
    expect(() =>
      inspectLaunchInventory({
        ...value,
        rows: [{ ...row, inventoryOwner: null }],
      }),
    ).toThrow();
  });

  it('fails for a missing option or governing notice even while party data is pending', () => {
    const value = freshManifest();
    const pool = value.pools.find(
      ({ name }) => name === 'eligible ordinary ACG arcanist exploits',
    );
    expect(pool?.members).toContain('pf1/P17L09Wh6jFpIPWh');
    expect(
      value.rows.find(
        ({ key }) => key === 'local/race-ability-scores/pf1/nVjKDLZSRONzYm8f',
      )?.implementationOwner.issue,
    ).toBe(740);
    value.rows = value.rows.filter(
      ({ key }) => !['pf1/P17L09Wh6jFpIPWh', 'notice/PZO1131'].includes(key),
    );
    const report = inspectLaunchInventory(value);
    expect(report.inventoryErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'pool-member',
          key: 'pf1/P17L09Wh6jFpIPWh',
        }),
        expect.objectContaining({
          code: 'dependency-missing',
          key: 'notice/PZO1131',
        }),
      ]),
    );
    expect(report.party.status).toBe('pending');
  });

  const reorderedSets = () => {
    const value = freshManifest();
    const reversed = {
      ...value,
      rows: [...value.rows].reverse(),
      roots: [...value.roots].reverse(),
    };
    return { value, reversed };
  };

  it('has deterministic bytes and identity for reordered inventory sets: bytes', () => {
    const { value, reversed } = reorderedSets();
    expect(serializeLaunchInventory(value)).toBe(
      serializeLaunchInventory(reversed),
    );
  });

  it('has deterministic bytes and identity for reordered inventory sets: identity', () => {
    const { value, reversed } = reorderedSets();
    expect(launchScopeIdentity(value)).toBe(launchScopeIdentity(reversed));
  });

  it('preserves the generic fingerprint through document encoding and party edits: document encoding', () => {
    const value = freshManifest();
    expect(
      launchScopeIdentity(parseLaunchInventory(launchInventoryDocument(value))),
    ).toBe(launchScopeIdentity(value));
  });

  it('preserves the generic fingerprint through document encoding and party edits: party edits', () => {
    const value = freshManifest();
    expect(
      launchScopeIdentity({
        ...value,
        party: { ...value.party, owner: 'Actual campaign players' },
      }),
    ).toBe(launchScopeIdentity(value));
  });

  it('changes the generic fingerprint when actual source content changes', () => {
    const value = freshManifest();
    const first = value.rows[0];
    if (!first) throw new Error('Empty manifest.');
    const source = first.sources[0];
    if (!source) throw new Error('Missing source binding.');
    first.sources[0] = { ...source, effectiveSha256: 'f'.repeat(64) };
    expect(launchScopeIdentity(value)).not.toBe(launchScopeIdentity(manifest));
  });

  const withoutAdvancedFinding = () => {
    const value = freshManifest();
    value.semanticContracts = value.semanticContracts.filter(
      ({ id }) => id !== 'rule/advanced/finding/A1',
    );
    return value;
  };

  it('does not hide an omitted advanced source requirement behind launch holds or a false completeness claim: inspection', () => {
    const value = withoutAdvancedFinding();
    const report = inspectLaunchInventory(value);
    expect(
      report.inventoryErrors.some(({ code }) => code === 'advanced-contract'),
    ).toBe(true);
    expect(
      report.launchFailures.some(({ code }) => code === 'implementation'),
    ).toBe(true);
    expect(
      value.coverage.filter(({ contract }) => contract.startsWith('#251 §')),
    ).toHaveLength(19);
  });

  it('does not hide an omitted advanced source requirement behind launch holds or a false completeness claim: rendered report', () => {
    const value = withoutAdvancedFinding();
    expect(renderLaunchInventoryReport(value)).toContain(
      'Generic inventory: INCOMPLETE. Launch qualification: FAILED.',
    );
  });

  const withoutResearchWarnings = (value: LaunchManifest) => ({
    ...value,
    research: [],
    pools: value.pools.map((entry) => ({ ...entry, research: [] })),
  });

  it('cannot hide missing pool authority by erasing research warnings: erased warnings', () => {
    const value = freshManifest();
    const pool = value.pools.find(
      ({ name }) => name === 'eligible ordinary ACG arcanist exploits',
    );
    expect(pool?.membersSha256).toBe(launchInventoryHash(pool?.members));
    const withoutWarnings = withoutResearchWarnings(value);
    expect(inspectLaunchInventory(withoutWarnings).genericComplete).toBe(true);
  });

  it('cannot hide missing pool authority by erasing research warnings: removed member', () => {
    const withoutWarnings = withoutResearchWarnings(freshManifest());
    const exploitPool = withoutWarnings.pools.find(
      ({ name }) => name === 'eligible ordinary ACG arcanist exploits',
    );
    if (!exploitPool) throw new Error('Missing published exploit pool.');
    exploitPool.members = exploitPool.members.filter(
      (key) => key !== 'pf1/P17L09Wh6jFpIPWh',
    );
    exploitPool.membersSha256 = launchInventoryHash(exploitPool.members);
    expect(
      inspectLaunchInventory(withoutWarnings).inventoryErrors.some(
        ({ code }) => code === 'pool-authority',
      ),
    ).toBe(true);
  });
});

it('retains the real Frost Brand Base Item requirement independently of prose links', () => {
  const value = freshManifest();
  expect(
    value.edges.filter((edge) => edge.from === 'pf1/TXd09UXUUNBWPk4Q'),
  ).toContainEqual(
    expect.objectContaining({
      from: 'pf1/TXd09UXUUNBWPk4Q',
      to: 'pf1/oyUApQSVsAqzyjdz',
      kind: 'requirement',
    }),
  );
});

// Content verification (slice 1): a current verified observation overrides
// the frozen one; holds, mechanism rules and the prose refusal stay.
it('lets verified observations override the frozen ones while holds, mechanisms and the prose refusal stay', () => {
  const value = freshManifest();
  const increment = 'everythingpath/fighter-bonus-feats-2';
  const spell = 'pf1/np203icv5b3gr1s9'; // Phantom Trap (CRB p. 320)
  const lineage = 'pf1-content/kDx6ZGhbIteoi7lG'; // Magical Lineage
  const proseRow = value.rows.find(({ key }) => key === spell)!;
  proseRow.mechanisms = proseRow.mechanisms.map((mechanism) => ({
    ...mechanism,
    disposition: 'permitted prose' as const,
    status: 'permitted' as const,
  }));
  const all = [
    'admission',
    'structure',
    'contentEvidence',
    'noticeEvidence',
  ] as const;
  const verification = [increment, spell, lineage].map((key) => ({
    key,
    verified: [...all],
    mechanisms: [],
    evidence: [],
  }));
  const frozen = inspectLaunchInventory(value);
  const report = inspectLaunchInventory(value, { verification });
  const codesOf = (inspection: typeof report, key: string) =>
    inspection.launchFailures
      .filter((failure) => failure.key === key)
      .map(({ code }) => code);
  expect(codesOf(frozen, increment)).toEqual(
    expect.arrayContaining(['admission', 'structure']),
  );
  expect(codesOf(report, increment)).toEqual([]);
  // Magical Lineage keeps its hold or outstanding chosen-spell mechanism.
  expect(codesOf(report, lineage).length).toBeGreaterThan(0);
  expect(codesOf(report, lineage)).not.toContain('admission');
  // Verification never widens the sole prose exception.
  expect(report.inventoryErrors).toContainEqual(
    expect.objectContaining({ code: 'prose-authority', key: spell }),
  );
  expect(report.genericComplete).toBe(false);
}, 120_000);

// Content verification (slice 2): prose by category satisfies only the
// mechanism condition; Magical Lineage's recorded prose stays.
it('lets projected prose satisfy only its mechanism, while holds stay and Magical Lineage still qualifies', () => {
  const value = freshManifest();
  const lineage = 'pf1-content/kDx6ZGhbIteoi7lG'; // Magical Lineage
  const lineageRow = value.rows.find(({ key }) => key === lineage)!;
  expect(lineageRow.mechanisms).toContainEqual(
    expect.objectContaining({
      name: 'Metamagic adjustment',
      disposition: 'permitted prose',
      status: 'permitted',
    }),
  );
  const verified = {
    key: lineage,
    verified: [
      'admission',
      'structure',
      'contentEvidence',
      'noticeEvidence',
    ] as const,
    mechanisms: [],
  };
  const failuresOf = (
    prose?: { mechanism: string; category: 'attack-feat-text' }[],
  ) =>
    inspectLaunchInventory(value, {
      verification: [
        {
          ...verified,
          verified: [...verified.verified],
          ...(prose ? { prose } : {}),
        },
      ],
    });
  const without = failuresOf();
  const withProse = failuresOf([
    { mechanism: 'Chosen spell', category: 'attack-feat-text' },
  ]);
  const of = (report: typeof without, code: string) =>
    report.launchFailures.filter(
      (failure) => failure.key === lineage && failure.code === code,
    );
  expect(of(without, 'implementation').map(({ reason }) => reason)).toEqual([
    expect.stringMatching(/^Chosen spell: /),
  ]);
  expect(of(withProse, 'implementation')).toEqual([]);
  // Prose never clears a hold, and the recorded exception raises no error.
  expect(of(withProse, 'hold')).toEqual(of(without, 'hold'));
  expect(of(withProse, 'hold').length).toBeGreaterThan(0);
  for (const report of [without, withProse])
    expect(
      report.inventoryErrors.filter(
        ({ code, key }) => key === lineage && code.startsWith('prose-'),
      ),
    ).toEqual([]);
}, 120_000);
