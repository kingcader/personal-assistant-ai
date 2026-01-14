/**
 * Task API Route
 *
 * PATCH /api/tasks/:id - Update task status
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateTaskStatus } from '@/lib/supabase/task-queries';

const VALID_STATUSES = ['todo', 'in_progress', 'completed', 'cancelled'] as const;
type TaskStatus = (typeof VALID_STATUSES)[number];

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
    const { status } = body;

    // Validate status
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const task = await updateTaskStatus(id, status as TaskStatus);

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update task' },
      { status: 500 }
    );
  }
}
