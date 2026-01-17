/**
 * Meeting Prep Packet API
 *
 * Get or generate AI prep packets for calendar events
 *
 * Part of Loop #4: AI-Powered Productivity Calendar
 *
 * Usage:
 * - GET /api/calendar/[eventId]/prep - Get cached prep packet or generate new one
 * - POST /api/calendar/[eventId]/prep - Force regenerate prep packet
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCalendarEventById,
  getPrepPacket,
  upsertPrepPacket,
  PrepPacketContent,
} from '@/lib/supabase/calendar-queries';
import { supabase } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

/**
 * GET /api/calendar/[eventId]/prep
 *
 * Returns cached prep packet if exists, otherwise generates a new one
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params;

    // Get event details
    const event = await getCalendarEventById(eventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check for existing prep packet
    const existingPacket = await getPrepPacket(eventId);
    if (existingPacket) {
      return NextResponse.json({
        prep_packet: existingPacket,
        event,
        cached: true,
      });
    }

    // Generate new prep packet
    const prepContent = await generatePrepPacket(event);
    const aiModel = process.env.AI_PROVIDER === 'anthropic'
      ? 'claude-3-5-sonnet'
      : 'gpt-4o-mini';

    const prepPacket = await upsertPrepPacket(eventId, prepContent, aiModel);

    return NextResponse.json({
      prep_packet: prepPacket,
      event,
      cached: false,
    });
  } catch (error) {
    console.error('Error getting prep packet:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calendar/[eventId]/prep
 *
 * Force regenerate prep packet
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params;

    // Get event details
    const event = await getCalendarEventById(eventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Generate new prep packet (force regenerate)
    const prepContent = await generatePrepPacket(event);
    const aiModel = process.env.AI_PROVIDER === 'anthropic'
      ? 'claude-3-5-sonnet'
      : 'gpt-4o-mini';

    const prepPacket = await upsertPrepPacket(eventId, prepContent, aiModel);

    return NextResponse.json({
      prep_packet: prepPacket,
      event,
      regenerated: true,
    });
  } catch (error) {
    console.error('Error regenerating prep packet:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Generate prep packet content for an event
 */
async function generatePrepPacket(event: any): Promise<PrepPacketContent> {
  // Extract attendee emails
  const attendeeEmails = (event.attendees || [])
    .map((a: any) => a.email)
    .filter((e: string) => e && !e.includes('calendar.google.com'));

  // Gather context from database
  const [relatedTasks, relatedEmails, waitingOnThreads] = await Promise.all([
    // Tasks related to attendees or with similar keywords
    findRelatedTasks(event.summary, attendeeEmails),

    // Recent emails from/to attendees
    findRelatedEmails(attendeeEmails, 30),

    // Waiting-on threads with attendees
    findWaitingOnThreads(attendeeEmails),
  ]);

  // Generate AI talking points
  const talkingPoints = await generateTalkingPoints(event, relatedTasks, relatedEmails);

  // Generate AI summary
  const aiSummary = await generateEventSummary(event, relatedTasks, relatedEmails);

  return {
    meeting: {
      summary: event.summary,
      time: event.start_time,
      attendees: attendeeEmails,
      location: event.location,
    },
    related_tasks: relatedTasks,
    related_emails: relatedEmails,
    waiting_on: waitingOnThreads,
    talking_points: talkingPoints,
    ai_summary: aiSummary,
  };
}

/**
 * Find tasks related to meeting (by attendee or keywords)
 */
async function findRelatedTasks(summary: string | null, attendeeEmails: string[]): Promise<any[]> {
  try {
    // Get active tasks
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, title, status, priority, due_date')
      .in('status', ['todo', 'in_progress'])
      .order('due_date', { ascending: true })
      .limit(20);

    if (error) throw error;

    // Simple keyword matching for now
    const summaryWords = (summary || '').toLowerCase().split(/\s+/);
    const relevantTasks = (tasks || []).filter((task: any) => {
      const titleLower = task.title.toLowerCase();
      // Check if any keyword from meeting summary appears in task title
      return summaryWords.some(
        (word) => word.length > 3 && titleLower.includes(word)
      );
    });

    return relevantTasks.slice(0, 5).map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
    }));
  } catch (error) {
    console.error('Error finding related tasks:', error);
    return [];
  }
}

/**
 * Find recent emails from/to attendees
 */
async function findRelatedEmails(attendeeEmails: string[], daysBack: number): Promise<any[]> {
  if (attendeeEmails.length === 0) return [];

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    // Find emails where sender matches any attendee
    const { data: emails, error } = await supabase
      .from('emails')
      .select(`
        id,
        subject,
        body,
        received_at,
        thread_id,
        people!sender_id (email, name)
      `)
      .gte('received_at', cutoffDate.toISOString())
      .order('received_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Filter to attendees
    const attendeeSet = new Set(attendeeEmails.map((e) => e.toLowerCase()));
    const relevantEmails = (emails || []).filter((email: any) => {
      const senderEmail = email.people?.email?.toLowerCase();
      return senderEmail && attendeeSet.has(senderEmail);
    });

    return relevantEmails.slice(0, 5).map((e: any) => ({
      id: e.id,
      subject: e.subject,
      from: e.people?.email || 'unknown',
      snippet: (e.body || '').substring(0, 150) + '...',
      date: e.received_at,
      thread_id: e.thread_id,
    }));
  } catch (error) {
    console.error('Error finding related emails:', error);
    return [];
  }
}

