/**
 * Calendar Database Queries
 *
 * Supabase queries for calendar events, meeting prep packets,
 * and scheduling suggestions.
 *
 * Part of Loop #4: AI-Powered Productivity Calendar
 */

import { supabase } from './client';
import type { CalendarEvent as GoogleCalendarEvent } from '@/lib/google/calendar';

// ============================================
// TYPES
// ============================================

export interface DBCalendarEvent {
  id: string;
  google_event_id: string;
  calendar_id: string;
  summary: string | null;
  description: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean;
  attendees: EventAttendee[];
  organizer: EventAttendee | null;
  location: string | null;
  meeting_link: string | null;
  status: 'confirmed' | 'tentative' | 'cancelled';
  recurring_event_id: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface EventAttendee {
  email: string;
  name: string | null;
  responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  organizer?: boolean;
  self?: boolean;
}

export interface MeetingPrepPacket {
  id: string;
  event_id: string;
  content: PrepPacketContent;
  ai_model_used: string | null;
  generated_at: string;
  regenerated_count: number;
  last_regenerated_at: string | null;
}

export interface PrepPacketContent {
  meeting: {
    summary: string | null;
    time: string;
    attendees: string[];
    location: string | null;
  };
  related_tasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
  }[];
  related_emails: {
    id: string;
    subject: string;
    from: string;
    snippet: string;
    date: string;
    thread_id: string;
  }[];
  waiting_on: {
    thread_id: string;
    subject: string;
    days_waiting: number;
    waiting_on_email: string;
  }[];
  talking_points: string[];
  ai_summary: string;
  attendee_context?: {
    [email: string]: {
      recent_interactions: string[];
      open_items: string[];
    };
  };
}

export interface SchedulingSuggestion {
  id: string;
  task_id: string;
  suggested_start: string;
  suggested_end: string;
  reason: string;
  estimated_duration_minutes: number | null;
  confidence_score: number | null;
  status: 'pending' | 'accepted' | 'dismissed';
  accepted_at: string | null;
  dismissed_at: string | null;
  ai_model_used: string | null;
  created_at: string;
  // Joined fields
  task_title?: string;
  task_priority?: string;
  task_due_date?: string | null;
}

export interface CalendarSyncState {
  id: string;
  calendar_id: string;
  last_sync_at: string | null;
  last_sync_success: boolean;
  last_sync_error: string | null;
  sync_token: string | null;
  events_synced_count: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// CALENDAR EVENTS
// ============================================

/**
 * Upsert calendar event (insert or update by google_event_id)
 */
export async function upsertCalendarEvent(
  event: GoogleCalendarEvent
): Promise<{ event: DBCalendarEvent; isNew: boolean }> {
  // First, try to find existing event
  const { data: existing } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('google_event_id', event.googleEventId)
    .single();

  const eventData = {
    google_event_id: event.googleEventId,
    calendar_id: event.calendarId,
    summary: event.summary,
    description: event.description,
    start_time: event.startTime.toISOString(),
    end_time: event.endTime.toISOString(),
    all_day: event.allDay,
    attendees: event.attendees,
    organizer: event.organizer,
    location: event.location,
    meeting_link: event.meetingLink,
    status: event.status,
    recurring_event_id: event.recurringEventId,
    synced_at: new Date().toISOString(),
  };

  if (existing) {
    // Update existing event
    const { data, error } = await supabase
      .from('calendar_events')
      .update(eventData as never)
      .eq('google_event_id', event.googleEventId)
      .select()
      .single();

    if (error) throw error;
    return { event: data as DBCalendarEvent, isNew: false };
  } else {
    // Insert new event
    const { data, error } = await supabase
      .from('calendar_events')
      .insert(eventData as never)
      .select()
      .single();

    if (error) throw error;
    return { event: data as DBCalendarEvent, isNew: true };
  }
}

/**
 * Get calendar events within a date range
 * Uses overlap logic: events that start before range ends AND end after range starts
 */
export async function getCalendarEvents(
  startDate: Date,
  endDate: Date,
  status: 'confirmed' | 'tentative' | 'cancelled' | 'all' = 'all'
): Promise<DBCalendarEvent[]> {
  let query = supabase
    .from('calendar_events')
    .select('*')
    // Events that OVERLAP with the range (not just start within it)
    .lte('start_time', endDate.toISOString())   // Starts before range ends
    .gte('end_time', startDate.toISOString())   // Ends after range starts
    .order('start_time', { ascending: true });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as DBCalendarEvent[];
}

/**
 * Get a single calendar event by ID
 */
export async function getCalendarEventById(
  eventId: string
): Promise<DBCalendarEvent | null> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as DBCalendarEvent | null;
}

