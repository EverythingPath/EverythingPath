'use client';
import { useState } from 'react';
import type { Id } from '@convex/_generated/dataModel';
import { CharacterRecordDialog } from '~/components/character-manager/character-record-dialog';
import type { SetupStorage } from '~/lib/setup-envelope';
import { GuidedMilitiaSetup } from './guided';
import {
  SetupOpening,
  SetupPageFrame,
  SetupSkeleton,
  SetupStarted,
  SetupStorageNotice,
} from './setup-states';
import { useSetupSession, type SetupSessionScope } from './use-setup-session';

function SetupSession(
  props: SetupSessionScope & { storage?: SetupStorage | null },
) {
  const session = useSetupSession(props);
  const [addingCharacter, setAddingCharacter] = useState(false);
  switch (session.kind) {
    case 'loading':
      return <SetupSkeleton />;
    case 'unavailable':
      return (
        <p role="status">Militia setup is unavailable for this campaign.</p>
      );
    case 'started':
      return (
        <SetupStarted
          week={session.week}
          weekHref={session.weekHref}
          militiaHref={session.militiaHref}
        />
      );
    case 'opening':
      return <SetupOpening />;
    case 'form':
      return (
        <>
          {session.notice ? (
            <SetupStorageNotice notice={session.notice} />
          ) : null}
          <GuidedMilitiaSetup
            {...session.guided}
            onAddCharacter={() => setAddingCharacter(true)}
          />
          {/* Outside the step layouts, so its values survive any change. */}
          <CharacterRecordDialog
            campaignId={props.campaignId}
            organizationId={props.organizationId}
            open={addingCharacter}
            onOpenChange={setAddingCharacter}
          />
        </>
      );
  }
}

// Setup for one campaign, inside the shell's verified campaign access. Each
// account, organization and campaign has its own session, so a switch never
// shows or retargets another scope's unfinished setup.
export function MilitiaSetupScreen({
  accountId,
  organizationId,
  campaignId,
  storage,
}: {
  accountId: string | null | undefined;
  organizationId: string;
  campaignId: Id<'campaign'>;
  /** This browser's storage by default. */
  storage?: SetupStorage | null;
}) {
  return (
    <SetupPageFrame>
      {accountId ? (
        <SetupSession
          key={[accountId, organizationId, campaignId].join(':')}
          accountId={accountId}
          organizationId={organizationId}
          campaignId={campaignId}
          storage={storage}
        />
      ) : (
        <SetupSkeleton />
      )}
    </SetupPageFrame>
  );
}
