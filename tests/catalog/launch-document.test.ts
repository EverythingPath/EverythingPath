// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import {
  launchInventoryDocuments,
  parseLaunchInventoryDocument,
  parseLaunchInventory,
  serializeLaunchInventoryDocument,
} from '../../scripts/catalog/launch-inventory-document';
import { z } from 'zod';
import { launchManifestCopies } from './launch-manifest';

const checkpoints = parseLaunchInventoryDocument(
  JSON.parse(
    readFileSync(
      new URL(
        '../../scripts/catalog/scopes/campaign-mvp-v1.checkpoints.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ),
);

function table(records: unknown[]) {
  return {
    encoding: 'campaign-inventory-records-v3',
    records,
    sha256: createHash('sha256').update(JSON.stringify(records)).digest('hex'),
  };
}

it('preserves printed checkpoint values and order through shared document storage', () => {
  const { documents, records } = launchInventoryDocuments([
    ['checkpoints', checkpoints],
    ['independent-expectations', checkpoints],
  ]);
  expect(parseLaunchInventoryDocument(documents.checkpoints, records)).toEqual(
    checkpoints,
  );
  expect(
    parseLaunchInventoryDocument(
      documents['independent-expectations'],
      records,
    ),
  ).toEqual(checkpoints);
});

it('refuses an absent document body instead of treating it as empty data', () => {
  const records = table([]);
  expect(() =>
    parseLaunchInventoryDocument(
      {
        encoding: records.encoding,
        records: 'campaign-mvp-v1.records.json',
        recordsSha256: records.sha256,
      },
      records,
    ),
  ).toThrow();
});

it('rejects missing and changed shared checkpoint expectations', () => {
  const { documents, records } = launchInventoryDocuments([
    ['checkpoints', checkpoints],
    ['independent-expectations', checkpoints],
  ]);
  expect(() =>
    parseLaunchInventoryDocument(documents.checkpoints, table([])),
  ).toThrow(/Changed inventory records/);
  expect(() =>
    parseLaunchInventoryDocument(documents.checkpoints, {
      ...records,
      records: records.records.map(() => null),
    }),
  ).toThrow(/Changed inventory records/);
});

it('rejects malformed, dangling and cyclic references even in a correctly hashed dictionary', () => {
  const records = table([{ $record: 0 }]);
  const document = {
    encoding: records.encoding,
    records: 'campaign-mvp-v1.records.json',
    recordsSha256: records.sha256,
  };
  for (const reference of ['not-a-record', -1, 1.5, 1])
    expect(() =>
      parseLaunchInventoryDocument(
        { ...document, value: { $record: reference } },
        records,
      ),
    ).toThrow();
  expect(() =>
    parseLaunchInventoryDocument(
      { ...document, value: { $record: 0 } },
      records,
    ),
  ).toThrow(/Cyclic inventory record/);
});

it('returns independently editable projections without sharing mutable decoded records', () => {
  const { documents, records } = launchInventoryDocuments([
    ['checkpoints', checkpoints],
    ['independent-expectations', checkpoints],
  ]);
  const submitted = parseLaunchInventoryDocument(
    documents.checkpoints,
    records,
  );
  if (!Array.isArray(submitted))
    throw new Error('Expected printed checkpoints.');
  submitted.length = 0;
  expect(
    parseLaunchInventoryDocument(
      documents['independent-expectations'],
      records,
    ),
  ).toEqual(checkpoints);
});

it('reparses edited documents and keeps committed records independent from returned manifests', () => {
  const document = z
    .object({ value: z.record(z.string(), z.unknown()) })
    .passthrough()
    .parse(
      JSON.parse(
        readFileSync(
          new URL(
            '../../scripts/catalog/scopes/campaign-mvp-v1.json',
            import.meta.url,
          ),
          'utf8',
        ),
      ),
    );
  const first = parseLaunchInventory(document);
  const row = first.rows[0];
  if (!row) throw new Error('Missing published inventory row.');
  const originalName = row.name;
  row.name = 'Changed source label';
  expect(parseLaunchInventory(document).rows[0]?.name).toBe(originalName);
  document.value.schemaVersion = 2;
  expect(() => parseLaunchInventory(document)).toThrow();
});

it('gives every launch test case a complete manifest that shares no object with another case', () => {
  const document: unknown = JSON.parse(
    readFileSync(
      new URL(
        '../../scripts/catalog/scopes/campaign-mvp-v1.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const freshManifest = launchManifestCopies(document);
  const first = freshManifest();
  expect(JSON.stringify(first)).toBe(
    JSON.stringify(parseLaunchInventory(document)),
  );
  const objects = new Set<object>();
  const collect = (value: unknown) => {
    if (value === null || typeof value !== 'object') return;
    objects.add(value);
    Object.values(value).forEach(collect);
  };
  collect(first);
  let shared = 0;
  const check = (value: unknown) => {
    if (value === null || typeof value !== 'object') return;
    if (objects.has(value)) shared++;
    Object.values(value).forEach(check);
  };
  const second = freshManifest();
  check(second);
  expect(shared).toBe(0);
  const row = first.rows[0];
  if (!row) throw new Error('Missing published inventory row.');
  const originalName = row.name;
  row.name = 'Changed source label';
  first.edges = [];
  expect(second.rows[0]?.name).toBe(originalName);
  expect(freshManifest().rows[0]?.name).toBe(originalName);
  expect(freshManifest().edges).toHaveLength(second.edges.length);
});

it('round-trips actual source contracts and their published inventory rows deterministically', () => {
  const read = (name: string) =>
    JSON.parse(
      readFileSync(
        new URL(`../../scripts/catalog/scopes/${name}`, import.meta.url),
        'utf8',
      ),
    );
  const audit = z
    .object({ contracts: z.array(z.object({ id: z.string() }).passthrough()) })
    .parse(parseLaunchInventoryDocument(read('campaign-mvp-v1.core.json')));
  const ids = [
    'rule/core/general-feat/pf1-content/0DCgS5nYM9tY097b',
    'rule/core/selection/pf1/WLqBCT5DqmGAx8Wd/bonus combat feats/0',
  ];
  const contracts = audit.contracts.filter((entry) => ids.includes(entry.id));
  const rows = parseLaunchInventory(read('campaign-mvp-v1.json')).rows.filter(
    (entry) => ids.includes(entry.key),
  );
  expect(contracts).toHaveLength(2);
  expect(rows.map(({ name }) => name).sort()).toEqual([
    'Elemental Fist',
    'Razortusk',
  ]);
  const source = {
    contracts,
    accounting: [],
    edges: [],
    citations: [],
  };
  const manifest = { rows, edges: [] };
  const inputs: [string, unknown][] = [
    ['campaign-mvp-v1.core.json', source],
    ['campaign-mvp-v1.json', manifest],
  ];
  const first = launchInventoryDocuments(inputs);
  const second = launchInventoryDocuments(inputs);
  expect(
    parseLaunchInventoryDocument(
      first.documents['campaign-mvp-v1.json'],
      first.records,
    ),
  ).toEqual(manifest);
  expect(serializeLaunchInventoryDocument(first)).toBe(
    serializeLaunchInventoryDocument(second),
  );
});

it('keeps the complete committed inventory representation within its compact size budget', () => {
  const output = execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL('../../scripts/check-artifacts.mjs', import.meta.url),
      ),
    ],
    { encoding: 'utf8' },
  );
  expect(output).toContain('campaign-mvp-inventory:');
  expect(output).toContain('Artifact budgets passed');
});

// Owner decision (2026-10-30): 30 s, as the canonical CLI's module load plus one full inspection takes ~9.6 s idle and a projected 14–23 s on Boat-class VMs.
it('exposes the preserved inventory identity and qualification through the CLI', () => {
  const output = execFileSync(
    process.execPath,
    [
      '--import',
      'tsx',
      fileURLToPath(
        new URL('../../scripts/catalog-launch-inventory.ts', import.meta.url),
      ),
    ],
    {
      encoding: 'utf8',
    },
  );
  // #772's reviewed Inquisitor and Magus schedules add 18 required increment
  // rows (judgment 6, teamwork feats 5, magus arcana 5, bonus feats 2), each
  // with its admission, structure, content and notice observations (72), and
  // make the two classes' Spells rows required (5 each, 10), while their
  // outstanding-schedule holds clear (2): 99256 + 72 + 10 - 2.
  // #771A's reviewed Cleric and Sorcerer schedules add 23 required increment
  // rows (channel energy 9, bloodline powers 4, bloodline spells 8, bloodline
  // feats 2; 92) and make six rows required (5 each, 30: the cleric's spells,
  // the sorcerer's bloodline, spells, bloodline spells, exchange spell and
  // bloodline feat, whose bonus-feat formula is a second implementation
  // obligation, 1), while their outstanding-schedule holds clear (2):
  // 99336 + 92 + 30 + 1 - 2.
  // #771B's reviewed Oracle and Witch schedules add 24 required increment
  // rows (mystery spells 9, revelations 5, hexes 10; 96) and make the witch's
  // spells row required (5), while their outstanding-schedule holds clear
  // (2): 99457 + 96 + 5 - 2.
  // The notice-hold clearance (owner, 2026-10-30) makes the 67 required
  // notice rows observe their notices instead of six failures each: 6 with a
  // reviewed identity and 22 with a usable PCGen block are verified (-36,
  // -132), 15 drafted PRD records stay unreviewed without a hold (-15), and
  // 24 without an identity stay held: 99556 - 183.
  // Their review recorded (2026-10-30), the 15 PRD rows are verified too:
  // 99373 - 15 * 5.
  // #596 run A's inventories (2026-10-31) make PZO9455 and PZO9481 required
  // rows (+2) and PZO9491 required; the two owner-owed ones fail six checks
  // each, and Weapon Training's five named holds surface: 99298 + 12 + 5.
  // The drafted PCGen confirmations of the books with their own Section 15
  // line (owner, 2026-10-31) move only the Registry and confirmation hashes
  // the inventory binds; no row changes until their review is recorded.
  // The current Paizo Community Use notice (compliance C1, 2026-10-31) moves
  // only the legal resources hash the inventory binds; no row changes.
  // Their review recorded (2026-10-31), the 10 required book rows the PCGen
  // confirmations cover (PZO9280, 9404, 9407, 9410, 9411, 9412, 9418, 9420,
  // 9423, 9481) are verified and stop failing their six checks:
  // 99315 - 10 * 6.
  // #596 run B (2026-11-01) drops Weapon Training's PZO9410 and PZO9481
  // holds on those reviewed confirmations; its other three holds stay:
  // 99255 - 2.
  // #328 S4-A (2026-11-01) admits Human, Dwarf and Half-Orc and their 21
  // standard traits: the required rows among them drop their whole-content
  // and notice-chain holds (each race keeps #740's launch hold), 99253 - 47.
  // Fix round 1 keeps Languages (Human) held: its three holds return, + 3.
  // #328 S4-B (2026-11-01) confirms 31 Half-Elf, Elf, Gnome and Halfling
  // traits and Gnome and Halfling: the 21 required trait rows drop their
  // whole-content and notice-chain holds and the two races their #328
  // whole-content hold (each keeps #740's launch hold), 99209 - 69. Elf and
  // Half-Elf stay held on the male base weight.
  // The clearance projection (2026-11-03) drops the notice holds the committed
  // clearances name from the content rows that copied them from their legal
  // records: 2,357 holds on required rows, 99138 - 2357.
  // #536 whole-content wave 1 (2026-11-03) confirms 38 of the batch's 41
  // required spell rows; each drops its whole-content hold, 96781 - 38.
  // Alter Winds, Geas, Lesser and Permanency keep a named hold.
  // #544 whole-content wave 2 (2026-11-03) confirms 40 of its 43 required
  // spell rows (spells-544's 42 and Silent Image), 96743 - 40; Make Whole,
  // Transmute Potion to Poison and Monstrous Physique II keep a named hold.
  // #631 wave A (2026-11-04) assesses ten increment parents: their rows cite
  // their inventories and their notice edges the inventories' notices, so
  // the identity moves; no row's failures change (96703).
  // #617 wave B (2026-11-04) assesses eleven more the same way (96703).
  // #516 whole-content wave 3 (2026-11-04, with its fix rounds) frees 38 of
  // its 39 required spell rows (spells-516's 38 and Scrying), 96703 - 38;
  // Absorbing Inhalation keeps a named hold.
  // #615 wave D (2026-11-05) assesses nine more; held Mercy records its
  // Healer's Handbook mercies, so PZO9475 becomes a required notice row
  // (#737's), 19267 + 1 rows and 96665 + 1.
  // The waves 1-2 correction (2026-11-06) bounds 29 rows' bloodline, domain
  // and subdomain mappings: their books' notices become required, four new
  // notice rows (PZO9283, PZO9424, PZO9431, PZO9441; 19268 + 4) and three
  // optional ones turn required (PZO9443, PZO9448, PZO9460). Eight rows are
  // held at the gate, Clashing Rocks on a named hold and Cat's Grace, Mass
  // dependently omitted (96666 + 13).
  // #619 wave E (2026-11-06) assesses three parents with contextNotes: their
  // notice edges cite their inventories, so the identity moves; no row's
  // failures change (96679).
  expect(JSON.parse(output)).toEqual({
    version: 'campaign-mvp-v1',
    identity:
      'sha256:f90caf7d7be1e0a3c02d23b1a988e8b330a35412f3072ef3cbf472dc7e7c399e',
    roots: 31,
    checkpoints: 420,
    rows: 19272,
    pools: 384,
    inventoryErrors: 0,
    outstandingRequirements: 96679,
    genericComplete: true,
    launchQualified: false,
    party: 'pending',
  });
}, 70_000);
