/**
 * Conversation Database Queries
 *
 * CRUD operations for conversations and chat messages.
 * Handles conversation persistence for the chat interface.
 *
 * Part of Loop #7 Enhancements: Conversation Persistence
 */

import { supabase } from './client';

// ============================================
// TYPES
// ============================================

export interface Conversation {
  id: string;
  title: string | null;
  summary: string | null;
  message_count: number;
  first_message_at: string | null;
  last_message_at: string | null;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationWithPreview extends Conversation {
  last_user_message: string | null;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  type: string | null;
  intent: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  citations: Citation[] | null;
  action: ChatAction | null;
  search_results: SearchResult[] | null;
  sequence_number: number;
  processing_ms: number | null;
  ai_model_used: string | null;
  created_at: string;
}

export interface Citation {
  fileName: string;
  sectionTitle: string | null;
  driveUrl: string;
  sourceUrl: string | null;
  excerpt: string;
  similarity: number;
  truthPriority: string | null;
}

export interface ChatAction {
  type: 'send_email' | 'create_task' | 'create_event';
  status: 'pending_approval' | 'approved' | 'cancelled';
  data: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  subject: string;
  snippet: string;
  sender: string;
  date: string;
}

export interface CreateMessageInput {
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: string;
  intent?: string;
  confidence?: 'high' | 'medium' | 'low';
  citations?: Citation[];
  action?: ChatAction;
  search_results?: SearchResult[];
  processing_ms?: number;
  ai_model_used?: string;
}

// ============================================
// CONVERSATION OPERATIONS
// ============================================

/**
 * Create a new conversation
 */
export async function createConversation(
  title?: string
): Promise<Conversation> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('conversations')
    .insert({
      title: title || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  return data as Conversation;
}

/**
 * Get a conversation by ID
 */
export async function getConversation(
  conversationId: string
): Promise<Conversation | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get conversation: ${error.message}`);
  }

  return data as Conversation | null;
}

/**
 * List recent conversations (not archived)
 */
export async function listConversations(
  limit: number = 20,
  offset: number = 0,
  includeArchived: boolean = false
): Promise<ConversationWithPreview[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (!includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list conversations: ${error.message}`);
  }

  // Get last user message for each conversation
  const conversations = data as Conversation[];
  const conversationsWithPreviews: ConversationWithPreview[] = [];

  for (const conv of conversations) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lastMessage } = await (supabase as any)
      .from('chat_messages')
      .select('content')
      .eq('conversation_id', conv.id)
      .eq('role', 'user')
      .order('sequence_number', { ascending: false })
      .limit(1)
      .single();

    conversationsWithPreviews.push({
      ...conv,
      last_user_message: lastMessage?.content || null,
    });
  }

  return conversationsWithPreviews;
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<Conversation> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('conversations')
    .update({ title })
    .eq('id', conversationId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update conversation title: ${error.message}`);
  }

  return data as Conversation;
}

/**
 * Update conversation summary
 */
export async function updateConversationSummary(
  conversationId: string,
  summary: string
): Promise<Conversation> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('conversations')
    .update({ summary })
    .eq('id', conversationId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update conversation summary: ${error.message}`);
  }

  return data as Conversation;
}

/**
 * Archive a conversation
 */
export async function archiveConversation(
  conversationId: string
): Promise<Conversation> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('conversations')
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to archive conversation: ${error.message}`);
  }

  return data as Conversation;
}

/**
 * Unarchive a conversation
 */
export async function unarchiveConversation(
  conversationId: string
): Promise<Conversation> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('conversations')
    .update({
      is_archived: false,
      archived_at: null,
    })
    .eq('id', conversationId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to unarchive conversation: ${error.message}`);
  }

  return data as Conversation;
}

/**
 * Delete a conversation (and all its messages via cascade)
 */
export async function deleteConversation(
  conversationId: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  if (error) {
    throw new Error(`Failed to delete conversation: ${error.message}`);
  }
}

// ============================================
// MESSAGE OPERATIONS
// ============================================

/**
 * Get the next sequence number for a conversation
 */
async function getNextSequenceNumber(conversationId: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('chat_messages')
    .select('sequence_number')
    .eq('conversation_id', conversationId)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .single();

  return (data?.sequence_number || 0) + 1;
}

/**
 * Add a message to a conversation
 */
