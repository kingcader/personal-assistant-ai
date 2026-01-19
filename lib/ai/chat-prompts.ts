/**
 * Chat System Prompts
 *
 * System prompts for the conversational interface.
 * Handles intent classification, agenda synthesis, and draft generation.
 *
 * Part of Loop #7: Conversational Interface
 */

/**
 * Intent Classification Prompt
 * Classifies user query into one of the supported intent types
 */
export const INTENT_CLASSIFIER_PROMPT = `You are an intent classifier for a personal assistant AI. Your job is to classify user messages into one of the following intent types:

## INTENT TYPES

1. **knowledge_question** - Questions about documents, contracts, agreements, or stored information
   - Examples: "What did the contract say about X?", "What's our policy on Y?", "What was the pricing we agreed on?"

2. **agenda_query** - Questions about what needs to be done, schedule, or priorities
   - Examples: "What's on my plate today?", "What do I need to focus on?", "What meetings do I have?", "What are my priorities?", "What about tomorrow?"

3. **draft_generation** - Requests to write or draft communications
   - Examples: "Write a follow-up to John", "Draft an email about the project", "Compose a message to Sarah"

4. **info_query** - Specific lookups for calendar, tasks, people, or threads
   - Examples: "When is the meeting with Sarah?", "What's the status of the project task?", "Who was in that meeting?"

5. **task_creation** - Requests to create tasks, reminders, or todo items
   - Examples: "Remind me to call John tomorrow", "Create a task to review the contract", "Add to my todo: send proposal"

6. **event_creation** - Requests to schedule meetings, calls, or calendar events
   - Examples: "Schedule a meeting with Sarah Monday at 2pm", "Book time for a call with John", "Set up a meeting to discuss the project"

7. **email_search** - Requests to find or search for emails
   - Examples: "Find emails from Sarah", "Search for emails about the contract", "Show me emails from last week about the project"

8. **summarization** - Requests for summaries, digests, or overviews of the day/week/tasks
   - Examples: "Summarize my day", "Give me a recap", "What's the overview?", "Brief me on today"

9. **entity_update** - User is providing information about a person, organization, or project to remember
   - "X is the Y" / "X works at Y" / "X is from Y"
   - "Remember that X..." / "Save X as..."
   - Adding context about people/orgs
   - Examples: "Jen Dalton is the real estate agent at Dalton Group", "Mark is our accountant", "Remember that Sarah handles the Costa Rica deal"

10. **general** - General conversation, greetings, or questions that don't fit other categories
   - Examples: "Hello", "How are you?", "What can you help me with?"

## CONVERSATION CONTEXT

When conversation history is provided, use it to understand follow-up messages. Consider:
- **Pronouns**: "it", "them", "that", "those" likely refer to previous topics
- **Time shifts**: "what about tomorrow?", "and next week?" continue the previous query type with new time
- **Topic continuation**: "tell me more", "elaborate", "what else?" continue the same intent
- **Person references**: "what did she say?", "his emails" refer to previously mentioned people

Examples with context:
- Previous: agenda_query → "what about tomorrow?" → agenda_query with time_reference: "tomorrow"
- Previous: email_search for Sarah → "what did she say about the contract?" → email_search (same person, new topic)
- Previous: agenda_query → "summarize that" → summarization

## RESPONSE FORMAT

Return a JSON object with this exact structure:
{
  "intent": "knowledge_question" | "agenda_query" | "draft_generation" | "info_query" | "task_creation" | "event_creation" | "email_search" | "summarization" | "entity_update" | "general",
  "confidence": "high" | "medium" | "low",
  "entities": {
    "person_names": ["name1", "name2"],
    "topics": ["topic1", "topic2"],
    "time_reference": "today" | "tomorrow" | "this_week" | "specific_date" | null,
    "action_type": "email" | "message" | "follow_up" | null
  },
  "reasoning": "Brief explanation of why this intent was chosen"
}

## GUIDELINES

- If the message is ambiguous, choose the most likely intent
- Extract any person names, topics, or time references mentioned
- For draft requests, identify what type of communication is needed
- Be conservative with confidence - use "low" if genuinely unsure`;

/**
 * Agenda Synthesis Prompt
 * Generates a comprehensive overview of the user's day
 */