/**
 * Get events for today
 */
export async function getTodaysEvents(): Promise<DBCalendarEvent[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return getCalendarEvents(today, tomorrow);
}

/**
 * Get upcoming events with prep packet status
 */
export async function getUpcomingEventsWithPrep(
  days: number = 7
): Promise<(DBCalendarEvent & { prep_packet_id: string | null; has_prep_packet: boolean })[]> {
  const now = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const { data, error } = await supabase
    .from('calendar_events')
    .select(`
      *,
      meeting_prep_packets (
        id
      )
    `)
    .gte('start_time', now.toISOString())
    .lte('start_time', endDate.toISOString())
    .eq('status', 'confirmed')
    .order('start_time', { ascending: true });

  if (error) throw error;

  return (data || []).map((event: any) => ({
    ...event,
    prep_packet_id: event.meeting_prep_packets?.[0]?.id || null,
    has_prep_packet: !!event.meeting_prep_packets?.length,
    meeting_prep_packets: undefined,
  }));
}

/**
 * Delete old events (cleanup)
 */
export async function deleteOldEvents(olderThanDays: number = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const { data, error } = await supabase
    .from('calendar_events')
    .delete()
    .lt('end_time', cutoffDate.toISOString())
    .select('id');

  if (error) throw error;
  return data?.length || 0;
}

// ============================================
// MEETING PREP PACKETS
// ============================================

/**
 * Create or update meeting prep packet for an event
 */
export async function upsertPrepPacket(
  eventId: string,
  content: PrepPacketContent,
  aiModelUsed: string
): Promise<MeetingPrepPacket> {
  // Check if packet already exists
  const { data: existing } = await supabase
    .from('meeting_prep_packets')
    .select('*')
    .eq('event_id', eventId)
    .single();

  if (existing) {
    // Update existing packet
    const { data, error } = await supabase
      .from('meeting_prep_packets')
      .update({
        content,
        ai_model_used: aiModelUsed,
        regenerated_count: ((existing as any).regenerated_count || 0) + 1,
        last_regenerated_at: new Date().toISOString(),
      } as never)
      .eq('event_id', eventId)
      .select()
      .single();

    if (error) throw error;
    return data as MeetingPrepPacket;
  } else {
    // Insert new packet
    const { data, error } = await supabase
      .from('meeting_prep_packets')
      .insert({
        event_id: eventId,
        content,
        ai_model_used: aiModelUsed,
      } as never)
      .select()
      .single();

    if (error) throw error;
    return data as MeetingPrepPacket;
  }
}

/**
 * Get prep packet for an event
 */
