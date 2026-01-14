/**
 * Audit Log Query Functions
 *
 * Provides explicit auditability for all actions in the system.
 * Every suggestion approval, task update, follow-up send, etc. is logged.
 */

import { supabase } from './client';
import type { AuditLog, AuditLogInsert, Json, PendingApprovalsCount } from '@/types/database';

/**
 * Log an audit event
 * Called by other query functions to record all actions
 */
export async function logAuditEvent(event: AuditLogInsert): Promise<AuditLog> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('audit_log')
    .insert(event)
    .select()
    .single();

  if (error) {
    // Don't throw - audit failures shouldn't break the main operation
    console.error('Failed to log audit event:', error);
    // Return a mock audit log to allow the operation to continue
    return {
      id: 'error',
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      action: event.action,
      actor: event.actor || 'user',
      previous_state: event.previous_state || null,
      new_state: event.new_state || null,
      metadata: event.metadata || null,
      created_at: new Date().toISOString(),
    };
  }

  return data as AuditLog;
}

/**
 * Get audit history for a specific entity
 * Useful for viewing the history of a task, thread, or follow-up
 */
export async function getAuditHistory(
  entityType: string,
  entityId: string
): Promise<AuditLog[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('audit_log')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch audit history: ${error.message}`);
  }

  return data as AuditLog[];
}

/**
 * Get recent audit events (for activity feed)
 * Optionally filter by action types
 */
export async function getRecentAuditEvents(
  options: {
    limit?: number;
    actions?: string[];
    entityTypes?: string[];
    actor?: 'user' | 'ai' | 'system';
  } = {}
): Promise<AuditLog[]> {
  const { limit = 50, actions, entityTypes, actor } = options;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (actions && actions.length > 0) {
    query = query.in('action', actions);
  }

  if (entityTypes && entityTypes.length > 0) {
    query = query.in('entity_type', entityTypes);
  }

  if (actor) {
    query = query.eq('actor', actor);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch recent audit events: ${error.message}`);
  }

  return data as AuditLog[];
}

/**
 * Get pending approvals count (for nav badges)
 * Uses the pending_approvals_count view
 */
export async function getPendingApprovalsCount(): Promise<PendingApprovalsCount> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('pending_approvals_count')
    .select('*')
    .single();

  if (error) {
    // Return zeros if view doesn't exist yet
    console.warn('Failed to fetch pending approvals count:', error);
    return {
      task_suggestions: 0,
      follow_up_suggestions: 0,
      total: 0,
    };
  }

  return data as PendingApprovalsCount;
}

/**
 * Get daily activity summary
 * Returns counts of actions by type for a given date
 */
export async function getDailyActivitySummary(
  date: string = new Date().toISOString().split('T')[0]
): Promise<{
  date: string;
  approvals: number;
  rejections: number;
  tasksCompleted: number;
  followUpsSent: number;
  total: number;
}> {
  const startOfDay = `${date}T00:00:00.000Z`;
  const endOfDay = `${date}T23:59:59.999Z`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('audit_log')
    .select('action')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  if (error) {
    throw new Error(`Failed to fetch daily activity: ${error.message}`);
  }

  const actions = data as Array<{ action: string }>;

  return {
    date,
    approvals: actions.filter(a => a.action === 'approved').length,
    rejections: actions.filter(a => a.action === 'rejected').length,
    tasksCompleted: actions.filter(a => a.action === 'completed').length,
    followUpsSent: actions.filter(a => a.action === 'sent').length,
    total: actions.length,
  };
}

/**
 * Convenience function to log common actions
 */
export const AuditActions = {
  async suggestionApproved(suggestionId: string, taskId: string, previousState?: Json, newState?: Json) {
    return logAuditEvent({
      entity_type: 'suggestion',
      entity_id: suggestionId,
      action: 'approved',
      actor: 'user',
      previous_state: previousState,
      new_state: newState,
      metadata: { created_task_id: taskId },
    });
  },

  async suggestionRejected(suggestionId: string, previousState?: Json) {
    return logAuditEvent({
      entity_type: 'suggestion',
      entity_id: suggestionId,
      action: 'rejected',
      actor: 'user',
      previous_state: previousState,
    });
  },

  async taskStatusChanged(taskId: string, action: string, previousState?: Json, newState?: Json) {
    return logAuditEvent({
      entity_type: 'task',
      entity_id: taskId,
      action,
      actor: 'user',
      previous_state: previousState,
      new_state: newState,
    });
  },

  async followUpGenerated(followUpId: string, threadId: string, newState?: Json) {
    return logAuditEvent({
      entity_type: 'follow_up',
      entity_id: followUpId,
      action: 'created',
      actor: 'ai',
      new_state: newState,
      metadata: { thread_id: threadId },
    });
  },

  async threadSnoozed(threadId: string, snoozeUntil: string, previousState?: Json, newState?: Json) {
    return logAuditEvent({
      entity_type: 'thread',
      entity_id: threadId,
      action: 'snoozed',
      actor: 'user',
      previous_state: previousState,
      new_state: newState,
      metadata: { snooze_until: snoozeUntil },
    });
  },
};
