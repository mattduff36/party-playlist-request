import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireSuperAdmin } from '@/middleware/auth';
import { getUnresolvedErrorCount } from '@/lib/support/logger';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) return auth.response!;
    const sa = requireSuperAdmin(auth.user);
    if (!sa.authorized) return sa.response!;

    const unresolvedErrors = await getUnresolvedErrorCount();
    return NextResponse.json({ unresolvedErrors });
  } catch (error) {
    console.error('[support/summary] GET failed:', error);
    return NextResponse.json({ unresolvedErrors: 0 });
  }
}
