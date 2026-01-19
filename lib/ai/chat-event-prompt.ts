/**
 * Event Extraction Prompt for Chat Interface
 *
 * Extracts calendar event details from natural language requests.
 * Used for "schedule a meeting...", "book time for...", etc.
 *
 * Part of Loop #7 Enhancements: Event Creation
 */

/**
 * System prompt for event extraction
 */
export const EVENT_EXTRACTION_PROMPT = `You are a calendar event extraction assistant. Your job is to extract event details from natural language requests.

## YOUR TASK

Parse the user's request and extract structured calendar event information.

## RESPONSE FORMAT

Return a JSON object with this structure:
{
  "summary": "Event title/summary",
  "description": "Optional additional context or agenda",
  "start_date": "YYYY-MM-DD",
  "start_time": "HH:MM in 24-hour format",
  "end_time": "HH:MM in 24-hour format (or null to default to 1 hour)",
  "all_day": false,
  "attendees": [
    { "email": "person@example.com", "name": "Person Name" }
  ],
  "location": "Meeting location or null",
  "confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation of how you interpreted the request"
}

## GUIDELINES

### Summary/Title
- Keep it concise but descriptive
- Include the main purpose: "Meeting with Sarah", "Project Review", "1:1 with John"
- For calls: "Call with [Name]"
- For reviews: "[Topic] Review"

### Date Interpretation
- "today" = current date
- "tomorrow" = current date + 1 day
- "Monday" = next Monday (or this Monday if today is before Monday)
- "next week" = same day next week
- "in 3 days" = current date + 3 days

### Time Interpretation
- "at 2pm" = 14:00
- "morning" = 09:00
- "afternoon" = 14:00
- "lunch" = 12:00
- "end of day" = 17:00
- Default duration is 1 hour if end_time not specified

### Attendees
- Extract email addresses if provided
- Extract names and try to match known patterns
- If only a name is mentioned, set email to null and include the name
- The organizer (Kincaid) is NOT included in attendees

### Location
- Extract physical addresses
- Detect "Zoom", "Meet", "Teams" as video call indicators
- "call" or "phone" = null location (phone call)

## CURRENT DATE

Today is: {{CURRENT_DATE}}

## EXAMPLES

Input: "Schedule a meeting with Sarah on Monday at 2pm"
Output:
{
  "summary": "Meeting with Sarah",
  "description": null,
  "start_date": "2025-01-20",
  "start_time": "14:00",
  "end_time": "15:00",
  "all_day": false,
  "attendees": [{ "email": null, "name": "Sarah" }],
  "location": null,
  "confidence": "high",
  "reasoning": "Meeting with Sarah scheduled for next Monday at 2pm, 1 hour duration"
}

Input: "Book a 30 minute call with John tomorrow at 3:30pm"
Output:
{
  "summary": "Call with John",
  "description": null,
  "start_date": "2025-01-19",
  "start_time": "15:30",
  "end_time": "16:00",
  "all_day": false,
  "attendees": [{ "email": null, "name": "John" }],
  "location": null,
  "confidence": "high",
  "reasoning": "30-minute call with John scheduled for tomorrow at 3:30pm"
}

Input: "Set up a project review meeting for next week with the team"
Output:
{
  "summary": "Project Review Meeting",
  "description": "Team project review",
  "start_date": "2025-01-25",
  "start_time": "10:00",
  "end_time": "11:00",
  "all_day": false,
  "attendees": [],
  "location": null,
  "confidence": "medium",
  "reasoning": "Project review meeting for next week, defaulted to 10am. 'Team' mentioned but no specific attendees"
}`;

/**
 * Parsed event extraction result
 */
export interface EventExtraction {
  summary: string;
  description: string | null;
  start_date: string;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  attendees: Array<{ email: string | null; name: string }>;
  location: string | null;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

/**
 * Build the event extraction prompt with current date
 */
export function buildEventExtractionPrompt(userMessage: string): string {
  return `User request: "${userMessage}"`;
}

/**
 * Get the system prompt with current date
 */
export function getEventExtractionSystemPrompt(): string {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  return EVENT_EXTRACTION_PROMPT.replace('{{CURRENT_DATE}}', dateStr);
}

/**
 * Parse event extraction response
 */
export function parseEventExtractionResponse(response: string): EventExtraction {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Default to tomorrow at 10am if no date/time
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 1);
    const defaultDateStr = defaultDate.toISOString().split('T')[0];

    return {
      summary: parsed.summary || 'Untitled Event',
      description: parsed.description || null,
      start_date: parsed.start_date || defaultDateStr,
      start_time: parsed.start_time || '10:00',
      end_time: parsed.end_time || null,
      all_day: parsed.all_day === true,
      attendees: Array.isArray(parsed.attendees)
        ? parsed.attendees.map((a: { email?: string | null; name?: string }) => ({
            email: a.email || null,
            name: a.name || 'Unknown',
          }))
        : [],
      location: parsed.location || null,
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
        ? parsed.confidence
        : 'medium',
      reasoning: parsed.reasoning || '',
    };
  } catch {
    // Default to tomorrow at 10am
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 1);

    return {
      summary: 'Untitled Event',
      description: null,
      start_date: defaultDate.toISOString().split('T')[0],
      start_time: '10:00',
      end_time: null,
      all_day: false,
      attendees: [],
      location: null,
      confidence: 'low',
      reasoning: 'Failed to parse event details',
    };
  }
}

/**
 * Calculate end time based on start time and duration
 */
export function calculateEndTime(startTime: string, durationMinutes: number = 60): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const startMinutes = hours * 60 + minutes;
  const endMinutes = startMinutes + durationMinutes;

  const endHours = Math.floor(endMinutes / 60) % 24;
  const endMins = endMinutes % 60;

  return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
}
