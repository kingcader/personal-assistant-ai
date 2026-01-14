/**
 * Thread Query Functions
 *
 * Handles thread aggregation, waiting-on detection, and follow-up management.
 * Part of Loop #2: Waiting-On + Follow-Up Engine
 */

import { supabase } from './client';
import type {
  Thread,
  ThreadInsert,
  ThreadUpdate,
  FollowUpSuggestion,
  FollowUpSuggestionInsert,
  WaitingOnThread,
  ThreadParticipant,
} from '@/types/database';
import { logAuditEvent } from './audit-queries';

// Kincaid's email - used for detecting "my" messages
const MY_EMAIL = 'kincaidgarrett@gmail.com';

// Threshold for "waiting on" detection (in days)
const WAITING_THRESHOLD_DAYS = 2;

/**
 * Thread with related emails for context
 */
export interface ThreadWithEmails extends Thread {
  emails: Array<{
    id: string;
    subject: string;
    body: string;
    received_at: string;
    sender: {
      email: string;
      name: string | null;
    };
  }>;
}

/**
 * Follow-up suggestion with thread context
 */
export interface FollowUpWithThread extends FollowUpSuggestion {
  thread: {
    id: string;
    subject: string | null;
    waiting_on_email: string | null;
    waiting_since: string | null;
  };
}

// ============================================
// THREAD QUERIES
// ============================================

/**
 * Get or create a thread by Gmail thread ID
 * Used during thread sync
 */
export async function upsertThread(data: {
  gmail_thread_id: string;
  subject?: string | null;
  participants?: ThreadParticipant[];
  first_message_at?: string | null;
  last_message_at?: string | null;
  last_sender_email?: string | null;
  my_last_message_at?: string | null;
  message_count?: number;
}): Promise<{ thread: Thread; isNew: boolean }> {
  // Check if thread exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('threads')
    .select('*')
    .eq('gmail_thread_id', data.gmail_thread_id)
    .single();

  if (existing) {
    // Update existing thread
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error } = await (supabase as any)
      .from('threads')
      .update({
        subject: data.subject ?? existing.subject,
        participants: data.participants ?? existing.participants,
        first_message_at: data.first_message_at ?? existing.first_message_at,
        last_message_at: data.last_message_at ?? existing.last_message_at,
        last_sender_email: data.last_sender_email ?? existing.last_sender_email,
        my_last_message_at: data.my_last_message_at ?? existing.my_last_message_at,
        message_count: data.message_count ?? existing.message_count,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update thread: ${error.message}`);
    }

    return { thread: updated as Thread, isNew: false };
  }

  // Create new thread
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error } = await (supabase as any)
    .from('threads')
    .insert({
      gmail_thread_id: data.gmail_thread_id,
      subject: data.subject ?? null,
      participants: data.participants ?? [],
      first_message_at: data.first_message_at ?? null,
      last_message_at: data.last_message_at ?? null,
      last_sender_email: data.last_sender_email ?? null,
      my_last_message_at: data.my_last_message_at ?? null,
      message_count: data.message_count ?? 0,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create thread: ${error.message}`);
  }

  return { thread: created as Thread, isNew: true };
}

/**
 * Update waiting-on status for a thread
 * Called after sync determines I sent last and haven't received a reply
 */
export async function updateWaitingOnStatus(
  threadId: string,
  waitingOnEmail: string | null,
  waitingSince: string | null
): Promise<Thread> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('threads')
    .update({
      waiting_on_email: waitingOnEmail,
      waiting_since: waitingSince,
    })
    .eq('id', threadId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update waiting-on status: ${error.message}`);
  }

  return data as Thread;
}

/**
 * Get all threads I'm waiting on
 * Uses the waiting_on_threads view for performance
 */
export async function getWaitingOnThreads(): Promise<WaitingOnThread[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('waiting_on_threads')
    .select('*')
    .order('waiting_since', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch waiting-on threads: ${error.message}`);
  }

  return data as WaitingOnThread[];
}

/**
 * Get a single thread with all its emails
 * Used for generating follow-up context
 */
export async function getThreadWithEmails(threadId: string): Promise<ThreadWithEmails | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: thread, error: threadError } = await (supabase as any)
    .from('threads')
    .select('*')
    .eq('id', threadId)
    .single();

  if (threadError || !thread) {
    return null;
  }

  // Get all emails in this thread
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: emails, error: emailsError } = await (supabase as any)
    .from('emails')
    .select(`
      id,
      subject,
      body,
      received_at,
      sender:people!sender_id(email, name)
    `)
    .eq('internal_thread_id', threadId)
    .order('received_at', { ascending: true });

  if (emailsError) {
    throw new Error(`Failed to fetch thread emails: ${emailsError.message}`);
  }

  return {
    ...thread,
    emails: emails || [],
  } as ThreadWithEmails;
}

/**
 * Snooze a thread (temporarily hide from waiting-on list)
 */
