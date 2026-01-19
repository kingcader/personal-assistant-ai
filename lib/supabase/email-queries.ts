/**
 * Email Search Queries
 *
 * Search and filter emails in the database.
 * Used by the chat interface for email search functionality.
 *
 * Part of Loop #7 Enhancements: Email Search
 */

import { supabase } from './client';

// ============================================
// TYPES
// ============================================

export interface EmailSearchParams {
  query?: string;        // General search (subject + body)
  senderEmail?: string;  // Filter by sender email
  senderName?: string;   // Filter by sender name
  subject?: string;      // Search in subject
  dateFrom?: Date;       // Start date
  dateTo?: Date;         // End date
  limit?: number;        // Max results (default 20)
  offset?: number;       // Pagination offset
}

export interface EmailSearchResult {
  id: string;
  subject: string;
  snippet: string;
  sender: string;  // Name or email
  senderEmail: string;
  date: string;
  threadId: string | null;
  hasAttachments: boolean;
}

export interface EmailSearchResponse {
  results: EmailSearchResult[];
  total: number;
  searchParams: EmailSearchParams;
  searchDurationMs: number;
}

// ============================================
// SEARCH FUNCTIONS
// ============================================

/**
 * Search emails with various filters
 */
export async function searchEmails(params: EmailSearchParams): Promise<EmailSearchResponse> {
  const startTime = Date.now();
  const limit = params.limit || 20;
  const offset = params.offset || 0;

  try {
    // Build the query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('emails')
      .select(`
        id,
        subject,
        body,
        received_at,
        thread_id,
        has_attachments,
        sender:people!sender_id(
          id,
          name,
          email
        )
      `, { count: 'exact' });

    // Apply sender email filter
    if (params.senderEmail) {
      // Need to filter by joined table
      // First get sender ID from people table
      const { data: senders } = await supabase
        .from('people')
        .select('id')
        .ilike('email', `%${params.senderEmail}%`);

      if (senders && senders.length > 0) {
        const senderIds = senders.map((s: { id: string }) => s.id);
        query = query.in('sender_id', senderIds);
      } else {
        // No matching senders, return empty results
        return {
          results: [],
          total: 0,
          searchParams: params,
          searchDurationMs: Date.now() - startTime,
        };
      }
    }

    // Apply sender name filter
    if (params.senderName) {
      const { data: senders } = await supabase
        .from('people')
        .select('id')
        .ilike('name', `%${params.senderName}%`);

      if (senders && senders.length > 0) {
        const senderIds = senders.map((s: { id: string }) => s.id);
        query = query.in('sender_id', senderIds);
      } else {
        return {
          results: [],
          total: 0,
          searchParams: params,
          searchDurationMs: Date.now() - startTime,
        };
      }
    }

    // Apply subject filter
    if (params.subject) {
      query = query.ilike('subject', `%${params.subject}%`);
    }

    // Apply general query (search subject and body)
    if (params.query) {
      // Use OR for subject and body search
      query = query.or(`subject.ilike.%${params.query}%,body.ilike.%${params.query}%`);
    }

    // Apply date filters
    if (params.dateFrom) {
      query = query.gte('received_at', params.dateFrom.toISOString());
    }
    if (params.dateTo) {
      query = query.lte('received_at', params.dateTo.toISOString());
    }

    // Order by date descending (most recent first)
    query = query.order('received_at', { ascending: false });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Email search failed: ${error.message}`);
    }

    // Transform results
    const results: EmailSearchResult[] = (data || []).map((email: {
      id: string;
      subject: string;
      body: string;
      received_at: string;
      thread_id: string | null;
      has_attachments: boolean;
      sender: { id: string; name: string | null; email: string } | null;
    }) => ({
      id: email.id,
      subject: email.subject,
      snippet: createSnippet(email.body, params.query || params.subject),
      sender: email.sender?.name || email.sender?.email || 'Unknown',
      senderEmail: email.sender?.email || 'unknown@example.com',
      date: email.received_at,
      threadId: email.thread_id,
      hasAttachments: email.has_attachments || false,
    }));

    return {
      results,
      total: count || results.length,
      searchParams: params,
      searchDurationMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('Email search error:', error);
    throw error;
  }
}

/**
 * Create a snippet from email body, highlighting search term
 */
function createSnippet(body: string, searchTerm?: string, maxLength: number = 150): string {
  if (!body) return '';

  // Clean up the body (remove excessive whitespace, newlines)
  const cleanBody = body.replace(/\s+/g, ' ').trim();

  if (!searchTerm) {
    // Just return the first part of the body
    return cleanBody.length > maxLength
      ? cleanBody.substring(0, maxLength) + '...'
      : cleanBody;
  }

  // Try to find the search term and extract context around it
  const lowerBody = cleanBody.toLowerCase();
  const lowerTerm = searchTerm.toLowerCase();
  const index = lowerBody.indexOf(lowerTerm);

  if (index === -1) {
    // Term not found in body, return beginning
    return cleanBody.length > maxLength
      ? cleanBody.substring(0, maxLength) + '...'
      : cleanBody;
  }

  // Calculate snippet bounds
  const contextLength = Math.floor((maxLength - searchTerm.length) / 2);
  let start = Math.max(0, index - contextLength);
  let end = Math.min(cleanBody.length, index + searchTerm.length + contextLength);

  // Adjust to word boundaries
  if (start > 0) {
    const spaceIndex = cleanBody.indexOf(' ', start);
    if (spaceIndex !== -1 && spaceIndex < index) {
      start = spaceIndex + 1;
    }
  }
  if (end < cleanBody.length) {
    const spaceIndex = cleanBody.lastIndexOf(' ', end);
    if (spaceIndex > index + searchTerm.length) {
      end = spaceIndex;
    }
  }

  let snippet = cleanBody.substring(start, end);

  // Add ellipsis
  if (start > 0) snippet = '...' + snippet;
  if (end < cleanBody.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Get email by ID with full details
 */
export async function getEmailById(emailId: string): Promise<{
  id: string;
  subject: string;
  body: string;
  received_at: string;
  thread_id: string | null;
  has_attachments: boolean;
  sender: { name: string | null; email: string };
  to_emails: string[];
  cc_emails: string[];
} | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('emails')
    .select(`
      *,
      sender:people!sender_id(name, email)
    `)
    .eq('id', emailId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get email: ${error.message}`);
  }

  return data;
}

