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
let vapidConfigError: string | null = null;

/**
 * Strip base64 padding and ensure URL-safe format
 * web-push requires URL-safe base64 WITHOUT padding (no = characters)
 */
function toUrlSafeBase64(key: string): string {
  return key
    .replace(/\+/g, '-')  // + -> -
    .replace(/\//g, '_')  // / -> _
    .replace(/=+$/, '');  // Remove trailing =
}

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;

  const VAPID_PUBLIC_KEY_RAW = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE_KEY_RAW = process.env.VAPID_PRIVATE_KEY;
  const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:kincaidgarrett@gmail.com';

  // Convert to URL-safe base64 without padding (required by web-push)
  const VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY_RAW ? toUrlSafeBase64(VAPID_PUBLIC_KEY_RAW) : undefined;
  const VAPID_PRIVATE_KEY = VAPID_PRIVATE_KEY_RAW ? toUrlSafeBase64(VAPID_PRIVATE_KEY_RAW) : undefined;

  console.log('📱 VAPID config check:', {
    publicKeyExists: !!VAPID_PUBLIC_KEY,
    privateKeyExists: !!VAPID_PRIVATE_KEY,
    publicKeyLength: VAPID_PUBLIC_KEY?.length,
    privateKeyLength: VAPID_PRIVATE_KEY?.length,
    subject: VAPID_SUBJECT,
  });

  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    try {
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
      vapidConfigured = true;
      console.log('📱 VAPID configured successfully');
      return true;
    } catch (error) {
      vapidConfigError = error instanceof Error ? error.message : String(error);
      console.error('📱 Failed to configure VAPID:', vapidConfigError, error);
      return false;
    }
  }

  vapidConfigError = 'VAPID keys not found in environment';
  console.warn('📱 VAPID keys not configured - push notifications disabled');
  return false;
}

// Export for debugging
export function getVapidStatus(): { configured: boolean; error: string | null } {
  return { configured: vapidConfigured, error: vapidConfigError };
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
 * Result of sending to a single subscription
 */
export interface SendResult {
  success: boolean;
  endpoint: string;
  error?: string;
  statusCode?: number;
}

/**
 * Send push notification to a single subscription
 */
async function sendToSubscription(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<SendResult> {
  const endpointPreview = subscription.endpoint.slice(0, 50) + '...';

  // Ensure VAPID is configured
  if (!ensureVapidConfigured()) {
    return { success: false, endpoint: endpointPreview, error: 'VAPID not configured' };
  }

  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    };

    console.log(`📱 Attempting push to: ${endpointPreview}`);
    console.log(`📱 Keys: p256dh=${subscription.keys.p256dh?.slice(0, 20)}..., auth=${subscription.keys.auth?.slice(0, 10)}...`);

    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload)
    );

    // Update last used timestamp
    await updateSubscriptionLastUsed(subscription.id);

    console.log(`📱 Push successful to: ${endpointPreview}`);
    return { success: true, endpoint: endpointPreview };
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`📱 Push failed for ${endpointPreview}:`, { statusCode, errorMessage, error });

    // Handle expired/invalid subscriptions
    if (statusCode === 404 || statusCode === 410) {
      console.log(`📱 Subscription expired, deactivating: ${endpointPreview}`);
      await deactivatePushSubscription(subscription.endpoint);
    }

    return {
      success: false,
      endpoint: endpointPreview,
      error: errorMessage,
      statusCode
    };
  }
}

/**
 * Send push notification to all active subscriptions
 */
export async function sendPushToAll(payload: PushPayload): Promise<{
  sent: number;
  failed: number;
  total: number;
  errors: SendResult[];
}> {
  // Ensure VAPID is configured before sending
  if (!ensureVapidConfigured()) {
    console.log('📱 Push notifications disabled - VAPID not configured');
    return { sent: 0, failed: 0, total: 0, errors: [] };
  }

  const subscriptions = await getActivePushSubscriptions();

  if (subscriptions.length === 0) {
    console.log('📱 No active push subscriptions');
    return { sent: 0, failed: 0, total: 0, errors: [] };
  }

  console.log(`📱 Sending push to ${subscriptions.length} device(s)...`);

  let sent = 0;
  let failed = 0;
  const errors: SendResult[] = [];

  // Send to all subscriptions in parallel
  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendToSubscription(sub, payload))
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      if (result.value.success) {
        sent++;
      } else {
        failed++;
        errors.push(result.value);
      }
    } else {
      failed++;
      errors.push({ success: false, endpoint: 'unknown', error: result.reason?.message || 'Promise rejected' });
    }
  }

  console.log(`📱 Push results: ${sent} sent, ${failed} failed`);
  if (errors.length > 0) {
    console.log(`📱 Errors:`, errors);
  }

  return { sent, failed, total: subscriptions.length, errors };
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
  errors: SendResult[];
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
