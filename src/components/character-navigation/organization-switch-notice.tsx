import { Button } from '~/components/ui/button';
export function OrganizationSwitchNotice({
  status,
}: {
  status: { kind: 'idle' | 'switching' | 'failed'; retry: () => void };
}) {
  if (status.kind === 'idle') return null;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-3 md:px-6">
      {status.kind === 'switching' ? (
        <p role="status" className="text-muted-foreground text-sm">
          Changing organization…
        </p>
      ) : (
        <div
          role="alert"
          className="border-destructive/40 flex flex-wrap items-center gap-3 rounded-md border p-3"
        >
          <p className="text-sm">The organization could not be changed.</p>
          <Button variant="outline" size="sm" onClick={status.retry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
