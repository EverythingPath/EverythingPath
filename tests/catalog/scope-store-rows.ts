import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import {
  pcgenPin,
  pins,
  prdPin,
  type Repository,
} from '../../scripts/catalog/inventory.ts';
import ledgerData from '../../scripts/catalog/everythingpath-identities.json' with { type: 'json' };
import {
  foldUpstreamKey,
  locatorKeyOf,
  parseIdentityLedger,
} from '../../scripts/catalog/everythingpath-identities.ts';
import type { LaunchManifest } from '../../scripts/catalog/launch-inventory-schema.ts';
import { decodePartyScope } from '../../scripts/catalog/party/party-scope.ts';
import { pcgenOwnerSelection } from '../../scripts/catalog/pcgen-owners.ts';
import { allIncrementKeys } from '../../scripts/catalog/pcgen/schedules.ts';
import { readReleaseScope } from '../../scripts/catalog/release-scope.ts';
import { openReleaseScope } from '../../scripts/catalog/release-scopes.ts';
import { pinnedStore } from './pinned-sources.ts';

/**
 * pbl-store-topup: a static presence check of the pinned store against what
 * the committed release scopes select (tests/fixtures/pinned/README.md, "What
 * the scopes need"): the record of every selected Foundry key, the file each
 * selected PCGen owner's selector names, and every file a required or
 * selected row binds, with its file digest where the binding records one. The
 * selection is the release operator's own (`openReleaseScope`, as
 * `release-operator.ts` opens a scope). It imports no catalog, so it does not
 * prove that an import succeeds.
 */

type Source = LaunchManifest['rows'][number]['sources'][number];
type StoreSource = Source & { repository: Repository | 'pcgen' | 'prd' };

export type ScopeVersion = 'campaign-mvp-v1' | 'campaign-party-v1';

/** A row of one committed scope the check inspects. */
export type ScopeRow = {
  scope: ScopeVersion;
  key: string;
  name: string;
  /** The operator imports the row's upstream record (`importKeys`). */
  selected: boolean;
  /** The pinned files the launch inventory binds the row to (none in the party scope). */
  sources: StoreSource[];
  /** A selected PCGen owner's: the store path of the file its selector names. */
  ownerFiles: string[];
};

/** The store as the check sees it: Foundry records by key, file bytes by store path. */
export type StoreView = {
  /** The store path (`<repo>/<path>`) of the record with this key. */
  recordFile: (key: string) => string | undefined;
  read: (storePath: string) => Buffer | undefined;
};

const storeRepositories = new Set(['pf1', 'pf1-content', 'pcgen', 'prd']);
const bound = (sources: readonly Source[]) =>
  sources.filter((source): source is StoreSource =>
    storeRepositories.has(source.repository),
  );

/**
 * The PCGen owners a scope's PCGen selection emits: each selector of the
 * committed selection (`pcgenOwnerSelection`) whose owner key, as the
 * identity ledger freezes it for the selector's file and KEY (the lookup
 * `pcgen-owners.ts` makes), is one of the scope's `pcgenKeys`, with the store
 * path of the file the selector names.
 */
export function selectedPcgenOwners(pcgenKeys: readonly string[]) {
  const ledger = parseIdentityLedger(ledgerData, {
    reservedKeys: allIncrementKeys(),
  });
  const owners = new Map<string, string>();
  for (const { externalKey, sources } of ledger.identities)
    for (const source of sources)
      if (source.source === 'pcgen')
        owners.set(locatorKeyOf(source), externalKey);
  const keys = new Set(pcgenKeys);
  return pcgenOwnerSelection.flatMap(({ file, key }) => {
    const owner = owners.get(foldUpstreamKey(`pcgen:${file}#${key}`));
    if (owner === undefined)
      throw new Error(`${key} (${file}) has no frozen identity.`);
    return keys.has(owner)
      ? [{ key: owner, file: posix.join('pcgen', pcgenPin.directory, file) }]
      : [];
  });
}

/**
 * Both committed scopes' rows the store must supply: every Foundry key the
 * operator selects for import (`importKeys`, the rows their descriptions cite
 * included); every PCGen owner its PCGen selection emits (`pcgenKeys`;
 * campaign-mvp-v1 has none); and, in campaign-mvp-v1, every required or
 * selected row with its bound files, whatever the row's own key.
 */
export async function committedScopeRows(): Promise<ScopeRow[]> {
  return [...(await mvpRows()), ...(await partyRows())];
}

/** A selected PCGen owner as a row: no record of its own, the file its selector names. */
const ownerRow = (
  scope: ScopeVersion,
  { key, file }: { key: string; file: string },
  name: string | undefined,
): ScopeRow => ({
  scope,
  key,
  name: name ?? key,
  selected: false,
  sources: [],
  ownerFiles: [file],
});

