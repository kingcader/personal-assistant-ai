/**
 * Task Scheduling API
 *
 * GET - Get existing scheduling suggestions for a task
 * POST - Generate new scheduling suggestions
 * PUT - Schedule task to a specific time block
 * DELETE - Unschedule task (remove from calendar, keep task)
 *
 * Part of Loop #4: AI-Powered Productivity Calendar
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSchedulingSuggestionsForTask,
  scheduleTask,
  unscheduleTask,
  rescheduleTask,
} from '@/lib/supabase/calendar-queries';
import {
  generateSchedulingSuggestions,
  saveSchedulingSuggestions,
  TaskForScheduling,
} from '@/lib/ai/scheduling-suggestions';
import { supabase } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

interface TaskRow {
  id: string;
  title: string;
  priority: string | null;
  due_date: string | null;
  status: string;
  description: string | null;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tasks/[id]/schedule
 *
 * Get existing scheduling suggestions for a task
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: taskId } = await context.params;

    const suggestions = await getSchedulingSuggestionsForTask(taskId);

    return NextResponse.json({
      suggestions,
    });
  } catch (error) {
    console.error('Error getting scheduling suggestions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tasks/[id]/schedule
 *
 * Generate new scheduling suggestions for a task
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: taskId } = await context.params;

    // Fetch the task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, title, priority, due_date, status, description')
      .eq('id', taskId)
      .single<TaskRow>();

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.status === 'completed' || task.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot schedule completed or cancelled tasks' },
        { status: 400 }
      );
    }

    // Generate suggestions
    const validPriority = (task.priority === 'low' || task.priority === 'med' || task.priority === 'high')
      ? task.priority
      : 'med'; // Default to medium priority
    const validStatus = (task.status === 'todo' || task.status === 'in_progress')
      ? task.status
      : 'todo';

    const taskForScheduling: TaskForScheduling = {
      id: task.id,
      title: task.title,
      priority: validPriority,
      due_date: task.due_date,
      status: validStatus,
      description: task.description,
    };

    const suggestions = await generateSchedulingSuggestions([taskForScheduling]);

    if (suggestions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No available time slots found',
        suggestions: [],
      });
    }

    // Save suggestions to database
    await saveSchedulingSuggestions(suggestions);

    // Fetch the saved suggestions
    const savedSuggestions = await getSchedulingSuggestionsForTask(taskId);

    return NextResponse.json({
      success: true,
      suggestions: savedSuggestions,
    });
  } catch (error) {
    console.error('Error generating scheduling suggestions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tasks/[id]/schedule
 *
 * Schedule or reschedule a task to a specific time block
 *
 * Body: { scheduled_start: ISO string, scheduled_end: ISO string }
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id: taskId } = await context.params;
    const body = await request.json();

    const { scheduled_start, scheduled_end } = body;

    if (!scheduled_start || !scheduled_end) {
      return NextResponse.json(
        { error: 'scheduled_start and scheduled_end are required' },
        { status: 400 }
      );
    }

    const startTime = new Date(scheduled_start);
    const endTime = new Date(scheduled_end);

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

    // Check if task exists
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, status')
      .eq('id', taskId)
      .single<{ id: string; status: string }>();

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.status === 'completed' || task.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot schedule completed or cancelled tasks' },
        { status: 400 }
      );
    }

    const scheduledTask = await scheduleTask(taskId, startTime, endTime);

    return NextResponse.json({
      success: true,
      task: scheduledTask,
    });
  } catch (error) {
    console.error('Error scheduling task:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to schedule task' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tasks/[id]/schedule
 *
 * Unschedule a task (remove from calendar, keep task)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: taskId } = await context.params;

    // Check if task exists
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, is_scheduled')
      .eq('id', taskId)
      .single<{ id: string; is_scheduled: boolean }>();

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (!task.is_scheduled) {
      return NextResponse.json(
        { error: 'Task is not scheduled' },
        { status: 400 }
      );
    }

    await unscheduleTask(taskId);

    return NextResponse.json({
      success: true,
      message: 'Task unscheduled',
    });
  } catch (error) {
    console.error('Error unscheduling task:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to unschedule task' },
      { status: 500 }
    );
  }
}
