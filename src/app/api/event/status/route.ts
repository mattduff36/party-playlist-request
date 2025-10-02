/**
 * Event Status API Endpoint
 * 
 * Handles updating and retrieving event status (offline/standby/live)
 * with proper state transitions and Pusher synchronization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
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
    // Import database service dynamically to avoid circular dependencies
    const { getDatabaseService } = await import('@/lib/db/database-service');
    const dbService = getDatabaseService();
    
    // Get current event status
    const event = await dbService.getEvent();
    
    if (!event) {
      // Create a default event if none exists
      console.log('No event found, creating default event...');
      const defaultEvent = await dbService.createEvent({
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
    
    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        status: event.status,
        version: event.version,
        activeAdminId: event.active_admin_id,
        config: event.config,
        updatedAt: event.updated_at,
      }
    });

  } catch (error) {
    console.error('Error getting event status:', error);
    return NextResponse.json({ 
      error: 'Failed to get event status' 
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await authService.requireAdminAuth(req);
    
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
    
    // Get current event state (pass null if no eventId to get the first/active event)
    const currentEvent = await dbService.getEvent(eventId || undefined);

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

    // Update event status with version increment
    const newVersion = currentEvent.version + 1;
    const updatedEvent = await dbService.updateEventStatus(currentEvent.id, status as EventStatus, newVersion);

    if (!updatedEvent) {
      return NextResponse.json({ 
        error: 'Failed to update event status' 
      }, { status: 500 });
    }

    // Trigger Pusher event for real-time synchronization
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
        adminId: admin.adminId,
        adminName: admin.username,
      });
      
      console.log(`🎉 Event status updated to ${status} by ${admin.username}`);
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
