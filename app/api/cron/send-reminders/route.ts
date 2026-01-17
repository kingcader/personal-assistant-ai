/**
 * Send Reminders Cron Job
 *
 * Checks for due reminders and sends push notifications.
 * Should be run every 5 minutes via cron-job.org.
 *
 * Part of Loop #4.5: Calendar Enhancements
 *
 * Schedule (cron-job.org):
 * - Every 5 minutes: *\/5 * * * *
 * - URL: /api/cron/send-reminders
 * - Header: Authorization: Bearer {CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDueReminders, markReminderSent } from '@/lib/supabase/calendar-queries';
import { notify } from '@/lib/notifications/push';

export const dynamic = 'force-dynamic';

/**
 * Verify cron secret
 */
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('⏰ CRON_SECRET not configured');
    return false;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.replace('Bearer ', '');
  return token === cronSecret;
}

/**
 * Format reminder time for display
 */
function formatReminderTime(startTime: Date): string {
  const now = new Date();
  const diffMs = startTime.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));

  if (diffMins <= 0) {
    return 'now';
  } else if (diffMins < 60) {
    return `in ${diffMins} minute${diffMins === 1 ? '' : 's'}`;
  } else {
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (mins === 0) {
      return `in ${hours} hour${hours === 1 ? '' : 's'}`;
    }
    return `in ${hours}h ${mins}m`;
  }
}

/**
 * GET /api/cron/send-reminders
 *
 * Check for due reminders and send push notifications
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    if (!verifyCronSecret(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('⏰ Checking for due reminders...');

    // Get all due reminders
    const dueReminders = await getDueReminders();

    if (dueReminders.length === 0) {
      console.log('⏰ No due reminders found');
      return NextResponse.json({
        success: true,
        reminders_sent: 0,
        message: 'No due reminders',
      });
    }

    console.log(`⏰ Found ${dueReminders.length} due reminder(s)`);

    let sentCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each reminder
    for (const reminder of dueReminders) {
      try {
        const entityTitle = reminder.entity_title || 'Untitled';
        const entityStartTime = reminder.entity_start_time
          ? new Date(reminder.entity_start_time)
          : null;

        // Build notification
        const title = reminder.entity_type === 'task'
          ? '📋 Task Reminder'
          : '📅 Event Reminder';

        let body = entityTitle;
        if (entityStartTime) {
          body += ` - ${formatReminderTime(entityStartTime)}`;
        }

        const link = reminder.entity_type === 'task'
          ? '/tasks'
          : '/calendar';

        // Send push notification
        await notify({
          type: 'reminder',
          title,
          body,
          link,
          tag: `reminder-${reminder.id}`,
          related_entity_type: reminder.entity_type,
          related_entity_id: reminder.task_id || reminder.event_id || undefined,
        });

        // Mark reminder as sent
        await markReminderSent(reminder.id);
        sentCount++;

        console.log(`⏰ Sent reminder for ${reminder.entity_type}: ${entityTitle}`);
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Reminder ${reminder.id}: ${errorMessage}`);
        console.error(`⏰ Failed to send reminder ${reminder.id}:`, error);
      }
    }

    console.log(`⏰ Reminders processed: ${sentCount} sent, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      reminders_found: dueReminders.length,
      reminders_sent: sentCount,
      reminders_failed: errorCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('⏰ Error processing reminders:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
