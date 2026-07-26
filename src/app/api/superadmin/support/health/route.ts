import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireSuperAdmin } from '@/middleware/auth';
import { healthCheckSystem } from '@/lib/monitoring/health';
import { getUnresolvedErrorCount } from '@/lib/support/logger';

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) return auth.response!;
    const sa = requireSuperAdmin(auth.user);
    if (!sa.authorized) return sa.response!;

    const health = await healthCheckSystem.runAllChecks();
    const unresolvedErrors = await getUnresolvedErrorCount();

    return NextResponse.json({
      health,
      unresolvedErrors,
      uptimeSeconds: Math.floor(process.uptime()),
    });
  } catch (error) {
    console.error('[support/health] GET failed:', error);
    return NextResponse.json({ error: 'Failed to load health' }, { status: 500 });
  }
}