export async function getPrepPacket(
  eventId: string
): Promise<MeetingPrepPacket | null> {
  const { data, error } = await supabase
    .from('meeting_prep_packets')
    .select('*')
    .eq('event_id', eventId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as MeetingPrepPacket | null;
}

/**
 * Get events that need prep packets (upcoming meetings with attendees)
 */
export async function getEventsNeedingPrep(
  hoursAhead: number = 24
): Promise<DBCalendarEvent[]> {
  const now = new Date();
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() + hoursAhead);

  // Get events with attendees that don't have prep packets yet
  const { data: events, error } = await supabase
    .from('calendar_events')
    .select(`
      *,
      meeting_prep_packets (id)
    `)
    .gt('start_time', now.toISOString())
    .lt('start_time', cutoff.toISOString())
    .eq('status', 'confirmed')
    .order('start_time', { ascending: true });

  if (error) throw error;

  // Filter to events without prep packets and with attendees
  return (events || [])
    .filter((e: any) => {
      const hasAttendees = e.attendees && e.attendees.length > 0;
      const hasNoPrep = !e.meeting_prep_packets?.length;
      return hasAttendees && hasNoPrep;
    })
    .map((e: any) => {
      const { meeting_prep_packets, ...event } = e;
      return event as DBCalendarEvent;
    });
}

// ============================================
// SCHEDULING SUGGESTIONS
// ============================================

/**
 * Create scheduling suggestion for a task
 */
export async function createSchedulingSuggestion(
  taskId: string,
  suggestedStart: Date,
  suggestedEnd: Date,
  reason: string,
  options?: {
    estimatedDurationMinutes?: number;
    confidenceScore?: number;
    aiModelUsed?: string;
  }
): Promise<SchedulingSuggestion> {
  const { data, error } = await supabase
    .from('scheduling_suggestions')
    .insert({
      task_id: taskId,
      suggested_start: suggestedStart.toISOString(),
      suggested_end: suggestedEnd.toISOString(),
      reason,
      estimated_duration_minutes: options?.estimatedDurationMinutes,
      confidence_score: options?.confidenceScore,
      ai_model_used: options?.aiModelUsed,
    } as never)
    .select()
    .single();

  if (error) throw error;
  return data as SchedulingSuggestion;
}

/**
 * Get pending scheduling suggestions
 */
export async function getPendingSchedulingSuggestions(): Promise<SchedulingSuggestion[]> {
  const now = new Date();

  const { data, error } = await supabase
    .from('scheduling_suggestions')
    .select(`
      *,
      tasks (
        title,
        priority,
        due_date,
        status
      )
    `)
    .eq('status', 'pending')
    .gt('suggested_start', now.toISOString())
    .order('suggested_start', { ascending: true });

  if (error) throw error;

  return (data || [])
    .filter((s: any) => s.tasks && s.tasks.status !== 'completed' && s.tasks.status !== 'cancelled')
    .map((s: any) => ({
      ...s,
      task_title: s.tasks?.title,
      task_priority: s.tasks?.priority,
      task_due_date: s.tasks?.due_date,
      tasks: undefined,
    }));
}

/**
 * Get suggestions for a specific task
 */
export async function getSchedulingSuggestionsForTask(
  taskId: string
): Promise<SchedulingSuggestion[]> {
  const { data, error } = await supabase
    .from('scheduling_suggestions')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as SchedulingSuggestion[];
}

/**
 * Accept a scheduling suggestion
 */
export async function acceptSchedulingSuggestion(
  suggestionId: string
): Promise<SchedulingSuggestion> {
  const { data, error } = await supabase
    .from('scheduling_suggestions')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    } as never)
    .eq('id', suggestionId)
    .select()
    .single();

  if (error) throw error;
  return data as SchedulingSuggestion;
}

/**
 * Dismiss a scheduling suggestion
 */
export async function dismissSchedulingSuggestion(
  suggestionId: string
): Promise<SchedulingSuggestion> {
  const { data, error } = await supabase
    .from('scheduling_suggestions')
    .update({
      status: 'dismissed',
      dismissed_at: new Date().toISOString(),
    } as never)
    .eq('id', suggestionId)
    .select()
    .single();

  if (error) throw error;
  return data as SchedulingSuggestion;
}

// ============================================
// SYNC STATE
// ============================================

/**
 * Get or create sync state for a calendar
 */
