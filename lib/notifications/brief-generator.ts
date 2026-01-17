/**
 * Daily Brief Generator
 *
 * Generates morning and evening briefs using AI.
 * Format: Similar to Ocho Reports daily report style.
 * Part of Loop #3: Daily Brief + Push Notifications
 * Enhanced with Calendar Insights in Loop #4
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Calendar insights data structure (Loop #4)
 */
export interface CalendarInsights {
  events_today: Array<{
    id: string;
    summary: string | null;
    start_time: string;
    end_time: string;
    attendees_count: number;
    has_prep_packet: boolean;
  }>;
  meeting_count: number;
  total_meeting_hours: number;
  focus_time_available: string; // "2.5 hours between meetings"
  conflicts: string[]; // "Task 'Submit report' due during all-day offsite"
  busiest_time: string; // "Morning is packed, afternoon has gaps"
  ai_recommendation: string; // "Consider moving the 2pm task to tomorrow"
}

/**
 * Morning brief data structure
 */
export interface MorningBriefData {
  tasks_due_today: Array<{
    id: string;
    title: string;
    priority: string;
    due_date: string | null;
  }>;
  tasks_no_date: Array<{
    id: string;
    title: string;
    priority: string;
  }>;
  tasks_overdue: Array<{
    id: string;
    title: string;
    priority: string;
    due_date: string;
    days_overdue: number;
  }>;
  pending_task_suggestions: number;
  pending_follow_ups: number;
  waiting_on_threads: Array<{
    id: string;
    subject: string;
    waiting_on_email: string;
    days_waiting: number;
  }>;
  // Calendar insights (Loop #4)
  calendar_insights?: CalendarInsights;
}

/**
 * Evening brief data structure
 */
export interface EveningBriefData {
  tasks_completed_today: Array<{
    id: string;
    title: string;
    completed_at: string;
  }>;
  tasks_overdue: Array<{
    id: string;
    title: string;
    priority: string;
    due_date: string;
    days_overdue: number;
  }>;
  tasks_due_tomorrow: Array<{
    id: string;
    title: string;
    priority: string;
  }>;
  tasks_no_date: Array<{
    id: string;
    title: string;
    priority: string;
  }>;
  tasks_future: Array<{
    id: string;
    title: string;
    priority: string;
    due_date: string;
  }>;
  follow_ups_sent_today: number;
  suggestions_approved_today: number;
  suggestions_rejected_today: number;
}

/**
 * Generated brief content
 */
export interface BriefContent {
  summary: string; // AI-generated summary paragraph
  sections: Array<{
    title: string;
    items: string[];
  }>;
  raw_data: MorningBriefData | EveningBriefData;
}

/**
 * Generate morning brief content
 */
