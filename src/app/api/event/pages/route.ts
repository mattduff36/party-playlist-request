import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { triggerPageControlUpdate } from '@/lib/pusher';

export async function POST(req: NextRequest) {
  try {
    console.log('🌐 [API /event/pages POST] Request received');
    
    // Authenticate user
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    console.log(`🌐 [event/pages] User ${auth.user.username} (${userId}) updating page controls`);
    
    const body = await req.json();
    console.log('🌐 [API /event/pages POST] Request body:', body);
    
    const { page, enabled, eventId } = body;

    if (!page || typeof enabled !== 'boolean') {
      console.error('❌ [API /event/pages POST] Invalid request - missing page or enabled');
      return NextResponse.json({ 
        error: 'Page and enabled status are required' 
      }, { status: 400 });
    }

    if (!['requests', 'display'].includes(page)) {
      console.error('❌ [API /event/pages POST] Invalid page type:', page);
      return NextResponse.json({ 
        error: 'Page must be either "requests" or "display"' 
      }, { status: 400 });
    }

    // Import database service dynamically to avoid circular dependencies
    const { getDatabaseService } = await import('@/lib/db/database-service');
    const dbService = getDatabaseService();
    
    console.log('🌐 [API /event/pages POST] Getting event:', eventId || 'first/active');
    // Get current event for THIS user
    const currentEvent = await dbService.getEvent(userId, eventId || undefined);
    if (!currentEvent) {
      console.error('❌ [API /event/pages POST] Event not found');
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    
    console.log('🌐 [API /event/pages POST] Current event:', {
      id: currentEvent.id,
      status: currentEvent.status,
      currentPagesEnabled: currentEvent.config.pages_enabled,
    });

    // Update page enabled status
    const newConfig = {
      ...currentEvent.config,
      pages_enabled: {
        ...currentEvent.config.pages_enabled,
        [page]: enabled,
      },
    };
    
    console.log('🌐 [API /event/pages POST] New config:', newConfig);

    const updatedEvent = await dbService.updateEvent(currentEvent.id, { config: newConfig }, userId);
    console.log('🌐 [API /event/pages POST] Event updated in DB:', {
      id: updatedEvent.id,
      newPagesEnabled: updatedEvent.config.pages_enabled,
    });

    // Trigger Pusher event for real-time updates
    const pusherPayload = {
      page,
      enabled,
      pagesEnabled: updatedEvent.config.pages_enabled,
      adminId: userId,
      adminName: auth.user.username,
    };
    console.log('📡 [API /event/pages POST] Triggering Pusher event:', pusherPayload);
    await triggerPageControlUpdate(pusherPayload);
    console.log('✅ [API /event/pages POST] Pusher event sent successfully');

    const responseData = { 
      success: true, 
      event: {
        id: updatedEvent.id,
        status: updatedEvent.status,
        version: updatedEvent.version,
        activeAdminId: updatedEvent.active_admin_id,
        config: updatedEvent.config,
        updatedAt: updatedEvent.updated_at,
      },
      pageEnabled: enabled 
    };
    console.log('✅ [API /event/pages POST] Sending response:', responseData);
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('❌ [API /event/pages POST] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to update page control' 
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    console.log(`🌐 [event/pages GET] User ${auth.user.username} (${userId}) getting page controls`);
    
    const { getDatabaseService } = await import('@/lib/db/database-service');
    const dbService = getDatabaseService();
    const event = await dbService.getEvent(userId);

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      pagesEnabled: event.config.pages_enabled 
    });
  } catch (error) {
    console.error('Error getting page controls:', error);
    return NextResponse.json({ 
      error: 'Failed to get page controls' 
    }, { status: 500 });
  }
}
