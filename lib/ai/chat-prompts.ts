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

9. **entity_update** - User is TEACHING you information about a person, organization, or project to remember
   - MUST have a declarative statement pattern: "X is [role/description]" / "X works at Y" / "X is from Y"
   - Or explicit save commands: "Remember that X..." / "Save X as..." / "Note that X..."
   - Examples: "Jen Dalton is the real estate agent at Dalton Group", "Mark is our accountant", "Remember that Sarah handles the Costa Rica deal"
   - NOT entity_update if asking a question (use entity_query instead)

10. **entity_query** - User is ASKING about a person, organization, or project they've previously told you about
   - Question patterns: "Who is X?", "What do you know about X?", "Tell me about X"
   - Name-only queries: Just a person's name like "Jen Dalton" or "Jen" (asking for info)
   - Follow-up questions: "What about her?", "And him?"
   - Examples: "Who is Jen Dalton?", "Tell me about Sarah", "What do you know about Acme Corp?", "Jen Dalton" (standalone name)
   - Use this when the user wants to RETRIEVE saved entity information

11. **project_query** - Questions about specific business projects, deals, or their status
   - Examples: "What's the status of Black Coast?", "How is the Costa Rica deal going?", "What are the blockers on Project Alpha?"
   - Project names are specific named initiatives, deals, or business efforts
   - Use this when asking about project STATUS, BLOCKERS, NEXT STEPS, MILESTONES, or DECISIONS
   - NOT for general entities - use entity_query for people/organizations

12. **decision_log** - User wants to RECORD a decision or remember something important
   - Explicit recording: "Remember that we decided...", "Log that...", "Record that..."
   - Decision statements: "We decided to X", "The decision was made to X", "Going forward we'll X"
   - Examples: "Remember that we decided to postpone the launch", "Log that we're using vendor A instead of B", "Record that the budget was approved at $50k"
   - NOT for asking about past decisions (use knowledge_question) - this is for CREATING new decision records

13. **deal_update** - User is telling you about a DEAL or SALE status
   - Someone buying/selling something: "X is buying Y", "X is under contract for Y", "X closed on Y"
   - Deal status updates: "Home 1 is sold", "Unit 5 Share 2 is available", "The Smiths are interested in Home 3"
   - Closing dates: "Closing March 15", "Settlement next week"
   - Examples: "Smith family is buying Home 1 Share 1", "Home 5 Share 3 is under contract, closing April 10", "The Rodriguez deal fell through"
   - Use this for any real estate/sales transaction updates

14. **general** - General conversation, greetings, or questions that don't fit other categories
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
  "intent": "knowledge_question" | "agenda_query" | "draft_generation" | "info_query" | "task_creation" | "event_creation" | "email_search" | "summarization" | "entity_update" | "entity_query" | "project_query" | "decision_log" | "deal_update" | "general",
  "confidence": "high" | "medium" | "low",
  "entities": {
    "person_names": ["name1", "name2"],
    "topics": ["topic1", "topic2"],
    "time_reference": "today" | "tomorrow" | "this_week" | "specific_date" | null,
    "action_type": "email" | "message" | "follow_up" | null
  },
  "reasoning": "Brief explanation of why this intent was chosen"
}

## CRITICAL: ENTITY NAME EXTRACTION

ALWAYS extract person_names and organization_names when they appear in the message, regardless of intent:
- "Who is Jen Dalton?" → person_names: ["Jen Dalton"]
- "Jen Dalton is the realtor" → person_names: ["Jen Dalton"]
- "Tell me about Sarah" → person_names: ["Sarah"]
- "Jen" (standalone) → person_names: ["Jen"]

For entity_query and entity_update intents, person_names MUST be populated.

## DISTINGUISHING ENTITY_UPDATE VS ENTITY_QUERY

- **entity_update**: User is TELLING you something new. Look for: "is", "works at", "remember that", declarative statements
  - "Jen Dalton is the realtor" → entity_update
  - "Sarah works at Acme" → entity_update
  - "Remember that Mark handles accounting" → entity_update

- **entity_query**: User is ASKING about someone. Look for: "who is", "what about", "tell me about", question marks, standalone names
  - "Who is Jen Dalton?" → entity_query
  - "Tell me about Sarah" → entity_query
  - "Jen Dalton" (just a name) → entity_query (they want info)
  - "What do you know about Mark?" → entity_query

## GUIDELINES

