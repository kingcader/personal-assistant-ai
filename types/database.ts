/**
 * Database Types - Auto-generated from Supabase schema
 *
 * To regenerate these types after schema changes:
 * 1. Ensure Supabase is running: npm run supabase:start
 * 2. Run: npm run supabase:types
 *
 * For now, this file contains manually defined types matching the schema.
 * Once you set up Supabase locally, replace this with auto-generated types.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      people: {
        Row: {
          id: string
          email: string
          name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      emails: {
        Row: {
          id: string
          gmail_message_id: string
          thread_id: string | null
          internal_thread_id: string | null
          sender_id: string
          subject: string
          body: string
          received_at: string
          cc_emails: string[] | null
          to_emails: string[] | null
          has_attachments: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          gmail_message_id: string
          thread_id?: string | null
          internal_thread_id?: string | null
          sender_id: string
          subject: string
          body: string
          received_at: string
          cc_emails?: string[] | null
          to_emails?: string[] | null
          has_attachments?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          gmail_message_id?: string
          thread_id?: string | null
          internal_thread_id?: string | null
          sender_id?: string
          subject?: string
          body?: string
          received_at?: string
          cc_emails?: string[] | null
          to_emails?: string[] | null
          has_attachments?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      suggestions: {
        Row: {
          id: string
          email_id: string
          title: string
          why: string
          suggested_due_date: string | null
          suggested_owner_email: string
          priority: 'low' | 'med' | 'high'
          status: 'pending' | 'approved' | 'rejected'
          ai_model_used: string | null
          ai_confidence_score: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email_id: string
          title: string
          why: string
          suggested_due_date?: string | null
          suggested_owner_email: string
          priority?: 'low' | 'med' | 'high'
          status?: 'pending' | 'approved' | 'rejected'
          ai_model_used?: string | null
          ai_confidence_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email_id?: string
          title?: string
          why?: string
          suggested_due_date?: string | null
          suggested_owner_email?: string
          priority?: 'low' | 'med' | 'high'
          status?: 'pending' | 'approved' | 'rejected'
          ai_model_used?: string | null
          ai_confidence_score?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          email_id: string
          suggestion_id: string | null
          owner_id: string
          title: string
          description: string | null
          due_date: string | null
          priority: 'low' | 'med' | 'high'
          status: 'todo' | 'in_progress' | 'completed' | 'cancelled'
          created_at: string
          updated_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          email_id: string
          suggestion_id?: string | null
          owner_id: string
          title: string
          description?: string | null
          due_date?: string | null
          priority?: 'low' | 'med' | 'high'
          status?: 'todo' | 'in_progress' | 'completed' | 'cancelled'
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          email_id?: string
          suggestion_id?: string | null
          owner_id?: string
          title?: string
          description?: string | null
          due_date?: string | null
          priority?: 'low' | 'med' | 'high'
          status?: 'todo' | 'in_progress' | 'completed' | 'cancelled'
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
      }
      threads: {
        Row: {
          id: string
          gmail_thread_id: string
          subject: string | null
          participants: ThreadParticipant[]
          first_message_at: string | null
          last_message_at: string | null
          last_sender_email: string | null
          my_last_message_at: string | null
          message_count: number
          waiting_on_email: string | null
          waiting_since: string | null
          status: 'active' | 'resolved' | 'snoozed'
          snooze_until: string | null
          resolved_at: string | null
          resolved_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          gmail_thread_id: string
          subject?: string | null
          participants?: ThreadParticipant[]
          first_message_at?: string | null
          last_message_at?: string | null
          last_sender_email?: string | null
          my_last_message_at?: string | null
          message_count?: number
          waiting_on_email?: string | null
          waiting_since?: string | null
          status?: 'active' | 'resolved' | 'snoozed'
          snooze_until?: string | null
          resolved_at?: string | null
          resolved_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          gmail_thread_id?: string
          subject?: string | null
          participants?: ThreadParticipant[]
          first_message_at?: string | null
          last_message_at?: string | null
          last_sender_email?: string | null
          my_last_message_at?: string | null
          message_count?: number
          waiting_on_email?: string | null
          waiting_since?: string | null
          status?: 'active' | 'resolved' | 'snoozed'
          snooze_until?: string | null
          resolved_at?: string | null
          resolved_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      follow_up_suggestions: {
        Row: {
          id: string
          thread_id: string
          suggested_action: 'follow_up' | 'close_loop' | 'escalate'
          draft_subject: string | null
          draft_body: string
          tone: 'professional' | 'friendly' | 'urgent'
          ai_model_used: string | null
          ai_reasoning: string | null
          status: 'pending' | 'approved' | 'rejected' | 'sent'
          approved_at: string | null
          rejected_at: string | null
          rejection_reason: string | null
          sent_at: string | null
          sent_gmail_message_id: string | null
          user_edited_subject: string | null
          user_edited_body: string | null
          was_edited: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          thread_id: string
          suggested_action?: 'follow_up' | 'close_loop' | 'escalate'
          draft_subject?: string | null
          draft_body: string
          tone?: 'professional' | 'friendly' | 'urgent'
          ai_model_used?: string | null
          ai_reasoning?: string | null
          status?: 'pending' | 'approved' | 'rejected' | 'sent'
          approved_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          sent_gmail_message_id?: string | null
          user_edited_subject?: string | null
          user_edited_body?: string | null
          was_edited?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          thread_id?: string
          suggested_action?: 'follow_up' | 'close_loop' | 'escalate'
          draft_subject?: string | null
          draft_body?: string
          tone?: 'professional' | 'friendly' | 'urgent'
          ai_model_used?: string | null
          ai_reasoning?: string | null
          status?: 'pending' | 'approved' | 'rejected' | 'sent'
          approved_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          sent_gmail_message_id?: string | null
          user_edited_subject?: string | null
          user_edited_body?: string | null
          was_edited?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      audit_log: {
        Row: {
          id: string
          entity_type: string
          entity_id: string
          action: string
          actor: 'user' | 'ai' | 'system'
          previous_state: Json | null
          new_state: Json | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          entity_type: string
          entity_id: string
          action: string
          actor?: 'user' | 'ai' | 'system'
          previous_state?: Json | null
          new_state?: Json | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          entity_type?: string
          entity_id?: string
          action?: string
          actor?: 'user' | 'ai' | 'system'
          previous_state?: Json | null
          new_state?: Json | null
          metadata?: Json | null
          created_at?: string
        }
      }
    }
    Views: {
      waiting_on_threads: {
        Row: {
          id: string
          gmail_thread_id: string
          subject: string | null
          participants: ThreadParticipant[]
          last_message_at: string | null
          last_sender_email: string | null
          waiting_on_email: string | null
          waiting_since: string | null
          status: 'active' | 'resolved' | 'snoozed'
          days_waiting: number
          last_message_preview: string | null
        }
      }
      pending_approvals_count: {
        Row: {
          task_suggestions: number
          follow_up_suggestions: number
          total: number
        }
      }
    }
    Functions: {}
    Enums: {
      task_priority: 'low' | 'med' | 'high'
      suggestion_status: 'pending' | 'approved' | 'rejected'
      task_status: 'todo' | 'in_progress' | 'completed' | 'cancelled'
      thread_status: 'active' | 'resolved' | 'snoozed'
      follow_up_status: 'pending' | 'approved' | 'rejected' | 'sent'
      follow_up_action: 'follow_up' | 'close_loop' | 'escalate'
      follow_up_tone: 'professional' | 'friendly' | 'urgent'
      audit_actor: 'user' | 'ai' | 'system'
    }
  }
}

// Helper types for JSONB fields
export interface ThreadParticipant {
  email: string
  name?: string
  role: 'sender' | 'recipient' | 'cc'
}

// Convenience type aliases
export type Thread = Database['public']['Tables']['threads']['Row']
export type ThreadInsert = Database['public']['Tables']['threads']['Insert']
export type ThreadUpdate = Database['public']['Tables']['threads']['Update']

export type FollowUpSuggestion = Database['public']['Tables']['follow_up_suggestions']['Row']
export type FollowUpSuggestionInsert = Database['public']['Tables']['follow_up_suggestions']['Insert']
export type FollowUpSuggestionUpdate = Database['public']['Tables']['follow_up_suggestions']['Update']

export type AuditLog = Database['public']['Tables']['audit_log']['Row']
export type AuditLogInsert = Database['public']['Tables']['audit_log']['Insert']

export type WaitingOnThread = Database['public']['Views']['waiting_on_threads']['Row']
export type PendingApprovalsCount = Database['public']['Views']['pending_approvals_count']['Row']