export async function addMessage(
  input: CreateMessageInput
): Promise<ChatMessage> {
  // Get the next sequence number
  const sequenceNumber = await getNextSequenceNumber(input.conversation_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('chat_messages')
    .insert({
      conversation_id: input.conversation_id,
      role: input.role,
      content: input.content,
      type: input.type || null,
      intent: input.intent || null,
      confidence: input.confidence || null,
      citations: input.citations || null,
      action: input.action || null,
      search_results: input.search_results || null,
      sequence_number: sequenceNumber,
      processing_ms: input.processing_ms || null,
      ai_model_used: input.ai_model_used || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add message: ${error.message}`);
  }

  return data as ChatMessage;
}

/**
 * Get messages for a conversation
 */
export async function getMessages(
  conversationId: string,
  limit?: number,
  offset?: number
): Promise<ChatMessage[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sequence_number', { ascending: true });

  if (limit) {
    const start = offset || 0;
    query = query.range(start, start + limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get messages: ${error.message}`);
  }

  return data as ChatMessage[];
}

/**
 * Update a message's action status
 */
export async function updateMessageAction(
  messageId: string,
  action: ChatAction | null
): Promise<ChatMessage> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('chat_messages')
    .update({ action })
    .eq('id', messageId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update message action: ${error.message}`);
  }

  return data as ChatMessage;
}

/**
 * Get a single message by ID
 */
export async function getMessage(
  messageId: string
): Promise<ChatMessage | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('chat_messages')
    .select('*')
    .eq('id', messageId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get message: ${error.message}`);
  }

  return data as ChatMessage | null;
}

// ============================================
// UTILITY OPERATIONS
// ============================================

/**
 * Get conversation with all messages
 */
export async function getConversationWithMessages(
  conversationId: string
): Promise<{ conversation: Conversation; messages: ChatMessage[] } | null> {
  const conversation = await getConversation(conversationId);

  if (!conversation) {
    return null;
  }

  const messages = await getMessages(conversationId);

  return { conversation, messages };
}

/**
 * Search conversations by title or message content
 */
export async function searchConversations(
  query: string,
  limit: number = 10
): Promise<ConversationWithPreview[]> {
  const searchTerm = `%${query}%`;

  // Search in conversation titles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: titleMatches, error: titleError } = await (supabase as any)
    .from('conversations')
    .select('*')
    .ilike('title', searchTerm)
    .eq('is_archived', false)
    .limit(limit);

  if (titleError) {
    throw new Error(`Failed to search conversations: ${titleError.message}`);
  }

  // Search in message content
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messageMatches, error: messageError } = await (supabase as any)
    .from('chat_messages')
    .select('conversation_id')
    .ilike('content', searchTerm)
    .limit(limit * 2);

  if (messageError) {
    throw new Error(`Failed to search messages: ${messageError.message}`);
  }

  // Get unique conversation IDs from message matches
  const messageConvIds = [...new Set(messageMatches?.map((m: { conversation_id: string }) => m.conversation_id) || [])];

  // Get those conversations
  let messageConvs: Conversation[] = [];
  if (messageConvIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('conversations')
      .select('*')
      .in('id', messageConvIds)
      .eq('is_archived', false);

    if (error) {
      throw new Error(`Failed to get conversations: ${error.message}`);
    }
    messageConvs = data as Conversation[];
  }

  // Combine and deduplicate
  const allConvs = [...(titleMatches || []), ...messageConvs];
  const uniqueConvs = Array.from(
    new Map(allConvs.map(c => [c.id, c])).values()
  ).slice(0, limit);

  // Add preview messages
  const conversationsWithPreviews: ConversationWithPreview[] = [];
  for (const conv of uniqueConvs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lastMessage } = await (supabase as any)
      .from('chat_messages')
      .select('content')
      .eq('conversation_id', conv.id)
      .eq('role', 'user')
      .order('sequence_number', { ascending: false })
      .limit(1)
      .single();

    conversationsWithPreviews.push({
      ...conv,
      last_user_message: lastMessage?.content || null,
    });
  }

  return conversationsWithPreviews;
}

/**
 * Get conversation count
 */
export async function getConversationCount(
  includeArchived: boolean = false
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('conversations')
    .select('id', { count: 'exact', head: true });

  if (!includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to get conversation count: ${error.message}`);
  }

  return count || 0;
}
