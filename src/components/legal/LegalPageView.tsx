import Link from 'next/link';
import { reviewBanner, type LegalPage } from '@/lib/beta/legal';

interface LegalPageViewProps {
  page: LegalPage;
}

export default function LegalPageView({ page }: LegalPageViewProps) {
  const paragraphs = page.body_markdown.split(/\n\n+/).filter(Boolean);

  return (
    <div className="min-h-screen bg-ink text-bone">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Link href="/" className="text-sm text-accent hover:text-accent-hover">
          ← Party Playlist
        </Link>
        <p className="mt-6 text-xs uppercase tracking-wide text-amber-200/90">
          {reviewBanner(page.review_status)}
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold">{page.title}</h1>
        <div className="mt-6 space-y-4 text-muted leading-relaxed">
          {paragraphs.map((block) => {
            const isHeading = block.startsWith('**') && block.endsWith('**');
            if (isHeading) {
              return (
                <p key={block} className="text-bone font-medium">
                  {block.replace(/\*\*/g, '')}
                </p>
              );
            }
            if (block.startsWith('- ')) {
              const items = block.split('\n').filter((l) => l.startsWith('- '));
              return (
                <ul key={block} className="list-disc pl-5 space-y-1">
                  {items.map((item) => (
                    <li key={item}>{item.replace(/^- /, '')}</li>
                  ))}
                </ul>
              );
            }
            return <p key={block}>{block.replace(/\*\*/g, '')}</p>;
          })}
        </div>
        <p className="mt-8 text-sm text-faint">
          Last updated: {new Date(page.updated_at).toLocaleDateString()}
        </p>
        <nav className="mt-8 flex flex-wrap gap-4 text-sm text-accent">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/legal/retention">Retention</Link>
          <Link href="/legal/refund">Refunds</Link>
          <Link href="/legal/spotify-disconnect">Spotify disconnect</Link>
          <Link href="/legal/organiser-responsibility">Organiser duties</Link>
        </nav>
      </div>
    </div>
  );
}
