-- ============================================
-- LOOP #2: WAITING-ON + FOLLOW-UP ENGINE
-- Threads, Follow-up Suggestions, Audit Log
-- ============================================

-- ============================================
-- CUSTOM TYPES
-- ============================================

CREATE TYPE thread_status AS ENUM ('active', 'resolved', 'snoozed');
CREATE TYPE follow_up_status AS ENUM ('pending', 'approved', 'rejected', 'sent');
CREATE TYPE follow_up_action AS ENUM ('follow_up', 'close_loop', 'escalate');
CREATE TYPE follow_up_tone AS ENUM ('professional', 'friendly', 'urgent');
CREATE TYPE audit_actor AS ENUM ('user', 'ai', 'system');

-- ============================================
-- THREADS TABLE
-- Aggregates emails into conversation threads
-- ============================================

CREATE TABLE threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gmail_thread_id TEXT NOT NULL UNIQUE,
  subject TEXT,

  -- Participants stored as JSONB array: [{email, name, role}]
  -- role can be: 'sender', 'recipient', 'cc'
  participants JSONB DEFAULT '[]'::jsonb,

  -- Thread activity tracking
  first_message_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  last_sender_email TEXT,
  my_last_message_at TIMESTAMPTZ, -- When I (kincaidgarrett@gmail.com) last sent
  message_count INT DEFAULT 0,

  -- Waiting-on detection
  -- waiting_on_email is set when: I sent last AND no reply for 2+ days
  waiting_on_email TEXT,
  waiting_since TIMESTAMPTZ,

  -- Thread lifecycle
  status thread_status NOT NULL DEFAULT 'active',
  snooze_until TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_reason TEXT, -- 'manual', 'reply_received', 'follow_up_sent'

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_snooze CHECK (
    (status = 'snoozed' AND snooze_until IS NOT NULL) OR
    (status != 'snoozed')
  )
);

-- Add thread_id FK to emails table
ALTER TABLE emails ADD COLUMN internal_thread_id UUID REFERENCES threads(id) ON DELETE SET NULL;

-- ============================================
-- FOLLOW-UP SUGGESTIONS TABLE
-- AI-generated follow-up drafts for stalled threads
-- ============================================

CREATE TABLE follow_up_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,

  -- The suggested action type
  suggested_action follow_up_action NOT NULL DEFAULT 'follow_up',

  -- Draft content (editable before sending)
  draft_subject TEXT,
  draft_body TEXT NOT NULL,
  tone follow_up_tone NOT NULL DEFAULT 'professional',

  -- AI metadata
  ai_model_used TEXT,
  ai_reasoning TEXT, -- Why the AI suggested this follow-up

  -- Approval workflow
  status follow_up_status NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Send tracking
  sent_at TIMESTAMPTZ,
  sent_gmail_message_id TEXT, -- Reference to the sent email

  -- User edits tracking
  user_edited_subject TEXT,
  user_edited_body TEXT,
  was_edited BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUDIT LOG TABLE
-- Tracks all actions for full auditability
-- ============================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- What entity was affected
  entity_type TEXT NOT NULL, -- 'suggestion', 'task', 'follow_up', 'thread', 'email'
  entity_id UUID NOT NULL,

  -- What happened
  action TEXT NOT NULL, -- 'created', 'approved', 'rejected', 'sent', 'snoozed', 'resolved', 'updated', 'started', 'completed'

  -- Who did it
  actor audit_actor NOT NULL DEFAULT 'user',

  -- State change tracking
  previous_state JSONB, -- State before the action
  new_state JSONB,      -- State after the action

  -- Additional context
  metadata JSONB, -- Additional info: ip, user_agent, trigger_source, etc.

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_threads_updated_at
  BEFORE UPDATE ON threads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_follow_up_suggestions_updated_at
  BEFORE UPDATE ON follow_up_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- AUTO-SET TIMESTAMPS FOR STATUS CHANGES
-- ============================================

-- Auto-set resolved_at when thread status changes to 'resolved'
CREATE OR REPLACE FUNCTION set_thread_resolved_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'resolved' AND (OLD.status IS NULL OR OLD.status != 'resolved') THEN
    NEW.resolved_at = NOW();
  ELSIF NEW.status != 'resolved' THEN
    NEW.resolved_at = NULL;
    NEW.resolved_reason = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_threads_resolved_at
  BEFORE UPDATE ON threads
  FOR EACH ROW
  EXECUTE FUNCTION set_thread_resolved_at();

-- Auto-set approved_at/rejected_at on follow_up_suggestions
CREATE OR REPLACE FUNCTION set_follow_up_status_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    NEW.approved_at = NOW();
  ELSIF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
    NEW.rejected_at = NOW();
  ELSIF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
    NEW.sent_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_follow_up_suggestions_timestamps
  BEFORE UPDATE ON follow_up_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION set_follow_up_status_timestamps();

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Threads: lookup by gmail_thread_id (critical for sync)
CREATE UNIQUE INDEX idx_threads_gmail_thread_id ON threads(gmail_thread_id);

-- Threads: find waiting-on threads (critical for /waiting-on page)
CREATE INDEX idx_threads_waiting_on ON threads(waiting_on_email, waiting_since DESC)
  WHERE waiting_on_email IS NOT NULL AND status = 'active';

-- Threads: filter by status
CREATE INDEX idx_threads_status ON threads(status);

-- Threads: order by last activity
CREATE INDEX idx_threads_last_message ON threads(last_message_at DESC);

-- Threads: find snoozed threads that need to be unsnoozed
CREATE INDEX idx_threads_snooze ON threads(snooze_until)
  WHERE status = 'snoozed' AND snooze_until IS NOT NULL;

-- Emails: lookup by internal thread reference
CREATE INDEX idx_emails_internal_thread ON emails(internal_thread_id)
  WHERE internal_thread_id IS NOT NULL;

-- Follow-up suggestions: pending queue (critical for /review page)
CREATE INDEX idx_follow_ups_pending ON follow_up_suggestions(status, created_at DESC)
  WHERE status = 'pending';

-- Follow-up suggestions: by thread
CREATE INDEX idx_follow_ups_thread ON follow_up_suggestions(thread_id);

-- Audit log: lookup by entity
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);

-- Audit log: filter by action
CREATE INDEX idx_audit_action ON audit_log(action);

-- Audit log: recent entries (for activity feed)
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- Audit log: filter by actor type
CREATE INDEX idx_audit_actor ON audit_log(actor);

-- ============================================
-- HELPER VIEWS
-- ============================================

-- View: Threads I'm waiting on (for /waiting-on page)
CREATE VIEW waiting_on_threads AS
SELECT
  t.*,
  EXTRACT(DAY FROM NOW() - t.waiting_since)::INT as days_waiting,
  (
    SELECT e.body
    FROM emails e
    WHERE e.internal_thread_id = t.id
    ORDER BY e.received_at DESC
    LIMIT 1
  ) as last_message_preview
FROM threads t
WHERE t.waiting_on_email IS NOT NULL
  AND t.status = 'active'
ORDER BY t.waiting_since ASC;

-- View: Pending approvals count (for nav badges)
CREATE VIEW pending_approvals_count AS
SELECT
  (SELECT COUNT(*) FROM suggestions WHERE status = 'pending') as task_suggestions,
  (SELECT COUNT(*) FROM follow_up_suggestions WHERE status = 'pending') as follow_up_suggestions,
  (SELECT COUNT(*) FROM suggestions WHERE status = 'pending') +
  (SELECT COUNT(*) FROM follow_up_suggestions WHERE status = 'pending') as total;

-- ============================================
-- SETUP COMPLETE
-- ============================================
