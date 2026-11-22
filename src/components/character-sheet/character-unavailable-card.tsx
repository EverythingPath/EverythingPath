import { Card } from '~/components/ui/card';

// A Character this link can't open: never existed, deleted, or returned to
// its owner's private Characters. All read the same, without a retry, since
// loading again changes nothing; the frame's Back link is the way on.
export function CharacterUnavailableCard() {
  return (
    <Card role="status" className="p-4">
      <p>This character isn’t available.</p>
    </Card>
  );
}
