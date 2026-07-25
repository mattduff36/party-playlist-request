import type { Metadata, Viewport } from "next";
import { Syne, DM_Sans } from "next/font/google";
import { Analytics } from '@vercel/analytics/react';
import ServerStartup from '@/components/ServerStartup';
import MobileCacheBuster from '@/components/MobileCacheBuster';
import { GlobalEventProvider } from '@/lib/state/global-event-client';
import { QueryProvider } from '@/providers/QueryProvider';
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Party Playlist — Guest song requests for live events",
  description: "Let guests request Spotify tracks. DJs approve, venues display the night.",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  themeColor: '#0E1114',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable}`}>
      <body className="font-sans antialiased bg-ink text-bone min-h-screen">
        <QueryProvider>
          <GlobalEventProvider>
            <MobileCacheBuster />
            <ServerStartup />
            {children}
          </GlobalEventProvider>
        </QueryProvider>
        <Analytics />
      </body>
    </html>
  );
}
