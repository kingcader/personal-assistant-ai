/**
 * Calendar Events API
 *
 * POST - Create a new event (syncs to Google Calendar)
 *
 * Part of Loop #4.5: Calendar Enhancements
 */

import { NextRequest, NextResponse } from 'next/server';
import { createCalendarEvent, CalendarEventInput } from '@/lib/google/calendar';
import { upsertCalendarEvent } from '@/lib/supabase/calendar-queries';

export const dynamic = 'force-dynamic';

/**
 * POST /api/calendar/events
 *
 * Create a new calendar event
 *
 * Body: {
 *   summary: string (required)
 *   description?: string
 *   start_time: ISO string (required)
 *   end_time: ISO string (required)
 *   all_day?: boolean
 *   location?: string
 *   attendees?: string[] (email addresses)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { summary, description, start_time, end_time, all_day, location, attendees } = body;

    // Validate required fields
    if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
      return NextResponse.json(
        { error: 'Summary is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (!start_time || !end_time) {
      return NextResponse.json(
        { error: 'start_time and end_time are required' },
        { status: 400 }
      );
    }

    const startTime = new Date(start_time);
    const endTime = new Date(end_time);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    if (endTime <= startTime) {
      return NextResponse.json(
        { error: 'End time must be after start time' },
        { status: 400 }
      );
    }

    // Build event input
    const eventInput: CalendarEventInput = {
      summary: summary.trim(),
      description: description || null,
      startTime,
      endTime,
      allDay: all_day || false,
      location: location || null,
      attendees: attendees || [],
    };

    // Create in Google Calendar
    const googleEvent = await createCalendarEvent(eventInput);

    // Sync to local database
    const { event: dbEvent, isNew } = await upsertCalendarEvent(googleEvent);

    return NextResponse.json({
      success: true,
      event: dbEvent,
      google_event_id: googleEvent.googleEventId,
    });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create event' },
      { status: 500 }
    );
  }
}