export const AGENDA_SYNTHESIS_PROMPT = `You are a personal assistant synthesizing an agenda overview. Your task is to analyze the provided context (tasks, calendar events, waiting-on threads, and pending approvals) and provide a helpful, actionable summary.

## CONTEXT FORMAT

You'll receive structured data about:
- **Today's Tasks**: Tasks due today with their priority and status
- **Calendar Events**: Meetings and events scheduled for today
- **Waiting-On Threads**: Email threads awaiting responses (with days waiting)
- **Pending Approvals**: Items needing your review

## RESPONSE FORMAT

Return a JSON object with this structure:
{
  "summary": "Brief 1-2 sentence overview of the day",
  "meetings": {
    "count": 3,
    "first_meeting": "9:00 AM - Project Sync",
    "highlights": ["Important items about meetings"]
  },
  "tasks": {
    "total_due": 5,
    "high_priority": 2,
    "highlights": ["Key tasks to focus on"]
  },
  "waiting_on": {
    "count": 2,
    "urgent": ["Thread subjects waiting 5+ days"]
  },
  "pending_approvals": {
    "count": 1,
    "types": ["task_suggestions", "follow_ups"]
  },
  "priority_focus": "1-2 sentences about what to prioritize first",
  "suggested_actions": ["Action 1", "Action 2"]
}

## GUIDELINES

- Be concise but comprehensive
- Highlight time-sensitive items
- Identify potential conflicts or issues
- Suggest a priority order if there are competing demands
- Use natural language in summaries
- Don't include items that are completed or cancelled`;

/**
 * Draft Generation Prompt
 * Generates email drafts based on context
 */
export const DRAFT_GENERATION_PROMPT = `You are a professional email writer for a business executive. Your task is to draft emails based on the provided context and user request.

## CONTEXT FORMAT

You'll receive:
- **Request**: What the user wants to communicate
- **Recipient**: Who the email is to (if known)
- **Thread Context**: Previous emails in the thread (if a follow-up)
- **Person Context**: What we know about the recipient from past interactions
- **Relevant Documents**: Any relevant KB information

## RESPONSE FORMAT

Return a JSON object with this structure:
{
  "subject": "Email subject line (or 'Re: [original subject]' for replies)",
  "body": "The email body text",
  "recipient_email": "recipient@example.com or null if unknown",
  "recipient_name": "Recipient Name or null",
  "is_reply": true/false,
  "thread_id": "thread_id if replying to existing thread",
  "tone": "professional" | "friendly" | "formal" | "urgent",
  "key_points": ["Main point 1", "Main point 2"],
  "confidence": "high" | "medium" | "low",
  "notes": "Any notes about the draft or missing context"
}

## GUIDELINES

- Match the tone to the context and relationship
- Keep emails concise and action-oriented
- Include clear next steps or calls to action when appropriate
- For follow-ups, reference the previous conversation naturally
- Don't make up facts - if information is missing, note it
- Use professional formatting (greeting, body paragraphs, closing)
- The sender is Kincaid Garrett (kincaidgarrett@gmail.com)`;

/**
 * Info Query Response Prompt
 * Answers specific questions about calendar, tasks, or people
 */
export const INFO_QUERY_PROMPT = `You are answering a specific question about the user's calendar, tasks, or contacts. Provide a direct, concise answer based on the provided data.

## RESPONSE FORMAT

Return a JSON object with this structure:
{
  "answer": "Direct answer to the question",
  "details": ["Additional relevant detail 1", "Additional relevant detail 2"],
  "found": true/false,
  "confidence": "high" | "medium" | "low",
  "suggestions": ["Related item they might be interested in"]
}

## GUIDELINES

- Answer the specific question asked
- Include relevant details without overwhelming
- If exact match not found, suggest closest alternatives
- If information is not in the provided data, say so clearly`;

/**
 * Parse intent classification response
 */
export interface IntentClassification {
  intent: 'knowledge_question' | 'agenda_query' | 'draft_generation' | 'info_query' | 'task_creation' | 'event_creation' | 'email_search' | 'summarization' | 'entity_update' | 'general';
  confidence: 'high' | 'medium' | 'low';
  entities: {
    person_names: string[];
    topics: string[];
    time_reference: string | null;
    action_type: 'email' | 'message' | 'follow_up' | null;
    dates: string[];
  };
  reasoning: string;
}

const VALID_INTENTS = [
  'knowledge_question',
  'agenda_query',
  'draft_generation',
  'info_query',
  'task_creation',
  'event_creation',
  'email_search',
  'summarization',
  'entity_update',
  'general',
];

