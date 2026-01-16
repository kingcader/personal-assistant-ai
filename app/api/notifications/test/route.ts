/**
 * Push Notification Test API
 *
 * Used to debug push notification delivery.
 * GET /api/notifications/test - Check subscription status
 * POST /api/notifications/test - Send a test push notification
 * DELETE /api/notifications/test - Clear all subscriptions (for re-subscribing)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendTestPush } from '@/lib/notifications/push';
import { getActivePushSubscriptions, clearAllPushSubscriptions } from '@/lib/supabase/notification-queries';

export const dynamic = 'force-dynamic';

/**
 * Check push subscription status
 */
export async function GET() {
  try {
    const subscriptions = await getActivePushSubscriptions();

    // Check VAPID configuration
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    return NextResponse.json({
      vapid_configured: !!(vapidPublicKey && vapidPrivateKey),
      vapid_public_key_present: !!vapidPublicKey,
      vapid_private_key_present: !!vapidPrivateKey,
      active_subscriptions: subscriptions.length,
      subscriptions: subscriptions.map((sub) => ({
        id: sub.id,
        endpoint_preview: sub.endpoint.slice(0, 60) + '...',
        device_name: sub.device_name,
        user_agent: sub.user_agent?.slice(0, 50),
        created_at: sub.created_at,
        last_used_at: sub.last_used_at,
        is_active: sub.is_active,
      })),
    });
  } catch (error) {
    console.error('Error checking push status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Send a test push notification
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: require auth for production
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Allow without auth for testing, but log a warning
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('Test push sent without auth - consider adding security in production');
    }

    // Debug: Check VAPID and subscriptions BEFORE sending
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const subscriptions = await getActivePushSubscriptions();

    console.log('📱 Debug info before send:', {
      vapidPublicKeyExists: !!vapidPublicKey,
      vapidPrivateKeyExists: !!vapidPrivateKey,
      vapidPublicKeyLength: vapidPublicKey?.length,
      vapidPrivateKeyLength: vapidPrivateKey?.length,
      subscriptionCount: subscriptions.length,
    });

    console.log('📱 Sending test push notification...');

    const result = await sendTestPush();

    console.log('📱 Test push result:', result);

    return NextResponse.json({
      success: true,
      message: 'Test notification sent',
      debug: {
        vapid_public_key_exists: !!vapidPublicKey,
        vapid_private_key_exists: !!vapidPrivateKey,
        vapid_public_key_length: vapidPublicKey?.length || 0,
        vapid_private_key_length: vapidPrivateKey?.length || 0,
        subscriptions_found_before_send: subscriptions.length,
      },
      ...result,
    });
  } catch (error) {
    console.error('Error sending test push:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Clear all push subscriptions (for re-subscribing fresh)
 */
export async function DELETE() {
  try {
    const count = await clearAllPushSubscriptions();

    return NextResponse.json({
      success: true,
      message: `Cleared ${count} subscription(s). Please re-enable push notifications.`,
      cleared: count,
    });
  } catch (error) {
    console.error('Error clearing subscriptions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
