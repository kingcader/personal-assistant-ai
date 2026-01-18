/**
 * Calendar Data API
 *
 * Returns unified calendar data: events + tasks + scheduling suggestions
 *
 * Part of Loop #4: AI-Powered Productivity Calendar
 *
 * Usage: GET /api/calendar?start=2024-01-01&end=2024-01-31
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCalendarEvents,
  getUpcomingEventsWithPrep,
  getPendingSchedulingSuggestions,
  DBCalendarEvent,
} from '@/lib/supabase/calendar-queries';
import { supabase } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export interface CalendarDataResponse {
  tasks: CalendarTask[];
  events: CalendarEventWithPrep[];
  scheduling_suggestions: SchedulingSuggestionWithTask[];
}

export interface CalendarTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'low' | 'med' | 'high';
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  email_subject: string | null;
  created_at: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  is_scheduled: boolean;
}

export interface CalendarEventWithPrep extends DBCalendarEvent {
  prep_packet_id: string | null;
  has_prep_packet: boolean;
}

export interface SchedulingSuggestionWithTask {
  id: string;
  task_id: string;
  task_title: string;
  task_priority: string;
  task_due_date: string | null;
  suggested_start: string;
  suggested_end: string;
  reason: string;
  status: 'pending' | 'accepted' | 'dismissed';
}

/**
 * GET /api/calendar
 *
 * Query params:
 * - start: ISO date string for range start (default: today)
 * - end: ISO date string for range end (default: 14 days from start)
 * - include_completed: boolean to include completed tasks (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse date range
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const includeCompleted = searchParams.get('include_completed') === 'true';

    const startDate = startParam ? new Date(startParam) : new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = endParam ? new Date(endParam) : new Date(startDate);
    if (!endParam) {
      endDate.setDate(endDate.getDate() + 14);
    }
    endDate.setHours(23, 59, 59, 999);

    // Fetch all data in parallel
    const [eventsResult, tasksResult, suggestionsResult] = await Promise.all([
      // Calendar events with prep status
      getUpcomingEventsWithPrep(Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))),

      // Tasks in date range
      fetchTasksInRange(startDate, endDate, includeCompleted),

      // Pending scheduling suggestions
      getPendingSchedulingSuggestions(),
    ]);

    // Filter events to date range
    const events = eventsResult.filter((event) => {
      const eventStart = new Date(event.start_time);
      return eventStart >= startDate && eventStart <= endDate;
    });

    // Filter suggestions to date range
    const suggestions = suggestionsResult.filter((suggestion) => {
      const suggestedStart = new Date(suggestion.suggested_start);
      return suggestedStart >= startDate && suggestedStart <= endDate;
    });

    const response: CalendarDataResponse = {
      tasks: tasksResult,
      events: events as CalendarEventWithPrep[],
      scheduling_suggestions: suggestions.map((s) => ({
        id: s.id,
        task_id: s.task_id,
        task_title: s.task_title || 'Unknown task',
        task_priority: s.task_priority || 'med',
        task_due_date: s.task_due_date || null,
        suggested_start: s.suggested_start,
        suggested_end: s.suggested_end,
        reason: s.reason,
        status: s.status,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Fetch tasks within a date range
 */
async function fetchTasksInRange(
  startDate: Date,
  endDate: Date,
  includeCompleted: boolean
): Promise<CalendarTask[]> {
  let query = supabase
    .from('tasks')
    .select(`
      id,
      title,
      description,
      due_date,
      priority,
      status,
      created_at,
      scheduled_start,
      scheduled_end,
      is_scheduled,
      emails (subject)
    `)
    .order('due_date', { ascending: true, nullsFirst: false });

  // Filter by due date OR scheduled time in range (include tasks with no due date)
  // Include tasks where:
  // - due_date is in range, OR
  // - scheduled_start is in range, OR
  // - neither is set (show unscheduled tasks without due dates)
  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();
  query = query.or(
    `due_date.gte.${startISO},due_date.is.null,scheduled_start.gte.${startISO}`
  );
  query = query.or(
    `due_date.lte.${endISO},due_date.is.null,scheduled_start.lte.${endISO}`
  );

  // Filter out completed/cancelled unless requested
  if (!includeCompleted) {
    query = query.in('status', ['todo', 'in_progress']);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((task: any) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    due_date: task.due_date,
    priority: task.priority,
    status: task.status,
    email_subject: task.emails?.subject || null,
    created_at: task.created_at,
    scheduled_start: task.scheduled_start || null,
    scheduled_end: task.scheduled_end || null,
    is_scheduled: task.is_scheduled || false,
  }));
}
