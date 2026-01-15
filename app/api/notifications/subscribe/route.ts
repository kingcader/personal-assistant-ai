/**
 * Push Subscription API
 *
 * Manages Web Push subscriptions for notifications.
 * Part of Loop #3: Daily Brief + Push Notifications
 *
 * POST /api/notifications/subscribe - Register new subscription
 * DELETE /api/notifications/subscribe - Remove subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  savePushSubscription,
  removePushSubscription,
} from '@/lib/supabase/notification-queries';

export const dynamic = 'force-dynamic';

/**
 * Register a new push subscription
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json(
        { error: 'Missing required subscription data' },
        { status: 400 }
      );
    }

    const subscription = await savePushSubscription({
      endpoint: body.endpoint,
      keys: {
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
      user_agent: request.headers.get('user-agent') || undefined,
      device_name: body.device_name,
    });

    console.log('📱 Push subscription registered:', subscription.id);

    return NextResponse.json({
      success: true,
      subscription_id: subscription.id,
    });
  } catch (error) {
    console.error('Error registering push subscription:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Remove a push subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.endpoint) {
      return NextResponse.json(
        { error: 'Missing endpoint' },
        { status: 400 }
      );
    }

    await removePushSubscription(body.endpoint);

    console.log('📱 Push subscription removed');

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error removing push subscription:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
