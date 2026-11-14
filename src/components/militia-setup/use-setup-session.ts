'use client';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { useQuery } from '@tanstack/react-query';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { campaignPath, weekPath } from '~/lib/campaign-routes';
import { newMilitiaSetup, type MilitiaSetup } from '~/lib/canonical-setup';
import {
  browserSetupStorage,
  readSetupEnvelope,
  retireSetupEnvelope,
  SETUP_ENVELOPE_VERSION,
  writeSetupEnvelope,
  type SetupProgress,
  type SetupRestore,
  type SetupStorage,
} from '~/lib/setup-envelope';
import {
  composeSetupCharacters,
  withCurrentCharacters,
  type SetupCharacter,
} from '~/lib/setup-characters';
import type { GuidedSetupProps } from './use-guided-setup';

export type SetupSessionScope = {
  accountId: string;
  organizationId: string;
  campaignId: Id<'campaign'>;
};
// Something the player should know about keeping their entries.
export type SetupNotice =
  /** Entries will not survive a reload or leaving the page. */
  | 'unkept'
  /** Entries from an earlier visit could not be restored. */
  | 'notRestored';
export type SetupSessionView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  /** Setup had already started when this page first loaded. */
  | {
      kind: 'started';
      week: number | null;
      weekHref: string;
      militiaHref: string;
    }
  /** Another player started the militia while this form was open. */
  | { kind: 'opening' }
  | {
      kind: 'form';
      notice: SetupNotice | null;
      guided: Omit<GuidedSetupProps, 'onAddCharacter'>;
    };

type FormEntry = SetupProgress & {
  kind: 'form';
  restore: SetupRestore['kind'];
  initializationId: string;
  /** A start sent before a reload whose result never arrived. */
  submitted: MilitiaSetup | null;
};
type Entry = { kind: 'started' } | FormEntry;
type Attempt = 'idle' | 'pending' | 'recovering' | 'succeeded' | 'failed';

