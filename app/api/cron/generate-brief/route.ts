/**
 * Daily Brief Generation Cron Job
 *
 * Generates morning or evening briefs and sends push notifications.
 * Part of Loop #3: Daily Brief + Push Notifications
 *
 * Usage:
 * - GET /api/cron/generate-brief?type=morning
 * - GET /api/cron/generate-brief?type=evening
 *
 * Schedule (cron-job.org):
 * - Morning: 0 13 * * * (13:00 UTC = 7:00 AM Costa Rica)
 * - Evening: 0 2 * * *  (02:00 UTC = 8:00 PM Costa Rica)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { saveDailyBrief } from '@/lib/supabase/notification-queries';
import {
  generateMorningBrief,
  generateEveningBrief,
  formatBriefForNotification,
  type MorningBriefData,
  type EveningBriefData,
} from '@/lib/notifications/brief-generator';
import { notify } from '@/lib/notifications/push';

export const dynamic = 'force-dynamic';

// Costa Rica timezone (UTC-6)
const TIMEZONE = 'America/Costa_Rica';

/**
 * Get today's date in Costa Rica timezone
 */
function getTodayInCostaRica(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

/**
 * Fetch morning brief data from database
 */
async function fetchMorningBriefData(): Promise<MorningBriefData> {
  const today = getTodayInCostaRica();

  // Tasks due today (with explicit due date = today)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tasksDueToday } = await (supabase as any)
    .from('tasks')
    .select('id, title, priority, due_date')
    .eq('due_date', today)
    .in('status', ['todo', 'in_progress'])
    .order('priority', { ascending: false });

  // Tasks with no due date (need attention but no specific deadline)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tasksNoDate } = await (supabase as any)
    .from('tasks')
    .select('id, title, priority')
    .is('due_date', null)
    .in('status', ['todo', 'in_progress'])
    .order('priority', { ascending: false });

  // Overdue tasks (due_date < today and not completed)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tasksOverdue } = await (supabase as any)
    .from('tasks')
    .select('id, title, priority, due_date')
    .lt('due_date', today)
    .in('status', ['todo', 'in_progress'])
    .order('due_date', { ascending: true });

  // Pending task suggestions count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: pendingTaskSuggestions } = await (supabase as any)
    .from('suggestions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  // Pending follow-up suggestions count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: pendingFollowUps } = await (supabase as any)
    .from('follow_up_suggestions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  // Waiting-on threads
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: waitingOnThreads } = await (supabase as any)
    .from('threads')
    .select('id, subject, waiting_on_email, waiting_since')
    .not('waiting_on_email', 'is', null)
    .eq('status', 'active')
    .order('waiting_since', { ascending: true });

  // Calculate days overdue for each overdue task
  const todayDate = new Date(today);

  return {
    tasks_due_today: (tasksDueToday || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      due_date: t.due_date,
    })),
    tasks_no_date: (tasksNoDate || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
    })),
    tasks_overdue: (tasksOverdue || []).map((t: any) => {
      const dueDate = new Date(t.due_date);
      const daysOverdue = Math.floor((todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: t.id,
        title: t.title,
        priority: t.priority,
        due_date: t.due_date,
        days_overdue: daysOverdue,
      };
    }),
    pending_task_suggestions: pendingTaskSuggestions || 0,
    pending_follow_ups: pendingFollowUps || 0,
    waiting_on_threads: (waitingOnThreads || []).map((t: any) => ({
      id: t.id,
      subject: t.subject || 'No subject',
      waiting_on_email: t.waiting_on_email!,
      days_waiting: t.waiting_since
        ? Math.floor(
            (Date.now() - new Date(t.waiting_since).getTime()) / (1000 * 60 * 60 * 24)
          )
        : 0,
    })),
  };
}

/**
 * Fetch evening brief data from database
 */
