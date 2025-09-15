import { NextRequest, NextResponse } from 'next/server';
import { getNotifications, markNotificationAsShown } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // Get unshown notifications
    const notifications = await getNotifications();
    
    return NextResponse.json({
      notifications
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    return NextResponse.json({
      notifications: []
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { notificationId } = await req.json();
    
    if (!notificationId) {
      return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });
    }
    
    await markNotificationAsShown(notificationId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as shown:', error);
    return NextResponse.json({ error: 'Failed to mark notification as shown' }, { status: 500 });
  }
}