// Setup's entry, browser resume and start. The first authoritative options
// result decides the entry: an already-started militia shows the started
// page, even over a stale envelope; otherwise the form opens, resumed from
// this browser's envelope. A later completion by another player opens the
// accepted week; this player's own start opens its requested phase once.
export function useSetupSession({
  accountId,
  organizationId,
  campaignId,
  storage: givenStorage,
}: SetupSessionScope & {
  storage?: SetupStorage | null;
}): SetupSessionView {
  const scope = useMemo(
    () => ({ accountId, organizationId, campaignId }),
    [accountId, organizationId, campaignId],
  );
  const [storage] = useState(() =>
    givenStorage === undefined ? browserSetupStorage() : givenStorage,
  );
  const { data: options } = useQuery({
    ...convexQuery(api.canonicalSetup.options, { campaignId }),
    throwOnError: true,
  });
  // Options carry no kind; the authorized character read supplies each
  // record's kind, composed here rather than added to the options result.
  const { data: records } = useQuery({
    ...convexQuery(api.character.listByCampaign, {
      campaignId,
      organizationId,
      includeInactive: true,
    }),
    throwOnError: true,
  });
  const characters = useMemo(
    () =>
      options && records
        ? composeSetupCharacters(options.characters, records)
        : undefined,
    [options, records],
  );
  const initialize = useMutation(api.canonicalSetup.initialize);
  const router = useRouter();

  // The entry waits for authorization (options) and the current records, so
  // a restored envelope is migrated against the kinds its records own now.
  const [entry, setEntry] = useState<Entry>();
  if (entry === undefined && options?.started) setEntry({ kind: 'started' });
  else if (entry === undefined && options && characters)
    setEntry(formEntry(readSetupEnvelope(storage, scope), characters));
  const { data: workspace } = useQuery({
    ...convexQuery(
      api.canonicalDraftPersistence.workspace,
      entry?.kind === 'started' ? { campaignId } : 'skip',
    ),
    throwOnError: true,
  });

  const [attempt, setAttempt] = useState<Attempt>('idle');
  const [unkept, setUnkept] = useState(false);
  // What the envelope holds besides the entry: the latest form position and
  // the source of a start whose result is unknown.
  const latest = useRef<{
    progress?: SetupProgress;
    submitted?: MilitiaSetup | null;
  }>({});
  // Once setup has started, nothing may write the envelope again.
  const retired = useRef(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const staleEnvelope =
    entry?.kind === 'started' ||
    (entry?.kind === 'form' && entry.restore === 'discarded');
  useEffect(() => {
    if (staleEnvelope) retireSetupEnvelope(storage, scope);
  }, [staleEnvelope, storage, scope]);

  const form = entry?.kind === 'form' ? entry : null;
  function persist(progress?: SetupProgress, submitted?: MilitiaSetup | null) {
    if (!form || retired.current) return;
    latest.current = {
      progress: progress ?? latest.current.progress,
      submitted: submitted === undefined ? latest.current.submitted : submitted,
    };
    const kept = writeSetupEnvelope(storage, {
      version: SETUP_ENVELOPE_VERSION,
      scope,
      ...(latest.current.progress ?? form),
      initializationId: form.initializationId,
      submitted:
        latest.current.submitted === undefined
          ? form.submitted
          : latest.current.submitted,
    });
    if (!kept) setUnkept(true);
  }
  async function sendSetup(setup: MilitiaSetup) {
    if (!form) return;
    try {
      // Every attempt, including one after a reload, reuses this identity, so
      // a start retried with the same source is idempotent and a different
      // source cannot replace an accepted setup.
      await initialize({
        campaignId: scope.campaignId,
        initializationId: form.initializationId,
        setup,
      });
    } catch (error) {
      inFlight.current = false;
      persist(undefined, null);
      setAttempt('failed');
      throw error;
    }
    retired.current = true;
    retireSetupEnvelope(storage, scope);
    setAttempt('succeeded');
    // A player who has left this page, or switched campaign, stays put.
    if (mounted.current) router.push(weekPath(scope.campaignId, setup.phase));
  }
  function save(setup: MilitiaSetup) {
    if (!form || inFlight.current) return Promise.resolve();
    inFlight.current = true;
    setAttempt('pending');
    // Kept before sending, so a reload before the result retries this source.
    persist(undefined, setup);
    return sendSetup(setup);
  }

  // A start sent before a reload may be the one that just started the
  // militia: resending its source under the same identity finds out.
  const recovering = attempt === 'recovering';
  const unacknowledged =
    form && (attempt === 'idle' || recovering) ? form.submitted : null;
  // Otherwise another player's completion wins unless this player's own
  // start is in flight or has succeeded; a failed start yields to it too.
  const startedElsewhere =
    form !== null &&
    options?.started === true &&
    (attempt === 'idle' || attempt === 'failed' || recovering);
  // The recovery status belongs to this observation. The effect sends the
  // already-kept source and reports only the eventual request outcome.
  if (startedElsewhere && unacknowledged && attempt === 'idle')
    setAttempt('recovering');
  const followStarted = useEffectEvent(() => {
    if (unacknowledged) {
      if (inFlight.current) return;
      inFlight.current = true;
      sendSetup(unacknowledged).catch(() => undefined);
      return;
    }
    retired.current = true;
    retireSetupEnvelope(storage, scope);
    router.replace(campaignPath(scope.campaignId, 'week'));
  });
  useEffect(() => {
    if (startedElsewhere) followStarted();
  }, [startedElsewhere, recovering]);

  if (options === undefined || (options && entry === undefined))
    return { kind: 'loading' };
  if (!options || !entry) return { kind: 'unavailable' };
  if (entry.kind === 'started')
    return {
      kind: 'started',
      week: workspace?.week ?? null,
      weekHref: campaignPath(campaignId, 'week'),
      militiaHref: campaignPath(campaignId, 'militia'),
    };
  if (startedElsewhere && !unacknowledged) return { kind: 'opening' };
  // A form entry exists only once the records have loaded.
  if (!characters) return { kind: 'loading' };
  return {
    kind: 'form',
    notice: storageNotice(entry.restore, unkept),
    guided: {
      characters,
      initialValues: entry.values,
      initialStep: entry.step,
      initialVisited: entry.visited,
      resumed: entry.restore === 'restored',
      onProgress: (progress) => persist(progress),
      onSave: save,
      // Start stays disabled while a start is out or its week is opening.
      starting:
        attempt === 'pending' ||
        recovering ||
        attempt === 'succeeded' ||
        (startedElsewhere && unacknowledged !== null),
    },
  };
}

function storageNotice(
  restore: SetupRestore['kind'],
  unkept: boolean,
): SetupNotice | null {
  if (unkept || restore === 'unavailable') return 'unkept';
  if (restore === 'discarded') return 'notRestored';
  return null;
}

// The form's starting point: the restored envelope, with each roster
// character's current ledger facts and record kind, or a New militia's
// defaults.
function formEntry(
  restore: SetupRestore,
  characters: readonly SetupCharacter[],
): FormEntry {
  if (restore.kind === 'restored') {
    const { values, step, visited, initializationId, submitted } =
      restore.envelope;
    return {
      kind: 'form',
      restore: restore.kind,
      values: withCurrentCharacters(values, characters),
      step,
      visited,
      initializationId,
      submitted,
    };
  }
  return {
    kind: 'form',
    restore: restore.kind,
    values: newMilitiaSetup('Loyalty'),
    step: 'startingPoint',
    visited: ['startingPoint'],
    initializationId: crypto.randomUUID(),
    submitted: null,
  };
}
