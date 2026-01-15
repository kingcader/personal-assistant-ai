/**
 * Web Push Notification Sender
 *
 * Sends push notifications to all registered devices.
 * Part of Loop #3: Daily Brief + Push Notifications
 */

import webpush from 'web-push';
import {
  getActivePushSubscriptions,
  deactivatePushSubscription,
  updateSubscriptionLastUsed,
  createNotification,
  markNotificationPushSent,
  type NotificationType,
  type PushSubscription,
} from '@/lib/supabase/notification-queries';

// VAPID configuration - lazy initialization to avoid build-time errors
let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;

  const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
  const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:kincaidgarrett@gmail.com';

  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    try {
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
      vapidConfigured = true;
      return true;
    } catch (error) {
      console.error('Failed to configure VAPID:', error);
      return false;
    }
  }

  console.warn('VAPID keys not configured - push notifications disabled');
  return false;
}

/**
 * Push notification payload
 */
export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  link?: string;
  tag?: string; // Used to replace existing notifications with same tag
}

/**
 * Send push notification to a single subscription
 */
async function sendToSubscription(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<boolean> {
  // Ensure VAPID is configured
  if (!ensureVapidConfigured()) {
    return false;
  }

  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    };

    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload)
    );

    // Update last used timestamp
    await updateSubscriptionLastUsed(subscription.id);

    return true;
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode;

    // Handle expired/invalid subscriptions
    if (statusCode === 404 || statusCode === 410) {
      console.log(`📱 Subscription expired, deactivating: ${subscription.endpoint.slice(0, 50)}...`);
      await deactivatePushSubscription(subscription.endpoint);
    } else {
      console.error(`📱 Push failed for ${subscription.endpoint.slice(0, 50)}...:`, error);
    }

    return false;
  }
}

/**
 * Send push notification to all active subscriptions
 */
export async function sendPushToAll(payload: PushPayload): Promise<{
  sent: number;
  failed: number;
  total: number;
}> {
  // Ensure VAPID is configured before sending
  if (!ensureVapidConfigured()) {
    console.log('📱 Push notifications disabled - VAPID not configured');
    return { sent: 0, failed: 0, total: 0 };
  }

  const subscriptions = await getActivePushSubscriptions();

  if (subscriptions.length === 0) {
    console.log('📱 No active push subscriptions');
    return { sent: 0, failed: 0, total: 0 };
  }

  console.log(`📱 Sending push to ${subscriptions.length} device(s)...`);

  let sent = 0;
  let failed = 0;

  // Send to all subscriptions in parallel
  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendToSubscription(sub, payload))
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      sent++;
    } else {
      failed++;
    }
  }

  console.log(`📱 Push results: ${sent} sent, ${failed} failed`);

  return { sent, failed, total: subscriptions.length };
}

/**
 * Create a notification and send push immediately
 * This is the main function to call when something needs to notify the user
 */
export async function notify(params: {
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  tag?: string;
  related_entity_type?: string;
  related_entity_id?: string;
}): Promise<{
  notification_id: string;
  push_sent: number;
  push_failed: number;
}> {
  // 1. Create notification in database
  const notification = await createNotification({
    type: params.type,
    title: params.title,
    body: params.body,
    link: params.link,
    related_entity_type: params.related_entity_type,
    related_entity_id: params.related_entity_id,
  });

  // 2. Send push notification to all devices
  const pushPayload: PushPayload = {
    title: params.title,
    body: params.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    link: params.link || '/',
    tag: params.tag,
  };

  const pushResult = await sendPushToAll(pushPayload);

  // 3. Mark notification as push sent
  await markNotificationPushSent(
    notification.id,
    pushResult.failed > 0 ? `Failed to send to ${pushResult.failed} device(s)` : undefined
  );

  return {
    notification_id: notification.id,
    push_sent: pushResult.sent,
    push_failed: pushResult.failed,
  };
}

/**
 * Send a test push notification
 * Useful for debugging
 */
export async function sendTestPush(): Promise<{
  sent: number;
  failed: number;
  total: number;
}> {
  return sendPushToAll({
    title: 'Test Notification',
    body: 'Push notifications are working correctly!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    link: '/',
    tag: 'test',
  });
}