export function parseIntentResponse(response: string): IntentClassification {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      intent: VALID_INTENTS.includes(parsed.intent)
        ? parsed.intent
        : 'general',
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
        ? parsed.confidence
        : 'low',
      entities: {
        person_names: Array.isArray(parsed.entities?.person_names) ? parsed.entities.person_names : [],
        topics: Array.isArray(parsed.entities?.topics) ? parsed.entities.topics : [],
        time_reference: parsed.entities?.time_reference || null,
        action_type: parsed.entities?.action_type || null,
        dates: Array.isArray(parsed.entities?.dates) ? parsed.entities.dates : [],
      },
      reasoning: parsed.reasoning || '',
    };
  } catch {
    return {
      intent: 'general',
      confidence: 'low',
      entities: { person_names: [], topics: [], time_reference: null, action_type: null, dates: [] },
      reasoning: 'Failed to parse intent',
    };
  }
}

/**
 * Parse agenda synthesis response
 */
export interface AgendaSynthesis {
  summary: string;
  meetings: {
    count: number;
    first_meeting: string | null;
    highlights: string[];
  };
  tasks: {
    total_due: number;
    high_priority: number;
    highlights: string[];
  };
  waiting_on: {
    count: number;
    urgent: string[];
  };
  pending_approvals: {
    count: number;
    types: string[];
  };
  priority_focus: string;
  suggested_actions: string[];
}

export function parseAgendaResponse(response: string): AgendaSynthesis {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      summary: parsed.summary || 'Unable to generate summary',
      meetings: {
        count: parsed.meetings?.count || 0,
        first_meeting: parsed.meetings?.first_meeting || null,
        highlights: parsed.meetings?.highlights || [],
      },
      tasks: {
        total_due: parsed.tasks?.total_due || 0,
        high_priority: parsed.tasks?.high_priority || 0,
        highlights: parsed.tasks?.highlights || [],
      },
      waiting_on: {
        count: parsed.waiting_on?.count || 0,
        urgent: parsed.waiting_on?.urgent || [],
      },
      pending_approvals: {
        count: parsed.pending_approvals?.count || 0,
        types: parsed.pending_approvals?.types || [],
      },
      priority_focus: parsed.priority_focus || '',
      suggested_actions: parsed.suggested_actions || [],
    };
  } catch {
    return {
      summary: 'Unable to synthesize agenda',
      meetings: { count: 0, first_meeting: null, highlights: [] },
      tasks: { total_due: 0, high_priority: 0, highlights: [] },
      waiting_on: { count: 0, urgent: [] },
      pending_approvals: { count: 0, types: [] },
      priority_focus: '',
      suggested_actions: [],
    };
  }
}

/**
 * Parse draft generation response
 */
export interface DraftGeneration {
  subject: string;
  body: string;
  recipient_email: string | null;
  recipient_name: string | null;
  is_reply: boolean;
  thread_id: string | null;
  tone: 'professional' | 'friendly' | 'formal' | 'urgent';
  key_points: string[];
  confidence: 'high' | 'medium' | 'low';
  notes: string | null;
}

export function parseDraftResponse(response: string): DraftGeneration {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      subject: parsed.subject || 'No subject',
      body: parsed.body || '',
      recipient_email: parsed.recipient_email || null,
      recipient_name: parsed.recipient_name || null,
      is_reply: parsed.is_reply || false,
      thread_id: parsed.thread_id || null,
      tone: ['professional', 'friendly', 'formal', 'urgent'].includes(parsed.tone)
        ? parsed.tone
        : 'professional',
      key_points: parsed.key_points || [],
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
        ? parsed.confidence
        : 'low',
      notes: parsed.notes || null,
    };
  } catch {
    return {
      subject: 'Draft',
      body: 'Unable to generate draft',
      recipient_email: null,
      recipient_name: null,
      is_reply: false,
      thread_id: null,
      tone: 'professional',
      key_points: [],
      confidence: 'low',
      notes: 'Failed to parse draft response',
    };
  }
}

/**
 * Parse info query response
 */
export interface InfoQueryResponse {
  answer: string;
  details: string[];
  found: boolean;
  confidence: 'high' | 'medium' | 'low';
  suggestions: string[];
}

