import { parseLaunchInventoryDocument } from './launch-inventory-document.ts';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { launchAuthority as authority } from './launch-inventory-authority.ts';
import {
  launchManifestSchema,
  type LaunchManifest,
} from './launch-inventory-schema.ts';
import { classSources, classScheduleOwner } from './launch-class-sources.ts';
import { classTableRows, printedSourceColumns } from './prd-coverage.ts';
import { reviewedSchedule, scheduleRows } from './pcgen/schedules.ts';
import { prdPin } from './inventory.ts';
import { sourceHash } from './launch-inventory-sources.ts';
import { launchInventoryHash } from './launch-inventory.ts';

const data: unknown = parseLaunchInventoryDocument(
  JSON.parse(
    readFileSync(
      new URL('./scopes/campaign-mvp-v1.checkpoints.json', import.meta.url),
      'utf8',
    ),
  ),
);
const checkpointAuthority = launchManifestSchema.shape.checkpoints.parse(data);

/** Reproduce authority from printed files and reviewed schedules, never submitted inventory. */
export async function buildLaunchCheckpointAuthority({
  prdRoot,
}: {
  prdRoot: string;
}) {
  const checkpoints: LaunchManifest['checkpoints'] = [];
  for (const root of authority.roots.filter(({ kind }) => kind === 'class')) {
    const config = classSources[root.name];
    if (!config)
      throw new Error(`Missing printed class authority ${root.name}.`);
    const bytes = await readFile(join(prdRoot, config.path));
    const html = bytes.toString('utf8');
    const table = classTableRows(html, config.caption);
    if (table.length !== 20)
      throw new Error(`Expected twenty printed levels for ${root.name}.`);
    const columns = printedSourceColumns({
      html,
      lines: table.map(({ line }) => line),
    });
    const schedule = reviewedSchedule(root.name);
    for (const row of table)
      checkpoints.push({
        classKey: root.key,
        className: root.name,
        level: row.level,
        source: {
          repository: 'prd',
          pin: prdPin.contentSha256,
          locator: `${config.path}#L${row.line}`,
          rawSha256: sourceHash(bytes),
          effectiveSha256: sourceHash(bytes),
        },
        printed: row.special,
        columns: row.columns,
        sourceColumns: columns.get(row.line) ?? {},
        scheduledKeys: schedule
          ? scheduleRows(schedule)
              .filter(({ classLevel }) => classLevel === row.level)
              .map(({ externalKey }) => externalKey)
          : [],
        scheduleStatus: schedule ? 'reviewed schedule' : 'outstanding schedule',
        owner: classScheduleOwner(root.name),
      });
  }
  return checkpoints;
}

export function checkLaunchCheckpoints({
  manifest,
  fail,
}: {
  manifest: LaunchManifest;
  fail: (code: string, key: string, reason: string) => void;
}) {
  const expected = new Map(
    checkpointAuthority.map((entry) => [
      `${entry.classKey}:${entry.level}`,
      entry,
    ]),
  );
  if (
    checkpointAuthority.length !== 420 ||
    expected.size !== 420 ||
    launchInventoryHash(checkpointAuthority) !==
      authority.checkpointAuthoritySha256
  )
    fail(
      'checkpoint-authority',
      manifest.scopeVersion,
      'Printed checkpoint authority changed independently of the submitted inventory.',
    );
  const seen = new Set<string>();
  const rows = new Map(manifest.rows.map((row) => [row.key, row]));
  for (const checkpoint of manifest.checkpoints) {
    const key = `${checkpoint.classKey}:${checkpoint.level}`;
    if (seen.has(key))
      fail('checkpoint-duplicate', key, 'Duplicate class/level checkpoint.');
    seen.add(key);
    const printed = expected.get(key);
    if (
      !printed ||
      launchInventoryHash(checkpoint) !== launchInventoryHash(printed)
    )
      fail(
        'checkpoint-contract',
        key,
        'Checkpoint must retain its exact printed columns, source hash domains, class, level, ownership and applicable reviewed schedule.',
      );
    const schedule = reviewedSchedule(checkpoint.className);
    const keys = schedule
      ? scheduleRows(schedule)
          .filter(({ classLevel }) => classLevel === checkpoint.level)
          .map(({ externalKey }) => externalKey)
      : [];
    if (
      launchInventoryHash(checkpoint.scheduledKeys) !==
        launchInventoryHash(keys) ||
      checkpoint.scheduleStatus !==
        (schedule ? 'reviewed schedule' : 'outstanding schedule') ||
      checkpoint.scheduledKeys.some(
        (key) => rows.get(key)?.requirement !== 'required',
      )
    )
      fail(
        'checkpoint-schedule',
        key,
        'Scheduled keys must exist as required rows and apply to this receiving class and level; outstanding schedules grant no invented keys.',
      );
    const source = printed && {
      ...printed.source,
      locator: printed.source.locator.split('#')[0] ?? '',
    };
    if (
      !source ||
      !rows
        .get(checkpoint.classKey)
        ?.sources.some(
          (binding) =>
            launchInventoryHash(binding) === launchInventoryHash(source),
        )
    )
      fail(
        'checkpoint-source',
        key,
        'The receiving class must retain the independently bound printed table source.',
      );
  }
  for (const [key] of expected)
    if (!seen.has(key))
      fail(
        'checkpoint-missing',
        key,
        'Missing independently required printed class/level checkpoint.',
      );
}

export async function verifyLaunchCheckpointAuthority({
  prdRoot,
}: {
  prdRoot: string;
}) {
  const reproduced = await buildLaunchCheckpointAuthority({ prdRoot });
  if (
    launchInventoryHash(reproduced) !== launchInventoryHash(checkpointAuthority)
  )
    throw new Error(
      'Checkpoint authority differs from pinned printed tables or reviewed schedules.',
    );
}
