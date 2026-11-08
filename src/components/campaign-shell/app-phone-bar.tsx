'use client';

import { useRef, useState } from 'react';
import {
  type MilitiaExplanation,
  type PhoneNavigation,
} from './app-navigation-presentation';
import { MilitiaUnavailableSheet } from './militia-unavailable-sheet';
import { MoreTab } from './more-tab';
import { PhoneTab } from './phone-tab';
import { useScrollPaddingFor } from './scroll-padding';
import { ShellSlotHost } from './shell-slots';

// Phone: four fixed tabs pinned to the viewport's bottom edge on every page.
// Its height is reserved as scroll padding so content stays reachable above
// it; the Week frame fills the status-strip host immediately above the tabs.
// The explanation shown is the one the model gave when the dimmed tab was
// tapped; while militia existence is still loading there is none to give.
export function AppPhoneBar({ nav }: { nav: PhoneNavigation }) {
  const [explanation, setExplanation] = useState<MilitiaExplanation | null>(
    null,
  );
  const bar = useRef<HTMLDivElement>(null);
  useScrollPaddingFor(bar);
  return (
    <>
      <div
        ref={bar}
        className="bg-background/95 border-foreground/15 sticky bottom-0 z-40 shrink-0 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ShellSlotHost
          name="phone-status-strip"
          className="border-foreground/15 border-b"
        />
        <nav aria-label="Areas" className="grid grid-cols-4">
          {nav.phoneTabs.map((item) =>
            item.key === 'more' ? (
              <MoreTab key={item.key} />
            ) : (
              <PhoneTab
                key={item.key}
                item={item}
                onExplain={() => setExplanation(nav.militiaUnavailable)}
              />
            ),
          )}
        </nav>
      </div>
      <MilitiaUnavailableSheet
        explanation={explanation}
        onClose={() => setExplanation(null)}
      />
    </>
  );
}