async function mvpRows(): Promise<ScopeRow[]> {
  const scope = await openReleaseScope({ version: 'campaign-mvp-v1' });
  const selected = new Set(scope.importKeys);
  const { manifest } = await readReleaseScope({ version: 'campaign-mvp-v1' });
  const names = new Map(manifest.rows.map(({ key, name }) => [key, name]));
  return [
    ...manifest.rows
      .filter(
        ({ key, requirement }) =>
          selected.has(key) || requirement === 'required',
      )
      .map(({ key, name, sources }) => ({
        scope: 'campaign-mvp-v1' as const,
        key,
        name,
        selected: selected.has(key),
        sources: bound(sources),
        ownerFiles: [],
      })),
    ...selectedPcgenOwners(scope.pcgenKeys ?? []).map((owner) =>
      ownerRow('campaign-mvp-v1', owner, names.get(owner.key)),
    ),
  ];
}

async function partyRows(): Promise<ScopeRow[]> {
  const scope = await openReleaseScope({ version: 'campaign-party-v1' });
  const names = new Map(
    decodePartyScope(
      JSON.parse(
        readFileSync(
          new URL(
            '../../scripts/catalog/scopes/campaign-party-v1.json',
            import.meta.url,
          ),
          'utf8',
        ),
      ),
    ).rows.map(({ key, name }) => [key, name]),
  );
  return [
    ...scope.importKeys.map((key) => ({
      scope: 'campaign-party-v1' as const,
      key,
      name: names.get(key) ?? key,
      selected: true,
      sources: [],
      ownerFiles: [],
    })),
    ...selectedPcgenOwners(scope.pcgenKeys ?? []).map((owner) =>
      ownerRow('campaign-party-v1', owner, names.get(owner.key)),
    ),
  ];
}

/** The pin the store holds for a repository, in a launch binding's terms. */
const storePin = (repository: StoreSource['repository']) =>
  repository === 'pcgen'
    ? pcgenPin.commit
    : repository === 'prd'
      ? prdPin.contentSha256
      : pins[repository].commit;

/** A binding's file in the store: its locator without a line or anchor suffix. */
export function sourceStorePath({ repository, locator }: StoreSource) {
  const file = locator.replace(/[#:].*$/, '');
  return repository === 'pcgen'
    ? posix.join('pcgen', pcgenPin.directory, file)
    : posix.join(repository, file);
}

const sha256 = (bytes: Buffer) =>
  createHash('sha256').update(bytes).digest('hex');

/**
 * The bound file's own digest: `rawFileSha256`, else `rawSha256`, except that
 * a PCGen binding without `rawFileSha256` hashes the record PCGen compiles
 * from the file, not the file (launch-inventory.ts, "source-effective"), so
 * only the file's presence is checked.
 */
function fileDigest(source: StoreSource) {
  if (source.rawFileSha256 !== undefined) return source.rawFileSha256;
  return source.repository === 'pcgen' ? undefined : source.rawSha256;
}

/** Why the store cannot supply a bound file, or undefined. */
function boundFileGap(source: StoreSource, store: StoreView) {
  const path = sourceStorePath(source);
  if (source.pin !== storePin(source.repository))
    return `${path} is bound at pin ${source.pin}`;
  const bytes = store.read(path);
  if (bytes === undefined) return `${path} is absent`;
  const digest = fileDigest(source);
  return digest !== undefined && sha256(bytes) !== digest
    ? `${path} differs from its bound digest`
    : undefined;
}

/**
 * One line per thing the store cannot supply: a selected row with no store
 * record for its key, a selected PCGen owner whose selector's file the store
 * lacks, or a bound file the store lacks, holds at another pin or holds with
 * other bytes than the binding's file digest (`fileDigest`).
 */
export function scopeStoreGaps(rows: readonly ScopeRow[], store: StoreView) {
  const gaps: string[] = [];
  for (const row of rows) {
    const label = `${row.scope} ${row.key} (${row.name})`;
    if (row.selected && store.recordFile(row.key) === undefined)
      gaps.push(`${label}: no store file`);
    for (const path of row.ownerFiles)
      if (store.read(path) === undefined)
        gaps.push(`${label}: ${path}, its PCGen owner's file, is absent`);
    for (const source of row.sources) {
      const gap = boundFileGap(source, store);
      if (gap !== undefined) gaps.push(`${label}: ${gap}`);
    }
  }
  return gaps;
}

const topLevelId = /^_id: *['"]?([\w-]+)['"]?\s*$/m;

/** The checked-out store: every Foundry pack file indexed by its record's `_id`. */
export function readStore(root = pinnedStore): StoreView {
  const records = new Map<string, string>();
  for (const repo of Object.keys(pins) as Repository[]) {
    const top = posix.join(repo, pins[repo].directory);
    for (const file of readdirSync(join(root, top), { recursive: true })) {
      if (typeof file !== 'string' || !/\.ya?ml$/.test(file)) continue;
      const path = posix.join(top, file.split('\\').join('/'));
      const id = topLevelId.exec(readFileSync(join(root, path), 'utf8'))?.[1];
      if (id === undefined) continue;
      const key = `${repo}/${id}`;
      const known = records.get(key);
      if (known !== undefined)
        throw new Error(`Two store files hold ${key}: ${known}, ${path}`);
      records.set(key, path);
    }
  }
  return {
    recordFile: (key) => records.get(key),
    read: (path) => {
      try {
        return readFileSync(join(root, path));
      } catch {
        return undefined;
      }
    },
  };
}
