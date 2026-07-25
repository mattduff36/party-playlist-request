import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-ink text-bone">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            'radial-gradient(ellipse at 30% 20%, rgba(29,185,84,0.18), transparent 50%)',
        }}
      />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <p className="font-display text-7xl font-bold text-accent sm:text-8xl">404</p>
        <h1 className="mt-4 font-display text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 max-w-md text-muted">
          That route doesn&apos;t exist - head back to the party.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-lg bg-accent px-6 py-3 font-semibold text-ink transition hover:bg-accent-hover"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
