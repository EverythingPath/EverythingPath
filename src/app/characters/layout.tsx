'use client';
import { Authenticated, AuthLoading, Unauthenticated } from 'convex/react';
import type { ReactNode } from 'react';
import { NavigationGuardProvider } from '~/components/campaign-shell/navigation-guard';
import { ShellFrame, SignIn } from '~/components/campaign-shell/shell-frame';
import { AppPhoneBar } from '~/components/campaign-shell/app-phone-bar';
import { AppTopBar } from '~/components/campaign-shell/app-top-bar';
import { ShellSlotProvider } from '~/components/campaign-shell/shell-slots';
import { useIndependentCharactersShell } from '~/components/campaign-shell/use-independent-characters-shell';
import { CharactersListLoading } from '~/components/character-navigation/characters-list-loading';
import {
  CharacterSheetFrame,
  CharacterSheetSkeleton,
} from '~/components/character-sheet/character-sheet-frame';
import { Card } from '~/components/ui/card';
import type { BackLink } from '~/lib/campaign-routes';
const back: BackLink = { href: '/characters', label: 'Characters' };
function CharactersShell({ children }: { children: ReactNode }) {
  const { nav, isSheet } = useIndependentCharactersShell();
  return (
    <ShellFrame
      header={<AppTopBar nav={nav} />}
      footer={<AppPhoneBar nav={nav} />}
    >
      <Authenticated>{children}</Authenticated>
      <AuthLoading>
        {isSheet ? (
          <CharacterSheetSkeleton back={back} />
        ) : (
          <CharactersListLoading />
        )}
      </AuthLoading>
      <Unauthenticated>
        <CharacterSheetFrame back={back}>
          <Card className="gap-3 p-4">
            <p>Sign in to open your characters.</p>
            <div>
              <SignIn />
            </div>
          </Card>
        </CharacterSheetFrame>
      </Unauthenticated>
    </ShellFrame>
  );
}
export default function IndependentCharactersLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <NavigationGuardProvider>
      <ShellSlotProvider>
        <CharactersShell>{children}</CharactersShell>
      </ShellSlotProvider>
    </NavigationGuardProvider>
  );
}
