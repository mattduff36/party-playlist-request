/**
 * Legal / product copy pages with review status (PRD-08).
 */

import { getPool } from '@/lib/db';

export type LegalReviewStatus =
  | 'draft_unreviewed'
  | 'in_review'
  | 'professionally_reviewed';

export interface LegalPage {
  id: string;
  title: string;
  body_markdown: string;
  review_status: LegalReviewStatus;
  updated_at: string;
}

/** Default copy used when DB row body is empty — clearly unreviewed. */
export const LEGAL_DEFAULTS: Record<
  string,
  { title: string; body: string }
> = {
  privacy: {
    title: 'Privacy notice',
    body: `PartyPlaylist stores account details, event settings, and song-request metadata needed to run private events.

Spotify playback uses your connected Spotify account under Spotify's terms. We do not sell personal data.

IP addresses used for abuse prevention are hashed where possible and are not shown in organiser reports.

Contact the site operator for data access or deletion requests.

**Review status:** draft — not professional legal advice.`,
  },
  terms: {
    title: 'Terms of service',
    body: `PartyPlaylist is a self-service party music request system for private adult events.

You are responsible for your Spotify/account eligibility, playback equipment, internet connection, and any venue or music permissions that apply to your event.

The service does not replace professional DJ services or venue licensing advice.

Beta features may change. Abuse, illegal use, or attempts to bypass access controls may result in account suspension.

**Review status:** draft — not professional legal advice.`,
  },
  cookies: {
    title: 'Cookie information',
    body: `We use essential cookies for authentication (organiser session), guest device rate-limiting, CSRF protection, and display access.

Realtime features may use connection identifiers from our messaging provider.

We do not use third-party advertising cookies in the core product.

**Review status:** draft — not professional legal advice.`,
  },
  retention: {
    title: 'Retention and deletion summary',
    body: `Event request history is retained after event end for organiser reports unless you run a confirmed cleanup.

Guest nicknames may be retained for a limited period for moderation context, then eligible for anonymisation.

Spotify tokens are stored for the connected organiser account and cleared on disconnect.

**Review status:** draft — not professional legal advice.`,
  },
  refund: {
    title: 'Refund and cancellation policy (placeholder)',
    body: `Public paid checkout is not enabled in this beta build (see upcoming payment PRD).

When paid Party Pass sales begin, refund and cancellation terms will be published here after professional review.

**Review status:** draft placeholder — not professional legal advice.`,
  },
  spotify_disconnect: {
    title: 'Spotify disconnect and data deletion',
    body: `Organisers can disconnect Spotify from the admin Spotify page. Disconnect clears stored Spotify credentials for that account.

To delete your PartyPlaylist account and associated event data, contact support / the site operator with your username.

Revoking access in Spotify's account settings will also invalidate tokens; reconnect if you continue using Spotify mode.

**Review status:** draft — not professional legal advice.`,
  },
  organiser_responsibility: {
    title: 'Organiser responsibilities',
    body: `You are responsible for:

- Suitable speakers / playback equipment and a reliable internet connection
- Spotify account eligibility (including Premium where required for playback control)
- Music permissions and any venue rules that apply to your private event
- Moderating guest requests and choosing Manual mode when Spotify is unsuitable

PartyPlaylist does not claim to replace every professional DJ or solve venue music licensing.

**Review status:** draft — not professional legal advice.`,
  },
};

export async function getLegalPage(id: string): Promise<LegalPage | null> {
  const defaults = LEGAL_DEFAULTS[id];
  if (!defaults) return null;

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, title, body_markdown, review_status, updated_at
       FROM legal_pages WHERE id = $1`,
      [id]
    );
    if (result.rows[0]) {
      const row = result.rows[0];
      const body =
        row.body_markdown && String(row.body_markdown).trim().length > 0
          ? String(row.body_markdown)
          : defaults.body;
      return {
        id: String(row.id),
        title: String(row.title || defaults.title),
        body_markdown: body,
        review_status: (row.review_status ||
          'draft_unreviewed') as LegalReviewStatus,
        updated_at: new Date(row.updated_at).toISOString(),
      };
    }
  } catch {
    // Table may not exist yet in some test envs — fall back to defaults
  }

  return {
    id,
    title: defaults.title,
    body_markdown: defaults.body,
    review_status: 'draft_unreviewed',
    updated_at: new Date().toISOString(),
  };
}

export async function listLegalPages(): Promise<LegalPage[]> {
  const ids = Object.keys(LEGAL_DEFAULTS);
  const pages: LegalPage[] = [];
  for (const id of ids) {
    const page = await getLegalPage(id);
    if (page) pages.push(page);
  }
  return pages;
}

export function reviewBanner(status: LegalReviewStatus): string {
  if (status === 'professionally_reviewed') {
    return 'Professionally reviewed';
  }
  if (status === 'in_review') {
    return 'In legal review — not final';
  }
  return 'Draft / unreviewed — not professional legal advice';
}
