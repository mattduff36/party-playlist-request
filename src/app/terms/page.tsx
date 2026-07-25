import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-ink text-bone">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Link href="/" className="text-sm text-accent hover:text-accent-hover">
          ← Party Playlist
        </Link>
        <h1 className="mt-6 font-display text-4xl font-bold">Terms</h1>
        <p className="mt-4 text-muted leading-relaxed">
          By using Party Playlist you agree to use the service lawfully, respect venue and guest
          policies, and comply with Spotify&apos;s developer and user terms for any connected
          accounts. The service is provided as-is for event song requests; you are responsible for
          content approved for playback at your events.
        </p>
        <p className="mt-6 text-sm text-faint">Last updated: July 2026</p>
      </div>
    </div>
  );
}
