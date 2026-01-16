/**
 * Task API Route
 *
 * PATCH /api/tasks/:id - Update task status or fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateTaskStatus, updateTask } from '@/lib/supabase/task-queries';

const VALID_STATUSES = ['todo', 'in_progress', 'completed', 'cancelled'] as const;
const VALID_PRIORITIES = ['low', 'med', 'high'] as const;
type TaskStatus = (typeof VALID_STATUSES)[number];
type TaskPriority = (typeof VALID_PRIORITIES)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { status, title, description, due_date, priority } = body;

    // If only status is provided, use the status-specific update
    if (status && !title && !description && due_date === undefined && !priority) {
      // Validate status
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }

      const task = await updateTaskStatus(id, status as TaskStatus);
      return NextResponse.json({ success: true, task });
    }

    // Otherwise, update task fields
    const updates: {
      title?: string;
      description?: string | null;
      due_date?: string | null;
      priority?: TaskPriority;
    } = {};

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return NextResponse.json({ error: 'Title must be a non-empty string' }, { status: 400 });
      }
      updates.title = title.trim();
    }

    if (description !== undefined) {
      updates.description = description === null || description.trim() === '' ? null : description.trim();
    }

    if (due_date !== undefined) {
      updates.due_date = due_date === null || due_date === '' ? null : due_date;
    }

    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return NextResponse.json(
          { error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` },
          { status: 400 }
        );
      }
      updates.priority = priority;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const task = await updateTask(id, updates);

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update task' },
      { status: 500 }
    );
  }
}
