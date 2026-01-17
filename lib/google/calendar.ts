/**
 * Google Calendar API Client
 *
 * Fetches calendar events from Google Calendar.
 * Uses OAuth 2.0 credentials for authentication.
 *
 * Part of Loop #4: AI-Powered Productivity Calendar
 */

import { google, calendar_v3 } from 'googleapis';
import { getGoogleOAuth2Client } from './auth';

/**
 * Calendar event data structure
 */
export interface CalendarEvent {
  id: string;
  googleEventId: string;
  calendarId: string;
  summary: string | null;
  description: string | null;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  attendees: EventAttendee[];
  location: string | null;
  meetingLink: string | null;
  status: 'confirmed' | 'tentative' | 'cancelled';
  organizer: EventAttendee | null;
  recurringEventId: string | null;
}

export interface EventAttendee {
  email: string;
  name: string | null;
  responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  organizer?: boolean;
  self?: boolean;
}

/**
 * Get authenticated Calendar client
 */
export function getCalendarClient() {
  const oauth2Client = getGoogleOAuth2Client();
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Fetch calendar events within a date range
 *
 * @param startDate - Start of range (inclusive)
 * @param endDate - End of range (exclusive)
 * @param calendarId - Calendar ID (default: 'primary')
 * @param maxResults - Maximum number of events to return
 */
export async function fetchCalendarEvents(
  startDate: Date,
  endDate: Date,
  calendarId: string = 'primary',
  maxResults: number = 250
): Promise<CalendarEvent[]> {
  const calendar = getCalendarClient();

  const response = await calendar.events.list({
    calendarId,
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    maxResults,
    singleEvents: true, // Expand recurring events into instances
    orderBy: 'startTime',
  });

  const events = response.data.items || [];
  return events.map(parseGoogleEvent).filter((e): e is CalendarEvent => e !== null);
}

/**
 * Fetch a single calendar event by ID
 */
export async function fetchCalendarEvent(
  eventId: string,
  calendarId: string = 'primary'
): Promise<CalendarEvent | null> {
  const calendar = getCalendarClient();

  try {
    const response = await calendar.events.get({
      calendarId,
      eventId,
    });

    return parseGoogleEvent(response.data);
  } catch (error) {
    console.error(`Error fetching event ${eventId}:`, error);
    return null;
  }
}

/**
 * List all calendars accessible to the user
 */
export async function listCalendars(): Promise<{ id: string; summary: string; primary: boolean }[]> {
  const calendar = getCalendarClient();

  const response = await calendar.calendarList.list();
  const calendars = response.data.items || [];

  return calendars.map((cal) => ({
    id: cal.id || '',
    summary: cal.summary || '',
    primary: cal.primary || false,
  }));
}

/**
 * Parse Google Calendar event into our data structure
 */
function parseGoogleEvent(event: calendar_v3.Schema$Event): CalendarEvent | null {
  if (!event.id) return null;

  // Handle all-day events vs timed events
  const allDay = !!event.start?.date;
  const startTime = allDay
    ? new Date(event.start?.date || '')
    : new Date(event.start?.dateTime || '');
  const endTime = allDay
    ? new Date(event.end?.date || '')
    : new Date(event.end?.dateTime || '');

  // Extract meeting link from conference data or description
  let meetingLink: string | null = null;
  if (event.conferenceData?.entryPoints) {
    const videoEntry = event.conferenceData.entryPoints.find((e) => e.entryPointType === 'video');
    meetingLink = videoEntry?.uri || null;
  }
  if (!meetingLink && event.hangoutLink) {
    meetingLink = event.hangoutLink;
  }

  // Parse attendees
  const attendees: EventAttendee[] = (event.attendees || []).map((a) => ({
    email: a.email || '',
    name: a.displayName || null,
    responseStatus: (a.responseStatus as EventAttendee['responseStatus']) || 'needsAction',
    organizer: a.organizer || false,
    self: a.self || false,
  }));

  // Parse organizer
  const organizer: EventAttendee | null = event.organizer
    ? {
        email: event.organizer.email || '',
        name: event.organizer.displayName || null,
        responseStatus: 'accepted',
        organizer: true,
        self: event.organizer.self || false,
      }
    : null;

  return {
    id: event.id,
    googleEventId: event.id,
    calendarId: event.organizer?.email || 'primary',
    summary: event.summary || null,
    description: event.description || null,
    startTime,
    endTime,
    allDay,
    attendees,
    location: event.location || null,
    meetingLink,
    status: (event.status as CalendarEvent['status']) || 'confirmed',
    organizer,
    recurringEventId: event.recurringEventId || null,
  };
}

/**
 * Fetch events for the next N days
 */
export async function fetchUpcomingEvents(
  days: number = 30,
  calendarId: string = 'primary'
): Promise<CalendarEvent[]> {
  const now = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  return fetchCalendarEvents(now, endDate, calendarId);
}

/**
 * Fetch events for a specific day
 */
export async function fetchEventsForDay(
  date: Date,
  calendarId: string = 'primary'
): Promise<CalendarEvent[]> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return fetchCalendarEvents(startOfDay, endOfDay, calendarId);
}

