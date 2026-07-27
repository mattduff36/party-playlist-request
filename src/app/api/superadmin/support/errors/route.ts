import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireSuperAdmin } from '@/middleware/auth';
import { listSupportErrors, resolveSupportError } from '@/lib/support/queries';
import { pruneSupportLogsOlderThan } from '@/lib/support/logger';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) return auth.response!;
    const sa = requireSuperAdmin(auth.user);
    if (!sa.authorized) return sa.response!;

    // Lazy prune on Support reads
    void pruneSupportLogsOlderThan(90);

    const { searchParams } = new URL(req.url);
    const classificationParam = searchParams.get('classification');
    const classification =
      classificationParam === 'handled' ||
      classificationParam === 'unhandled' ||
      classificationParam === 'all'
        ? classificationParam
        : 'all';

    const data = await listSupportErrors({
      resolved: (searchParams.get('resolved') as 'all' | 'open' | 'resolved') || 'open',
      source: searchParams.get('source') || 'all',
      username: searchParams.get('username') || undefined,
      classification,
      limit: parseInt(searchParams.get('limit') || '50', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10),
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('[support/errors] GET failed:', error);
    return NextResponse.json({ error: 'Failed to load errors' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) return auth.response!;
    const sa = requireSuperAdmin(auth.user);
    if (!sa.authorized) return sa.response!;

    const body = await req.json();
    const id = body.id as string;
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const row = await resolveSupportError(id, auth.user.username);
    if (!row) {
      return NextResponse.json({ error: 'Error not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, error: row });
  } catch (error) {
    console.error('[support/errors] PATCH failed:', error);
    return NextResponse.json({ error: 'Failed to resolve error' }, { status: 500 });
  }
}
