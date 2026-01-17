/**
 * Reminders API
 *
 * POST - Create a reminder for a task or event
 * GET - List reminders for an entity
 *
 * Part of Loop #4.5: Calendar Enhancements
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createReminder,
  getRemindersForEntity,
  deleteReminder,
  getCalendarEventById,
} from '@/lib/supabase/calendar-queries';
import { supabase } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reminders?entity_type=task|event&entity_id=uuid
 *
 * Get reminders for a specific entity
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entity_type and entity_id are required' },
        { status: 400 }
      );
    }

    if (entityType !== 'task' && entityType !== 'event') {
      return NextResponse.json(
        { error: 'entity_type must be "task" or "event"' },
        { status: 400 }
      );
    }

    const reminders = await getRemindersForEntity(entityType, entityId);

    return NextResponse.json({ reminders });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch reminders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reminders
 *
 * Create a reminder
 *
 * Body: {
 *   entity_type: 'task' | 'event' (required)
 *   entity_id: string (required)
 *   minutes_before: number (required) - e.g., 5, 15, 30, 60, 1440 (1 day)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { entity_type, entity_id, minutes_before } = body;

    // Validate required fields
    if (!entity_type || !entity_id || minutes_before === undefined) {
      return NextResponse.json(
        { error: 'entity_type, entity_id, and minutes_before are required' },
        { status: 400 }
      );
    }

    if (entity_type !== 'task' && entity_type !== 'event') {
      return NextResponse.json(
        { error: 'entity_type must be "task" or "event"' },
        { status: 400 }
      );
    }

    if (typeof minutes_before !== 'number' || minutes_before < 0) {
      return NextResponse.json(
        { error: 'minutes_before must be a non-negative number' },
        { status: 400 }
      );
    }

    // Get entity start time
    let entityStartTime: Date;

    if (entity_type === 'task') {
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('scheduled_start, is_scheduled')
        .eq('id', entity_id)
        .single<{ scheduled_start: string | null; is_scheduled: boolean }>();

      if (taskError || !task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      if (!task.is_scheduled || !task.scheduled_start) {
        return NextResponse.json(
          { error: 'Task must be scheduled to set a reminder' },
          { status: 400 }
        );
      }

      entityStartTime = new Date(task.scheduled_start);
    } else {
      const event = await getCalendarEventById(entity_id);

      if (!event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      entityStartTime = new Date(event.start_time);
    }

    // Create the reminder
    const reminder = await createReminder(
      entity_type,
      entity_id,
      minutes_before,
      entityStartTime
    );

    return NextResponse.json({
      success: true,
      reminder,
    });
  } catch (error) {
    console.error('Error creating reminder:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create reminder' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reminders?id=uuid
 *
 * Delete a reminder
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reminderId = searchParams.get('id');

    if (!reminderId) {
      return NextResponse.json(
        { error: 'Reminder ID is required' },
        { status: 400 }
      );
    }

    await deleteReminder(reminderId);

    return NextResponse.json({
      success: true,
      message: 'Reminder deleted',
    });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete reminder' },
      { status: 500 }
    );
  }
}
