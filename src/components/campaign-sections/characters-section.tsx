'use client';
import type { CampaignScope } from '~/lib/campaign-scope';
import { CharacterRecordDialog } from '~/components/character-manager/character-record-dialog';
import { CharactersOfficersView } from '~/components/characters-officers/characters-officers-view';
import { CharactersSkeleton } from '~/components/characters-officers/characters-skeleton';
import { useCharacterCorrections } from '~/components/characters-officers/use-character-corrections';
import {
  useCharactersPage,
  type CharactersPage,
} from '~/components/characters-officers/use-characters-page';

// The page with its two corrections, for one campaign, militia and
// organization. While a correction is open, the board and rows show its
// result over the newest militia.
function CorrectableCharacters({
  campaignId,
  page,
  militia,
}: CampaignScope & {
  page: CharactersPage;
  militia: NonNullable<CharactersPage['militia']>;
}) {
  const corrections = useCharacterCorrections({
    campaignId,
    militiaId: militia.militiaId,
    draftId: militia.draftId,
    records: page.records,
  });
  const ready = corrections.status === 'ready' ? corrections : null;
  return (
    <CharactersOfficersView
      page={ready?.candidate ? page.present(ready.candidate) : page}
      corrections={ready}
    />
  );
}

// Characters & officers: the officer board over the character table, with
// the record dialog and the reasoned roster and officer corrections.
export function CharactersSection({
  campaignId,
  organizationId,
}: CampaignScope) {
  const page = useCharactersPage({ campaignId, organizationId });
  if (page.status === 'loading') return <CharactersSkeleton />;
  const { dialog } = page;
  return (
    <>
      {page.militia ? (
        // A campaign, militia or organization change discards the open
        // correction and any late result of its Save.
        <CorrectableCharacters
          key={`${organizationId}:${campaignId}:${page.militia.militiaId}`}
          campaignId={campaignId}
          organizationId={organizationId}
          page={page}
          militia={page.militia}
        />
      ) : (
        <CharactersOfficersView page={page} corrections={null} />
      )}
      {dialog.target && (dialog.target.kind === 'add' || dialog.record) ? (
        // One dialog per target: an edit starts from the record's values.
        <CharacterRecordDialog
          key={dialog.target.kind === 'add' ? 'add' : dialog.target.id}
          campaignId={campaignId}
          organizationId={organizationId}
          record={dialog.record}
          open
          onOpenChange={(open) => {
            if (!open) dialog.close();
          }}
          archiveWarning={dialog.archiveWarning}
        />
      ) : null}
    </>
  );
}
