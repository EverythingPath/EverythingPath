import '~/styles/globals.css';
import './fonts/subsets.css';
import { type Metadata, type Viewport } from 'next';
import { ConvexClientProvider } from '../../ConvexClientProvider';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { BrowserHistoryAdapter } from '~/components/campaign-shell/browser-history-adapter';
import type React from 'react';
import localFont from 'next/font/local';

// Self-hosted so the build never depends on Google Fonts responses (Turbopack's
// next/font/google fails on `/l/font?kit=...&skey=...` URLs, vercel/next.js#99114).
// The files are Google's own subsets: latin here (preloaded), the rest in
// subsets.css. The const names become the family names, so they match Google's.
// OFL licenses sit beside the files in `./fonts`.
const Cinzel = localFont({
  src: [
    { path: './fonts/Cinzel-latin.woff2', weight: '400', style: 'normal' },
    { path: './fonts/Cinzel-latin.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-cinzel',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
  // Google's latin range, repeated per loader: font loader options must be
  // literals.
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
});

const VT323 = localFont({
  src: [{ path: './fonts/VT323-latin.woff2', weight: '400', style: 'normal' }],
  variable: '--font-vt323',
  display: 'swap',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
});

const MedievalSharp = localFont({
  src: [
    {
      path: './fonts/MedievalSharp-latin.woff2',
      weight: '400',
      style: 'normal',
    },
  ],
  variable: '--font-medieval',
  display: 'swap',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
});

export const metadata: Metadata = {
  title: 'Keepnet',
  description: 'Arcane communication through the mycelial network',
  icons: [{ rel: 'icon', url: '/favicon.ico' }],
};

// Phone shell: `cover` makes the safe-area insets real so the bottom bar and
// top bar pad around the home indicator and notch; `resizes-content` shrinks
// the layout viewport under the on-screen keyboard, so the sticky bottom bar
// and a focused field stay above it instead of underneath.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

// Every route renders per request. ClerkProvider needs a publishable key to
// render, so a statically prerendered page (even `/_not-found`) would fail a
// build without one; the build must compile with only a Convex URL.
export const dynamic = 'force-dynamic';

// Each route renders its own top bar: the campaign list keeps the
// organization switcher in the breadcrumb, campaign pages the campaign switcher.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${Cinzel.variable} ${VT323.variable} ${MedievalSharp.variable} antialiased`}
    >
      <body className="vsc-initialized retro-grid scanlines bg-background text-foreground">
        <ClerkProvider
          appearance={{
            baseTheme: dark,
            elements: {
              card: 'bg-background border-foreground/20',
              socialButtonsBlockButton:
                'border-foreground/20 hover:bg-foreground/10',
              dividerLine: 'bg-foreground/20',
              dividerText: 'text-foreground/40',
              formFieldInput:
                'bg-background border-foreground/20 focus:border-foreground/40',
              formButtonPrimary:
                'bg-primary text-primary-foreground hover:bg-primary/90',
              footerActionLink: 'text-primary hover:text-primary/90',
            },
          }}
        >
          <ConvexClientProvider>
            <BrowserHistoryAdapter />
            {children}
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
