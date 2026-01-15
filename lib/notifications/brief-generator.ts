/**
 * Daily Brief Generator
 *
 * Generates morning and evening briefs using AI.
 * Format: Similar to Ocho Reports daily report style.
 * Part of Loop #3: Daily Brief + Push Notifications
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  pending_task_suggestions: number;
  pending_follow_ups: number;
  waiting_on_threads: Array<{
    id: string;
    subject: string;
    waiting_on_email: string;
    days_waiting: number;
  }>;
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
  tasks_still_pending: Array<{
    id: string;
    title: string;
    priority: string;
    due_date: string | null;
    is_overdue: boolean;
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

  // Tasks due today
  if (data.tasks_due_today.length > 0) {
    sections.push({
      title: 'Tasks Due Today',
      items: data.tasks_due_today.map(
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
  const prompt = `Generate a brief, friendly morning summary (2-3 sentences) for a daily report.

Date: ${today}
Tasks due today: ${data.tasks_due_today.length}
Threads waiting on reply: ${data.waiting_on_threads.length}
Pending approvals: ${data.pending_task_suggestions + data.pending_follow_ups}

Keep it concise and actionable. Focus on what needs attention today.`;

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
      items: data.tasks_completed_today.map((t) => t.title),
    });
  }

  // Still pending
  if (data.tasks_still_pending.length > 0) {
    const overdueCount = data.tasks_still_pending.filter((t) => t.is_overdue).length;
    sections.push({
      title: overdueCount > 0 ? `Still Pending (${overdueCount} overdue)` : 'Still Pending',
      items: data.tasks_still_pending.map(
        (t) => `${t.is_overdue ? '⚠️ ' : ''}[${t.priority.toUpperCase()}] ${t.title}`
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
  const prompt = `Generate a brief, friendly end-of-day summary (2-3 sentences) for a daily report.

Date: ${today}
Tasks completed: ${data.tasks_completed_today.length}
Tasks still pending: ${data.tasks_still_pending.length}
Overdue tasks: ${data.tasks_still_pending.filter((t) => t.is_overdue).length}
Follow-ups sent: ${data.follow_ups_sent_today}

Keep it concise. Acknowledge progress and note any concerns.`;

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
