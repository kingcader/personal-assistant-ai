/**
 * Chat API Endpoint
 *
 * Main conversational interface endpoint. Handles intent classification
 * and routes to appropriate handlers (KB search, agenda, drafts, etc.)
 *
 * Part of Loop #7: Conversational Interface
 *
 * Usage: POST /api/chat
 * Body: { message: string, conversationId?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  INTENT_CLASSIFIER_PROMPT,
  AGENDA_SYNTHESIS_PROMPT,
  DRAFT_GENERATION_PROMPT,
  INFO_QUERY_PROMPT,
  ENTITY_QUERY_PROMPT,
  parseIntentResponse,
  parseAgendaResponse,
  parseDraftResponse,
  parseInfoResponse,
  parseEntityQueryResponse,
  IntentClassification,
} from '@/lib/ai/chat-prompts';
import {
  ANSWER_GENERATION_SYSTEM_PROMPT,
  buildAnswerPrompt,
  parseAnswerResponse,
} from '@/lib/ai/answer-generation-prompt';
import {
  fetchAgendaContext,
  fetchPersonContext,
  fetchKBContext,
  fetchEntityContext,
  fetchMultiEntityContext,
  formatAgendaForPrompt,
  formatPersonForPrompt,
  formatKBForPrompt,
  formatEntityForPrompt,
  formatMultiEntityForPrompt,
  findMeeting,
  findTask,
  searchEmailsContext,
  formatEmailSearchForPrompt,
  parseDateReference,
} from '@/lib/chat/context';
import {
  extractEntityNamesFromMessage,
  ENTITY_EXTRACTION_SYSTEM_PROMPT,
  parseExtractionResponse,
} from '@/lib/entities/extractor';
import {
  upsertEntity,
  upsertRelationship,
  findEntityByName,
  renameEntity,
} from '@/lib/entities/queries';
import type { Entity } from '@/lib/entities/queries';
import { logAuditEvent } from '@/lib/supabase/audit-queries';
import { getDriveFileUrl } from '@/lib/google/drive';
import {
  createConversation,
  addMessage,
  getConversation,
  getMessages,
} from '@/lib/supabase/conversation-queries';
import {
  getTaskExtractionSystemPrompt,
  buildTaskExtractionPrompt,
  parseTaskExtractionResponse,
} from '@/lib/ai/chat-task-prompt';
import {
  getEventExtractionSystemPrompt,
  buildEventExtractionPrompt,
  parseEventExtractionResponse,
  calculateEndTime,
} from '@/lib/ai/chat-event-prompt';

export const dynamic = 'force-dynamic';

// ============================================
// TYPES
// ============================================

interface Citation {
  fileName: string;
  sectionTitle: string | null;
  driveUrl: string;
  sourceUrl: string | null;
  excerpt: string;
  similarity: number;
  truthPriority: string | null;
}

interface ChatAction {
  type: 'send_email' | 'create_task' | 'create_event';
  status: 'pending_approval';
  data: Record<string, unknown>;
}

interface ChatResponse {
  success: boolean;
  response: string;
  type: 'answer' | 'draft' | 'agenda' | 'info' | 'general' | 'search_results' | 'summary';
  citations?: Citation[];
  confidence?: 'high' | 'medium' | 'low';
  action?: ChatAction;
  intent?: IntentClassification;
  processingMs?: number;
  error?: string;
  conversationId?: string;
  messageId?: string;
  searchResults?: EmailSearchResult[];
}

interface EmailSearchResult {
  id: string;
  subject: string;
  snippet: string;
  sender: string;
  senderEmail: string;
  date: string;
  threadId?: string | null;
  hasAttachments?: boolean;
}

// ============================================
// AI HELPERS
// ============================================

/**
 * Call AI with a system prompt and user message
 */
async function callAI(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const provider = process.env.AI_PROVIDER || 'openai';

  if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    return data.content[0]?.text || '';
  } else {
    // OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }
}

/**
 * Classify the intent of a user message
 * @param message - The current user message
 * @param conversationHistory - Optional recent conversation history for context
 */
