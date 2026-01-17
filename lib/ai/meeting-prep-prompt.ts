/**
 * AI Meeting Prep Prompt
 *
 * System prompt and utilities for generating meeting preparation packets.
 * Used to create context-aware summaries and talking points before meetings.
 *
 * Part of Loop #4: AI-Powered Productivity Calendar
 */

/**
 * System prompt for meeting prep packet generation
 */
export const MEETING_PREP_SYSTEM_PROMPT = `You are an executive assistant helping prepare for meetings.
Your job is to analyze meeting context and generate useful prep materials.

You will receive:
- Meeting details (title, time, attendees, location)
- Related tasks from the task system
- Recent emails from/to attendees
- Threads where we're waiting on attendees

Your output should help the user:
1. Walk in prepared with context on recent interactions
2. Know what open items exist with each attendee
3. Have conversation starters and key discussion points
4. Understand the likely purpose and goals of the meeting

Guidelines:
- Be concise and actionable
- Focus on what's most relevant to THIS meeting
- Highlight anything time-sensitive or urgent
- If there are waiting-on items with attendees, flag them as potential discussion topics
- Generate 3-5 talking points, not more
- Write a brief AI summary (1-2 sentences) describing what this meeting is about

IMPORTANT: Your response must be valid JSON with this structure:
{
  "talking_points": ["point 1", "point 2", "point 3"],
  "ai_summary": "Brief description of meeting context"
}`;

/**
 * Build user message for meeting prep
 */
export function buildMeetingPrepUserMessage(context: {
  meeting: {
    summary: string | null;
    time: string;
    attendees: string[];
    location: string | null;
  };
  related_tasks: {
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
  }[];
  related_emails: {
    subject: string;
    from: string;
    snippet: string;
    date: string;
  }[];
  waiting_on: {
    subject: string;
    days_waiting: number;
    waiting_on_email: string;
  }[];
}): string {
  const { meeting, related_tasks, related_emails, waiting_on } = context;

  let message = `Generate prep materials for this meeting:

MEETING DETAILS:
- Title: ${meeting.summary || '(No title)'}
- Time: ${new Date(meeting.time).toLocaleString()}
- Attendees: ${meeting.attendees.join(', ') || 'None specified'}
${meeting.location ? `- Location: ${meeting.location}` : ''}

`;

  if (related_tasks.length > 0) {
    message += `RELATED TASKS (${related_tasks.length}):
${related_tasks.map((t) => `- [${t.status.toUpperCase()}] ${t.title} (${t.priority} priority${t.due_date ? `, due ${t.due_date}` : ''})`).join('\n')}

`;
  } else {
    message += `RELATED TASKS: None found

`;
  }

  if (related_emails.length > 0) {
    message += `RECENT EMAILS FROM ATTENDEES (${related_emails.length}):
${related_emails.map((e) => `- "${e.subject}" from ${e.from} on ${new Date(e.date).toLocaleDateString()}
  Preview: ${e.snippet.substring(0, 100)}...`).join('\n')}

`;
  } else {
    message += `RECENT EMAILS FROM ATTENDEES: None found

`;
  }

  if (waiting_on.length > 0) {
    message += `WAITING ON RESPONSES FROM ATTENDEES (${waiting_on.length}):
${waiting_on.map((w) => `- "${w.subject}" - waiting on ${w.waiting_on_email} for ${w.days_waiting} days`).join('\n')}

`;
  }

  message += `Based on this context, generate:
1. 3-5 specific, actionable talking points for this meeting
2. A brief AI summary (1-2 sentences) describing what this meeting is likely about

Respond with valid JSON only.`;

  return message;
}

/**
 * Validate meeting prep AI response
 */
export function validateMeetingPrepResponse(response: any): {
  talking_points: string[];
  ai_summary: string;
} {
  // Handle different response formats
  let parsed = response;

  // If string, try to parse
  if (typeof response === 'string') {
    try {
      parsed = JSON.parse(response);
    } catch {
      // Try to extract JSON from text
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        // Return defaults if can't parse
        return {
          talking_points: ['Review meeting agenda and objectives'],
          ai_summary: 'Meeting without additional context',
        };
      }
    }
  }

  // Extract fields with defaults
  let talking_points: string[] = [];
  if (Array.isArray(parsed.talking_points)) {
    talking_points = parsed.talking_points.filter(
      (p: any) => typeof p === 'string' && p.trim().length > 0
    );
  } else if (Array.isArray(parsed.points)) {
    talking_points = parsed.points.filter(
      (p: any) => typeof p === 'string' && p.trim().length > 0
    );
  }

  // Ensure at least one talking point
  if (talking_points.length === 0) {
    talking_points = ['Review meeting agenda and objectives'];
  }

  // Limit to 5 talking points
  talking_points = talking_points.slice(0, 5);

  const ai_summary =
    typeof parsed.ai_summary === 'string' && parsed.ai_summary.trim()
      ? parsed.ai_summary.trim()
      : typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : 'Meeting';

  return { talking_points, ai_summary };
}

/**
 * Default talking points when no context is available
 */
export const DEFAULT_TALKING_POINTS = [
  'Review meeting agenda and objectives',
  'Prepare any questions or discussion points',
  'Note action items during the meeting',
];
