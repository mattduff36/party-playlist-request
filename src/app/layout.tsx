import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from '@vercel/analytics/react';
import ServerStartup from '@/components/ServerStartup';
import MobileCacheBuster from '@/components/MobileCacheBuster';
import { GlobalEventProvider } from '@/lib/state/global-event-client';
import { QueryProvider } from '@/providers/QueryProvider';
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Party DJ Request System",
  description: "Request songs for the party playlist",
  viewport: {
    width: 'device-width',
    initialScale: 1.0,
    maximumScale: 1.0,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-gray-50 min-h-screen`}>
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
