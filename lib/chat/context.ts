/**
 * Chat Context Fetcher
 *
 * Utilities for fetching context data for the conversational interface.
 * Aggregates data from tasks, calendar, threads, and knowledge base.
 *
 * Part of Loop #7: Conversational Interface
 */

import { supabase } from '@/lib/supabase/client';
import { getTodaysEvents, getCalendarEvents, DBCalendarEvent } from '@/lib/supabase/calendar-queries';
import { getWaitingOnThreads } from '@/lib/supabase/thread-queries';
import type { WaitingOnThread } from '@/types/database';
import { embedSearchQuery } from '@/lib/kb/embeddings';
import { searchChunks, SearchResult } from '@/lib/supabase/kb-queries';
import {
  searchEmails,
  EmailSearchParams,
  EmailSearchResult,
  parseRelativeDate,
} from '@/lib/supabase/email-queries';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface TaskContext {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'low' | 'med' | 'high';
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_start: string | null;
  scheduled_end: string | null;
}

export interface AgendaContext {
  tasks: {
    dueToday: TaskContext[];
    overdue: TaskContext[];
    highPriority: TaskContext[];
    inProgress: TaskContext[];
  };
  events: DBCalendarEvent[];
  waitingOn: WaitingOnThread[];
  pendingApprovals: {
    taskSuggestions: number;
    followUps: number;
  };
  scheduledTasks: TaskContext[];
}

export interface PersonContext {
  person: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  recentEmails: Array<{
    id: string;
    subject: string;
    received_at: string;
    snippet: string;
  }>;
  relatedTasks: TaskContext[];
  waitingOnThreads: WaitingOnThread[];
  upcomingMeetings: DBCalendarEvent[];
}

export interface KBContext {
  chunks: SearchResult[];
  query: string;
  searchDurationMs: number;
}

// ============================================
// AGENDA CONTEXT
// ============================================

/**
 * Fetch complete agenda context for the current user
 * Used for "what's on my plate" type queries
 */
export async function fetchAgendaContext(): Promise<AgendaContext> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);

  // Fetch all data in parallel
  const [
    tasksResult,
    eventsResult,
    waitingOnResult,
    taskSuggestionsResult,
    followUpsResult,
    scheduledTasksResult,
  ] = await Promise.all([
    // Tasks: get all active tasks
    supabase
      .from('tasks')
      .select('id, title, description, due_date, priority, status, scheduled_start, scheduled_end')
      .not('status', 'in', '("completed","cancelled")')
      .order('due_date', { ascending: true, nullsFirst: false }),

    // Today's events
    getTodaysEvents(),

    // Waiting-on threads
    getWaitingOnThreads(),

    // Pending task suggestions count
    supabase
      .from('suggestions')
      .select('id', { count: 'exact' })
      .eq('status', 'pending'),

    // Pending follow-ups count
    supabase
      .from('follow_up_suggestions')
      .select('id', { count: 'exact' })
      .eq('status', 'pending'),

    // Scheduled tasks for today
    supabase
      .from('tasks')
      .select('id, title, description, due_date, priority, status, scheduled_start, scheduled_end')
      .eq('is_scheduled', true)
      .not('status', 'in', '("completed","cancelled")')
      .gte('scheduled_start', today.toISOString())
      .lte('scheduled_start', endOfToday.toISOString())
      .order('scheduled_start', { ascending: true }),
  ]);

  if (tasksResult.error) throw new Error(`Failed to fetch tasks: ${tasksResult.error.message}`);

  const tasks = (tasksResult.data || []) as TaskContext[];

  // Categorize tasks
  const dueToday = tasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    return dueDate >= today && dueDate <= endOfToday;
  });

  const overdue = tasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    return dueDate < today;
  });

  const highPriority = tasks.filter(t => t.priority === 'high');
  const inProgress = tasks.filter(t => t.status === 'in_progress');

  return {
    tasks: {
      dueToday,
      overdue,
      highPriority,
      inProgress,
    },
    events: eventsResult,
    waitingOn: waitingOnResult,
    pendingApprovals: {
      taskSuggestions: taskSuggestionsResult.count || 0,
      followUps: followUpsResult.count || 0,
    },
    scheduledTasks: (scheduledTasksResult.data || []) as TaskContext[],
  };
}