- If the message is ambiguous, choose the most likely intent
- Extract any person names, topics, or time references mentioned
- For draft requests, identify what type of communication is needed
- Be conservative with confidence - use "low" if genuinely unsure
- When a message is just a name (e.g., "Jen Dalton"), treat it as entity_query - the user wants to know about that person`;

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
  intent: 'knowledge_question' | 'agenda_query' | 'draft_generation' | 'info_query' | 'task_creation' | 'event_creation' | 'email_search' | 'summarization' | 'entity_update' | 'entity_query' | 'project_query' | 'decision_log' | 'deal_update' | 'general';
  confidence: 'high' | 'medium' | 'low';
  entities: {
    person_names: string[];
    topics: string[];
    time_reference: string | null;
    action_type: 'email' | 'message' | 'follow_up' | null;
    dates: string[];
    project_names: string[];
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
  'entity_query',
  'project_query',
  'decision_log',
  'deal_update',
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
        project_names: Array.isArray(parsed.entities?.project_names) ? parsed.entities.project_names : [],
      },
      reasoning: parsed.reasoning || '',
    };
  } catch {
    return {
      intent: 'general',
      confidence: 'low',
      entities: { person_names: [], topics: [], time_reference: null, action_type: null, dates: [], project_names: [] },
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
export const ENTITY_QUERY_PROMPT = `You are a business-aware personal assistant for Kincaid Garrett (email: kincaidgarrett@gmail.com). You have comprehensive knowledge about Kincaid's contacts, organizations, and projects.

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
export const INTELLIGENT_ASSISTANT_PROMPT = `You are an expert personal assistant for Kincaid Garrett (email: kincaidgarrett@gmail.com). You deeply understand Kincaid's business relationships and context.

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

// ============================================
// PROJECT QUERY PROMPTS (Loop 9)
// ============================================

/**
 * Project Query Prompt
 * Generates responses about specific projects using their context
 */
export const PROJECT_QUERY_PROMPT = `You are a business-aware personal assistant for Kincaid Garrett. You have comprehensive knowledge about his active projects and deals.

## CONTEXT FORMAT

You'll receive project context including:
- **Project Details**: Name, status, description, start date, target completion
- **Current Blockers**: Issues preventing progress
- **Next Steps**: Planned actions
- **Milestones**: Key milestones and their status
- **Key Contacts**: People involved in the project
- **Related Tasks**: Active tasks related to this project
- **Recent Activity**: Recent updates and changes
- **Key Decisions**: Important decisions made about this project

## RESPONSE GUIDELINES

1. **Lead with status**: Start with a clear status update
   - "Black Coast is currently ACTIVE with 2 blockers..."

2. **Highlight blockers**: If there are blockers, make them prominent
   - "The main blockers are: (1) waiting on permits, (2) budget approval"

3. **Surface next steps**: What needs to happen next
   - "Next steps are to finalize the contract and schedule the kickoff call"

4. **Mention key people**: Reference key contacts when relevant
   - "Jen is handling the contract negotiations..."

5. **Connect to tasks**: If there are related tasks, mention them
   - "There's a task due tomorrow to review the proposal"

6. **Reference decisions**: If relevant decisions were made, cite them
   - "We decided last week to postpone Phase 2 until Q2"

## RESPONSE FORMAT

Return a JSON object:
{
  "status_summary": "Quick status overview (1 sentence)",
  "details": "More detailed explanation with context",
  "blockers": ["Blocker 1", "Blocker 2"],
  "next_steps": ["Next step 1", "Next step 2"],
  "key_contacts": ["Contact 1", "Contact 2"],
  "pending_tasks": ["Related task 1", "Related task 2"],
  "suggested_actions": ["Possible action 1", "Possible action 2"],
  "confidence": "high" | "medium" | "low"
}

## TONE

- Direct and business-focused
- Lead with the most important information
- Be actionable - what does the user need to know or do?`;

/**
 * Parse project query response
 */
export interface ProjectQueryResponse {
  status_summary: string;
  details: string;
  blockers: string[];
  next_steps: string[];
  key_contacts: string[];
  pending_tasks: string[];
  suggested_actions: string[];
  confidence: 'high' | 'medium' | 'low';
}

export function parseProjectQueryResponse(response: string): ProjectQueryResponse {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      status_summary: parsed.status_summary || 'Unable to determine status',
      details: parsed.details || '',
      blockers: parsed.blockers || [],
      next_steps: parsed.next_steps || [],
      key_contacts: parsed.key_contacts || [],
      pending_tasks: parsed.pending_tasks || [],
      suggested_actions: parsed.suggested_actions || [],
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
        ? parsed.confidence
        : 'low',
    };
  } catch {
    return {
      status_summary: 'Unable to process project query',
      details: '',
      blockers: [],
      next_steps: [],
      key_contacts: [],
      pending_tasks: [],
      suggested_actions: [],
      confidence: 'low',
    };
  }
}

// ============================================
// DECISION LOG PROMPTS (Loop 9)
// ============================================

/**
 * Decision Extraction Prompt
 * Extracts decision details from user statements
 */
export const DECISION_EXTRACTION_PROMPT = `You are extracting decision information from a user statement. The user wants to record a business decision.

