import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from '@vercel/analytics/react';
import ServerStartup from '@/components/ServerStartup';
import MobileCacheBuster from '@/components/MobileCacheBuster';
import MobileConsole from '@/components/MobileConsole';
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Party DJ Request System",
  description: "Request songs for the party playlist",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-gray-50 min-h-screen`}>
        <MobileCacheBuster />
        <ServerStartup />
        {children}
        <MobileConsole />
        <Analytics />
      </body>
    </html>
  );
}
