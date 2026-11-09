'use client';
import { useMutation } from 'convex/react';
import { useQuery } from '@tanstack/react-query';
import { convexQuery } from '@convex-dev/react-query';
import { useState } from 'react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import { useCharacterLedgerQuery } from '~/lib/sharedQueries';
import { mirrorRosterKinds } from '~/lib/character-kind';
import type { SetupCharacter } from '~/lib/setup-characters';

type Snapshot = CanonicalWeekState['militiaSnapshot'];

// The accepted militia and its only write: a reasoned correction bound to
// the revision it was prepared against. Every write carries the campaign and
// militia this hook was mounted for, so a later scope change never
// retargets it.
//
// Once loaded, a scope's militia never goes back to loading. A moment
// without a result (while the subscription is re-established) would unmount
// an open correction and mount it again: its menus and pickers would close,
// and its heading would take focus from the control in use (#141).
export function useLedgerCorrection({
  campaignId,
  militiaId,
}: {
  campaignId: Id<'campaign'>;
  militiaId: Id<'militia'>;
}) {
  const { data: result } = useQuery({
    ...convexQuery(api.canonicalLedger.read, { campaignId, militiaId }),
    throwOnError: true,
  });
  const [kept, keep] = useState<{
    campaignId: Id<'campaign'>;
    militiaId: Id<'militia'>;
    ledger: NonNullable<typeof result>;
  } | null>(null);
  const sameScope =
    kept?.campaignId === campaignId && kept.militiaId === militiaId;
  if (result !== undefined && (!sameScope || kept.ledger !== result))
    keep({ campaignId, militiaId, ledger: result });
  const ledger = result ?? (sameScope ? kept.ledger : undefined);
  const saveCorrection = useMutation(api.canonicalLedger.save);
  return {
    ledger,
    write: (correction: {
      expectedRevision: number;
      snapshot: Snapshot;
      reason: string;
    }) => saveCorrection({ campaignId, militiaId, ...correction }),
  };
}

// The Militia page's ledger: the correction write, sending roster kinds as
// the current records' PC or NPC; the server mirrors them again from the
// records it reads.
export function useCanonicalLedger({
  campaignId,
  militiaId,
  organizationId,
}: {
  campaignId: Id<'campaign'>;
  militiaId: Id<'militia'>;
  organizationId: string;
}) {
  const { ledger, write } = useLedgerCorrection({ campaignId, militiaId });
  const { data: records = [] } = useCharacterLedgerQuery(
    campaignId,
    organizationId,
    true,
    true,
  );
  const characters: SetupCharacter[] = records.map((c) => ({
    characterId: c._id,
    name: c.name,
    level: c.level,
    strength: c.strength,
    dexterity: c.dexterity,
    constitution: c.constitution,
    intelligence: c.intelligence,
    wisdom: c.wisdom,
    charisma: c.charisma,
    isActive: c.isActive,
    kind: c.kind,
  }));
  return {
    ledger,
    characters,
    save: (correction: {
      expectedRevision: number;
      snapshot: Snapshot;
      reason: string;
    }) =>
      write({
        ...correction,
        snapshot: {
          ...correction.snapshot,
          roster: mirrorRosterKinds(correction.snapshot.roster, characters),
        },
      }),
  };
}
