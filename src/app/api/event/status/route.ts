/**
 * Event Status API Endpoint
 * 
 * Handles updating and retrieving event status (offline/standby/live)
 * with proper state transitions and Pusher synchronization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { triggerStateUpdate } from '@/lib/pusher';
import { EventStatus } from '@/lib/db/schema';

// State transition validation
const VALID_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  offline: ['standby', 'live'],
  standby: ['offline', 'live'],
  live: ['offline', 'standby'],
};

function canTransition(from: EventStatus, to: EventStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export async function GET(req: NextRequest) {
  try {
    // Authenticate and get user info
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }
    
    const userId = auth.user.user_id;
    console.log(`📊 [event/status] User ${auth.user.username} (${userId}) fetching event status`);
    
    // Import database service dynamically to avoid circular dependencies
    const { getDatabaseService } = await import('@/lib/db/database-service');
    const dbService = getDatabaseService();
    
    // Verify the user actually exists in the database (JWT might be stale)
    const { sql } = await import('@/lib/db/neon-client');
    const userCheck = await sql`SELECT id FROM users WHERE id = ${userId}`;
    
    if (userCheck.length === 0) {
      console.error(`❌ User ${userId} from JWT does not exist in database. Token is stale.`);
      return NextResponse.json(
        { error: 'Invalid authentication token. Please log in again.' },
        { 
          status: 401,
          headers: {
            'Set-Cookie': 'auth_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict'
          }
        }
      );
    }
    
    // Get current event status for THIS user
    const event = await dbService.getEvent(userId);
    
    if (!event) {
      // Create a default event if none exists
      console.log(`No event found for user ${userId}, creating default event...`);
      const defaultEvent = await dbService.createEvent({
        user_id: userId,  // ✅ Associate event with this user
        status: 'offline',
        version: 0,
        config: {
          pages_enabled: {
            requests: false,
            display: false,
          },
          event_title: 'Party DJ Requests',
          welcome_message: 'Welcome to the party!',
          secondary_message: 'Request your favorite songs',
          tertiary_message: 'Have fun!',
        }
      });
      
      if (!defaultEvent) {
        return NextResponse.json({ 
          error: 'Failed to create default event' 
        }, { status: 500 });
      }
      
      return NextResponse.json({
        success: true,
        event: {
          id: defaultEvent.id,
          status: defaultEvent.status,
          version: defaultEvent.version,
          activeAdminId: defaultEvent.active_admin_id,
          config: defaultEvent.config,
          updatedAt: defaultEvent.updated_at,
        }
      });
    }
    
    // Include guest access code when DJ event is on so AdminLayout "Code:" chrome
    // can hydrate from GlobalEventProvider without a second racey /events/current fetch.
    let pin: string | null = null;
    if (event.status === 'live' || event.status === 'standby') {
      try {
        const { getActiveEvent, createEvent } = await import('@/lib/event-service');
        let guest = await getActiveEvent(userId);
        if (!guest) {
          guest = await createEvent(userId);
        }
        const code = guest.access_code || guest.pin;
        pin = typeof code === 'string' && code.length > 0 ? code : null;
      } catch (guestError) {
        console.error('❌ Failed to resolve guest access code for status GET:', guestError);
      }
    }

    const response = NextResponse.json({
      success: true,
      event: {
        id: event.id,
        status: event.status,
        version: event.version,
        activeAdminId: event.active_admin_id,
        config: event.config,
        updatedAt: event.updated_at,
        pin,
      }
    });
    
    // Do not cache when pin may be minted / rotated with status
    response.headers.set('Cache-Control', 'private, no-store');
    
    return response;

  } catch (error) {
    console.error('Error getting event status:', error);
    return NextResponse.json({ 
      error: 'Failed to get event status' 
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate and get user info
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }
    
    const userId = auth.user.user_id;
    console.log(`🔄 [event/status] User ${auth.user.username} (${userId}) updating event status`);

    const body = await req.json();
    const { status, eventId } = body;

    if (!status) {
      return NextResponse.json({ 
        error: 'Status is required' 
      }, { status: 400 });
    }

    if (!['offline', 'standby', 'live'].includes(status)) {
      return NextResponse.json({ 
        error: 'Invalid status. Must be offline, standby, or live' 
      }, { status: 400 });
    }

    // Import database service dynamically
    const { getDatabaseService } = await import('@/lib/db/database-service');
    const dbService = getDatabaseService();
    
    // Get current event state for THIS user
    const currentEvent = await dbService.getEvent(userId, eventId || undefined);

    if (!currentEvent) {
      return NextResponse.json({ 
        error: 'Event not found. Please create an event first.' 
      }, { status: 404 });
    }

    // Validate state transition
    if (!canTransition(currentEvent.status as EventStatus, status as EventStatus)) {
      return NextResponse.json({ 
        error: `Invalid transition from ${currentEvent.status} to ${status}`,
        details: {
          currentStatus: currentEvent.status,
          requestedStatus: status,
          validTransitions: VALID_TRANSITIONS[currentEvent.status as EventStatus]
        }
      }, { status: 400 });
    }

    const startingNewEvent =
      currentEvent.status === 'offline' &&
      (status === 'standby' || status === 'live');

    // Mint guest access code BEFORE flipping status so a failed mint does not leave Live without a code.
    // Previously, End only set events.status=offline and left user_events.active=true — Start then
    // resurrected the same 4-digit code via GET /api/events/current.
    if (startingNewEvent) {
      try {
        const { createEvent } = await import('@/lib/event-service');
        const guestEvent = await createEvent(userId);
        console.log(
          `🔑 Minted new guest access code for user ${userId}: ${guestEvent.access_code}`
        );
      } catch (createEventError) {
        console.error('❌ Failed to create guest access event on start:', createEventError);
        return NextResponse.json(
          { error: 'Failed to create event access code. Please try again.' },
          { status: 500 }
        );
      }
    }

    // Update event status with version increment
    const newVersion = currentEvent.version + 1;
    const updatedEvent = await dbService.updateEventStatus(currentEvent.id, status as EventStatus, newVersion, userId);

    if (!updatedEvent) {
      return NextResponse.json({ 
        error: 'Failed to update event status' 
      }, { status: 500 });
    }

    // Starting a new DJ event (offline → standby/live): reset shared mood to DJ Tool
    if (startingNewEvent) {
      try {
        const { updateEventSettings, getEventSettings } = await import('@/lib/db');
        const { triggerEvent, getUserChannel } = await import('@/lib/pusher');
        const { DEFAULT_DISPLAY_MOOD } = await import('@/styles/theme');
        await updateEventSettings({ display_mood: DEFAULT_DISPLAY_MOOD }, userId);
        const settings = await getEventSettings(userId);
        await triggerEvent(getUserChannel(userId), 'settings-update', {
          settings,
          timestamp: Date.now(),
          userId,
        });
        console.log(`🎨 Reset display_mood to ${DEFAULT_DISPLAY_MOOD} for new event start (${userId})`);
      } catch (moodResetError) {
        console.error('❌ Failed to reset display mood on event start:', moodResetError);
        // Don't fail the status change if mood reset fails
      }
    }

    // End event: archive lifecycle (offline) — do NOT delete request history here.
    // Destructive cleanup remains a separate confirmed admin action (cleanup-requests).
    if (status === 'offline') {
      try {
        const { endAllActiveEventsForUser } = await import('@/lib/event-service');
        await endAllActiveEventsForUser(userId);
      } catch (endEventsError) {
        console.error('❌ Failed to end user_events on offline:', endEventsError);
        // Continue — status already updated; next start still mints a new code
      }

      try {
        const { archiveEventOnEnd } = await import('@/lib/reliability/event-archive');
        const archived = await archiveEventOnEnd(userId, updatedEvent.id);
        console.log(
          `📦 Archived event ${archived.eventId}: ${archived.archivedRequests} requests stamped`
        );
      } catch (archiveError) {
        console.error('❌ Failed to archive event requests on offline:', archiveError);
      }

      try {
        const { emitSecurityAudit } = await import('@/lib/auth/security-audit');
        emitSecurityAudit('event.end', {
          correlationId: auth.correlationId,
          userId,
          eventId: updatedEvent.id,
          meta: { status: 'offline' },
        });
      } catch {
        // non-fatal
      }
    }

    // Trigger Pusher event for real-time synchronization (USER-SPECIFIC CHANNEL)
    try {
      await triggerStateUpdate({
        status: updatedEvent.status as EventStatus,
        pagesEnabled: {
          requests: updatedEvent.config?.pages_enabled?.requests || false,
          display: updatedEvent.config?.pages_enabled?.display || false,
        },
        config: {
          event_title: updatedEvent.config?.event_title || 'Party DJ Requests',
          welcome_message: updatedEvent.config?.welcome_message || '',
          secondary_message: updatedEvent.config?.secondary_message || '',
          tertiary_message: updatedEvent.config?.tertiary_message || '',
        },
        adminId: userId,
        adminName: auth.user.username,
        userId: userId, // ✅ USER-SPECIFIC CHANNEL - only this user receives the event
      });
      
      console.log(`🎉 Event status updated to ${status} by ${auth.user.username}`);
    } catch (pusherError) {
      console.error('❌ Failed to send Pusher event:', pusherError);
      // Don't fail the request if Pusher fails
    }

    return NextResponse.json({
      success: true,
      event: {
        id: updatedEvent.id,
        status: updatedEvent.status,
        version: updatedEvent.version,
        activeAdminId: updatedEvent.active_admin_id,
        config: updatedEvent.config,
        updatedAt: updatedEvent.updated_at,
      }
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('❌ Error updating event status:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error,
      error: error
    });
    
    return NextResponse.json({ 
      error: 'Failed to update event status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