/**
 * Get free/busy information for time slots
 * Useful for finding available slots for scheduling
 */
export async function getFreeBusy(
  startDate: Date,
  endDate: Date,
  calendarId: string = 'primary'
): Promise<{ start: Date; end: Date }[]> {
  const calendar = getCalendarClient();

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      items: [{ id: calendarId }],
    },
  });

  const busySlots = response.data.calendars?.[calendarId]?.busy || [];

  return busySlots.map((slot) => ({
    start: new Date(slot.start || ''),
    end: new Date(slot.end || ''),
  }));
}

/**
 * Find available time slots in a date range
 * Returns gaps between busy periods
 */
export async function findAvailableSlots(
  startDate: Date,
  endDate: Date,
  minDurationMinutes: number = 30,
  workingHoursStart: number = 8, // 8 AM
  workingHoursEnd: number = 18,  // 6 PM
  calendarId: string = 'primary'
): Promise<{ start: Date; end: Date; durationMinutes: number }[]> {
  const busySlots = await getFreeBusy(startDate, endDate, calendarId);

  // Sort busy slots by start time
  busySlots.sort((a, b) => a.start.getTime() - b.start.getTime());

  const availableSlots: { start: Date; end: Date; durationMinutes: number }[] = [];
  let currentTime = new Date(startDate);

  // Helper to check if time is within working hours
  const isWithinWorkingHours = (date: Date): boolean => {
    const hours = date.getHours();
    return hours >= workingHoursStart && hours < workingHoursEnd;
  };

  // Helper to get next working hours start
  const getNextWorkingHoursStart = (date: Date): Date => {
    const result = new Date(date);
    if (result.getHours() >= workingHoursEnd) {
      // Move to next day
      result.setDate(result.getDate() + 1);
    }
    result.setHours(workingHoursStart, 0, 0, 0);
    return result;
  };

  // Helper to get working hours end for a day
  const getWorkingHoursEnd = (date: Date): Date => {
    const result = new Date(date);
    result.setHours(workingHoursEnd, 0, 0, 0);
    return result;
  };

  for (const busySlot of busySlots) {
    // Skip if we're past end date
    if (currentTime >= endDate) break;

    // Adjust current time to working hours if needed
    if (!isWithinWorkingHours(currentTime)) {
      currentTime = getNextWorkingHoursStart(currentTime);
    }

    // Check for gap before this busy slot
    const gapEnd = new Date(Math.min(busySlot.start.getTime(), getWorkingHoursEnd(currentTime).getTime()));

    if (gapEnd > currentTime) {
      const durationMinutes = (gapEnd.getTime() - currentTime.getTime()) / (1000 * 60);

      if (durationMinutes >= minDurationMinutes) {
        availableSlots.push({
          start: new Date(currentTime),
          end: gapEnd,
          durationMinutes,
        });
      }
    }

    // Move current time past the busy slot
    currentTime = new Date(Math.max(currentTime.getTime(), busySlot.end.getTime()));
  }

  // Check for remaining time after last busy slot
  while (currentTime < endDate) {
    if (!isWithinWorkingHours(currentTime)) {
      currentTime = getNextWorkingHoursStart(currentTime);
      if (currentTime >= endDate) break;
    }

    const dayEnd = getWorkingHoursEnd(currentTime);
    const slotEnd = new Date(Math.min(dayEnd.getTime(), endDate.getTime()));

    if (slotEnd > currentTime) {
      const durationMinutes = (slotEnd.getTime() - currentTime.getTime()) / (1000 * 60);

      if (durationMinutes >= minDurationMinutes) {
        availableSlots.push({
          start: new Date(currentTime),
          end: slotEnd,
          durationMinutes,
        });
      }
    }

    currentTime = getNextWorkingHoursStart(currentTime);
  }

  return availableSlots;
}

// ============================================
// WRITE OPERATIONS (requires calendar.events scope)
// ============================================

/**
 * Input for creating/updating a calendar event
 */