// ============================================
// PERSON CONTEXT
// ============================================

/**
 * Fetch context about a specific person
 * Used for "who is X" or "draft email to X" type queries
 */
export async function fetchPersonContext(name: string): Promise<PersonContext> {
  // Search for person by name or email (case-insensitive)
  const searchTerm = name.toLowerCase();

  // Find the person
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: people } = await (supabase as any)
    .from('people')
    .select('*')
    .or(`email.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
    .limit(1);

  if (!people || people.length === 0) {
    return {
      person: null,
      recentEmails: [],
      relatedTasks: [],
      waitingOnThreads: [],
      upcomingMeetings: [],
    };
  }

  const person = people[0] as { id: string; email: string; name: string | null };

  // Fetch related data in parallel
  const [emailsResult, threadsResult, eventsResult] = await Promise.all([
    // Recent emails from this person
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('emails')
      .select('id, subject, received_at, body')
      .eq('sender_id', person.id)
      .order('received_at', { ascending: false })
      .limit(10),

    // Waiting-on threads involving this person
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('waiting_on_threads')
      .select('*')
      .eq('waiting_on_email', person.email),

    // Upcoming meetings with this person (check attendees JSONB)
    getCalendarEvents(new Date(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
  ]);

  // Filter events that include this person as attendee
  const upcomingMeetings = eventsResult.filter(event => {
    if (!event.attendees) return false;
    return event.attendees.some(
      (a: { email: string }) => a.email.toLowerCase() === person.email.toLowerCase()
    );
  });

  return {
    person: {
      id: person.id,
      email: person.email,
      name: person.name,
    },
    recentEmails: (emailsResult.data || []).map((e: { id: string; subject: string; received_at: string; body: string }) => ({
      id: e.id,
      subject: e.subject,
      received_at: e.received_at,
      snippet: (e.body || '').substring(0, 150) + '...',
    })),
    relatedTasks: [], // Could be expanded to link tasks to people
    waitingOnThreads: (threadsResult.data || []) as WaitingOnThread[],
    upcomingMeetings,
  };
}

// ============================================
// KNOWLEDGE BASE CONTEXT
// ============================================

/**
 * Fetch relevant KB chunks for a query
 * Used for knowledge questions
 */
export async function fetchKBContext(query: string): Promise<KBContext> {
  const startTime = Date.now();

  try {
    // Generate embedding for the query
    const queryEmbedding = await embedSearchQuery(query);

    // Search for relevant chunks
    const chunks = await searchChunks({
      queryEmbedding,
      limit: 10,
      threshold: 0.3,
    });

    return {
      chunks,
      query,
      searchDurationMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('Error fetching KB context:', error);
    return {
      chunks: [],
      query,
      searchDurationMs: Date.now() - startTime,
    };
  }
}

// ============================================
// SPECIFIC LOOKUPS
// ============================================

/**
 * Find a meeting by partial name match
 */
export async function findMeeting(searchTerm: string): Promise<DBCalendarEvent | null> {
  const events = await getCalendarEvents(
    new Date(),
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
  );

  const normalizedSearch = searchTerm.toLowerCase();

  // Find best match
  const match = events.find(e => {
    const summary = (e.summary || '').toLowerCase();
    const attendeeNames = (e.attendees || [])
      .map((a: { name: string | null }) => (a.name || '').toLowerCase())
      .join(' ');

    return summary.includes(normalizedSearch) || attendeeNames.includes(normalizedSearch);
  });

  return match || null;
}

/**
 * Find a task by partial name match
 */
export async function findTask(searchTerm: string): Promise<TaskContext | null> {
  const { data } = await supabase
    .from('tasks')
    .select('id, title, description, due_date, priority, status, scheduled_start, scheduled_end')
    .not('status', 'in', '("completed","cancelled")')
    .ilike('title', `%${searchTerm}%`)
    .limit(1);

  return data && data.length > 0 ? (data[0] as TaskContext) : null;
}

/**
 * Get thread by subject search
 */
export async function findThread(searchTerm: string): Promise<{
  id: string;
  subject: string | null;
  waiting_on_email: string | null;
  last_message_at: string | null;
} | null> {
  const { data } = await supabase
    .from('threads')
    .select('id, subject, waiting_on_email, last_message_at')
    .ilike('subject', `%${searchTerm}%`)
    .limit(1);

  return data && data.length > 0 ? data[0] : null;
}

// ============================================
// CONTEXT FORMATTING
// ============================================

/**
 * Format agenda context as a string for AI prompt
 */
export function formatAgendaForPrompt(agenda: AgendaContext): string {
  const lines: string[] = [];

  lines.push('## TODAY\'S AGENDA\n');

  // Events
  lines.push('### Calendar Events');
  if (agenda.events.length === 0) {
    lines.push('No meetings scheduled today.\n');
  } else {
    agenda.events.forEach(e => {
      const time = new Date(e.start_time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      const attendeeCount = e.attendees?.length || 0;
      lines.push(`- ${time}: ${e.summary || 'Untitled'} (${attendeeCount} attendees)`);
    });
    lines.push('');
  }

  // Tasks due today
  lines.push('### Tasks Due Today');
  if (agenda.tasks.dueToday.length === 0) {
    lines.push('No tasks due today.\n');
  } else {
    agenda.tasks.dueToday.forEach(t => {
      lines.push(`- [${t.priority.toUpperCase()}] ${t.title} (${t.status})`);
    });
    lines.push('');
  }

  // Overdue tasks
  if (agenda.tasks.overdue.length > 0) {
    lines.push('### Overdue Tasks');
    agenda.tasks.overdue.forEach(t => {
      const dueDate = t.due_date ? new Date(t.due_date).toLocaleDateString() : '';
      lines.push(`- [${t.priority.toUpperCase()}] ${t.title} (due ${dueDate})`);
    });
    lines.push('');
  }

  // High priority tasks
  const highPriorityNotDue = agenda.tasks.highPriority.filter(
    t => !agenda.tasks.dueToday.some(d => d.id === t.id) &&
         !agenda.tasks.overdue.some(o => o.id === t.id)
  );
  if (highPriorityNotDue.length > 0) {
    lines.push('### High Priority Tasks');
    highPriorityNotDue.forEach(t => {
      lines.push(`- ${t.title} (${t.status})`);
    });
    lines.push('');
  }

  // Waiting on
  lines.push('### Waiting On (Threads)');
  if (agenda.waitingOn.length === 0) {
    lines.push('No threads waiting for response.\n');
  } else {
    agenda.waitingOn.forEach(w => {
      lines.push(`- "${w.subject}" - waiting on ${w.waiting_on_email} (${w.days_waiting} days)`);
    });
    lines.push('');
  }

  // Pending approvals
  const totalApprovals = agenda.pendingApprovals.taskSuggestions + agenda.pendingApprovals.followUps;
  if (totalApprovals > 0) {
    lines.push('### Pending Approvals');
    if (agenda.pendingApprovals.taskSuggestions > 0) {
      lines.push(`- ${agenda.pendingApprovals.taskSuggestions} task suggestion(s)`);
    }
    if (agenda.pendingApprovals.followUps > 0) {
      lines.push(`- ${agenda.pendingApprovals.followUps} follow-up(s)`);
    }
    lines.push('');
  }

  // Scheduled tasks
  if (agenda.scheduledTasks.length > 0) {
    lines.push('### Scheduled Time Blocks');
    agenda.scheduledTasks.forEach(t => {
      const start = t.scheduled_start
        ? new Date(t.scheduled_start).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })
        : '';
      lines.push(`- ${start}: ${t.title}`);
    });
  }

  return lines.join('\n');
}

/**
 * Format person context as a string for AI prompt
 */
export function formatPersonForPrompt(context: PersonContext): string {
  const lines: string[] = [];

  if (!context.person) {
    return 'No matching person found in the system.';
  }

  lines.push(`## PERSON: ${context.person.name || context.person.email}\n`);
  lines.push(`Email: ${context.person.email}\n`);

  if (context.recentEmails.length > 0) {
    lines.push('### Recent Emails');
    context.recentEmails.forEach(e => {
      const date = new Date(e.received_at).toLocaleDateString();
      lines.push(`- [${date}] "${e.subject}"`);
    });
    lines.push('');
  }

  if (context.waitingOnThreads.length > 0) {
    lines.push('### Waiting On');
    context.waitingOnThreads.forEach(w => {
      lines.push(`- "${w.subject}" (${w.days_waiting} days)`);
    });
    lines.push('');
  }

  if (context.upcomingMeetings.length > 0) {
    lines.push('### Upcoming Meetings');
    context.upcomingMeetings.forEach(m => {
      const date = new Date(m.start_time).toLocaleDateString();
      lines.push(`- [${date}] ${m.summary || 'Untitled'}`);
    });
  }

  return lines.join('\n');
}