export async function generateMorningBrief(
  data: MorningBriefData
): Promise<BriefContent> {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Build sections
  const sections: BriefContent['sections'] = [];

  // Overdue tasks (most important - shown first)
  if (data.tasks_overdue.length > 0) {
    sections.push({
      title: `Past Due (${data.tasks_overdue.length})`,
      items: data.tasks_overdue.map(
        (t) => `⚠️ [${t.priority.toUpperCase()}] ${t.title} (${t.days_overdue} day${t.days_overdue > 1 ? 's' : ''} overdue)`
      ),
    });
  }

  // Tasks due today
  if (data.tasks_due_today.length > 0) {
    sections.push({
      title: 'Tasks Due Today',
      items: data.tasks_due_today.map(
        (t) => `[${t.priority.toUpperCase()}] ${t.title}`
      ),
    });
  }

  // Tasks with no due date (need to be done, just no specific deadline)
  if (data.tasks_no_date.length > 0) {
    sections.push({
      title: 'No Due Date (Need Attention)',
      items: data.tasks_no_date.map(
        (t) => `[${t.priority.toUpperCase()}] ${t.title}`
      ),
    });
  }

  // Waiting on
  if (data.waiting_on_threads.length > 0) {
    sections.push({
      title: 'Waiting On',
      items: data.waiting_on_threads.map(
        (t) => `${t.subject} - waiting on ${t.waiting_on_email} (${t.days_waiting} days)`
      ),
    });
  }

  // Calendar section (Loop #4)
  if (data.calendar_insights && data.calendar_insights.events_today.length > 0) {
    const calendarItems: string[] = [];
    data.calendar_insights.events_today.forEach((event) => {
      const time = new Date(event.start_time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      const prepIcon = event.has_prep_packet ? '✨' : '';
      const attendeeInfo = event.attendees_count > 0 ? ` (${event.attendees_count} attendees)` : '';
      calendarItems.push(`${time}: ${event.summary || '(No title)'}${attendeeInfo} ${prepIcon}`);
    });

    // Add summary info
    if (data.calendar_insights.focus_time_available) {
      calendarItems.push(`📊 ${data.calendar_insights.focus_time_available}`);
    }

    sections.push({
      title: `Today's Calendar (${data.calendar_insights.meeting_count} meetings)`,
      items: calendarItems,
    });

    // Add conflicts if any
    if (data.calendar_insights.conflicts.length > 0) {
      sections.push({
        title: 'Schedule Conflicts',
        items: data.calendar_insights.conflicts.map((c) => `⚠️ ${c}`),
      });
    }
  }

  // Pending approvals
  const pendingItems: string[] = [];
  if (data.pending_task_suggestions > 0) {
    pendingItems.push(`${data.pending_task_suggestions} task suggestion(s) to review`);
  }
  if (data.pending_follow_ups > 0) {
    pendingItems.push(`${data.pending_follow_ups} follow-up draft(s) to review`);
  }
  if (pendingItems.length > 0) {
    sections.push({
      title: 'Needs Your Attention',
      items: pendingItems,
    });
  }

  // Generate AI summary
  const totalTasksNeedingAttention = data.tasks_due_today.length + data.tasks_no_date.length + data.tasks_overdue.length;

  // Build calendar context for AI prompt
  let calendarContext = '';
  if (data.calendar_insights) {
    const ci = data.calendar_insights;
    calendarContext = `
Meetings today: ${ci.meeting_count} (${ci.total_meeting_hours.toFixed(1)} hours)
Focus time available: ${ci.focus_time_available}
${ci.conflicts.length > 0 ? `Schedule conflicts: ${ci.conflicts.join('; ')}` : ''}
${ci.busiest_time ? `Schedule note: ${ci.busiest_time}` : ''}`;
  }

  const prompt = `Generate a brief, friendly morning summary (2-3 sentences) for a daily report.

Date: ${today}
Tasks overdue: ${data.tasks_overdue.length}
Tasks due today: ${data.tasks_due_today.length}
Tasks with no due date: ${data.tasks_no_date.length}
Threads waiting on reply: ${data.waiting_on_threads.length}
Pending approvals: ${data.pending_task_suggestions + data.pending_follow_ups}${calendarContext}

Keep it concise and actionable. ${data.tasks_overdue.length > 0 ? 'Emphasize the overdue tasks that need immediate attention.' : 'Focus on what needs attention today.'} ${data.calendar_insights && data.calendar_insights.meeting_count > 3 ? 'Note the busy meeting schedule.' : ''}`;

  let summary = `Good morning! Today is ${today}.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant generating brief daily summaries. Be concise and friendly.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 150,
    });

    summary = response.choices[0]?.message?.content || summary;
  } catch (error) {
    console.error('Error generating morning brief summary:', error);
  }

  return {
    summary,
    sections,
    raw_data: data,
  };
}

/**
 * Generate evening brief content
 */
export async function generateEveningBrief(
  data: EveningBriefData
): Promise<BriefContent> {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Build sections
  const sections: BriefContent['sections'] = [];

  // Completed today
  if (data.tasks_completed_today.length > 0) {
    sections.push({
      title: 'Completed Today',
      items: data.tasks_completed_today.map((t) => `✅ ${t.title}`),
    });
  }

  // Overdue tasks (most important)
  if (data.tasks_overdue.length > 0) {
    sections.push({
      title: `Past Due (${data.tasks_overdue.length})`,
      items: data.tasks_overdue.map(
        (t) => `⚠️ [${t.priority.toUpperCase()}] ${t.title} (${t.days_overdue} day${t.days_overdue > 1 ? 's' : ''} overdue)`
      ),
    });
  }

  // Tasks due tomorrow
  if (data.tasks_due_tomorrow.length > 0) {
    sections.push({
      title: 'Due Tomorrow',
      items: data.tasks_due_tomorrow.map(
        (t) => `[${t.priority.toUpperCase()}] ${t.title}`
      ),
    });
  }

  // Tasks with no due date
  if (data.tasks_no_date.length > 0) {
    sections.push({
      title: 'No Due Date (Need Attention)',
      items: data.tasks_no_date.map(
        (t) => `[${t.priority.toUpperCase()}] ${t.title}`
      ),
    });
  }

  // Future tasks (brief preview)
  if (data.tasks_future.length > 0) {
    sections.push({
      title: 'Coming Up',
      items: data.tasks_future.slice(0, 5).map(
        (t) => `[${t.priority.toUpperCase()}] ${t.title} (due ${t.due_date})`
      ),
    });
  }

  // Activity summary
  const activityItems: string[] = [];
  if (data.suggestions_approved_today > 0) {
    activityItems.push(`${data.suggestions_approved_today} suggestion(s) approved`);
  }
  if (data.suggestions_rejected_today > 0) {
    activityItems.push(`${data.suggestions_rejected_today} suggestion(s) rejected`);
  }
  if (data.follow_ups_sent_today > 0) {
    activityItems.push(`${data.follow_ups_sent_today} follow-up(s) sent`);
  }
  if (activityItems.length > 0) {
    sections.push({
      title: "Today's Activity",
      items: activityItems,
    });
  }

  // Generate AI summary
  const totalPending = data.tasks_overdue.length + data.tasks_due_tomorrow.length + data.tasks_no_date.length + data.tasks_future.length;
  const prompt = `Generate a brief, friendly end-of-day summary (2-3 sentences) for a daily report.

Date: ${today}
Tasks completed today: ${data.tasks_completed_today.length}
Tasks overdue: ${data.tasks_overdue.length}
Tasks due tomorrow: ${data.tasks_due_tomorrow.length}
Tasks with no due date: ${data.tasks_no_date.length}
Future tasks: ${data.tasks_future.length}
Follow-ups sent: ${data.follow_ups_sent_today}

Keep it concise. ${data.tasks_completed_today.length > 0 ? 'Acknowledge the progress made today.' : ''} ${data.tasks_overdue.length > 0 ? 'Note the overdue tasks that need attention.' : ''}`;

  let summary = `End of day summary for ${today}.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant generating brief daily summaries. Be concise and supportive.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 150,
    });

    summary = response.choices[0]?.message?.content || summary;
  } catch (error) {
    console.error('Error generating evening brief summary:', error);
  }

  return {
    summary,
    sections,
    raw_data: data,
  };
}

