/**
 * Database Query Functions
 *
 * Typed query functions for the Personal Assistant AI system.
 * All queries are idempotent and support the MVP approval workflow.
 */

import { supabase } from './client';
import type { Database } from '@/types/database';

type Tables = Database['public']['Tables'];
type Suggestion = Tables['suggestions']['Row'];
type Task = Tables['tasks']['Row'];
type Person = Tables['people']['Row'];
type Email = Tables['emails']['Row'];

/**
 * Pending Suggestion with Email Context
 * Used in the Approvals UI
 */
export interface PendingSuggestion extends Suggestion {
  email: {
    id: string;
    subject: string;
    received_at: string;
    sender: {
      name: string | null;
      email: string;
    };
  };
}

/**
 * Get all pending suggestions with email context
 * Primary query for the Approvals page
 */
export async function getPendingSuggestions(): Promise<PendingSuggestion[]> {
  const { data, error } = await supabase
    .from('suggestions')
    .select(`
      *,
      email:emails!inner(
        id,
        subject,
        received_at,
        sender:people!sender_id(name, email)
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending suggestions:', error);
    throw new Error(`Failed to fetch pending suggestions: ${error.message}`);
  }

  return data as PendingSuggestion[];
}

/**
 * Approve a suggestion and create a task
 * Supports inline edits before approval
 */
export async function approveSuggestion(
  suggestionId: string,
  edits?: {
    title?: string;
    description?: string;
    due_date?: string | null;
    priority?: 'low' | 'med' | 'high';
  }
): Promise<Task> {
  // 1. Fetch suggestion with email and owner
  const { data: suggestion, error: suggestionError } = await supabase
    .from('suggestions')
    .select(`
      *,
      email:emails!inner(id)
    `)
    .eq('id', suggestionId)
    .eq('status', 'pending') // Ensure still pending
    .single();

  if (suggestionError || !suggestion) {
    throw new Error('Suggestion not found or already processed');
  }

  // 2. Ensure owner exists in people table (upsert)
  const { data: owner, error: ownerError } = await supabase
    .from('people')
    .upsert(
      {
        email: suggestion.suggested_owner_email,
        // Name will be updated if already exists, or set to null if new
      },
      {
        onConflict: 'email',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (ownerError || !owner) {
    throw new Error(`Failed to create/find owner: ${ownerError?.message}`);
  }

  // 3. Create task from suggestion (with optional edits)
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert({
      email_id: suggestion.email_id,
      suggestion_id: suggestion.id,
      owner_id: owner.id,
      title: edits?.title ?? suggestion.title,
      description: edits?.description ?? suggestion.why,
      due_date: edits?.due_date ?? suggestion.suggested_due_date,
      priority: edits?.priority ?? suggestion.priority,
      status: 'todo',
    })
    .select()
    .single();

  if (taskError || !task) {
    throw new Error(`Failed to create task: ${taskError?.message}`);
  }

  // 4. Update suggestion status to 'approved'
  const { error: updateError } = await supabase
    .from('suggestions')
    .update({ status: 'approved' })
    .eq('id', suggestionId)
    .eq('status', 'pending'); // Optimistic lock

  if (updateError) {
    // Task was created but suggestion wasn't updated - log warning but return task
    console.warn('Task created but suggestion update failed:', updateError);
  }

  return task;
}

/**
 * Reject a suggestion
 * Marks suggestion as rejected (no task created)
 */
export async function rejectSuggestion(suggestionId: string): Promise<void> {
  const { error } = await supabase
    .from('suggestions')
    .update({ status: 'rejected' })
    .eq('id', suggestionId)
    .eq('status', 'pending'); // Only reject if still pending

  if (error) {
    throw new Error(`Failed to reject suggestion: ${error.message}`);
  }
}

/**
 * Get tasks by owner email
 * Useful for "my tasks" view (future)
 */
export async function getTasksByOwner(
  ownerEmail: string,
  includeCompleted: boolean = false
): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    .select(`
      *,
      owner:people!owner_id(name, email),
      email:emails(subject, received_at)
    `)
    .eq('people.email', ownerEmail);

  if (!includeCompleted) {
    query = query.in('status', ['todo', 'in_progress']);
  }

  query = query.order('due_date', { ascending: true, nullsFirst: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch tasks: ${error.message}`);
  }

  return data as Task[];
}

