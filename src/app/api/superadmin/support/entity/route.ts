import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireSuperAdmin } from '@/middleware/auth';
import { getEntityTimeline } from '@/lib/support/queries';

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) return auth.response!;
    const sa = requireSuperAdmin(auth.user);
    if (!sa.authorized) return sa.response!;

    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username') || undefined;
    const eventId = searchParams.get('eventId') || undefined;

    if (!username && !eventId) {
      return NextResponse.json(
        { error: 'username or eventId required' },
        { status: 400 }
      );
    }

    const data = await getEntityTimeline({
      username,
      eventId,
      limit: parseInt(searchParams.get('limit') || '40', 10),
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('[support/entity] GET failed:', error);
    return NextResponse.json({ error: 'Failed to load entity timeline' }, { status: 500 });
  }
}