/**
 * Format brief content as text for notifications
 */
export function formatBriefForNotification(
  brief: BriefContent,
  type: 'morning' | 'evening'
): { title: string; body: string } {
  const title = type === 'morning' ? 'Good Morning!' : 'End of Day Summary';

  // Create a short body from the summary
  const body = brief.summary.length > 150
    ? brief.summary.slice(0, 147) + '...'
    : brief.summary;

  return { title, body };
}

/**
 * Generate calendar insights from events and tasks (Loop #4)
 */
export function generateCalendarInsights(
  events: Array<{
    id: string;
    summary: string | null;
    start_time: string;
    end_time: string;
    all_day: boolean;
    attendees: any[];
    has_prep_packet?: boolean;
  }>,
  tasksDueToday: Array<{
    id: string;
    title: string;
    due_date: string | null;
  }>
): CalendarInsights {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // Filter to today's events (non all-day)
  const todaysEvents = events
    .filter((e) => {
      const start = new Date(e.start_time);
      return start >= todayStart && start <= todayEnd;
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  // Calculate meeting hours
  let totalMeetingMinutes = 0;
  todaysEvents.forEach((event) => {
    if (!event.all_day) {
      const start = new Date(event.start_time);
      const end = new Date(event.end_time);
      totalMeetingMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
    }
  });
  const totalMeetingHours = totalMeetingMinutes / 60;

  // Calculate focus time (gaps between meetings during work hours 8 AM - 6 PM)
  const workStart = new Date(now);
  workStart.setHours(8, 0, 0, 0);
  const workEnd = new Date(now);
  workEnd.setHours(18, 0, 0, 0);

  let focusMinutes = 0;
  let currentTime = Math.max(now.getTime(), workStart.getTime());

  const nonAllDayEvents = todaysEvents.filter((e) => !e.all_day);
  for (const event of nonAllDayEvents) {
    const eventStart = new Date(event.start_time).getTime();
    const eventEnd = new Date(event.end_time).getTime();

    if (eventStart > currentTime && eventStart < workEnd.getTime()) {
      focusMinutes += (eventStart - currentTime) / (1000 * 60);
    }
    currentTime = Math.max(currentTime, eventEnd);
  }

  // Add remaining time after last meeting
  if (currentTime < workEnd.getTime()) {
    focusMinutes += (workEnd.getTime() - currentTime) / (1000 * 60);
  }

  const focusHours = focusMinutes / 60;
  const focusTimeAvailable =
    focusHours >= 1
      ? `${focusHours.toFixed(1)} hours of focus time available`
      : focusMinutes > 0
      ? `${Math.round(focusMinutes)} minutes of focus time available`
      : 'No focus time available today';

  // Detect conflicts (tasks due during all-day events or busy periods)
  const conflicts: string[] = [];
  const allDayEvents = todaysEvents.filter((e) => e.all_day);
  if (allDayEvents.length > 0 && tasksDueToday.length > 0) {
    conflicts.push(
      `You have ${tasksDueToday.length} task(s) due today during "${allDayEvents[0].summary || 'all-day event'}"`
    );
  }

  // Determine busiest time
  let busiestTime = '';
  const morningEvents = nonAllDayEvents.filter((e) => new Date(e.start_time).getHours() < 12).length;
  const afternoonEvents = nonAllDayEvents.filter((e) => new Date(e.start_time).getHours() >= 12).length;

  if (morningEvents > afternoonEvents && morningEvents > 0) {
    busiestTime = 'Morning is packed with meetings';
  } else if (afternoonEvents > morningEvents && afternoonEvents > 0) {
    busiestTime = 'Afternoon is heavy with meetings';
  } else if (morningEvents > 0 && afternoonEvents > 0) {
    busiestTime = 'Meetings throughout the day';
  }

  // Generate AI recommendation
  let aiRecommendation = '';
  if (totalMeetingHours > 4 && tasksDueToday.length > 2) {
    aiRecommendation = 'Heavy meeting day - consider rescheduling non-urgent tasks';
  } else if (focusHours < 1 && tasksDueToday.length > 0) {
    aiRecommendation = 'Limited focus time today - prioritize the most urgent task';
  } else if (focusHours > 4) {
    aiRecommendation = 'Good amount of focus time available for deep work';
  }

  return {
    events_today: todaysEvents.map((e) => ({
      id: e.id,
      summary: e.summary,
      start_time: e.start_time,
      end_time: e.end_time,
      attendees_count: e.attendees?.length || 0,
      has_prep_packet: e.has_prep_packet || false,
    })),
    meeting_count: nonAllDayEvents.length,
    total_meeting_hours: totalMeetingHours,
    focus_time_available: focusTimeAvailable,
    conflicts,
    busiest_time: busiestTime,
    ai_recommendation: aiRecommendation,
  };
}