export async function getSyncState(
  calendarId: string = 'primary'
): Promise<CalendarSyncState> {
  const { data: existing } = await supabase
    .from('calendar_sync_state')
    .select('*')
    .eq('calendar_id', calendarId)
    .single();

  if (existing) {
    return existing as CalendarSyncState;
  }

  // Create new sync state
  const { data, error } = await supabase
    .from('calendar_sync_state')
    .insert({ calendar_id: calendarId } as never)
    .select()
    .single();

  if (error) throw error;
  return data as CalendarSyncState;
}

/**
 * Update sync state after successful sync
 */
export async function updateSyncStateSuccess(
  calendarId: string,
  eventsCount: number,
  syncToken?: string
): Promise<void> {
  const { error } = await supabase
    .from('calendar_sync_state')
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_success: true,
      last_sync_error: null,
      events_synced_count: eventsCount,
      sync_token: syncToken,
    } as never)
    .eq('calendar_id', calendarId);

  if (error) throw error;
}

/**
 * Update sync state after failed sync
 */
export async function updateSyncStateError(
  calendarId: string,
  errorMessage: string
): Promise<void> {
  const { error } = await supabase
    .from('calendar_sync_state')
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_success: false,
      last_sync_error: errorMessage,
    } as never)
    .eq('calendar_id', calendarId);

  if (error) throw error;
}

// ============================================
// TASK SCHEDULING
// ============================================

export interface ScheduledTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'low' | 'med' | 'high';
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_start: string;
  scheduled_end: string;
  is_scheduled: boolean;
  email_subject: string | null;
}

export interface UnscheduledTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'low' | 'med' | 'high';
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  email_subject: string | null;
  created_at: string;
}

/**
 * Get scheduled tasks (tasks with time blocks)
 */
