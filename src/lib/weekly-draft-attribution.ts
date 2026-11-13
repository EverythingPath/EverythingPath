import { z } from 'zod';
import type {
  DraftObservation,
  DraftTargetRevision,
} from './weekly-draft-persistence-contract';

export type RemoteDraftChange = {
  sequence: number;
  targets: readonly (readonly string[])[];
};

const targetPath = z.array(z.string()).nonempty();

function overlaps(first: readonly string[], second: readonly string[]) {
  return first
    .slice(0, Math.min(first.length, second.length))
    .every((part, index) => part === second[index]);
}

export function createDraftAttribution(ownRevisions: ReadonlySet<number>) {
  let baseline: number | null = null;
  let sequence = 0;
  let closed = false;
  let change: RemoteDraftChange | null = null;
  const seen = new Map<string, number>();
  let dispatched: { revision: number; targets: readonly string[][] } | null =
    null;
  const deferred = new Map<
    string,
    { path: string[]; revisions: [number, ...number[]] }
  >();
  let uncertain: string[][] = [];
  function publish(targets: string[][]) {
    if (targets.length)
      change = {
        sequence: ++sequence,
        targets: [
          ...new Map(
            targets.map((path) => [JSON.stringify(path), path]),
          ).values(),
        ],
      };
  }
  function close() {
    closed = true;
    change = null;
    dispatched = null;
    deferred.clear();
    seen.clear();
    uncertain = [];
  }
  function resolve() {
    dispatched = null;
    const targets = [...deferred.values()]
      .filter((candidate) =>
        candidate.revisions.some((revision) => !ownRevisions.has(revision)),
      )
      .map((candidate) => candidate.path);
    deferred.clear();
    return targets;
  }
  function classifyTarget(row: DraftTargetRevision, baselineRevision: number) {
    if (row.revision <= (seen.get(row.target) ?? baselineRevision)) return null;
    seen.set(row.target, row.revision);
    if (ownRevisions.has(row.revision)) return null;
    try {
      const parsed = targetPath.safeParse(JSON.parse(row.target));
      if (
        !parsed.success ||
        uncertain.some((path) => overlaps(path, parsed.data))
      )
        return null;
      const pending =
        dispatched !== null &&
        row.revision > dispatched.revision &&
        dispatched.targets.some((path) => overlaps(path, parsed.data));
      return { path: parsed.data, pending };
    } catch {
      // Malformed metadata cannot justify a player-facing attribution.
      return null;
    }
  }
  function deferTarget(row: DraftTargetRevision, path: string[]) {
    const previous = deferred.get(row.target);
    deferred.set(row.target, {
      path,
      // One serially dispatched operation can own at most one revision.
      revisions: previous
        ? [previous.revisions[0], row.revision]
        : [row.revision],
    });
  }
  function observe(observation: DraftObservation, targets: string[][] = []) {
    if (observation.status === 'closed') close();
    if (closed) return;
    baseline ??= observation.revision;
    for (const row of observation.targetRevisions) {
      const evidence = classifyTarget(row, baseline);
      if (!evidence) continue;
      if (evidence.pending) deferTarget(row, evidence.path);
      else targets.push(evidence.path);
    }
    publish(targets);
  }
  return {
    close,
    getChange: () => structuredClone(change),
    begin(revision: number, targets: string[][]) {
      if (closed) return;
      dispatched = { revision, targets };
    },
    accepted(observation: DraftObservation) {
      // One receipt may resolve an observed overlap and reveal newer targets.
      // Publish their union before the persistence owner notifies subscribers.
      observe(observation, resolve());
    },
    failed(definitiveRejection: boolean) {
      if (!dispatched) return;
      if (definitiveRejection) {
        publish(resolve());
        return;
      }
      for (const path of dispatched.targets) {
        if (
          uncertain.some(
            (known) => known.length <= path.length && overlaps(known, path),
          )
        )
          continue;
        uncertain = uncertain.filter(
          (known) => !(path.length <= known.length && overlaps(path, known)),
        );
        uncertain.push([...path]);
      }
      dispatched = null;
      deferred.clear();
    },
    observe,
  };
}