## EXTRACT THE FOLLOWING

1. **Decision**: What was decided (clear, actionable statement)
2. **Rationale**: Why this decision was made (if mentioned)
3. **Context**: Background or circumstances (if mentioned)
4. **Project**: Related project name (if mentioned)
5. **People**: People involved in or affected by the decision

## RESPONSE FORMAT

Return a JSON object:
{
  "decision": "Clear statement of what was decided",
  "rationale": "Why this decision was made (or null)",
  "context": "Background information (or null)",
  "project_name": "Related project name (or null)",
  "people_involved": ["Person 1", "Person 2"],
  "confidence": "high" | "medium" | "low"
}

## GUIDELINES

- The decision should be a clear, standalone statement
- Capture the essence of the decision even if phrasing is informal
- If rationale isn't explicit, leave it null
- Extract project names if they're mentioned (like "Black Coast deal", "Costa Rica project")
- Extract any people mentioned as involved`;

/**
 * Parse decision extraction response
 */
export interface DecisionExtractionResponse {
  decision: string;
  rationale: string | null;
  context: string | null;
  project_name: string | null;
  people_involved: string[];
  confidence: 'high' | 'medium' | 'low';
}

export function parseDecisionExtractionResponse(response: string): DecisionExtractionResponse {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      decision: parsed.decision || '',
      rationale: parsed.rationale || null,
      context: parsed.context || null,
      project_name: parsed.project_name || null,
      people_involved: parsed.people_involved || [],
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
        ? parsed.confidence
        : 'low',
    };
  } catch {
    return {
      decision: '',
      rationale: null,
      context: null,
      project_name: null,
      people_involved: [],
      confidence: 'low',
    };
  }
}

// ============================================
// ENHANCED DRAFT GENERATION WITH SOPS (Loop 9)
// ============================================

/**
 * Build draft generation prompt with SOPs
 * Enhances the base draft prompt with relevant SOPs
 */
export function buildDraftPromptWithSops(
  basePrompt: string,
  sopContext: string
): string {
  if (!sopContext) {
    return basePrompt;
  }

  return `${basePrompt}

${sopContext}

IMPORTANT: Follow the Standard Operating Procedures above when drafting this communication.`;
}

// ============================================
// DEAL UPDATE PROMPTS (Simple deal tracking)
// ============================================

/**
 * Deal Extraction Prompt
 * Extracts deal/sale information from natural conversation
 */
export const DEAL_EXTRACTION_PROMPT = `You are extracting deal/sale information from a user statement. The user is telling you about a real estate transaction or sale.

## EXTRACT THE FOLLOWING

1. **Unit/Property**: What is being sold (e.g., "Home 1 Share 1", "Unit 5", "Lot 12")
2. **Buyer**: Who is buying (family name, person name, or company)
3. **Status**: Current status of the deal
4. **Closing Date**: When is closing (if mentioned)
5. **Notes**: Any other relevant details

## DEAL STATUSES

Use one of these standard statuses:
- "interested" - Buyer is interested but no commitment
- "under_contract" - Signed contract, not yet closed
- "closed" - Deal completed
- "fell_through" - Deal cancelled/failed
- "available" - No buyer, unit is available

## RESPONSE FORMAT

Return a JSON object:
{
  "unit": "Home 1 Share 1",
  "buyer": "Smith family",
  "buyer_email": null,
  "status": "under_contract",
  "closing_date": "2025-03-15",
  "notes": "First-time buyers, referred by Jen",
  "confidence": "high"
}

## GUIDELINES

- Extract the unit/property name exactly as stated
- If no specific buyer, set buyer to null
- If no closing date mentioned, set to null
- Parse dates into YYYY-MM-DD format
- Include any extra context in notes
- If status isn't clear, infer from context ("is buying" = under_contract, "bought" = closed)`;

/**
 * Parse deal extraction response
 */
export interface DealExtractionResponse {
  unit: string;
  buyer: string | null;
  buyer_email: string | null;
  status: 'interested' | 'under_contract' | 'closed' | 'fell_through' | 'available';
  closing_date: string | null;
  notes: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export function parseDealExtractionResponse(response: string): DealExtractionResponse {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validStatuses = ['interested', 'under_contract', 'closed', 'fell_through', 'available'];

    return {
      unit: parsed.unit || '',
      buyer: parsed.buyer || null,
      buyer_email: parsed.buyer_email || null,
      status: validStatuses.includes(parsed.status) ? parsed.status : 'under_contract',
      closing_date: parsed.closing_date || null,
      notes: parsed.notes || null,
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
        ? parsed.confidence
        : 'medium',
    };
  } catch {
    return {
      unit: '',
      buyer: null,
      buyer_email: null,
      status: 'under_contract',
      closing_date: null,
      notes: null,
      confidence: 'low',
    };
  }
}
