import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { triggerRequestDeleted } from '@/lib/pusher';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authService.requireAdminAuth(req);
    const { id } = await params;
    
    const client = getPool();
    
    // Delete the request completely
    const result = await client.query(
      'DELETE FROM requests WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json({ 
        error: 'Request not found' 
      }, { status: 404 });
    }
    
    const deletedRequest = result.rows[0];
    
    // 🚀 PUSHER: Trigger real-time event for deleted request
    try {
      await triggerRequestDeleted({
        id: deletedRequest.id,
        track_name: deletedRequest.track_name,
        artist_name: deletedRequest.artist_name,
        status: deletedRequest.status,
        deleted_at: new Date().toISOString()
      });
      console.log(`🗑️ Pusher event sent for deleted request: ${deletedRequest.track_name}`);
    } catch (pusherError) {
      console.error('❌ Failed to send Pusher event:', pusherError);
      // Don't fail the request if Pusher fails
    }
    
    return NextResponse.json({
      success: true,
      message: 'Request deleted successfully',
      deleted_request: {
        id: deletedRequest.id,
        track_name: deletedRequest.track_name,
        artist_name: deletedRequest.artist_name,
        status: deletedRequest.status
      }
    });
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error deleting request:', error);
    return NextResponse.json({ 
      error: 'Failed to delete request' 
    }, { status: 500 });
  }
}