/**
 * Update task status
 * Used for marking tasks as in_progress, completed, etc.
 */
export async function updateTaskStatus(
  taskId: string,
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled'
): Promise<Task> {
  const updateData: {
    status: typeof status;
    updated_at: string;
    completed_at: string | null;
  } = {
    status,
    updated_at: new Date().toISOString(),
    completed_at: status === 'completed' ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update task: ${error.message}`);
  }

  if (!data) {
    throw new Error('Task not found');
  }

  return data;
}

/**
 * Get all people (for owner dropdown in edits)
 */
export async function getAllPeople(): Promise<Person[]> {
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .order('email', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch people: ${error.message}`);
  }

  return data;
}

/**
 * Idempotent email ingestion
 * Used by N8N workflow to insert emails safely
 */
export async function upsertEmail(emailData: {
  gmail_message_id: string;
  thread_id?: string | null;
  sender_email: string;
  sender_name?: string | null;
  subject: string;
  body: string;
  received_at: string;
  to_emails?: string[];
  cc_emails?: string[];
  has_attachments?: boolean;
}): Promise<{ email: Email; isNew: boolean }> {
  // Check if email already exists (idempotency)
  const { data: existing } = await supabase
    .from('emails')
    .select('id')
    .eq('gmail_message_id', emailData.gmail_message_id)
    .single();

  if (existing) {
    // Email already processed
    const { data: email } = await supabase
      .from('emails')
      .select('*')
      .eq('id', existing.id)
      .single();
    return { email: email!, isNew: false };
  }

  // Upsert sender into people table
  const { data: sender, error: senderError } = await supabase
    .from('people')
    .upsert(
      {
        email: emailData.sender_email,
        name: emailData.sender_name || null,
      },
      { onConflict: 'email' }
    )
    .select()
    .single();

  if (senderError || !sender) {
    throw new Error(`Failed to create/find sender: ${senderError?.message}`);
  }

  // Insert email
  const { data: email, error: emailError } = await supabase
    .from('emails')
    .insert({
      gmail_message_id: emailData.gmail_message_id,
      thread_id: emailData.thread_id || null,
      sender_id: sender.id,
      subject: emailData.subject,
      body: emailData.body,
      received_at: emailData.received_at,
      to_emails: emailData.to_emails || [],
      cc_emails: emailData.cc_emails || [],
      has_attachments: emailData.has_attachments || false,
    })
    .select()
    .single();

  if (emailError || !email) {
    throw new Error(`Failed to insert email: ${emailError?.message}`);
  }

  return { email, isNew: true };
}

// Kincaid's email - the ONLY person tasks should be assigned to
const KINCAID_EMAIL = 'kincaidgarrett@gmail.com';

/**
 * Insert AI-generated suggestions
 * Used by N8N workflow after AI extraction
 * IMPORTANT: Only inserts suggestions for Kincaid (filters out any others)
 */
export async function insertSuggestions(
  emailId: string,
  suggestions: Array<{
    title: string;
    why: string;
    suggested_due_date: string | null;
    suggested_owner_email: string;
    priority: 'low' | 'med' | 'high';
  }>,
  aiModelUsed?: string
): Promise<Suggestion[]> {
  // SAFETY FILTER: Only keep suggestions assigned to Kincaid
  const kincaidSuggestions = suggestions.filter((s) => {
    const isForKincaid = s.suggested_owner_email.toLowerCase() === KINCAID_EMAIL.toLowerCase();
    if (!isForKincaid) {
      console.log(`⚠️ Filtered out suggestion for ${s.suggested_owner_email}: "${s.title}"`);
    }
    return isForKincaid;
  });

  if (kincaidSuggestions.length === 0) {
    console.log('📭 No suggestions for Kincaid in this batch');
    return [];
  }

  const { data, error } = await supabase
    .from('suggestions')
    .insert(
      kincaidSuggestions.map((s) => ({
        email_id: emailId,
        title: s.title,
        why: s.why,
        suggested_due_date: s.suggested_due_date,
        suggested_owner_email: s.suggested_owner_email,
        priority: s.priority,
        status: 'pending' as const,
        ai_model_used: aiModelUsed || null,
      }))
    )
    .select();

  if (error) {
    throw new Error(`Failed to insert suggestions: ${error.message}`);
  }

  return data;
}