export async function snoozeThread(
  threadId: string,
  snoozeUntil: string
): Promise<Thread> {
  // Get current state for audit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current } = await (supabase as any)
    .from('threads')
    .select('*')
    .eq('id', threadId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('threads')
    .update({
      status: 'snoozed',
      snooze_until: snoozeUntil,
    })
    .eq('id', threadId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to snooze thread: ${error.message}`);
  }

  // Log audit event
  await logAuditEvent({
    entity_type: 'thread',
    entity_id: threadId,
    action: 'snoozed',
    actor: 'user',
    previous_state: current,
    new_state: data,
    metadata: { snooze_until: snoozeUntil },
  });

  return data as Thread;
}

/**
 * Resolve a thread (mark as no longer waiting)
 */
export async function resolveThread(
  threadId: string,
  reason: string = 'manual'
): Promise<Thread> {
  // Get current state for audit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current } = await (supabase as any)
    .from('threads')
    .select('*')
    .eq('id', threadId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('threads')
    .update({
      status: 'resolved',
      resolved_reason: reason,
      waiting_on_email: null,
      waiting_since: null,
    })
    .eq('id', threadId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to resolve thread: ${error.message}`);
  }

  // Log audit event
  await logAuditEvent({
    entity_type: 'thread',
    entity_id: threadId,
    action: 'resolved',
    actor: 'user',
    previous_state: current,
    new_state: data,
    metadata: { reason },
  });

  return data as Thread;
}

/**
 * Reactivate a snoozed thread
 * Called automatically when snooze expires or manually
 */
export async function reactivateThread(threadId: string): Promise<Thread> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('threads')
    .update({
      status: 'active',
      snooze_until: null,
    })
    .eq('id', threadId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to reactivate thread: ${error.message}`);
  }

  return data as Thread;
}

/**
 * Get threads with expired snooze that need reactivation
 */
export async function getSnoozedThreadsToReactivate(): Promise<Thread[]> {
  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('threads')
    .select('*')
    .eq('status', 'snoozed')
    .lte('snooze_until', now);

  if (error) {
    throw new Error(`Failed to fetch snoozed threads: ${error.message}`);
  }

  return data as Thread[];
}

// ============================================
// FOLLOW-UP SUGGESTION QUERIES
// ============================================

/**
 * Create a follow-up suggestion for a thread
 */
export async function createFollowUpSuggestion(
  data: FollowUpSuggestionInsert
): Promise<FollowUpSuggestion> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: suggestion, error } = await (supabase as any)
    .from('follow_up_suggestions')
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create follow-up suggestion: ${error.message}`);
  }

  // Log audit event
  await logAuditEvent({
    entity_type: 'follow_up',
    entity_id: suggestion.id,
    action: 'created',
    actor: 'ai',
    new_state: suggestion,
    metadata: { thread_id: data.thread_id },
  });

  return suggestion as FollowUpSuggestion;
}

/**
 * Get all pending follow-up suggestions with thread context
 */
export async function getPendingFollowUps(): Promise<FollowUpWithThread[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('follow_up_suggestions')
    .select(`
      *,
      thread:threads!inner(
        id,
        subject,
        waiting_on_email,
        waiting_since
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch pending follow-ups: ${error.message}`);
  }

  return data as FollowUpWithThread[];
}

/**
 * Approve a follow-up suggestion
 * Optionally accepts user edits to the draft
 */
export async function approveFollowUp(
  followUpId: string,
  edits?: {
    subject?: string;
    body?: string;
  }
): Promise<FollowUpSuggestion> {
  // Get current state for audit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current } = await (supabase as any)
    .from('follow_up_suggestions')
    .select('*')
    .eq('id', followUpId)
    .single();

  const updateData: Record<string, unknown> = {
    status: 'approved',
  };

  if (edits?.subject) {
    updateData.user_edited_subject = edits.subject;
    updateData.was_edited = true;
  }

  if (edits?.body) {
    updateData.user_edited_body = edits.body;
    updateData.was_edited = true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('follow_up_suggestions')
    .update(updateData)
    .eq('id', followUpId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to approve follow-up: ${error.message}`);
  }

  // Log audit event
  await logAuditEvent({
    entity_type: 'follow_up',
    entity_id: followUpId,
    action: 'approved',
    actor: 'user',
    previous_state: current,
    new_state: data,
    metadata: edits ? { edited: true } : { edited: false },
  });

  return data as FollowUpSuggestion;
}

/**
 * Reject a follow-up suggestion
 */
export async function rejectFollowUp(
  followUpId: string,
  reason?: string
): Promise<FollowUpSuggestion> {
  // Get current state for audit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current } = await (supabase as any)
    .from('follow_up_suggestions')
    .select('*')
    .eq('id', followUpId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('follow_up_suggestions')
    .update({
      status: 'rejected',
      rejection_reason: reason || null,
    })
    .eq('id', followUpId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to reject follow-up: ${error.message}`);
  }

  // Log audit event
  await logAuditEvent({
    entity_type: 'follow_up',
    entity_id: followUpId,
    action: 'rejected',
    actor: 'user',
    previous_state: current,
    new_state: data,
    metadata: reason ? { reason } : undefined,
  });

  return data as FollowUpSuggestion;
}

