'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Music2, Users, Smartphone, Zap, Radio, Heart } from 'lucide-react';

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-[#191414]" />;
  }

  const features = [
    {
      icon: <Music2 className="w-7 h-7" />,
      title: 'Spotify Integration',
      description: 'Connect Spotify and send approved requests straight to your queue.',
    },
    {
      icon: <Users className="w-7 h-7" />,
      title: 'Guest Requests',
      description: 'Share one link. Guests search and request without creating accounts.',
    },
    {
      icon: <Smartphone className="w-7 h-7" />,
      title: 'Real-Time Updates',
      description: 'Approvals and now-playing sync live across admin, guests, and display.',
    },
    {
      icon: <Zap className="w-7 h-7" />,
      title: 'DJ Control',
      description: 'Approve, reject, and steer the night from a mobile-friendly admin.',
    },
    {
      icon: <Radio className="w-7 h-7" />,
      title: 'Venue Display',
      description: 'Big-screen now playing, queue, QR, and notices for the room.',
    },
    {
      icon: <Heart className="w-7 h-7" />,
      title: 'Built for Events',
      description: 'Parties, weddings, bars - pick a display mood that fits the room.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#191414] text-white relative overflow-hidden">
      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(29,185,84,0.35), transparent 55%), radial-gradient(circle at 90% 20%, rgba(29,185,84,0.12), transparent 40%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <nav className="relative z-10 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Music2 className="h-7 w-7 text-[#1DB954]" />
            <span className="font-display text-xl font-bold tracking-tight">Party Playlist</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/login" className="text-sm font-medium text-white/80 hover:text-[#1DB954] transition-colors">
              Log In
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-[#1DB954] px-4 py-2 text-sm font-bold text-black transition hover:bg-[#1ed760] hover:scale-[1.02] active:scale-[0.98]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero — brand first, one job */}
      <header className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-3xl ss-reveal">
          <p className="font-display text-5xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl">
            Party Playlist
          </p>
          <h1 className="mt-5 font-display text-2xl font-semibold text-[#1DB954] sm:text-3xl md:text-4xl">
            Guests choose the music. You keep the night.
          </h1>
          <p className="mt-4 max-w-xl text-base text-[#B3B3B3] sm:text-lg">
            Spotify-powered requests for live events - approve on your phone, show the queue on the big screen.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center ss-reveal ss-reveal-delay-1">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full bg-[#1DB954] px-8 py-3.5 text-base font-bold text-black shadow-[0_0_40px_rgba(29,185,84,0.25)] transition hover:bg-[#1ed760] hover:scale-[1.02] active:scale-[0.98]"
            >
              Start hosting
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:border-[#1DB954]/50 hover:bg-white/10"
            >
              DJ sign in
            </Link>
          </div>
        </div>

        {/* Full-bleed visual plane under fold on mobile; edge atmosphere already acts as hero plane */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 hidden h-[70%] w-[55%] md:block ss-reveal ss-reveal-delay-2"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(29,185,84,0.2) 0%, transparent 65%)',
          }}
        />
      </header>

      <section className="relative z-10 border-t border-white/10 bg-black/30 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 max-w-2xl">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              Built for the floor
            </h2>
            <p className="mt-3 text-[#B3B3B3]">
              Everything you need between guest phone and Spotify playback.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="border-t border-[#1DB954]/25 pt-6">
                <div className="mb-4 text-[#1DB954]">{feature.icon}</div>
                <h3 className="font-display text-lg font-bold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#B3B3B3]">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Live in three steps
          </h2>
          <ol className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-3">
            {[
              { step: '01', title: 'Connect Spotify', desc: 'Link your account and pick the playback device.' },
              { step: '02', title: 'Share your link', desc: 'Guests open your request page - PIN optional.' },
              { step: '03', title: 'Run the night', desc: 'Approve tracks, drive the display, keep the queue moving.' },
            ].map((item) => (
              <li key={item.step}>
                <span className="font-display text-4xl font-bold text-[#1DB954]/40">{item.step}</span>
                <h3 className="mt-2 font-display text-xl font-bold">{item.title}</h3>
                <p className="mt-2 text-sm text-[#B3B3B3]">{item.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="relative z-10 px-4 pb-20 sm:px-6">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl bg-[#1DB954] px-8 py-12 text-center text-black sm:px-12">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Ready when the crowd is</h2>
          <p className="mx-auto mt-3 max-w-xl text-black/75">
            Set up your event, go live, and let the room request the soundtrack.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex rounded-full bg-black px-8 py-3.5 font-bold text-[#1DB954] transition hover:scale-[1.02] active:scale-[0.98]"
          >
            Get started free
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 bg-black">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Music2 className="h-5 w-5 text-[#1DB954]" />
            <span className="font-display font-bold">Party Playlist</span>
          </div>
          <div className="flex gap-6 text-sm text-[#B3B3B3]">
            <Link href="/privacy" className="hover:text-[#1DB954] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[#1DB954] transition-colors">Terms</Link>
            <Link href="/contact" className="hover:text-[#1DB954] transition-colors">Contact</Link>
          </div>
        </div>
        <p className="pb-8 text-center text-xs text-[#535353]">
          © {new Date().getFullYear()} Party Playlist. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
