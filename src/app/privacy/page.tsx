import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-ink text-bone">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Link href="/" className="text-sm text-accent hover:text-accent-hover">
          ← Party Playlist
        </Link>
        <h1 className="mt-6 font-display text-4xl font-bold">Privacy</h1>
        <p className="mt-4 text-muted leading-relaxed">
          Party Playlist stores account details, event settings, and song request metadata needed to
          run your events. Spotify playback is handled via your connected Spotify account under
          Spotify&apos;s terms. We do not sell personal data. Contact us for data requests.
        </p>
        <p className="mt-6 text-sm text-faint">Last updated: July 2026</p>
      </div>
    </div>
  );
}