async function fetchEveningBriefData(): Promise<EveningBriefData> {
  const today = getTodayInCostaRica();
  const startOfDay = `${today}T00:00:00`;
  const endOfDay = `${today}T23:59:59`;

  // Calculate tomorrow's date
  const todayDate = new Date(today);
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toISOString().split('T')[0];

  // Tasks completed today
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tasksCompletedToday } = await (supabase as any)
    .from('tasks')
    .select('id, title, completed_at')
    .eq('status', 'completed')
    .gte('completed_at', startOfDay)
    .lte('completed_at', endOfDay);

  // Overdue tasks (due_date < today and not completed)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tasksOverdue } = await (supabase as any)
    .from('tasks')
    .select('id, title, priority, due_date')
    .lt('due_date', today)
    .in('status', ['todo', 'in_progress'])
    .order('due_date', { ascending: true });

  // Tasks due tomorrow
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tasksDueTomorrow } = await (supabase as any)
    .from('tasks')
    .select('id, title, priority')
    .eq('due_date', tomorrow)
    .in('status', ['todo', 'in_progress'])
    .order('priority', { ascending: false });

  // Tasks with no due date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tasksNoDate } = await (supabase as any)
    .from('tasks')
    .select('id, title, priority')
    .is('due_date', null)
    .in('status', ['todo', 'in_progress'])
    .order('priority', { ascending: false });

  // Future tasks (due after tomorrow)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tasksFuture } = await (supabase as any)
    .from('tasks')
    .select('id, title, priority, due_date')
    .gt('due_date', tomorrow)
    .in('status', ['todo', 'in_progress'])
    .order('due_date', { ascending: true })
    .limit(10);

  // Follow-ups sent today
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: followUpsSentToday } = await (supabase as any)
    .from('follow_up_suggestions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', startOfDay)
    .lte('sent_at', endOfDay);

  // Suggestions approved today (via audit log)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: suggestionsApprovedToday } = await (supabase as any)
    .from('audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('entity_type', 'suggestion')
    .eq('action', 'approved')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  // Suggestions rejected today (via audit log)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: suggestionsRejectedToday } = await (supabase as any)
    .from('audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('entity_type', 'suggestion')
    .eq('action', 'rejected')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  return {
    tasks_completed_today: (tasksCompletedToday || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      completed_at: t.completed_at!,
    })),
    tasks_overdue: (tasksOverdue || []).map((t: any) => {
      const dueDate = new Date(t.due_date);
      const daysOverdue = Math.floor((todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: t.id,
        title: t.title,
        priority: t.priority,
        due_date: t.due_date,
        days_overdue: daysOverdue,
      };
    }),
    tasks_due_tomorrow: (tasksDueTomorrow || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
    })),
    tasks_no_date: (tasksNoDate || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
    })),
    tasks_future: (tasksFuture || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      due_date: t.due_date,
    })),
    follow_ups_sent_today: followUpsSentToday || 0,
    suggestions_approved_today: suggestionsApprovedToday || 0,
    suggestions_rejected_today: suggestionsRejectedToday || 0,
  };
}

/**
 * Main brief generation handler
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get brief type from query params
    const searchParams = request.nextUrl.searchParams;
    const briefType = searchParams.get('type') as 'morning' | 'evening' | null;

    if (!briefType || !['morning', 'evening'].includes(briefType)) {
      return NextResponse.json(
        { error: 'Invalid brief type. Use ?type=morning or ?type=evening' },
        { status: 400 }
      );
    }

    console.log(`📋 Generating ${briefType} brief...`);

    const today = getTodayInCostaRica();

    // 3. Fetch data and generate brief
    let briefContent;
    if (briefType === 'morning') {
      const data = await fetchMorningBriefData();
      briefContent = await generateMorningBrief(data);
    } else {
      const data = await fetchEveningBriefData();
      briefContent = await generateEveningBrief(data);
    }

    // 4. Save brief to database
    const savedBrief = await saveDailyBrief({
      date: today,
      type: briefType,
      content: briefContent as unknown as Record<string, unknown>,
      ai_model_used: 'gpt-4o-mini',
    });

    console.log(`📋 Brief saved: ${savedBrief.id}`);

    // 5. Send push notification
    const { title, body } = formatBriefForNotification(briefContent, briefType);
    const notifyResult = await notify({
      type: briefType === 'morning' ? 'morning_brief' : 'evening_brief',
      title,
      body,
      link: '/',
      tag: `brief-${briefType}-${today}`,
      related_entity_type: 'brief',
      related_entity_id: savedBrief.id,
    });

    console.log(
      `📋 Brief notification sent: ${notifyResult.push_sent} device(s)`
    );

    return NextResponse.json({
      success: true,
      brief_id: savedBrief.id,
      type: briefType,
      date: today,
      notification_id: notifyResult.notification_id,
      push_sent: notifyResult.push_sent,
      push_failed: notifyResult.push_failed,
    });
  } catch (error) {
    console.error('❌ Error generating brief:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
