/**
 * Calendar Event API (Single Event)
 *
 * PATCH - Update event time/details
 * DELETE - Delete event
 *
 * Part of Loop #4.5: Calendar Enhancements
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  updateCalendarEvent,
  deleteCalendarEvent,
  CalendarEventInput,
} from '@/lib/google/calendar';
import {
  getCalendarEventById,
  upsertCalendarEvent,
} from '@/lib/supabase/calendar-queries';
import { supabase } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/calendar/events/[id]
 *
 * Update a calendar event
 *
 * Body: {
 *   summary?: string
 *   description?: string | null
 *   start_time?: ISO string
 *   end_time?: ISO string
 *   all_day?: boolean
 *   location?: string | null
 *   attendees?: string[]
 * }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: eventId } = await context.params;
    const body = await request.json();

    // Get the event from database to get the Google event ID
    const dbEvent = await getCalendarEventById(eventId);

    if (!dbEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { summary, description, start_time, end_time, all_day, location, attendees } = body;

    // Build update payload
    const updateInput: Partial<CalendarEventInput> = {};

    if (summary !== undefined) {
      if (typeof summary !== 'string' || summary.trim().length === 0) {
        return NextResponse.json(
          { error: 'Summary must be a non-empty string' },
          { status: 400 }
        );
      }
      updateInput.summary = summary.trim();
    }

    if (description !== undefined) {
      updateInput.description = description;
    }

    if (start_time !== undefined) {
      const startTime = new Date(start_time);
      if (isNaN(startTime.getTime())) {
        return NextResponse.json(
          { error: 'Invalid start_time format' },
          { status: 400 }
        );
      }
      updateInput.startTime = startTime;
    }

    if (end_time !== undefined) {
      const endTime = new Date(end_time);
      if (isNaN(endTime.getTime())) {
        return NextResponse.json(
          { error: 'Invalid end_time format' },
          { status: 400 }
        );
      }
      updateInput.endTime = endTime;
    }

    // Validate time range if both are provided
    if (updateInput.startTime && updateInput.endTime) {
      if (updateInput.endTime <= updateInput.startTime) {
        return NextResponse.json(
          { error: 'End time must be after start time' },
          { status: 400 }
        );
      }
    }

    if (all_day !== undefined) {
      updateInput.allDay = all_day;
    }

    if (location !== undefined) {
      updateInput.location = location;
    }

    if (attendees !== undefined) {
      updateInput.attendees = attendees;
    }

    // Update in Google Calendar
    const googleEvent = await updateCalendarEvent(
      dbEvent.google_event_id,
      updateInput
    );

    // Sync updated event to local database
    const { event: updatedDbEvent } = await upsertCalendarEvent(googleEvent);

    return NextResponse.json({
      success: true,
      event: updatedDbEvent,
    });
  } catch (error) {
    console.error('Error updating calendar event:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update event' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/calendar/events/[id]
 *
 * Delete a calendar event
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: eventId } = await context.params;

    // Get the event from database
    const dbEvent = await getCalendarEventById(eventId);

    if (!dbEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Delete from Google Calendar
    await deleteCalendarEvent(dbEvent.google_event_id);

    // Delete from local database
    const { error: deleteError } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', eventId);

    if (deleteError) {
      console.error('Error deleting event from database:', deleteError);
      // Event is already deleted from Google, so we consider this successful
    }

    return NextResponse.json({
      success: true,
      message: 'Event deleted',
    });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete event' },
      { status: 500 }
    );
  }
}