export async function getScheduledTasks(
  startDate?: Date,
  endDate?: Date
): Promise<ScheduledTask[]> {
  let query = supabase
    .from('tasks')
    .select(`
      id,
      title,
      description,
      due_date,
      priority,
      status,
      scheduled_start,
      scheduled_end,
      is_scheduled,
      emails (subject)
    `)
    .eq('is_scheduled', true)
    .not('status', 'in', '("completed","cancelled")')
    .order('scheduled_start', { ascending: true });

  if (startDate) {
    query = query.gte('scheduled_start', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('scheduled_start', endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((t: any) => ({
    ...t,
    email_subject: t.emails?.subject || null,
    emails: undefined,
  }));
}

/**
 * Get unscheduled tasks (tasks without time blocks)
 */
export async function getUnscheduledTasks(): Promise<UnscheduledTask[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      id,
      title,
      description,
      due_date,
      priority,
      status,
      created_at,
      emails (subject)
    `)
    .or('is_scheduled.is.null,is_scheduled.eq.false')
    .not('status', 'in', '("completed","cancelled")')
    .order('priority', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((t: any) => ({
    ...t,
    email_subject: t.emails?.subject || null,
    emails: undefined,
  }));
}

/**
 * Schedule a task to a time block
 */
export async function scheduleTask(
  taskId: string,
  scheduledStart: Date,
  scheduledEnd: Date
): Promise<ScheduledTask> {
  const { data, error } = await supabase
    .from('tasks')
    .update({
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: scheduledEnd.toISOString(),
      is_scheduled: true,
    } as never)
    .eq('id', taskId)
    .select(`
      id,
      title,
      description,
      due_date,
      priority,
      status,
      scheduled_start,
      scheduled_end,
      is_scheduled,
      emails (subject)
    `)
    .single();

  if (error) throw error;
  if (!data) throw new Error('Task not found');

  const taskData = data as any;
  return {
    id: taskData.id,
    title: taskData.title,
    description: taskData.description,
    due_date: taskData.due_date,
    priority: taskData.priority,
    status: taskData.status,
    scheduled_start: taskData.scheduled_start,
    scheduled_end: taskData.scheduled_end,
    is_scheduled: taskData.is_scheduled,
    email_subject: taskData.emails?.subject || null,
  } as ScheduledTask;
}

/**
 * Unschedule a task (remove from calendar but keep task)
 */
export async function unscheduleTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({
      scheduled_start: null,
      scheduled_end: null,
      is_scheduled: false,
    } as never)
    .eq('id', taskId);

  if (error) throw error;
}

/**
 * Reschedule a task to a new time block
 */
export async function rescheduleTask(
  taskId: string,
  newStart: Date,
  newEnd: Date
): Promise<ScheduledTask> {
  return scheduleTask(taskId, newStart, newEnd);
}

// ============================================
// REMINDERS
// ============================================

export interface Reminder {
  id: string;
  entity_type: 'task' | 'event';
  task_id: string | null;
  event_id: string | null;
  minutes_before: number;
  remind_at: string;
  status: 'pending' | 'sent' | 'dismissed';
  sent_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

export interface ReminderWithEntity extends Reminder {
  entity_title: string | null;
  entity_start_time: string | null;
}

/**
 * Create a reminder for a task or event
 */
export async function createReminder(
  entityType: 'task' | 'event',
  entityId: string,
  minutesBefore: number,
  entityStartTime: Date
): Promise<Reminder> {
  // Calculate remind_at time
  const remindAt = new Date(entityStartTime.getTime() - minutesBefore * 60 * 1000);

  const reminderData: any = {
    entity_type: entityType,
    minutes_before: minutesBefore,
    remind_at: remindAt.toISOString(),
  };

  if (entityType === 'task') {
    reminderData.task_id = entityId;
  } else {
    reminderData.event_id = entityId;
  }

  const { data, error } = await supabase
    .from('reminders')
    .insert(reminderData as never)
    .select()
    .single();

  if (error) throw error;
  return data as Reminder;
}

/**
 * Get reminders for a specific entity
 */
export async function getRemindersForEntity(
  entityType: 'task' | 'event',
  entityId: string
): Promise<Reminder[]> {
  const column = entityType === 'task' ? 'task_id' : 'event_id';

  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq(column, entityId)
    .order('remind_at', { ascending: true });

  if (error) throw error;
  return data as Reminder[];
}

/**
 * Get due reminders (pending and ready to send)
 */
export async function getDueReminders(): Promise<ReminderWithEntity[]> {
  const now = new Date();

  const { data, error } = await supabase
    .from('reminders')
    .select(`
      *,
      tasks (title, scheduled_start),
      calendar_events (summary, start_time)
    `)
    .eq('status', 'pending')
    .lte('remind_at', now.toISOString())
    .order('remind_at', { ascending: true });

  if (error) throw error;

  return (data || []).map((r: any) => ({
    ...r,
    entity_title: r.entity_type === 'task'
      ? r.tasks?.title
      : r.calendar_events?.summary,
    entity_start_time: r.entity_type === 'task'
      ? r.tasks?.scheduled_start
      : r.calendar_events?.start_time,
    tasks: undefined,
    calendar_events: undefined,
  }));
}

/**
 * Mark reminder as sent
 */
export async function markReminderSent(reminderId: string): Promise<void> {
  const { error } = await supabase
    .from('reminders')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    } as never)
    .eq('id', reminderId);

  if (error) throw error;
}

/**
 * Dismiss a reminder
 */
export async function dismissReminder(reminderId: string): Promise<void> {
  const { error } = await supabase
    .from('reminders')
    .update({
      status: 'dismissed',
      dismissed_at: new Date().toISOString(),
    } as never)
    .eq('id', reminderId);

  if (error) throw error;
}

/**
 * Delete a reminder
 */
export async function deleteReminder(reminderId: string): Promise<void> {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', reminderId);

  if (error) throw error;
}
