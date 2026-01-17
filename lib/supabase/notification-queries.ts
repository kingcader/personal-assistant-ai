/**
 * Notification Database Queries
 *
 * Handles all database operations for notifications and push subscriptions.
 */

import { supabase } from './client';

// Notification types matching the database enum
export type NotificationType =
  | 'task_suggestion'
  | 'follow_up'
  | 'waiting_on'
  | 'morning_brief'
  | 'evening_brief'
  | 'calendar_event'
  | 'meeting_prep'
  | 'scheduling_suggestion'
  | 'reminder';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  read: boolean;
  read_at: string | null;
  push_sent: boolean;
  push_sent_at: string | null;
  push_error: string | null;
  created_at: string;
}

export interface PushSubscription {
  id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  user_agent: string | null;
  device_name: string | null;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

export interface DailyBrief {
  id: string;
  date: string;
  type: 'morning' | 'evening';
  content: Record<string, unknown>;
  ai_model_used: string | null;
  generated_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ============================================
// NOTIFICATION QUERIES
// ============================================

/**
 * Create a new notification
 */
export async function createNotification(params: {
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  related_entity_type?: string;
  related_entity_id?: string;
}): Promise<Notification> {
  const { data, error } = await db
    .from('notifications')
    .insert({
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link || null,
      related_entity_type: params.related_entity_type || null,
      related_entity_id: params.related_entity_id || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  return data as Notification;
}

/**
 * Get unread notifications
 */
export async function getUnreadNotifications(): Promise<Notification[]> {
  const { data, error } = await db
    .from('notifications')
    .select('*')
    .eq('read', false)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch unread notifications: ${error.message}`);
  }

  return (data || []) as Notification[];
}

/**
 * Get recent notifications (for dropdown)
 */
export async function getRecentNotifications(limit: number = 20): Promise<Notification[]> {
  const { data, error } = await db
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch recent notifications: ${error.message}`);
  }

  return (data || []) as Notification[];
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(): Promise<number> {
  const { count, error } = await db
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('read', false);

  if (error) {
    throw new Error(`Failed to fetch unread count: ${error.message}`);
  }

  return count || 0;
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { error } = await db
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) {
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  const { error } = await db
    .from('notifications')
    .update({ read: true })
    .eq('read', false);

  if (error) {
    throw new Error(`Failed to mark all notifications as read: ${error.message}`);
  }
}

/**
 * Mark notification as push sent
 */
export async function markNotificationPushSent(
  notificationId: string,
  errorMsg?: string
): Promise<void> {
  const { error: dbError } = await db
    .from('notifications')
    .update({
      push_sent: true,
      push_sent_at: new Date().toISOString(),
      push_error: errorMsg || null,
    })
    .eq('id', notificationId);

  if (dbError) {
    throw new Error(`Failed to update notification push status: ${dbError.message}`);
  }
}

/**
 * Get notifications pending push delivery
 */
export async function getNotificationsPendingPush(): Promise<Notification[]> {
  const { data, error } = await db
    .from('notifications')
    .select('*')
    .eq('push_sent', false)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch pending push notifications: ${error.message}`);
  }

  return (data || []) as Notification[];
}

// ============================================
// PUSH SUBSCRIPTION QUERIES
// ============================================

/**
 * Save a push subscription
 */
export async function savePushSubscription(params: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  user_agent?: string;
  device_name?: string;
}): Promise<PushSubscription> {
  // Upsert - update if endpoint exists, insert if not
  const { data, error } = await db
    .from('push_subscriptions')
    .upsert(
      {
        endpoint: params.endpoint,
        keys: params.keys,
        user_agent: params.user_agent || null,
        device_name: params.device_name || null,
        is_active: true,
        last_used_at: new Date().toISOString(),
      },
      {
        onConflict: 'endpoint',
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save push subscription: ${error.message}`);
  }