/**
 * Get emails in a thread
 */
export async function getEmailsInThread(threadId: string): Promise<Array<{
  id: string;
  subject: string;
  body: string;
  received_at: string;
  sender: { name: string | null; email: string };
}>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('emails')
    .select(`
      id,
      subject,
      body,
      received_at,
      sender:people!sender_id(name, email)
    `)
    .eq('thread_id', threadId)
    .order('received_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get thread emails: ${error.message}`);
  }

  return data || [];
}

/**
 * Get recent emails from a specific person
 */
export async function getRecentEmailsFromPerson(
  email: string,
  limit: number = 10
): Promise<EmailSearchResult[]> {
  const result = await searchEmails({
    senderEmail: email,
    limit,
  });

  return result.results;
}

/**
 * Parse natural language date references
 */
export function parseRelativeDate(dateRef: string): Date | null {
  const now = new Date();
  const lowerRef = dateRef.toLowerCase().trim();

  // Today
  if (lowerRef === 'today') {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  // Yesterday
  if (lowerRef === 'yesterday') {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  // Last week
  if (lowerRef === 'last week' || lowerRef === 'this week') {
    const date = new Date(now);
    date.setDate(date.getDate() - 7);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  // Last month
  if (lowerRef === 'last month' || lowerRef === 'this month') {
    const date = new Date(now);
    date.setMonth(date.getMonth() - 1);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  // X days ago
  const daysMatch = lowerRef.match(/(\d+)\s*days?\s*ago/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  // X weeks ago
  const weeksMatch = lowerRef.match(/(\d+)\s*weeks?\s*ago/);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1], 10);
    const date = new Date(now);
    date.setDate(date.getDate() - weeks * 7);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  return null;
}