async function classifyIntent(
  message: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<IntentClassification> {
  // Build prompt with optional conversation context
  let userPrompt = '';

  if (conversationHistory && conversationHistory.length > 0) {
    userPrompt += '## Recent Conversation:\n';
    conversationHistory.forEach(m => {
      userPrompt += `${m.role}: ${m.content}\n`;
    });
    userPrompt += '\n';
  }

  userPrompt += `## Message to Classify:\n"${message}"`;

  const response = await callAI(INTENT_CLASSIFIER_PROMPT, userPrompt);
  return parseIntentResponse(response);
}

// ============================================
// INTENT HANDLERS
// ============================================

/**
 * Handle knowledge question - search KB and generate grounded answer
 */
async function handleKnowledgeQuestion(
  message: string,
  intent: IntentClassification
): Promise<ChatResponse> {
  console.log('📚 Handling knowledge question:', message);

  // Fetch relevant KB chunks
  const kbContext = await fetchKBContext(message);

  if (kbContext.chunks.length === 0) {
    return {
      success: true,
      response: "I couldn't find any relevant information in the knowledge base to answer your question. Try rephrasing your query or ensure the relevant documents have been indexed.",
      type: 'answer',
      citations: [],
      confidence: 'low',
      intent,
    };
  }

  // Prepare chunks for AI
  const chunksForAI = kbContext.chunks.map(chunk => ({
    content: chunk.content,
    fileName: chunk.file_name,
    sectionTitle: chunk.section_title,
    similarity: chunk.similarity,
    truthPriority: chunk.truth_priority,
  }));

  // Generate answer
  const userPrompt = buildAnswerPrompt(message, chunksForAI);
  const aiResponse = await callAI(ANSWER_GENERATION_SYSTEM_PROMPT, userPrompt);
  const parsedAnswer = parseAnswerResponse(aiResponse);

  // Build citations
  const citations: Citation[] = parsedAnswer.sourcesUsed
    .filter(idx => idx >= 0 && idx < kbContext.chunks.length)
    .map(idx => {
      const chunk = kbContext.chunks[idx];
      return {
        fileName: chunk.file_name,
        sectionTitle: chunk.section_title,
        driveUrl: chunk.drive_file_id ? getDriveFileUrl(chunk.drive_file_id) : '',
        sourceUrl: null,
        excerpt: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
        similarity: chunk.similarity,
        truthPriority: chunk.truth_priority,
      };
    });

  // If AI didn't specify sources, include top chunks
  if (citations.length === 0) {
    kbContext.chunks.slice(0, 3).forEach(chunk => {
      citations.push({
        fileName: chunk.file_name,
        sectionTitle: chunk.section_title,
        driveUrl: chunk.drive_file_id ? getDriveFileUrl(chunk.drive_file_id) : '',
        sourceUrl: null,
        excerpt: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
        similarity: chunk.similarity,
        truthPriority: chunk.truth_priority,
      });
    });
  }

  return {
    success: true,
    response: parsedAnswer.answer,
    type: 'answer',
    citations,
    confidence: parsedAnswer.confidence,
    intent,
  };
}

/**
 * Handle agenda query - synthesize overview for requested date
 */
async function handleAgendaQuery(
  message: string,
  intent: IntentClassification
): Promise<ChatResponse> {
  console.log('📅 Handling agenda query:', message);

  // Parse date reference from intent or message
  let targetDate: Date | undefined;
  if (intent.entities.time_reference) {
    targetDate = parseDateReference(intent.entities.time_reference);
  }

  // Fetch agenda context for target date
  const agendaContext = await fetchAgendaContext(targetDate);

  // Format for AI prompt with target date
  const contextString = formatAgendaForPrompt(agendaContext, targetDate);

  // Generate synthesis
  const aiResponse = await callAI(
    AGENDA_SYNTHESIS_PROMPT,
    `User question: "${message}"\n\n${contextString}`
  );
  const parsed = parseAgendaResponse(aiResponse);

  // Format a human-readable response
  const lines: string[] = [parsed.summary, ''];

  if (parsed.meetings.count > 0) {
    lines.push(`**Meetings**: ${parsed.meetings.count} today${parsed.meetings.first_meeting ? ` (first at ${parsed.meetings.first_meeting})` : ''}`);
  }

  if (parsed.tasks.total_due > 0) {
    lines.push(`**Tasks Due**: ${parsed.tasks.total_due}${parsed.tasks.high_priority > 0 ? ` (${parsed.tasks.high_priority} high priority)` : ''}`);
  }

  if (parsed.waiting_on.count > 0) {
    lines.push(`**Waiting On**: ${parsed.waiting_on.count} thread${parsed.waiting_on.count > 1 ? 's' : ''}`);
  }

  if (parsed.pending_approvals.count > 0) {
    lines.push(`**Pending Approvals**: ${parsed.pending_approvals.count}`);
  }

  if (parsed.priority_focus) {
    lines.push('');
    lines.push(`**Focus**: ${parsed.priority_focus}`);
  }

  return {
    success: true,
    response: lines.join('\n'),
    type: 'agenda',
    confidence: 'high',
    intent,
  };
}

/**
 * Handle draft generation - create email draft
 */
async function handleDraftGeneration(
  message: string,
  intent: IntentClassification
): Promise<ChatResponse> {
  console.log('✍️ Handling draft generation:', message);

  let contextString = '';

  // If we have a person name, fetch their context
  if (intent.entities.person_names.length > 0) {
    const personName = intent.entities.person_names[0];
    const personContext = await fetchPersonContext(personName);
    contextString = formatPersonForPrompt(personContext);

    // If person has waiting-on threads, include that context
    if (personContext.waitingOnThreads.length > 0) {
      contextString += '\n\n### Thread Context (for follow-up)\n';
      // We could fetch full thread context here for better follow-ups
    }
  }

  // Generate draft
  const userPrompt = `User request: "${message}"${contextString ? `\n\n${contextString}` : ''}`;
  const aiResponse = await callAI(DRAFT_GENERATION_PROMPT, userPrompt);
  const draft = parseDraftResponse(aiResponse);

  // Build response with draft preview
  const responseLines = [
    `I've drafted an email for you:`,
    '',
    `**To:** ${draft.recipient_name || draft.recipient_email || '[Recipient]'}`,
    `**Subject:** ${draft.subject}`,
    '',
    draft.body,
  ];

  if (draft.notes) {
    responseLines.push('');
    responseLines.push(`*Note: ${draft.notes}*`);
  }

  return {
    success: true,
    response: responseLines.join('\n'),
    type: 'draft',
    confidence: draft.confidence,
    intent,
    action: {
      type: 'send_email',
      status: 'pending_approval',
      data: {
        subject: draft.subject,
        body: draft.body,
        recipient_email: draft.recipient_email,
        recipient_name: draft.recipient_name,
        is_reply: draft.is_reply,
        thread_id: draft.thread_id,
      },
    },
  };
}

/**
 * Handle info query - specific lookups
 * Enhanced with entity context for person/org queries
 */
async function handleInfoQuery(
  message: string,
  intent: IntentClassification
): Promise<ChatResponse> {
  console.log('🔍 Handling info query:', message);

  let contextString = '';

  // Try to find relevant data based on the query
  // First try entity lookup (richer than person lookup)
  if (intent.entities.person_names.length > 0) {
    const entityContext = await fetchEntityContext(intent.entities.person_names[0]);
    if (entityContext) {
      // Use entity context (has relationships, mentions, etc.)
      contextString = formatEntityForPrompt(entityContext);
    } else {
      // Fall back to person context (email-based lookup)
      const personContext = await fetchPersonContext(intent.entities.person_names[0]);
      contextString = formatPersonForPrompt(personContext);
    }
  }

  // Check for meeting references
  const meetingKeywords = ['meeting', 'call', 'sync', 'event'];
  const hasMeetingRef = meetingKeywords.some(k => message.toLowerCase().includes(k));
  if (hasMeetingRef) {
    // Try to find a specific meeting
    const searchTerms = intent.entities.person_names.concat(intent.entities.topics);
    for (const term of searchTerms) {
      const meeting = await findMeeting(term);
      if (meeting) {
        contextString += `\n\n### Found Meeting\n`;
        contextString += `- Summary: ${meeting.summary || 'Untitled'}\n`;
        contextString += `- Time: ${new Date(meeting.start_time).toLocaleString()}\n`;
        contextString += `- Attendees: ${(meeting.attendees || []).map((a: { email: string }) => a.email).join(', ')}\n`;
        break;
      }
    }
  }

  // Check for task references
  const taskKeywords = ['task', 'todo', 'assignment'];
  const hasTaskRef = taskKeywords.some(k => message.toLowerCase().includes(k));
  if (hasTaskRef) {
    for (const topic of intent.entities.topics) {
      const task = await findTask(topic);
      if (task) {
        contextString += `\n\n### Found Task\n`;
        contextString += `- Title: ${task.title}\n`;
        contextString += `- Status: ${task.status}\n`;
        contextString += `- Priority: ${task.priority}\n`;
        contextString += `- Due: ${task.due_date || 'No due date'}\n`;
        break;
      }
    }
  }

  // Generate response
  const userPrompt = `User question: "${message}"\n\nAvailable Data:\n${contextString || 'No specific data found.'}`;
  const aiResponse = await callAI(INFO_QUERY_PROMPT, userPrompt);
  const parsed = parseInfoResponse(aiResponse);

  return {
    success: true,
    response: parsed.answer + (parsed.details.length > 0 ? '\n\n' + parsed.details.join('\n') : ''),
    type: 'info',
    confidence: parsed.confidence,
    intent,
  };
}

/**
 * Handle entity query - questions about specific people, organizations, or projects
 * Uses the entity system for comprehensive context
 */
async function handleEntityQuery(
  message: string,
  intent: IntentClassification
): Promise<ChatResponse> {
  console.log('👤 Handling entity query:', message);

  // Extract entity names from the message
  const detectedNames = extractEntityNamesFromMessage(message);
  const allNames = [...new Set([...intent.entities.person_names, ...detectedNames])];

  if (allNames.length === 0) {
    return {
      success: true,
      response: "I couldn't identify a specific person, organization, or project in your question. Could you mention who or what you'd like to know about?",
      type: 'info',
      confidence: 'low',
      intent,
    };
  }

  // Fetch entity context for all detected names
  const entityContexts = await fetchMultiEntityContext(allNames);

  if (entityContexts.size === 0) {
    // No entities found in the system
    return {
      success: true,
      response: `I don't have information about ${allNames.join(' or ')} in my system yet. They may appear once I process more emails, calendar events, or documents.`,
      type: 'info',
      confidence: 'medium',
      intent,
    };
  }

  // Format context for AI
  const contextString = formatMultiEntityForPrompt(entityContexts);

  // Generate entity-aware response
  const userPrompt = `User question: "${message}"\n\n${contextString}`;
  const aiResponse = await callAI(ENTITY_QUERY_PROMPT, userPrompt);
  const parsed = parseEntityQueryResponse(aiResponse);

  // Build response
  const responseLines = [parsed.summary];

  if (parsed.context) {
    responseLines.push('');
    responseLines.push(parsed.context);
  }

  if (parsed.pending_items.length > 0) {
    responseLines.push('');
    responseLines.push('**Pending Items:**');
    parsed.pending_items.forEach(item => {
      responseLines.push(`- ${item}`);
    });
  }

  if (parsed.suggested_actions.length > 0) {
    responseLines.push('');
    responseLines.push('**Suggested Actions:**');
    parsed.suggested_actions.forEach(action => {
      responseLines.push(`- ${action}`);
    });
  }

  return {
    success: true,
    response: responseLines.join('\n'),
    type: 'info',
    confidence: parsed.confidence,
    intent,
  };
}

/**
 * Handle task creation - extract task details and return for approval
 */
async function handleTaskCreation(
  message: string,
  intent: IntentClassification
): Promise<ChatResponse> {
  console.log('📝 Handling task creation:', message);

  // Extract task details using AI
  const systemPrompt = getTaskExtractionSystemPrompt();
  const userPrompt = buildTaskExtractionPrompt(message);
  const aiResponse = await callAI(systemPrompt, userPrompt);
  const task = parseTaskExtractionResponse(aiResponse);

  // Format response
  const responseLines = [
    `I'll create this task for you:`,
    '',
    `**${task.title}**`,
  ];

  if (task.description) {
    responseLines.push(`_${task.description}_`);
  }

  responseLines.push('');

  const details: string[] = [];
  if (task.due_date) {
    const dateStr = new Date(task.due_date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    details.push(`Due: ${dateStr}${task.due_time ? ` at ${task.due_time}` : ''}`);
  }
  details.push(`Priority: ${task.priority === 'med' ? 'Medium' : task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}`);

  responseLines.push(details.join(' | '));

  return {
    success: true,
    response: responseLines.join('\n'),
    type: 'info',
    confidence: task.confidence,
    intent,
    action: {
      type: 'create_task',
      status: 'pending_approval',
      data: {
        title: task.title,
        description: task.description,
        due_date: task.due_date,
        due_time: task.due_time,
        priority: task.priority,
      },
    },
  };
}

/**
 * Handle event creation - extract event details and return for approval
 */
async function handleEventCreation(
  message: string,
  intent: IntentClassification
): Promise<ChatResponse> {
  console.log('📅 Handling event creation:', message);

  // Extract event details using AI
  const systemPrompt = getEventExtractionSystemPrompt();
  const userPrompt = buildEventExtractionPrompt(message);
  const aiResponse = await callAI(systemPrompt, userPrompt);
  const event = parseEventExtractionResponse(aiResponse);

  // Calculate end time if not provided
  const endTime = event.end_time || calculateEndTime(event.start_time);

  // Format response
  const dateObj = new Date(`${event.start_date}T${event.start_time}`);
  const formattedDateTime = dateObj.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const responseLines = [
    `I'll schedule this event:`,
    '',
    `**${event.summary}**`,
    `${formattedDateTime} - ${endTime}`,
  ];

  if (event.attendees.length > 0) {
    responseLines.push(`With: ${event.attendees.map(a => a.name || a.email).join(', ')}`);
  }

  if (event.location) {
    responseLines.push(`Location: ${event.location}`);
  }

  if (event.description) {
    responseLines.push('');
    responseLines.push(`_${event.description}_`);
  }

  return {
    success: true,
    response: responseLines.join('\n'),
    type: 'info',
    confidence: event.confidence,
    intent,
    action: {
      type: 'create_event',
      status: 'pending_approval',
      data: {
        summary: event.summary,
        description: event.description,
        start_date: event.start_date,
        start_time: event.start_time,
        end_time: endTime,
        attendees: event.attendees,
        location: event.location,
      },
    },
  };
}

/**
 * Handle general/greeting messages
 */
async function handleGeneral(
  message: string,
  intent: IntentClassification
): Promise<ChatResponse> {
  console.log('💬 Handling general message:', message);

  // Simple responses for common patterns
  const lowerMessage = message.toLowerCase().trim();

  if (['hi', 'hello', 'hey', 'hi!', 'hello!', 'hey!'].includes(lowerMessage)) {
    return {
      success: true,
      response: "Hello! I'm your assistant. I can help you with:\n\n- **Questions about documents** - \"What did the contract say about X?\"\n- **Your agenda** - \"What's on my plate today?\"\n- **Draft emails** - \"Write a follow-up to Sarah\"\n- **Lookups** - \"When is the meeting with John?\"\n\nWhat can I help you with?",
      type: 'general',
      confidence: 'high',
      intent,
    };
  }

  if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
    return {
      success: true,
      response: "I'm your AI assistant with access to your emails, tasks, calendar, and knowledge base. Here's what I can do:\n\n**1. Knowledge Questions**\nAsk about documents, contracts, or information in your system.\n*Example: \"What are the payment terms in the contract?\"*\n\n**2. Agenda Overview**\nGet a summary of your day, tasks, and priorities.\n*Example: \"What's on my plate today?\"*\n\n**3. Draft Communications**\nI can draft emails and follow-ups for you to review.\n*Example: \"Write a follow-up to John about the project\"*\n\n**4. Specific Lookups**\nFind specific meetings, tasks, or information.\n*Example: \"When is my meeting with Sarah?\"*",
      type: 'general',
      confidence: 'high',
      intent,
    };
  }

  // Default fallback
  return {
    success: true,
    response: "I'm not quite sure what you're looking for. Could you try rephrasing? You can ask me about:\n- Documents and contracts in your knowledge base\n- Your tasks and calendar for today\n- Drafting emails or follow-ups\n- Finding specific meetings or tasks",
    type: 'general',
    confidence: 'low',
    intent,
  };
}

/**
 * Handle email search - search emails based on extracted parameters
 */
async function handleEmailSearch(
  message: string,
  intent: IntentClassification
): Promise<ChatResponse> {
  console.log('📧 Handling email search:', message);

  // Build search params from intent entities
  const searchParams: {
    query?: string;
    senderName?: string;
    senderEmail?: string;
    subject?: string;
    dateRef?: string;
    limit?: number;
  } = {
    limit: 10,
  };

  // Extract sender from person names
  if (intent.entities.person_names.length > 0) {
    searchParams.senderName = intent.entities.person_names[0];
  }

  // Extract topics as query terms
  if (intent.entities.topics.length > 0) {
    searchParams.query = intent.entities.topics.join(' ');
  }

  // Extract date references
  if (intent.entities.dates && intent.entities.dates.length > 0) {
    searchParams.dateRef = intent.entities.dates[0];
  }

  // If no specific params extracted, use the whole message as a query
  if (!searchParams.senderName && !searchParams.query && !searchParams.dateRef) {
    // Remove common words to create a search query
    const cleanedQuery = message
      .toLowerCase()
      .replace(/find|search|show|get|emails?|from|about|regarding|messages?/gi, '')
      .trim();
    if (cleanedQuery.length > 2) {
      searchParams.query = cleanedQuery;
    }
  }

  // Perform the search
  const searchContext = await searchEmailsContext(searchParams);

  // Format response
  if (searchContext.results.length === 0) {
    const searchDescription = [];
    if (searchParams.senderName) searchDescription.push(`from ${searchParams.senderName}`);
    if (searchParams.query) searchDescription.push(`about "${searchParams.query}"`);
    if (searchParams.dateRef) searchDescription.push(`from ${searchParams.dateRef}`);

    return {
      success: true,
      response: `I couldn't find any emails${searchDescription.length > 0 ? ' ' + searchDescription.join(' ') : ''}. Try different search terms or check if the emails have been synced.`,
      type: 'search_results',
      confidence: 'high',
      intent,
      searchResults: [],
    };
  }

  // Build summary response
  const searchDescription = [];
  if (searchParams.senderName) searchDescription.push(`from ${searchParams.senderName}`);
  if (searchParams.query) searchDescription.push(`about "${searchParams.query}"`);
  if (searchParams.dateRef) searchDescription.push(`from ${searchParams.dateRef}`);

  const summaryLines = [
    `Found ${searchContext.total} email${searchContext.total !== 1 ? 's' : ''}${searchDescription.length > 0 ? ' ' + searchDescription.join(' ') : ''}:`,
  ];

  // Add brief summary of top results
  searchContext.results.slice(0, 3).forEach((email, idx) => {
    const date = new Date(email.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    summaryLines.push(`${idx + 1}. **${email.subject}** from ${email.sender} (${date})`);
  });

  if (searchContext.total > 3) {
    summaryLines.push(`\n_Plus ${searchContext.total - 3} more..._`);
  }

  return {
    success: true,
    response: summaryLines.join('\n'),
    type: 'search_results',
    confidence: 'high',
    intent,
    searchResults: searchContext.results,
  };
}

/**
 * Handle summarization requests - provide concise overview/digest
 */
async function handleSummarization(
  message: string,
  intent: IntentClassification
): Promise<ChatResponse> {
  console.log('📋 Handling summarization:', message);

  // Parse date reference if provided
  let targetDate: Date | undefined;
  if (intent.entities.time_reference) {
    targetDate = parseDateReference(intent.entities.time_reference);
  }

  // Fetch agenda context
  const agendaContext = await fetchAgendaContext(targetDate);

  // Format context for AI
  const contextString = formatAgendaForPrompt(agendaContext, targetDate);

  // Create summarization-specific prompt
  const summarySystemPrompt = `You are a personal assistant providing a concise summary. Your task is to synthesize the provided agenda data into a brief, actionable digest.

## RESPONSE GUIDELINES

- Be CONCISE - aim for 3-5 bullet points maximum
- Highlight what matters most: urgent items, upcoming meetings, high-priority tasks
- Use natural language, not lists of data
- Focus on actionable insights, not just reporting numbers
- If there's nothing urgent or noteworthy, say so clearly
- Include time context (today, tomorrow, this week) in your summary

## OUTPUT FORMAT

Provide a brief narrative summary followed by key action items if any. Do NOT use JSON format - respond in natural language.`;

  const aiResponse = await callAI(
    summarySystemPrompt,
    `User requested: "${message}"\n\n${contextString}`
  );

  // Build response
  const dateLabel = targetDate
    ? targetDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : 'Today';

  return {
    success: true,
    response: `## ${dateLabel}'s Summary\n\n${aiResponse}`,
    type: 'agenda' as const,
    confidence: 'high',
    intent,
  };
}

/**
 * Handle entity update - user is teaching the system about people/organizations
 */
async function handleEntityUpdate(
  message: string,
  intent: IntentClassification
): Promise<ChatResponse> {
  console.log('👤 Handling entity update:', message);

  // Check for rename patterns first
  // Patterns: "It's not called X, it's called Y", "It's just called Y", "save it as Y", "rename X to Y", "call it Y"
  const renamePatterns = [
    /(?:it'?s?\s+)?not\s+called\s+[""']?(.+?)[""']?[.,]?\s*(?:it'?s?\s+)?(?:just\s+)?(?:called\s+)?[""']?(.+?)[""']?$/i,
    /(?:it'?s?\s+)?just\s+called\s+[""']?(.+?)[""']?$/i,
    /save\s+(?:it\s+)?as\s+[""']?(.+?)[""']?$/i,
    /rename\s+(?:it\s+)?(?:to\s+)?[""']?(.+?)[""']?$/i,
    /call\s+it\s+[""']?(.+?)[""']?(?:\s+not\s+.+)?$/i,
    /(?:no,?\s+)?(?:don'?t\s+save\s+)?[""']?(.+?)[""']?\s+save\s+(?:it\s+)?as\s+[""']?(.+?)[""']?$/i,
  ];

  for (const pattern of renamePatterns) {
    const match = message.match(pattern);
    if (match) {
      // Extract the new name (last capture group with content)
      const newName = match[match.length - 1]?.trim() || match[1]?.trim();
      if (newName) {
        console.log('👤 Detected rename request, new name:', newName);

        // Find the most recently mentioned entity to rename
        // Look for entities that might match what was discussed
        const possibleOldNames = match.length > 2 ? [match[1]?.trim()] : [];

        // Try to find the entity to rename
        let entityToRename = null;

        // First try the old name if provided
        for (const oldName of possibleOldNames) {
          if (oldName) {
            entityToRename = await findEntityByName(oldName);
            if (entityToRename) break;
          }
        }

        // If not found by old name, try partial match with the new name (user might be correcting it)
        if (!entityToRename) {
          entityToRename = await findEntityByName(newName);
        }

        if (entityToRename) {
          const oldName = entityToRename.name;
          const renamed = await renameEntity(entityToRename.id, newName);

          if (renamed) {
            return {
              success: true,
              response: `Got it! I've renamed **${oldName}** to **${renamed.name}**. The old name "${oldName}" is now saved as an alias.`,
              type: 'info',
              confidence: 'high',
              intent,
            };
          }
        }

        // If we couldn't find an entity to rename, fall through to normal entity creation
        console.log('👤 Could not find entity to rename, will create new entity');
      }
    }
  }

  // Build a prompt for entity extraction from the user's statement
  const extractionPrompt = `Extract entities and relationships from this user statement. The user is explicitly telling you about people, organizations, or projects they want you to remember.

## USER STATEMENT
"${message}"

## NOTES
- The user is providing factual information to store
- Extract all entities mentioned (people, organizations, projects, deals)
- Extract relationships between entities (works_at, involved_in, etc.)
- Any descriptive context (like "representing our project") should be captured in the entity's description field
- Set confidence to 1.0 since this is user-verified information`;

  // Use AI to extract entities
  const aiResponse = await callAI(ENTITY_EXTRACTION_SYSTEM_PROMPT, extractionPrompt);
  const extracted = parseExtractionResponse(aiResponse);

  if (extracted.entities.length === 0) {
    return {
      success: true,
      response: "I couldn't identify any specific people, organizations, or projects in your message. Could you try rephrasing? For example:\n- \"Jen Dalton is the real estate agent at Dalton Group\"\n- \"Mark works at Acme Corp as CFO\"\n- \"Remember that Sarah handles the Costa Rica deal\"",
      type: 'general',
      confidence: 'low',
      intent,
    };
  }

  // Set confidence to 1.0 for user-provided information
  extracted.entities.forEach(e => {
    e.confidence = 1.0;
  });
  extracted.relationships.forEach(r => {
    r.confidence = 1.0;
  });

  // Upsert all entities and build a map for relationships
  const entityMap = new Map<string, Entity>();
  const savedEntities: Array<{ entity: Entity; isNew: boolean; merged?: string }> = [];

  for (const extractedEntity of extracted.entities) {
    // Check if entity already exists
    const existingEntity = await findEntityByName(extractedEntity.name);

    // Upsert the entity
    const savedEntity = await upsertEntity(extractedEntity);

    if (savedEntity) {
      entityMap.set(extractedEntity.name, savedEntity);
      savedEntities.push({
        entity: savedEntity,
        isNew: !existingEntity,
        merged: existingEntity && existingEntity.name !== extractedEntity.name
          ? existingEntity.name
          : undefined,
      });
    }
  }

  // Create relationships
  const savedRelationships: Array<{
    source: string;
    target: string;
    type: string;
  }> = [];

  for (const rel of extracted.relationships) {
    const sourceEntity = entityMap.get(rel.sourceEntity);
    const targetEntity = entityMap.get(rel.targetEntity);

    if (sourceEntity && targetEntity) {
      await upsertRelationship(
        sourceEntity.id,
        targetEntity.id,
        rel.type,
        rel.confidence,
        rel.context ? { context: rel.context } : {}
      );
      savedRelationships.push({
        source: sourceEntity.name,
        target: targetEntity.name,
        type: rel.type,
      });
    }
  }

  // Build response
  const responseLines = ["Got it! I've saved:"];
  responseLines.push('');

  for (const { entity, isNew, merged } of savedEntities) {
    const typeLabel = entity.type.charAt(0).toUpperCase() + entity.type.slice(1);
    const role = entity.metadata?.role ? ` - ${entity.metadata.role}` : '';
    const notes = entity.notes ? ` *${entity.notes}*` : '';

    if (merged) {
      responseLines.push(`- **${entity.name}**${role} (merged with existing "${merged}")${notes}`);
    } else if (isNew) {
      responseLines.push(`- **${entity.name}** (${typeLabel})${role}${notes}`);
    } else {
      responseLines.push(`- **${entity.name}**${role} (updated)${notes}`);
    }
  }

  if (savedRelationships.length > 0) {
    responseLines.push('');
    responseLines.push('**Relationships:**');
    for (const rel of savedRelationships) {
      const relLabel = rel.type.replace(/_/g, ' ');
      responseLines.push(`- ${rel.source} ${relLabel} ${rel.target}`);
    }
  }

  responseLines.push('');
  responseLines.push("I'll remember this when you ask about " +
    savedEntities.map(e => e.entity.name).join(' or ') + '.');

  return {
    success: true,
    response: responseLines.join('\n'),
    type: 'info',
    confidence: 'high',
    intent,
  };
}

// ============================================
// MAIN HANDLER
// ============================================

/**
 * POST /api/chat
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { message, conversationId } = body;

    // Validate input
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    if (message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message cannot be empty' },
        { status: 400 }
      );
    }

    console.log(`💬 Chat message: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);

    // Step 1: Get or create conversation
    let activeConversationId = conversationId;

    if (conversationId) {
      // Verify conversation exists
      const existingConv = await getConversation(conversationId);
      if (!existingConv) {
        console.log('⚠️ Conversation not found, creating new one');
        const newConv = await createConversation();
        activeConversationId = newConv.id;
      }
    } else {
      // Create new conversation
      const newConv = await createConversation();
      activeConversationId = newConv.id;
      console.log(`📝 Created new conversation: ${activeConversationId}`);
    }

    // Step 2: Fetch recent conversation history for context (before adding new message)
    let conversationHistory: Array<{ role: string; content: string }> = [];
    try {
      const recentMessages = await getMessages(activeConversationId);
      // Get last 4 messages for context (2 exchanges)
      conversationHistory = recentMessages
        .slice(-4)
        .map(m => ({
          role: m.role,
          content: m.content,
        }));
    } catch (e) {
      console.log('⚠️ Could not fetch conversation history:', e);
    }

    // Step 3: Save user message
    const userMessage = await addMessage({
      conversation_id: activeConversationId,
      role: 'user',
      content: message,
    });
    console.log(`💾 Saved user message: ${userMessage.id}`);

    // Step 4: Classify intent with conversation context
    const intent = await classifyIntent(message, conversationHistory);
    console.log(`🎯 Intent: ${intent.intent} (${intent.confidence})`);

    // Step 5: Route to appropriate handler
    let response: ChatResponse;

    // Route to appropriate handler based on intent
    switch (intent.intent) {
      case 'knowledge_question':
        response = await handleKnowledgeQuestion(message, intent);
        break;
      case 'agenda_query':
        response = await handleAgendaQuery(message, intent);
        break;
      case 'draft_generation':
        response = await handleDraftGeneration(message, intent);
        break;
      case 'info_query':
        response = await handleInfoQuery(message, intent);
        break;
      case 'task_creation':
        response = await handleTaskCreation(message, intent);
        break;
      case 'event_creation':
        response = await handleEventCreation(message, intent);
        break;
      case 'email_search':
        response = await handleEmailSearch(message, intent);
        break;
      case 'summarization':
        response = await handleSummarization(message, intent);
        break;
      case 'entity_update':
        response = await handleEntityUpdate(message, intent);
        break;
      case 'entity_query':
        response = await handleEntityQuery(message, intent);
        break;
      case 'general':
      default:
        response = await handleGeneral(message, intent);
        break;
    }

    // Add processing time
    response.processingMs = Date.now() - startTime;

    // Step 5: Save assistant message
    const assistantMessage = await addMessage({
      conversation_id: activeConversationId,
      role: 'assistant',
      content: response.response,
      type: response.type,
      intent: intent.intent,
      confidence: response.confidence,
      citations: response.citations,
      action: response.action ? {
        type: response.action.type,
        status: response.action.status,
        data: response.action.data,
      } : undefined,
      search_results: response.searchResults,
      processing_ms: response.processingMs,
      ai_model_used: process.env.AI_PROVIDER === 'anthropic'
        ? 'claude-3-5-sonnet-20241022'
        : 'gpt-4o-mini',
    });
    console.log(`💾 Saved assistant message: ${assistantMessage.id}`);

    // Add conversation and message IDs to response
    response.conversationId = activeConversationId;
    response.messageId = assistantMessage.id;

    // Log to audit
    await logAuditEvent({
      entity_type: 'chat',
      entity_id: activeConversationId,
      action: 'message',
      actor: 'user',
      metadata: {
        message: message.substring(0, 200),
        intent: intent.intent,
        confidence: intent.confidence,
        response_type: response.type,
        processing_ms: response.processingMs,
        user_message_id: userMessage.id,
        assistant_message_id: assistantMessage.id,
      },
    });

    console.log(`✅ Chat response generated in ${response.processingMs}ms`);

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Chat error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
