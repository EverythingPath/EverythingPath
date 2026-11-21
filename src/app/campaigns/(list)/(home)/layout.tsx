import type { ReactNode } from 'react';
import { ListShell } from '~/components/campaign-shell/list-shell';
import { CampaignHomeScreen } from '~/components/campaign-home/campaign-home-screen';

// `/campaigns` and `/campaigns/<id>` are one list/home screen. It lives in
// this shared layout so choosing another campaign keeps the list, its focus
// and any local form mounted; the two pages only mark the addresses.
export default function CampaignHomeLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ListShell>
      <CampaignHomeScreen />
      {children}
    </ListShell>
  );
}
