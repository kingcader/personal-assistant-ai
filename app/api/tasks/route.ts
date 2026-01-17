/**
 * Tasks API
 *
 * POST - Create a new task manually
 * GET - List tasks (optional)
 *
 * Part of Loop #4.5: Calendar Enhancements
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

const VALID_PRIORITIES = ['low', 'med', 'high'] as const;
type TaskPriority = (typeof VALID_PRIORITIES)[number];

/**
 * POST /api/tasks
 *
 * Create a new task manually (not from email extraction)
 *
 * Body: {
 *   title: string (required)
 *   description?: string
 *   priority?: 'low' | 'med' | 'high' (default: 'med')
 *   due_date?: string (YYYY-MM-DD)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { title, description, priority, due_date } = body;

    // Validate title
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Validate priority if provided
    const taskPriority: TaskPriority = priority && VALID_PRIORITIES.includes(priority)
      ? priority
      : 'med';

    // For manual tasks, we need to get the owner (assuming single-user, use the first person or create one)
    // First, try to get the main user
    const { data: owner, error: ownerError } = await supabase
      .from('people')
      .select('id')
      .eq('email', 'kincaidgarrett@gmail.com')
      .single<{ id: string }>();

    if (ownerError || !owner) {
      return NextResponse.json(
        { error: 'Could not find task owner. Please ensure the system is properly configured.' },
        { status: 500 }
      );
    }

    // For manual tasks, we need a placeholder email record
    // First, check if we have a "manual tasks" placeholder email
    const { data: existingEmail } = await supabase
      .from('emails')
      .select('id')
      .eq('subject', '[Manual Task]')
      .single<{ id: string }>();

    let placeholderEmailId: string;

    if (!existingEmail) {
      // Create placeholder email for manual tasks
      const { data: newEmail, error: emailError } = await supabase
        .from('emails')
        .insert({
          gmail_message_id: 'manual-task-placeholder-' + Date.now(),
          thread_id: 'manual-tasks',
          sender_id: owner.id,
          subject: '[Manual Task]',
          body: 'Placeholder email for manually created tasks',
          received_at: new Date().toISOString(),
          processed: true,
        } as never)
        .select('id')
        .single<{ id: string }>();

      if (emailError || !newEmail) {
        return NextResponse.json(
          { error: 'Failed to create task placeholder' },
          { status: 500 }
        );
      }

      placeholderEmailId = newEmail.id;
    } else {
      placeholderEmailId = existingEmail.id;
    }

    // Create the task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        email_id: placeholderEmailId,
        owner_id: owner.id,
        title: title.trim(),
        description: description?.trim() || null,
        priority: taskPriority,
        due_date: due_date || null,
        status: 'todo',
      } as never)
      .select()
      .single();

    if (taskError) {
      console.error('Error creating task:', taskError);
      return NextResponse.json(
        { error: 'Failed to create task' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      task,
    });
  } catch (error) {
    console.error('Error in POST /api/tasks:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tasks
 *
 * List tasks with optional filters
 *
 * Query params:
 *   status - Filter by status (todo, in_progress, completed, cancelled)
 *   scheduled - Filter by scheduled (true/false)
 *   limit - Number of tasks to return (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const scheduled = searchParams.get('scheduled');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

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
        created_at,
        emails (subject)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    if (scheduled === 'true') {
      query = query.eq('is_scheduled', true);
    } else if (scheduled === 'false') {
      query = query.or('is_scheduled.is.null,is_scheduled.eq.false');
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const tasks = (data || []).map((t: any) => ({
      ...t,
      email_subject: t.emails?.subject || null,
      emails: undefined,
    }));

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Error in GET /api/tasks:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