/**
 * Format KB chunks as a string for AI prompt
 */
export function formatKBForPrompt(context: KBContext): string {
  if (context.chunks.length === 0) {
    return 'No relevant documents found in the knowledge base.';
  }

  const lines: string[] = [];
  lines.push('## RELEVANT KNOWLEDGE BASE CHUNKS\n');

  context.chunks.forEach((chunk, idx) => {
    const priority = chunk.truth_priority ? ` [${chunk.truth_priority}]` : '';
    const section = chunk.section_title ? ` - ${chunk.section_title}` : '';
    lines.push(`[${idx}] ${chunk.file_name}${section}${priority} (${Math.round(chunk.similarity * 100)}% match)`);
    lines.push('```');
    lines.push(chunk.content);
    lines.push('```\n');
  });

  return lines.join('\n');
}

// ============================================
// EMAIL SEARCH CONTEXT
// ============================================

export interface EmailSearchContext {
  results: EmailSearchResult[];
  total: number;
  searchParams: EmailSearchParams;
  searchDurationMs: number;
}

/**
 * Search emails based on extracted parameters from intent
 * Used for "find emails from..." or "search emails about..." queries
 */
export async function searchEmailsContext(params: {
  query?: string;
  senderName?: string;
  senderEmail?: string;
  subject?: string;
  dateRef?: string;
  limit?: number;
}): Promise<EmailSearchContext> {
  const startTime = Date.now();

  // Build search params
  const searchParams: EmailSearchParams = {
    limit: params.limit || 10,
  };

  // Add query if provided
  if (params.query) {
    searchParams.query = params.query;
  }

  // Add sender filters
  if (params.senderName) {
    searchParams.senderName = params.senderName;
  }
  if (params.senderEmail) {
    searchParams.senderEmail = params.senderEmail;
  }

  // Add subject filter
  if (params.subject) {
    searchParams.subject = params.subject;
  }

  // Parse relative date reference
  if (params.dateRef) {
    const dateFrom = parseRelativeDate(params.dateRef);
    if (dateFrom) {
      searchParams.dateFrom = dateFrom;
    }
  }

  try {
    const response = await searchEmails(searchParams);

    return {
      results: response.results,
      total: response.total,
      searchParams: response.searchParams,
      searchDurationMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('Error searching emails:', error);
    return {
      results: [],
      total: 0,
      searchParams,
      searchDurationMs: Date.now() - startTime,
    };
  }
}

/**
 * Format email search results for AI prompt
 */
export function formatEmailSearchForPrompt(context: EmailSearchContext): string {
  if (context.results.length === 0) {
    return 'No emails found matching your search criteria.';
  }

  const lines: string[] = [];
  lines.push(`## EMAIL SEARCH RESULTS (${context.total} found)\n`);

  context.results.forEach((email, idx) => {
    const date = new Date(email.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    lines.push(`[${idx + 1}] "${email.subject}"`);
    lines.push(`    From: ${email.sender} <${email.senderEmail}>`);
    lines.push(`    Date: ${date}`);
    lines.push(`    Preview: ${email.snippet}`);
    lines.push('');
  });

  return lines.join('\n');
}