  return data as PushSubscription;
}

/**
 * Get all active push subscriptions
 */
export async function getActivePushSubscriptions(): Promise<PushSubscription[]> {
  const { data, error } = await db
    .from('push_subscriptions')
    .select('*')
    .eq('is_active', true);

  if (error) {
    throw new Error(`Failed to fetch push subscriptions: ${error.message}`);
  }

  return (data || []) as PushSubscription[];
}

/**
 * Update subscription last used timestamp
 */
export async function updateSubscriptionLastUsed(subscriptionId: string): Promise<void> {
  const { error } = await db
    .from('push_subscriptions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', subscriptionId);

  if (error) {
    throw new Error(`Failed to update subscription last used: ${error.message}`);
  }
}

/**
 * Deactivate a push subscription (e.g., when push fails)
 */
export async function deactivatePushSubscription(endpoint: string): Promise<void> {
  const { error } = await db
    .from('push_subscriptions')
    .update({ is_active: false })
    .eq('endpoint', endpoint);

  if (error) {
    throw new Error(`Failed to deactivate subscription: ${error.message}`);
  }
}

/**
 * Remove a push subscription
 */
export async function removePushSubscription(endpoint: string): Promise<void> {
  const { error } = await db
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (error) {
    throw new Error(`Failed to remove subscription: ${error.message}`);
  }
}

/**
 * Clear all push subscriptions (for fresh start)
 */
export async function clearAllPushSubscriptions(): Promise<number> {
  // First count how many we have
  const { count } = await db
    .from('push_subscriptions')
    .select('*', { count: 'exact', head: true });

  // Delete all
  const { error } = await db
    .from('push_subscriptions')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (neq a non-existent id)

  if (error) {
    throw new Error(`Failed to clear subscriptions: ${error.message}`);
  }

  return count || 0;
}

// ============================================
// DAILY BRIEF QUERIES
// ============================================

/**
 * Save a daily brief
 */
export async function saveDailyBrief(params: {
  date: string; // YYYY-MM-DD
  type: 'morning' | 'evening';
  content: Record<string, unknown>;
  ai_model_used?: string;
}): Promise<DailyBrief> {
  // Upsert - update if date+type exists
  const { data, error } = await db
    .from('daily_briefs')
    .upsert(
      {
        date: params.date,
        type: params.type,
        content: params.content,
        ai_model_used: params.ai_model_used || null,
        generated_at: new Date().toISOString(),
      },
      {
        onConflict: 'date,type',
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save daily brief: ${error.message}`);
  }

  return data as DailyBrief;
}

/**
 * Get today's briefs
 */
export async function getTodaysBriefs(): Promise<DailyBrief[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await db
    .from('daily_briefs')
    .select('*')
    .eq('date', today)
    .order('type');

  if (error) {
    throw new Error(`Failed to fetch today's briefs: ${error.message}`);
  }

  return (data || []) as DailyBrief[];
}

/**
 * Get brief by date and type
 */
export async function getBrief(
  date: string,
  type: 'morning' | 'evening'
): Promise<DailyBrief | null> {
  const { data, error } = await db
    .from('daily_briefs')
    .select('*')
    .eq('date', date)
    .eq('type', type)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = not found
    throw new Error(`Failed to fetch brief: ${error.message}`);
  }

  return (data as DailyBrief) || null;
}

/**
 * Check if a notification of a specific type was sent recently for an entity
 * Used to prevent duplicate notifications (e.g., waiting-on notifications)
 */
export async function hasRecentNotification(params: {
  type: NotificationType;
  related_entity_type: string;
  related_entity_id: string;
  withinDays: number;
}): Promise<boolean> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - params.withinDays);

  const { data, error } = await db
    .from('notifications')
    .select('id')
    .eq('type', params.type)
    .eq('related_entity_type', params.related_entity_type)
    .eq('related_entity_id', params.related_entity_id)
    .gte('created_at', cutoffDate.toISOString())
    .limit(1);

  if (error) {
    console.error('Error checking recent notification:', error);
    return false; // On error, allow notification to be sent
  }

  return (data?.length ?? 0) > 0;
}

/**
 * Get recent briefs
 */
export async function getRecentBriefs(limit: number = 14): Promise<DailyBrief[]> {
  const { data, error } = await db
    .from('daily_briefs')
    .select('*')
    .order('date', { ascending: false })
    .order('type')
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch recent briefs: ${error.message}`);
  }

  return (data || []) as DailyBrief[];
}
