/**
 * Calendar Sync Cron Job
 *
 * Syncs Google Calendar events to the database.
 * Runs every 15 minutes to keep events up to date.
 *
 * Part of Loop #4: AI-Powered Productivity Calendar
 *
 * Usage: GET /api/cron/sync-calendar
 *
 * Environment:
 * - Requires Google OAuth with calendar.readonly scope
 * - CRON_SECRET for authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchUpcomingEvents, CalendarEvent } from '@/lib/google/calendar';
import {
  upsertCalendarEvent,
  getSyncState,
  updateSyncStateSuccess,
  updateSyncStateError,
  getEventsNeedingPrep,
  deleteOldEvents,
} from '@/lib/supabase/calendar-queries';
import { notify } from '@/lib/notifications/push';
import { hasRecentNotificationByType } from '@/lib/supabase/notification-queries';

export const dynamic = 'force-dynamic';

// Sync events for the next 30 days
const SYNC_DAYS_AHEAD = 30;

// Clean up events older than 90 days
const CLEANUP_DAYS_OLD = 90;

/**
 * Main calendar sync handler
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🗓️ Starting calendar sync...');

    const calendarId = 'primary';
    const results = {
      events_synced: 0,
      events_new: 0,
      events_updated: 0,
      events_needing_prep: 0,
      events_cleaned_up: 0,
      errors: [] as string[],
    };

    // 2. Get sync state
    await getSyncState(calendarId);

    try {
      // 3. Fetch events from Google Calendar
      console.log(`📅 Fetching events for next ${SYNC_DAYS_AHEAD} days...`);
      const events = await fetchUpcomingEvents(SYNC_DAYS_AHEAD, calendarId);
      console.log(`📧 Found ${events.length} events`);

      // 4. Upsert each event to database
      for (const event of events) {
        try {
          const { isNew } = await upsertCalendarEvent(event);

          results.events_synced++;
          if (isNew) {
            results.events_new++;
            console.log(`✅ New event: ${event.summary || '(No title)'}`);
          } else {
            results.events_updated++;
          }
        } catch (error) {
          const errorMsg = `Failed to sync event "${event.summary}": ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          results.errors.push(errorMsg);
        }
      }

      // 5. Check for events needing prep packets
      try {
        const eventsNeedingPrep = await getEventsNeedingPrep(24);
        results.events_needing_prep = eventsNeedingPrep.length;

        if (eventsNeedingPrep.length > 0) {
          console.log(`📋 ${eventsNeedingPrep.length} events need prep packets`);

          // Send notification if there are meetings soon without prep
          const upcomingMeetings = eventsNeedingPrep.filter((e) => {
            const startTime = new Date(e.start_time);
            const hoursUntil = (startTime.getTime() - Date.now()) / (1000 * 60 * 60);
            return hoursUntil <= 4; // Meetings in next 4 hours
          });

          if (upcomingMeetings.length > 0) {
            // Only send notification once - check if we already sent one in the last 4 hours
            const alreadyNotified = await hasRecentNotificationByType({
              type: 'meeting_prep',
              withinHours: 4,
            });

            if (!alreadyNotified) {
              await notify({
                type: 'meeting_prep' as any,
                title: `${upcomingMeetings.length} Meeting${upcomingMeetings.length > 1 ? 's' : ''} Without Prep`,
                body: upcomingMeetings[0].summary || 'Upcoming meeting needs prep packet',
                link: '/calendar',
                tag: 'meeting-prep',
              });
            } else {
              console.log('📋 Skipping meeting prep notification - already sent within 4 hours');
            }
          }
        }
      } catch (error) {
        console.error('Error checking events needing prep:', error);
      }

      // 6. Clean up old events
      try {
        const cleanedUp = await deleteOldEvents(CLEANUP_DAYS_OLD);
        results.events_cleaned_up = cleanedUp;
        if (cleanedUp > 0) {
          console.log(`🧹 Cleaned up ${cleanedUp} old events`);
        }
      } catch (error) {
        console.error('Error cleaning up old events:', error);
      }

      // 7. Update sync state
      await updateSyncStateSuccess(calendarId, results.events_synced);

      console.log('✅ Calendar sync complete:', results);

      return NextResponse.json({
        success: true,
        ...results,
      });
    } catch (error) {
      // Handle sync errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Calendar sync failed:', errorMessage);

      await updateSyncStateError(calendarId, errorMessage);

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          ...results,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Fatal error in calendar sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for manual sync trigger
 */
export async function POST(request: NextRequest) {
  // Reuse GET logic for manual triggers
  return GET(request);
}
