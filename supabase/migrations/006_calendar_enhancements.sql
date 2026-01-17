-- ============================================
-- LOOP #4.5: CALENDAR ENHANCEMENTS
-- Task scheduling, reminders, and calendar write support
-- ============================================

-- ============================================
-- EXTEND NOTIFICATION TYPE ENUM
-- ============================================

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'reminder';

-- ============================================
-- REMINDER STATUS TYPE
-- ============================================

CREATE TYPE reminder_status AS ENUM ('pending', 'sent', 'dismissed');

-- ============================================
-- ADD SCHEDULING FIELDS TO TASKS TABLE
-- ============================================

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT FALSE;

-- Index for scheduled tasks queries
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks(scheduled_start, scheduled_end)
  WHERE is_scheduled = TRUE;

-- ============================================
-- REMINDERS TABLE
-- Supports both tasks and events
-- ============================================

CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Entity reference (either task or event)
  entity_type TEXT NOT NULL CHECK (entity_type IN ('task', 'event')),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,

  -- Reminder configuration
  minutes_before INTEGER NOT NULL,

  -- Computed reminder time (set by trigger or on insert)
  remind_at TIMESTAMPTZ NOT NULL,

  -- Status tracking
  status reminder_status DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure exactly one entity reference
  CONSTRAINT reminder_entity_check CHECK (
    (entity_type = 'task' AND task_id IS NOT NULL AND event_id IS NULL) OR
    (entity_type = 'event' AND event_id IS NOT NULL AND task_id IS NULL)
  )
);

-- ============================================
-- INDEXES FOR REMINDERS
-- ============================================

-- Find reminders by entity
CREATE INDEX IF NOT EXISTS idx_reminders_task ON reminders(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reminders_event ON reminders(event_id) WHERE event_id IS NOT NULL;

-- Find pending reminders by time (for cron job)
CREATE INDEX IF NOT EXISTS idx_reminders_pending ON reminders(remind_at, status)
  WHERE status = 'pending';

-- ============================================
-- TRIGGERS FOR REMINDERS
-- ============================================

-- Auto-update updated_at
CREATE TRIGGER set_reminders_updated_at
  BEFORE UPDATE ON reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER VIEWS
-- ============================================

-- View: Scheduled tasks (tasks with time blocks)
CREATE OR REPLACE VIEW scheduled_tasks AS
SELECT
  t.*,
  e.subject AS email_subject
FROM tasks t
LEFT JOIN emails e ON t.email_id = e.id
WHERE t.is_scheduled = TRUE
  AND t.scheduled_start IS NOT NULL
  AND t.status NOT IN ('completed', 'cancelled')
ORDER BY t.scheduled_start ASC;

-- View: Unscheduled tasks (tasks without time blocks)
CREATE OR REPLACE VIEW unscheduled_tasks AS
SELECT
  t.*,
  e.subject AS email_subject
FROM tasks t
LEFT JOIN emails e ON t.email_id = e.id
WHERE (t.is_scheduled = FALSE OR t.is_scheduled IS NULL)
  AND t.status NOT IN ('completed', 'cancelled')
ORDER BY
  CASE t.priority
    WHEN 'high' THEN 1
    WHEN 'med' THEN 2
    WHEN 'low' THEN 3
  END,
  t.due_date NULLS LAST,
  t.created_at DESC;

-- View: Due reminders (pending reminders ready to send)
CREATE OR REPLACE VIEW due_reminders AS
SELECT
  r.*,
  CASE
    WHEN r.entity_type = 'task' THEN t.title
    WHEN r.entity_type = 'event' THEN ce.summary
  END AS entity_title,
  CASE
    WHEN r.entity_type = 'task' THEN t.scheduled_start
    WHEN r.entity_type = 'event' THEN ce.start_time
  END AS entity_start_time
FROM reminders r
LEFT JOIN tasks t ON r.task_id = t.id
LEFT JOIN calendar_events ce ON r.event_id = ce.id
WHERE r.status = 'pending'
  AND r.remind_at <= NOW()
ORDER BY r.remind_at ASC;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on reminders
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Permissive policy for anon (single-user app)
CREATE POLICY "Allow all for anon" ON reminders FOR ALL USING (true);

-- ============================================
-- SETUP COMPLETE
-- ============================================
