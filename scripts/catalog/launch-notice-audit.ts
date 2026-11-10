import { readFileSync } from 'node:fs';
import { parseLaunchInventoryDocument } from './launch-inventory-document.ts';
import type { AuditIndexes } from './launch-audit-shared.ts';
import { launchAuthority } from './launch-inventory-authority.ts';
import type { LaunchManifest } from './launch-inventory-schema.ts';
import { launchInventoryHash, rootPaths } from './launch-inventory.ts';
import {
  buildLaunchNoticeAuthority,
  launchNoticeScopeHash,
  noticeAuthoritySchema,
} from './launch-notice-authority.ts';

const authorityBytes = readFileSync(
  new URL('./scopes/campaign-mvp-v1.notices.json', import.meta.url),
  'utf8',
);
const data: unknown = parseLaunchInventoryDocument(JSON.parse(authorityBytes));
const authority = noticeAuthoritySchema.parse(data);
const authorityHash = launchInventoryHash(authority);
const paths = rootPaths(authority.pathGraph);
const required = new Map(
  authority.notices
    .filter(({ requirement }) => requirement === 'required')
    .map((row) => [row.key, row]),
);
// Reports may share these independent facts, but callers must not mutate later inspections.
for (const [key, row] of required) {
  for (const owner of [
    row.inventoryOwner,
    row.implementationOwner,
    row.publicTestOwner,
  ]) {
    Object.freeze(owner.evidence);
    Object.freeze(owner);
  }
  const witnesses = paths.get(key) ?? [];
  for (const witness of witnesses) {
    Object.freeze(witness.keys);
    Object.freeze(witness.reasons);
    Object.freeze(witness);
  }
  Object.freeze(witnesses);
}
const edges = authority.edges
  .filter(({ to }) => required.has(to))
  .map((edge) => ({ edge, hash: launchInventoryHash(edge) }));

function pathSignatures(witnesses: { keys: string[]; reasons: string[] }[]) {
  return new Set(
    witnesses.map(({ keys, reasons }) =>
      JSON.stringify([keys[0], keys.at(-2), reasons.at(-1)]),
    ),
  );
}
const incoming = new Map(
  [...required.keys()].map((key) => [
    key,
    pathSignatures(paths.get(key) ?? []),
  ]),
);

/** Known owners and root paths survive row, edge and coverage omission or corruption. */
export function requiredNoticeContext({ key }: { key: string }) {
  const row = required.get(key);
  return row && { owner: row.implementationOwner, paths: paths.get(key) ?? [] };
}

export function checkLaunchNotices({
  manifest,
  indexes,
  incomingPaths,
  fail,
}: {
  manifest: LaunchManifest;
  indexes: AuditIndexes;
  incomingPaths: ReturnType<typeof rootPaths>;
  fail: (code: string, key: string, reason: string) => void;
}) {
  if (authorityHash !== launchAuthority.noticeAuthoritySha256)
    fail(
      'notice-authority',
      manifest.scopeVersion,
      'Required notice authority changed independently of the submitted inventory.',
    );
  if (
    launchNoticeScopeHash(manifest, indexes.mechanicalEdges) !==
    authority.scopeSha256
  )
    fail(
      'notice-scope',
      manifest.scopeVersion,
      'Generic source identities, bindings or mechanical scope changed; reproduce notice authority from governing inputs before relying on it.',
    );
  for (const [key, expected] of required) {
    const row = indexes.rows.get(key);
    if (
      row?.kind !== 'notice' ||
      row.catalogKey !== null ||
      row.name !== expected.name ||
      row.requirement !== 'required'
    )
      fail(
        'notice-required',
        key,
        'Every independently required governing/whole-body notice must retain its exact identity and required disposition.',
      );
    if (
      launchInventoryHash(row?.sources) !==
      launchInventoryHash(expected.sources)
    )
      fail(
        'notice-source',
        key,
        'Required notice must retain its original pinned provenance and source hash domains; submitted observations cannot replace independent evidence.',
      );
    if (
      launchInventoryHash(
        row && [
          row.inventoryOwner,
          row.implementationOwner,
          row.publicTestOwner,
        ],
      ) !==
      launchInventoryHash([
        expected.inventoryOwner,
        expected.implementationOwner,
        expected.publicTestOwner,
      ])
    )
      fail(
        'notice-owner',
        key,
        'Required notice must retain its original inventory, implementation and public-test owners.',
      );
    const actual = pathSignatures(incomingPaths.get(key) ?? []);
    if (
      [...(incoming.get(key) ?? [])].some((signature) => !actual.has(signature))
    )
      fail(
        'notice-path',
        key,
        'An independently required root-to-notice incoming reason/path is missing; citation links cannot satisfy a mechanical notice dependency.',
      );
  }
  for (const { edge, hash } of edges)
    if (!indexes.edges.has(hash))
      fail(
        'notice-edge',
        edge.to,
        `Missing required incoming notice reason, condition or evidence from ${edge.from}.`,
      );
  for (const entry of authority.coverage)
    for (const key of entry.keys.filter((key) => required.has(key)))
      if (
        !manifest.coverage
          .find(({ contract }) => contract === entry.contract)
          ?.keys.includes(key)
      )
        fail(
          'notice-coverage',
          key,
          `Missing independently required notice reference in ${entry.contract}.`,
        );
  for (const entry of manifest.coverage)
    for (const key of entry.keys.filter((key) => key.startsWith('notice/')))
      if (!indexes.rows.has(key))
        fail(
          'notice-coverage',
          key,
          `Dangling notice reference in ${entry.contract}.`,
        );
}

/** CLI receives a fresh pinned-input build, never the submitted manifest being inspected. */
export async function verifyLaunchNoticeAuthority({
  inventory,
  repoRoot,
}: {
  inventory: LaunchManifest;
  repoRoot: string;
}) {
  const reproduced = await buildLaunchNoticeAuthority({ inventory, repoRoot });
  if (
    launchInventoryHash(reproduced) !== authorityHash ||
    JSON.stringify(reproduced) !== JSON.stringify(data)
  )
    throw new Error(
      'Notice authority differs from pinned governing/legal inputs or actual generic scope.',
    );
}
