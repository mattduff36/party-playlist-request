/**
 * Downloadable printable QR signage PDF (PRD-08).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getEventSettings } from '@/lib/db';
import { generateSignagePdf, signageFilename, type SignageFormat } from '@/lib/beta/signage';
import { getActiveEvent } from '@/lib/event-service';

const FORMATS = new Set<SignageFormat>(['a4', 'a5', 'table_card', 'screen_16x9']);

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authenticated || !auth.user) return auth.response!;

  const userId = auth.user.user_id;
  const username = auth.user.username;
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get('format') || 'a4') as SignageFormat;
  if (!FORMATS.has(format)) {
    return NextResponse.json(
      { error: 'Invalid format. Use a4, a5, table_card, or screen_16x9' },
      { status: 400 }
    );
  }

  const includeCodeParam = searchParams.get('includeAccessCode');
  const settings = await getEventSettings(userId);
  const includeAccessCode =
    includeCodeParam === '1' ||
    includeCodeParam === 'true' ||
    (includeCodeParam == null && Boolean(settings.print_access_code_on_signage));

  const origin = req.nextUrl.origin;
  let accessCode: string | null = null;
  try {
    const guest = await getActiveEvent(userId);
    accessCode = guest?.access_code || guest?.pin || null;
  } catch {
    accessCode = null;
  }

  // Guest join URL only — never admin
  const joinUrl = accessCode
    ? `${origin}/${username}/${accessCode}/request`
    : `${origin}/${username}/request`;

  const pdf = await generateSignagePdf({
    format,
    eventTitle: settings.event_title || 'Party Playlist',
    joinUrl,
    accessCode,
    includeAccessCode: Boolean(includeAccessCode && accessCode),
    brandColor: settings.theme_primary_color || '#111111',
    accentColor: settings.theme_secondary_color || '#1DB954',
  });

  const filename = signageFilename(format, settings.event_title || 'event');
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
