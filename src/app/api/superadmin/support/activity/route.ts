import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireSuperAdmin } from '@/middleware/auth';
import { listSupportActivity } from '@/lib/support/queries';

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) return auth.response!;
    const sa = requireSuperAdmin(auth.user);
    if (!sa.authorized) return sa.response!;

    const { searchParams } = new URL(req.url);
    const data = await listSupportActivity({
      action: searchParams.get('action') || 'all',
      username: searchParams.get('username') || undefined,
      since: searchParams.get('since'),
      after: searchParams.get('after'),
      limit: parseInt(searchParams.get('limit') || '50', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10),
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('[support/activity] GET failed:', error);
    return NextResponse.json({ error: 'Failed to load activity' }, { status: 500 });
  }
}
