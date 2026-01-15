/**
 * Debug endpoint to check tasks in database
 * GET /api/debug/tasks
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

// Costa Rica timezone (UTC-6)
function getTodayInCostaRica(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
}

export async function GET() {
  try {
    const today = getTodayInCostaRica();

    // Get all non-completed tasks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allTasks, error } = await (supabase as any)
      .from('tasks')
      .select('id, title, priority, due_date, status')
      .in('status', ['todo', 'in_progress'])
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Categorize tasks
    const overdue = allTasks?.filter((t: any) => t.due_date && t.due_date < today) ?? [];
    const dueToday = allTasks?.filter((t: any) => t.due_date === today) ?? [];
    const future = allTasks?.filter((t: any) => t.due_date && t.due_date > today) ?? [];
    const noDate = allTasks?.filter((t: any) => !t.due_date) ?? [];

    return NextResponse.json({
      today_costa_rica: today,
      total_active_tasks: allTasks?.length ?? 0,
      summary: {
        overdue: overdue.length,
        due_today: dueToday.length,
        future: future.length,
        no_date: noDate.length,
      },
      overdue_tasks: overdue.map((t: any) => ({
        title: t.title,
        due_date: t.due_date,
        status: t.status,
        priority: t.priority,
      })),
      due_today_tasks: dueToday.map((t: any) => ({
        title: t.title,
        due_date: t.due_date,
        status: t.status,
      })),
    });
  } catch (error) {
    console.error('Debug tasks error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
