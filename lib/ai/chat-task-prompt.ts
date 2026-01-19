/**
 * Task Extraction Prompt for Chat Interface
 *
 * Extracts task details from natural language requests.
 * Used for "remind me to...", "create a task...", etc.
 *
 * Part of Loop #7 Enhancements: Task Creation
 */

/**
 * System prompt for task extraction
 */
export const TASK_EXTRACTION_PROMPT = `You are a task extraction assistant. Your job is to extract task details from natural language requests.

## YOUR TASK

Parse the user's request and extract structured task information.

## RESPONSE FORMAT

Return a JSON object with this structure:
{
  "title": "Concise task title (action-oriented)",
  "description": "Optional additional context or details",
  "due_date": "YYYY-MM-DD or null if not specified",
  "due_time": "HH:MM in 24-hour format or null if not specified",
  "priority": "low" | "med" | "high",
  "confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation of how you interpreted the request"
}

## GUIDELINES

### Title Extraction
- Keep titles concise and action-oriented (start with a verb when possible)
- Examples: "Call John", "Send proposal to Sarah", "Review contract"
- Remove filler words like "remember to" or "don't forget to"

### Due Date Interpretation
- "today" = current date
- "tomorrow" = current date + 1 day
- "next week" = current date + 7 days
- "next Monday" = next Monday's date
- "in 3 days" = current date + 3 days
- "end of week" = Friday of current week
- "end of month" = last day of current month
- If no date specified, leave as null

### Priority Interpretation
- "urgent", "asap", "important", "high priority" → high
- "when you get a chance", "low priority", "eventually" → low
- Default to "med" if not specified
- Consider context clues (deadlines, urgency in wording)

### Time Interpretation
- "at 3pm" = 15:00
- "morning" = 09:00
- "afternoon" = 14:00
- "evening" = 18:00
- "end of day" = 17:00
- If no time specified, leave as null

## CURRENT DATE

Today is: {{CURRENT_DATE}}

## EXAMPLES

Input: "Remind me to call John tomorrow at 3pm"
Output:
{
  "title": "Call John",
  "description": null,
  "due_date": "2025-01-19",
  "due_time": "15:00",
  "priority": "med",
  "confidence": "high",
  "reasoning": "Clear task to call John, with specific date (tomorrow) and time (3pm)"
}

Input: "I need to review the contract by end of week - it's urgent"
Output:
{
  "title": "Review contract",
  "description": "Urgent - by end of week",
  "due_date": "2025-01-17",
  "due_time": null,
  "priority": "high",
  "confidence": "high",
  "reasoning": "Task to review contract, marked urgent, due by Friday"
}

Input: "Add a task to send Sarah the proposal"
Output:
{
  "title": "Send proposal to Sarah",
  "description": null,
  "due_date": null,
  "due_time": null,
  "priority": "med",
  "confidence": "high",
  "reasoning": "Task to send proposal to Sarah, no deadline specified"
}`;

/**
 * Parsed task extraction result
 */
export interface TaskExtraction {
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: 'low' | 'med' | 'high';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

/**
 * Build the task extraction prompt with current date
 */
export function buildTaskExtractionPrompt(userMessage: string): string {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  const systemPrompt = TASK_EXTRACTION_PROMPT.replace('{{CURRENT_DATE}}', dateStr);

  return `User request: "${userMessage}"`;
}

/**
 * Get the system prompt with current date
 */
export function getTaskExtractionSystemPrompt(): string {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  return TASK_EXTRACTION_PROMPT.replace('{{CURRENT_DATE}}', dateStr);
}

/**
 * Parse task extraction response
 */
export function parseTaskExtractionResponse(response: string): TaskExtraction {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      title: parsed.title || 'Untitled Task',
      description: parsed.description || null,
      due_date: parsed.due_date || null,
      due_time: parsed.due_time || null,
      priority: ['low', 'med', 'high'].includes(parsed.priority)
        ? parsed.priority
        : 'med',
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
        ? parsed.confidence
        : 'medium',
      reasoning: parsed.reasoning || '',
    };
  } catch {
    return {
      title: 'Untitled Task',
      description: null,
      due_date: null,
      due_time: null,
      priority: 'med',
      confidence: 'low',
      reasoning: 'Failed to parse task details',
    };
  }
}
