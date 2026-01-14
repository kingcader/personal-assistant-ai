-- ============================================
-- AI TASK EXTRACTION SYSTEM - SUPABASE SCHEMA
-- MVP Loop #1: Gmail → AI → Task Approvals
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CUSTOM TYPES
-- ============================================

CREATE TYPE task_priority AS ENUM ('low', 'med', 'high');
CREATE TYPE suggestion_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'completed', 'cancelled');

-- ============================================
-- CORE TABLES
-- ============================================

-- People: email senders/recipients for task ownership
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emails: Gmail messages (idempotent ingestion via gmail_message_id)
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gmail_message_id TEXT NOT NULL UNIQUE,
  thread_id TEXT,
  sender_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  to_emails TEXT[],
  cc_emails TEXT[],
  has_attachments BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suggestions: AI-generated task suggestions (pending approval)
CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  why TEXT NOT NULL,
  suggested_due_date DATE,
  suggested_owner_email TEXT NOT NULL,
  priority task_priority NOT NULL DEFAULT 'med',
  status suggestion_status NOT NULL DEFAULT 'pending',
  ai_model_used TEXT,
  ai_confidence_score NUMERIC(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'med', 'high')),
  CONSTRAINT valid_confidence CHECK (ai_confidence_score IS NULL OR (ai_confidence_score >= 0 AND ai_confidence_score <= 1)),
  UNIQUE (email_id, title, suggested_owner_email)
);

-- Tasks: approved tasks only
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE RESTRICT,
  suggestion_id UUID REFERENCES suggestions(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority task_priority NOT NULL DEFAULT 'med',
  status task_status NOT NULL DEFAULT 'todo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  CONSTRAINT valid_status CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'med', 'high'))
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-set completed_at when task status changes to 'completed'
CREATE OR REPLACE FUNCTION set_task_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status != 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_people_updated_at
  BEFORE UPDATE ON people
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emails_updated_at
  BEFORE UPDATE ON emails
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suggestions_updated_at
  BEFORE UPDATE ON suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_tasks_completed_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_task_completed_at();

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- People: email lookups
CREATE INDEX idx_people_email ON people(email);

-- Emails: idempotent ingestion
CREATE UNIQUE INDEX idx_emails_gmail_message_id ON emails(gmail_message_id);
CREATE INDEX idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX idx_emails_sender_id ON emails(sender_id);

-- Suggestions: pending queue (critical for approvals page)
CREATE INDEX idx_suggestions_email_id ON suggestions(email_id);
CREATE INDEX idx_suggestions_status_created_at ON suggestions(status, created_at DESC) WHERE status = 'pending';

-- Tasks: tasks by owner and status
CREATE INDEX idx_tasks_owner_id ON tasks(owner_id);
CREATE INDEX idx_tasks_email_id ON tasks(email_id);
CREATE INDEX idx_tasks_owner_status ON tasks(owner_id, status) WHERE status IN ('todo', 'in_progress');
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;

-- ============================================
-- SETUP COMPLETE
-- ============================================
