/**
 * Single Notification API
 *
 * Manage individual notifications.
 * Part of Loop #3: Daily Brief + Push Notifications
 *
 * PATCH /api/notifications/[id] - Mark notification as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { markNotificationAsRead } from '@/lib/supabase/notification-queries';

export const dynamic = 'force-dynamic';

/**
 * Mark a notification as read
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await markNotificationAsRead(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
