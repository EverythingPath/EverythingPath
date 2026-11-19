'use client';
import { useState } from 'react';
import { useNavigationGuard } from '~/components/campaign-shell/navigation-guard';
import { Card } from '~/components/ui/card';
import type { CharacterSheetOrigin } from '~/lib/campaign-routes';
import { CharacterLifecycle } from './character-lifecycle';
import type { CharacterScope } from './character-scope';
import type { Deletion } from './use-character-lifecycle';
import {
  CharacterSheetFrame,
  CharacterSheetSkeleton,
  type BackLink,
} from './character-sheet-frame';
import { CharacterSheetView } from './character-sheet-view';
import { DeletionBoundary } from './deletion-boundary';
import { useCharacterSheet } from './use-character-sheet';

type PageProps = CharacterScope & {
  back: BackLink;
  campaignName?: string;
  /** Where this sheet was opened from, so a linked sheet keeps the same Back. */
  origin?: CharacterSheetOrigin;
};

// An existing Character whose sheet is not prepared: nothing is initialized
// here, the player goes back to where they came from.
export function SheetUnavailable({ back }: { back: BackLink }) {
  return (
    <CharacterSheetFrame back={back}>
      <Card className="gap-3 p-4">
        <p>This character&apos;s sheet is not available here yet.</p>
      </Card>
    </CharacterSheetFrame>
  );
}

// The sheet's place while its Character is deleted and once it is gone; the
// origin link stays at hand in case navigation is slow.
function DeletionNote({
  back,
  deletion,
}: {
  back: BackLink;
  deletion: Exclude<Deletion, { kind: 'none' }>;
}) {
  return (
    <CharacterSheetFrame back={back}>
      <Card className="gap-3 p-4">
        <p role="status" className="[overflow-wrap:anywhere]">
          {deletion.kind === 'pending'
            ? `Deleting ${deletion.name}…`
            : `${deletion.name} was deleted.`}
        </p>
      </Card>
    </CharacterSheetFrame>
  );
}

function SheetHost({
  organizationId,
  campaignId,
  characterId,
  back,
  campaignName,
  origin,
  onDeletion,
}: PageProps & { onDeletion: (deletion: Deletion) => void }) {
  const controller = useCharacterSheet(
    { organizationId, campaignId, characterId },
    origin,
  );
  if (controller.sheet === undefined)
    return <CharacterSheetSkeleton back={back} />;
  if (controller.sheet === null) return <SheetUnavailable back={back} />;
  return (
    <CharacterSheetView
      scope={{ organizationId, campaignId, characterId }}
      sheet={controller.sheet}
      controller={controller}
      back={back}
      campaignName={campaignName}
      origin={origin}
      lifecycle={
        <CharacterLifecycle
          character={controller.sheet.character}
          campaignName={controller.sheet.campaign?.campaignName}
          owner={controller.sheet.owner}
          ownershipAvailable={
            controller.sheet.campaign?.ownershipAvailable ?? false
          }
          organizationId={organizationId}
          campaignId={campaignId}
          onDeletion={onDeletion}
        />
      }
    />
  );
}

// A private deletion outlives the sheet it started on: the subscription fails
// as the Character disappears, so the note stands in until the reply, then
// the origin opens.
function ScopedSheet(props: PageProps) {
  const guard = useNavigationGuard();
  const [deletion, setDeletion] = useState<Deletion>({ kind: 'none' });
  if (deletion.kind === 'done')
    return <DeletionNote back={props.back} deletion={deletion} />;
  return (
    <DeletionBoundary
      isDeleting={deletion.kind === 'pending'}
      fallback={
        deletion.kind === 'pending' ? (
          <DeletionNote back={props.back} deletion={deletion} />
        ) : null
      }
    >
      <SheetHost
        {...props}
        onDeletion={(next) => {
          setDeletion(next);
          if (next.kind === 'done') guard.navigate(props.back.href);
        }}
      />
    </DeletionBoundary>
  );
}

/**
 * The sheet for one Character, optionally constrained to a campaign. The
 * host is keyed on its scope, so a late save reply belongs to the discarded
 * instance. Authorization and query failures throw to the route's error
 * boundary rather than reading as an empty sheet.
 */
export function CharacterSheetPage(props: PageProps) {
  const {
    organizationId = 'no-organization',
    campaignId = 'no-campaign',
    characterId,
  } = props;
  return (
    <ScopedSheet
      key={`${organizationId}/${campaignId}/${characterId}`}
      {...props}
    />
  );
}
