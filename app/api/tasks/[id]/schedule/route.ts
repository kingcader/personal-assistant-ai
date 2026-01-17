/**
 * Task Scheduling API
 *
 * Get or generate scheduling suggestions for a specific task
 *
 * Part of Loop #4: AI-Powered Productivity Calendar
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSchedulingSuggestionsForTask } from '@/lib/supabase/calendar-queries';
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
