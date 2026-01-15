/**
 * Notifications API
 *
 * Lists and manages notifications.
 * Part of Loop #3: Daily Brief + Push Notifications
 *
 * GET /api/notifications - List recent notifications
 * POST /api/notifications/mark-all-read - Mark all as read
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getRecentNotifications,
  getUnreadCount,
  markAllNotificationsAsRead,
} from '@/lib/supabase/notification-queries';

export const dynamic = 'force-dynamic';

/**
 * Get recent notifications with unread count
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const [notifications, unreadCount] = await Promise.all([
      getRecentNotifications(limit),
      getUnreadCount(),
    ]);

    return NextResponse.json({
      notifications,
      unread_count: unreadCount,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Mark all notifications as read
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'mark_all_read') {
      await markAllNotificationsAsRead();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing notification action:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