/**
 * Find waiting-on threads with attendees
 */
async function findWaitingOnThreads(attendeeEmails: string[]): Promise<any[]> {
  if (attendeeEmails.length === 0) return [];

  try {
    const { data: threads, error } = await supabase
      .from('threads')
      .select('id, subject, waiting_on_email, waiting_since')
      .eq('status', 'active')
      .not('waiting_on_email', 'is', null)
      .order('waiting_since', { ascending: true })
      .limit(20);

    if (error) throw error;

    // Filter to threads where we're waiting on an attendee
    const attendeeSet = new Set(attendeeEmails.map((e) => e.toLowerCase()));
    const relevantThreads = (threads || []).filter((thread: any) =>
      thread.waiting_on_email && attendeeSet.has(thread.waiting_on_email.toLowerCase())
    );

    const now = new Date();
    return relevantThreads.slice(0, 3).map((t: any) => ({
      thread_id: t.id,
      subject: t.subject,
      days_waiting: Math.floor(
        (now.getTime() - new Date(t.waiting_since).getTime()) / (1000 * 60 * 60 * 24)
      ),
      waiting_on_email: t.waiting_on_email,
    }));
  } catch (error) {
    console.error('Error finding waiting-on threads:', error);
    return [];
  }
}

/**
 * Generate AI talking points for the meeting
 */
async function generateTalkingPoints(
  event: any,
  relatedTasks: any[],
  relatedEmails: any[]
): Promise<string[]> {
  // If no context, return generic talking points
  if (relatedTasks.length === 0 && relatedEmails.length === 0) {
    return [
      'Review meeting agenda and objectives',
      'Prepare any questions or discussion points',
      'Note action items during the meeting',
    ];
  }

  try {
    const prompt = buildTalkingPointsPrompt(event, relatedTasks, relatedEmails);
    const aiProvider = process.env.AI_PROVIDER || 'openai';

    if (aiProvider === 'openai') {
      return await generateWithOpenAI(prompt);
    } else {
      return await generateWithAnthropic(prompt);
    }
  } catch (error) {
    console.error('Error generating talking points:', error);
    return [
      'Review recent communications with attendees',
      'Check status of related tasks',
      'Prepare updates and questions',
    ];
  }
}

/**
 * Generate AI summary of the meeting context
 */
async function generateEventSummary(
  event: any,
  relatedTasks: any[],
  relatedEmails: any[]
): Promise<string> {
  if (relatedTasks.length === 0 && relatedEmails.length === 0) {
    return event.summary || 'Meeting without additional context';
  }

  try {
    const prompt = buildSummaryPrompt(event, relatedTasks, relatedEmails);
    const aiProvider = process.env.AI_PROVIDER || 'openai';

    if (aiProvider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that creates brief meeting context summaries. Be concise (1-2 sentences).',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 100,
        }),
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content || event.summary || 'Meeting';
    } else {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 100,
          system: 'You are a helpful assistant that creates brief meeting context summaries. Be concise (1-2 sentences).',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }),
      });

      const data = await response.json();
      return data.content?.[0]?.text || event.summary || 'Meeting';
    }
  } catch (error) {
    console.error('Error generating summary:', error);
    return event.summary || 'Meeting';
  }
}

function buildTalkingPointsPrompt(event: any, tasks: any[], emails: any[]): string {
  return `Generate 3-5 concise talking points for this meeting.

Meeting: ${event.summary || 'Meeting'}
Time: ${event.start_time}
Attendees: ${(event.attendees || []).map((a: any) => a.email).join(', ')}

Related tasks:
${tasks.map((t) => `- ${t.title} (${t.status}, ${t.priority} priority)`).join('\n') || 'None'}

Recent emails from attendees:
${emails.map((e) => `- ${e.subject} (${e.from})`).join('\n') || 'None'}

Return ONLY a JSON array of strings with the talking points. Example: ["Point 1", "Point 2"]`;
}

function buildSummaryPrompt(event: any, tasks: any[], emails: any[]): string {
  return `Summarize the context for this meeting in 1-2 sentences.

Meeting: ${event.summary || 'Meeting'}
Attendees: ${(event.attendees || []).map((a: any) => a.email).join(', ')}

Related tasks: ${tasks.length}
Recent emails: ${emails.length}

What is this meeting likely about based on the context?`;
}

async function generateWithOpenAI(prompt: string): Promise<string[]> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You generate concise meeting talking points. Always respond with a JSON array of strings.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) return [];

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.talking_points) return parsed.talking_points;
    if (parsed.points) return parsed.points;
    return [];
  } catch {
    return [];
  }
}

async function generateWithAnthropic(prompt: string): Promise<string[]> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      system: 'You generate concise meeting talking points. Always respond with a JSON array of strings.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  const content = data.content?.[0]?.text;

  if (!content) return [];

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.talking_points) return parsed.talking_points;
    if (parsed.points) return parsed.points;
    return [];
  } catch {
    return [];
  }
}
