/**
 * Resolve the public app origin used in emails and absolute links.
 * Prefer an explicit public URL; fall back to Vercel URL in deploy previews.
 */
export function getAppBaseUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    '';

  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return `https://${host}`;
  }

  return 'http://localhost:3000';
}