/**
 * Mark a follow-up as sent
 * Called after Gmail API successfully sends the email
 */
export async function markFollowUpSent(
  followUpId: string,
  gmailMessageId: string
): Promise<FollowUpSuggestion> {
  // Get current state for audit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current } = await (supabase as any)
    .from('follow_up_suggestions')
    .select('*')
    .eq('id', followUpId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('follow_up_suggestions')
    .update({
      status: 'sent',
      sent_gmail_message_id: gmailMessageId,
    })
    .eq('id', followUpId)
    .eq('status', 'approved')
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to mark follow-up as sent: ${error.message}`);
  }

  // Log audit event
  await logAuditEvent({
    entity_type: 'follow_up',
    entity_id: followUpId,
    action: 'sent',
    actor: 'system',
    previous_state: current,
    new_state: data,
    metadata: { gmail_message_id: gmailMessageId },
  });

  return data as FollowUpSuggestion;
}

/**
 * Get follow-up suggestion by ID
 */
export async function getFollowUpById(followUpId: string): Promise<FollowUpSuggestion | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('follow_up_suggestions')
    .select('*')
    .eq('id', followUpId)
    .single();

  if (error) {
    return null;
  }

  return data as FollowUpSuggestion;
}

// ============================================
// THREAD SYNC UTILITIES
// ============================================

/**
 * Determine if I'm waiting on someone in this thread
 * Logic: I sent the last message AND it's been > WAITING_THRESHOLD_DAYS
 */
export function isWaitingOn(thread: {
  last_sender_email: string | null;
  my_last_message_at: string | null;
  last_message_at: string | null;
}): { waiting: boolean; waitingOnEmail: string | null; waitingSince: string | null } {
  // If I didn't send the last message, I'm not waiting
  if (!thread.last_sender_email || !thread.my_last_message_at) {
    return { waiting: false, waitingOnEmail: null, waitingSince: null };
  }

  // Check if my last message is the thread's last message
  const myLastAt = new Date(thread.my_last_message_at);
  const threadLastAt = thread.last_message_at ? new Date(thread.last_message_at) : null;

  if (!threadLastAt || myLastAt < threadLastAt) {
    // Someone replied after me, not waiting
    return { waiting: false, waitingOnEmail: null, waitingSince: null };
  }

  // I sent the last message - check if enough time has passed
  const daysSinceMyMessage = (Date.now() - myLastAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceMyMessage < WAITING_THRESHOLD_DAYS) {
    // Not enough time has passed
    return { waiting: false, waitingOnEmail: null, waitingSince: null };
  }

  // I'm waiting! But for whom?
  // This would need the thread participants to determine
  // For now, we'll return null for waitingOnEmail and let the sync logic fill it in
  return {
    waiting: true,
    waitingOnEmail: null, // Filled in by sync logic based on recipients
    waitingSince: thread.my_last_message_at,
  };
}

/**
 * Link an email to its thread (set internal_thread_id)
 */
export async function linkEmailToThread(emailId: string, threadId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('emails')
    .update({ internal_thread_id: threadId })
    .eq('id', emailId);

  if (error) {
    throw new Error(`Failed to link email to thread: ${error.message}`);
  }
}

/**
 * Get unique Gmail thread IDs from all emails in the database
 * Used to fetch complete thread data (including sent emails)
 */
export async function getUniqueThreadIds(): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('emails')
    .select('thread_id')
    .not('thread_id', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch thread IDs: ${error.message}`);
  }

  const uniqueIds = new Set<string>();
  for (const email of data || []) {
    if (email.thread_id) {
      uniqueIds.add(email.thread_id);
    }
  }

  return Array.from(uniqueIds);
}

/**
 * Get all emails grouped by thread_id (Gmail's thread ID)
 * Used for initial thread sync
 */
export async function getEmailsGroupedByThread(): Promise<
  Map<string, Array<{ id: string; thread_id: string; subject: string; body: string; received_at: string; sender_email: string; to_emails: string[] | null; cc_emails: string[] | null }>>
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('emails')
    .select(`
      id,
      thread_id,
      subject,
      body,
      received_at,
      to_emails,
      cc_emails,
      sender:people!sender_id(email)
    `)
    .not('thread_id', 'is', null)
    .order('received_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch emails for thread grouping: ${error.message}`);
  }

  const grouped = new Map<string, Array<{ id: string; thread_id: string; subject: string; body: string; received_at: string; sender_email: string; to_emails: string[] | null; cc_emails: string[] | null }>>();

  for (const email of data || []) {
    const threadId = email.thread_id as string;
    if (!grouped.has(threadId)) {
      grouped.set(threadId, []);
    }
    grouped.get(threadId)!.push({
      id: email.id,
      thread_id: threadId,
      subject: email.subject,
      body: email.body,
      received_at: email.received_at,
      sender_email: email.sender?.email || '',
      to_emails: email.to_emails,
      cc_emails: email.cc_emails,
    });
  }

  return grouped;
}

export { MY_EMAIL, WAITING_THRESHOLD_DAYS };
