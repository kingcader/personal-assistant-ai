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
    }
    Views: {}
    Functions: {}
    Enums: {
      task_priority: 'low' | 'med' | 'high'
      suggestion_status: 'pending' | 'approved' | 'rejected'
      task_status: 'todo' | 'in_progress' | 'completed' | 'cancelled'
    }
  }
}
