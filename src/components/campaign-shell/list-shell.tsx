'use client';
import type { ReactNode } from 'react';
import { NavigationGuardProvider } from './navigation-guard';
import { ShellFrame } from './shell-frame';
import { AppPhoneBar } from './app-phone-bar';
import { AppTopBar } from './app-top-bar';
import { ShellSlotProvider } from './shell-slots';
import { useListShellNavigation } from './use-list-shell-navigation';
function ListShellContent({ children }: { children: ReactNode }) {
  const nav = useListShellNavigation();
  return (
    <ShellFrame
      header={<AppTopBar nav={nav} />}
      footer={<AppPhoneBar nav={nav} />}
    >
      {children}
    </ShellFrame>
  );
}
export function ListShell({ children }: { children: ReactNode }) {
  return (
    <NavigationGuardProvider>
      <ShellSlotProvider>
        <ListShellContent>{children}</ListShellContent>
      </ShellSlotProvider>
    </NavigationGuardProvider>
  );
}