export interface CalendarEventInput {
  summary: string;
  description?: string | null;
  startTime: Date;
  endTime: Date;
  allDay?: boolean;
  location?: string | null;
  attendees?: string[]; // Email addresses
}

/**
 * Create a new event in Google Calendar
 */
export async function createCalendarEvent(
  eventInput: CalendarEventInput,
  calendarId: string = 'primary'
): Promise<CalendarEvent> {
  const calendar = getCalendarClient();

  const eventBody: calendar_v3.Schema$Event = {
    summary: eventInput.summary,
    description: eventInput.description || undefined,
    location: eventInput.location || undefined,
  };

  // Set start/end time based on all-day flag
  if (eventInput.allDay) {
    const startDate = eventInput.startTime.toISOString().split('T')[0];
    const endDate = eventInput.endTime.toISOString().split('T')[0];
    eventBody.start = { date: startDate };
    eventBody.end = { date: endDate };
  } else {
    eventBody.start = { dateTime: eventInput.startTime.toISOString() };
    eventBody.end = { dateTime: eventInput.endTime.toISOString() };
  }

  // Add attendees if provided
  if (eventInput.attendees && eventInput.attendees.length > 0) {
    eventBody.attendees = eventInput.attendees.map((email) => ({ email }));
  }

  const response = await calendar.events.insert({
    calendarId,
    requestBody: eventBody,
    sendUpdates: 'all', // Send invites to attendees
  });

  const created = parseGoogleEvent(response.data);
  if (!created) {
    throw new Error('Failed to parse created event');
  }

  return created;
}

/**
 * Update an existing event in Google Calendar
 */
export async function updateCalendarEvent(
  eventId: string,
  eventInput: Partial<CalendarEventInput>,
  calendarId: string = 'primary'
): Promise<CalendarEvent> {
  const calendar = getCalendarClient();

  // First, get the existing event
  const existingResponse = await calendar.events.get({
    calendarId,
    eventId,
  });

  const existingEvent = existingResponse.data;

  // Build update payload
  const eventBody: calendar_v3.Schema$Event = {
    summary: eventInput.summary ?? existingEvent.summary,
    description: eventInput.description !== undefined ? (eventInput.description || undefined) : existingEvent.description,
    location: eventInput.location !== undefined ? (eventInput.location || undefined) : existingEvent.location,
  };

  // Update start/end times if provided
  if (eventInput.startTime !== undefined || eventInput.endTime !== undefined || eventInput.allDay !== undefined) {
    const allDay = eventInput.allDay ?? !!existingEvent.start?.date;
    const startTime = eventInput.startTime ?? new Date(existingEvent.start?.dateTime || existingEvent.start?.date || '');
    const endTime = eventInput.endTime ?? new Date(existingEvent.end?.dateTime || existingEvent.end?.date || '');

    if (allDay) {
      eventBody.start = { date: startTime.toISOString().split('T')[0] };
      eventBody.end = { date: endTime.toISOString().split('T')[0] };
    } else {
      eventBody.start = { dateTime: startTime.toISOString() };
      eventBody.end = { dateTime: endTime.toISOString() };
    }
  } else {
    // Keep existing times
    eventBody.start = existingEvent.start;
    eventBody.end = existingEvent.end;
  }

  // Update attendees if provided
  if (eventInput.attendees !== undefined) {
    eventBody.attendees = eventInput.attendees.map((email) => ({ email }));
  } else {
    eventBody.attendees = existingEvent.attendees;
  }

  const response = await calendar.events.update({
    calendarId,
    eventId,
    requestBody: eventBody,
    sendUpdates: 'all',
  });

  const updated = parseGoogleEvent(response.data);
  if (!updated) {
    throw new Error('Failed to parse updated event');
  }

  return updated;
}

/**
 * Delete an event from Google Calendar
 */
export async function deleteCalendarEvent(
  eventId: string,
  calendarId: string = 'primary'
): Promise<void> {
  const calendar = getCalendarClient();

  await calendar.events.delete({
    calendarId,
    eventId,
    sendUpdates: 'all', // Notify attendees of cancellation
  });
}

/**
 * Move/reschedule an event to a new time
 * Convenience method for updating just the time
 */
export async function rescheduleCalendarEvent(
  eventId: string,
  newStartTime: Date,
  newEndTime: Date,
  calendarId: string = 'primary'
): Promise<CalendarEvent> {
  return updateCalendarEvent(
    eventId,
    {
      startTime: newStartTime,
      endTime: newEndTime,
    },
    calendarId
  );
}
