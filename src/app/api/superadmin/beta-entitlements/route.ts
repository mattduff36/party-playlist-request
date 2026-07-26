/**
 * Super-admin beta entitlement grants (PRD-08).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireSuperAdmin } from '@/middleware/auth';
import {
  getActiveEntitlement,
  grantBetaEntitlement,
  listEntitlementsForUser,
  revokeBetaEntitlement,
} from '@/lib/beta/entitlement';
import { emitSecurityAudit } from '@/lib/auth/security-audit';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authenticated || !auth.user) return auth.response!;
  const sa = requireSuperAdmin(auth.user);
  if (!sa.authorized) return sa.response!;

  const userId = new URL(req.url).searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const [active, history] = await Promise.all([
    getActiveEntitlement(userId),
    listEntitlementsForUser(userId),
  ]);

  return NextResponse.json({ success: true, active, history });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authenticated || !auth.user) return auth.response!;
  const sa = requireSuperAdmin(auth.user);
  if (!sa.authorized) return sa.response!;

  const body = await req.json();
  const userId = String(body.userId || '');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  if (body.action === 'revoke') {
    const revoked = await revokeBetaEntitlement({
      userId,
      actorId: auth.user.user_id,
      reason: typeof body.reason === 'string' ? body.reason : undefined,
    });
    emitSecurityAudit('beta.entitlement_revoke', {
      correlationId: auth.correlationId,
      userId,
      meta: { actor: auth.user.user_id, revoked },
    });
    return NextResponse.json({ success: true, revoked });
  }

  const entitlement = await grantBetaEntitlement({
    userId,
    grantedBy: auth.user.user_id,
    days: typeof body.days === 'number' ? body.days : 30,
    endsAt: typeof body.endsAt === 'string' ? body.endsAt : undefined,
    notes: typeof body.notes === 'string' ? body.notes : null,
    source: typeof body.source === 'string' ? body.source : 'superadmin_grant',
  });

  emitSecurityAudit('beta.entitlement_grant', {
    correlationId: auth.correlationId,
    userId,
    meta: {
      entitlement_id: entitlement.id,
      ends_at: entitlement.ends_at,
    },
  });

  return NextResponse.json({ success: true, entitlement });
}
