import Link from 'next/link';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-ink text-bone">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Link href="/" className="text-sm text-accent hover:text-accent-hover">
          ← Party Playlist
        </Link>
        <h1 className="mt-6 font-display text-4xl font-bold">Contact</h1>
        <p className="mt-4 text-muted leading-relaxed">
          Questions about hosting, access, or the product? Reach out at{' '}
          <a
            href="mailto:hello@partyplaylist.app"
            className="text-accent hover:text-accent-hover underline-offset-2 hover:underline"
          >
            hello@partyplaylist.app
          </a>
          .
        </p>
      </div>
    </div>
  );
}
