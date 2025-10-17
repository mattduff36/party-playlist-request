/**
 * NOTE: This server-side simulator only works in local development.
 * Production uses client-side implementation due to serverless limitations.
 * See: docs/PARTY-SIMULATOR-SERVERLESS-ISSUE.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { partySimulator } from '@/lib/party-simulator';
import { requireSuperAdmin } from '@/lib/auth';

/**
 * GET /api/superadmin/party-simulator
 * Get current simulation status and statistics
 */
export async function GET(req: NextRequest) {
  try {
    // Check superadmin auth
    const authResult = await requireSuperAdmin(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const stats = partySimulator.getStats();
    return NextResponse.json({ stats });

  } catch (error) {
    console.error('❌ Error getting simulator stats:', error);
    return NextResponse.json(
      { error: 'Failed to get simulator stats' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/superadmin/party-simulator
 * Start the party simulation with config
 */
export async function POST(req: NextRequest) {
  try {
    // Check superadmin auth
    const authResult = await requireSuperAdmin(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { environment, username, requestPin, requestInterval, uniqueRequesters, burstMode, explicitSongs } = body;

    // Validate inputs
    if (!environment || !['local', 'production'].includes(environment)) {
      return NextResponse.json(
        { error: 'Environment must be "local" or "production"' },
        { status: 400 }
      );
    }

    if (!username || username.trim().length === 0) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    if (!requestInterval || requestInterval < 60000) {
      return NextResponse.json(
        { error: 'Request interval must be at least 1 minute (60000ms)' },
        { status: 400 }
      );
    }

    if (requestInterval > 1800000) {
      return NextResponse.json(
        { error: 'Request interval must be at most 30 minutes (1800000ms)' },
        { status: 400 }
      );
    }

    if (!uniqueRequesters || uniqueRequesters < 1 || uniqueRequesters > 20) {
      return NextResponse.json(
        { error: 'Unique requesters must be between 1 and 20' },
        { status: 400 }
      );
    }

    // Start simulation
    partySimulator.start({
      environment: environment as 'local' | 'production',
      username: username.trim(),
      requestPin: requestPin || undefined,
      requestInterval,
      uniqueRequesters,
      burstMode: !!burstMode,
      explicitSongs: !!explicitSongs
    });

    const targetUrl = environment === 'local' 
      ? `http://localhost:3000/${username}/request`
      : `https://partyplaylist.co.uk/${username}/request`;

    console.log('🎉 Party simulation started by superadmin:', {
      environment,
      username,
      targetUrl,
      hasPin: !!requestPin,
      requestInterval,
      uniqueRequesters,
      burstMode,
      explicitSongs
    });

    return NextResponse.json({
      success: true,
      message: 'Simulation started',
      stats: partySimulator.getStats()
    });

  } catch (error: any) {
    console.error('❌ Error starting simulator:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start simulator' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/superadmin/party-simulator
 * Stop the party simulation
 */
export async function DELETE(req: NextRequest) {
  try {
    // Check superadmin auth
    const authResult = await requireSuperAdmin(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    partySimulator.stop();

    console.log('🛑 Party simulation stopped by superadmin');

    return NextResponse.json({
      success: true,
      message: 'Simulation stopped',
      stats: partySimulator.getStats()
    });

  } catch (error) {
    console.error('❌ Error stopping simulator:', error);
    return NextResponse.json(
      { error: 'Failed to stop simulator' },
      { status: 500 }
    );
  }
}

