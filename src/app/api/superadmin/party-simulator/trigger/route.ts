import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { partySimulator } from '@/lib/party-simulator';

/**
 * POST /api/superadmin/party-simulator/trigger
 * Manually trigger a single request or burst during an active simulation
 */
export async function POST(req: NextRequest) {
  const authResult = await requireSuperAdmin(req);
  if (!authResult.authorized) {
    return NextResponse.json(
      { error: authResult.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { type } = body;

    if (!type || !['single', 'burst'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be "single" or "burst"' },
        { status: 400 }
      );
    }

    // Check if simulation is running
    const stats = partySimulator.getStats();
    if (!stats.isRunning) {
      return NextResponse.json(
        { error: 'No simulation is currently running' },
        { status: 400 }
      );
    }

    // Trigger the manual request(s)
    if (type === 'single') {
      await partySimulator.triggerManualRequest();
      console.log('🎯 Manual single request triggered by superadmin');
    } else {
      await partySimulator.triggerManualBurst();
      console.log('💥 Manual burst triggered by superadmin');
    }

    return NextResponse.json({
      success: true,
      message: `Manual ${type} triggered successfully`,
      stats: partySimulator.getStats()
    });

  } catch (error) {
    console.error('❌ Error triggering manual request:', error);
    return NextResponse.json(
      { error: 'Failed to trigger manual request' },
      { status: 500 }
    );
  }
}