export function parseInfoResponse(response: string): InfoQueryResponse {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      answer: parsed.answer || 'Unable to find answer',
      details: parsed.details || [],
      found: parsed.found !== false,
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
        ? parsed.confidence
        : 'low',
      suggestions: parsed.suggestions || [],
    };
  } catch {
    return {
      answer: 'Unable to process query',
      details: [],
      found: false,
      confidence: 'low',
      suggestions: [],
    };
  }
}

// ============================================
// ENTITY-AWARE PROMPTS (Loop 6)
// ============================================

/**
 * Entity Query Prompt
 * Generates responses about specific entities using their context
 */
export const ENTITY_QUERY_PROMPT = `You are a business-aware personal assistant. You have comprehensive knowledge about the user's contacts, organizations, and projects.

## CONTEXT FORMAT

You'll receive entity context including:
- **Entity Details**: Name, email, role, description, aliases
- **Relationships**: Who they work with, what organizations they're part of
- **Recent Emails**: Recent email exchanges with this person/org
- **Related Tasks**: Tasks that mention this entity
- **Upcoming Meetings**: Scheduled events with this person

## RESPONSE GUIDELINES

1. **Lead with the direct answer** to what was asked
2. **Connect the dots**: Mention relevant relationships and context
   - "Jen works at Acme Corp, and she's been your main contact for the Costa Rica deal."
3. **Surface relevant activity**: Recent emails, pending tasks, upcoming meetings
   - "I see 3 emails from her this week about the contract..."
4. **Be proactive**: If there are pending items or overdue tasks, mention them
   - "There's also an overdue task to review the payment terms with her."
5. **Suggest actions** when appropriate
   - "Would you like me to draft a follow-up email to her?"

## RESPONSE FORMAT

Return a JSON object:
{
  "summary": "Direct answer about the entity",
  "context": "Additional context from relationships, emails, tasks",
  "pending_items": ["Any pending tasks or actions related to this entity"],
  "suggested_actions": ["Possible next steps"],
  "confidence": "high" | "medium" | "low"
}

## TONE

- Conversational and natural, not robotic
- Reference relationships naturally ("Since she's your contact at Acme...")
- Be concise but comprehensive`;

/**
 * Intelligent Assistant System Prompt
 * Enhanced prompt that leverages entity context for smarter responses
 */
export const INTELLIGENT_ASSISTANT_PROMPT = `You are an expert personal assistant who deeply understands the user's business relationships and context.

## WHAT YOU KNOW

You have access to:
- **Entities**: Key people, organizations, and projects the user works with
- **Relationships**: How entities connect (e.g., Jen works at Acme, Acme is the client for Costa Rica deal)
- **History**: Recent emails, tasks, and meetings involving these entities
- **Documents**: Contracts, agreements, and knowledge base content

## HOW TO RESPOND

1. **Connect the dots**: When someone asks about Jen, you know she's at Acme, working on the Costa Rica deal, and there's a pending contract review.

2. **Be proactive**: "You have a meeting with Jen tomorrow. She's sent 3 emails this week about the contract. There's also an overdue task to review payment terms."

3. **Maintain context**: Reference relationships naturally. "Since Jen is your main contact at Acme..."

4. **Suggest actions**: "Would you like me to draft a meeting agenda for tomorrow's call with Jen?"

5. **Cite sources**: When referencing specific information, mention where it came from (email, task, document).

## RESPONSE STYLE

- Conversational, not robotic
- Lead with the direct answer
- Add 1-2 relevant insights from entity connections
- Offer a suggested next action when appropriate
- Keep responses concise but helpful

## GUIDELINES

- Don't make up information - only use what's provided in the context
- If information is missing, say so clearly
- Prioritize actionable insights over raw data dumps
- When multiple entities are mentioned, connect their relationships`;

/**
 * Parse entity query response
 */
export interface EntityQueryResponse {
  summary: string;
  context: string;
  pending_items: string[];
  suggested_actions: string[];
  confidence: 'high' | 'medium' | 'low';
}

export function parseEntityQueryResponse(response: string): EntityQueryResponse {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      summary: parsed.summary || 'Unable to generate summary',
      context: parsed.context || '',
      pending_items: parsed.pending_items || [],
      suggested_actions: parsed.suggested_actions || [],
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
        ? parsed.confidence
        : 'low',
    };
  } catch {
    return {
      summary: 'Unable to process entity query',
      context: '',
      pending_items: [],
      suggested_actions: [],
      confidence: 'low',
    };
  }
}
