'use client';
import {
  CharacterSheetFrame,
  CharacterSheetSkeleton,
} from '~/components/character-sheet/character-sheet-frame';
import { CreateCharacterSheet } from '~/components/character-sheet/create-character-sheet';
import { useCharacterCreationRoute } from '~/components/character-sheet/use-character-creation-route';
import { Card } from '~/components/ui/card';
export default function NewCharacterRoute() {
  const creation = useCharacterCreationRoute();
  if (creation.loading) return <CharacterSheetSkeleton back={creation.back} />;
  return (
    <CharacterSheetFrame back={creation.back}>
      {creation.available ? (
        <CreateCharacterSheet
          campaignId={creation.campaign?._id}
          organizationId={creation.organizationId}
          origin={creation.origin}
        />
      ) : (
        <Card className="gap-3 p-4">
          <p>Creating characters here is not available yet.</p>
        </Card>
      )}
    </CharacterSheetFrame>
  );
}
