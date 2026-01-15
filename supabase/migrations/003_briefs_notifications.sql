-- ============================================
-- LOOP #3: DAILY BRIEFS + PUSH NOTIFICATIONS
-- Daily Briefs, Notifications, Push Subscriptions
-- ============================================

-- ============================================
-- CUSTOM TYPES
-- ============================================

CREATE TYPE brief_type AS ENUM ('morning', 'evening');
CREATE TYPE notification_type AS ENUM ('task_suggestion', 'follow_up', 'waiting_on', 'morning_brief', 'evening_brief');

-- ============================================
-- DAILY BRIEFS TABLE
-- Stores generated morning/evening reports
-- ============================================

CREATE TABLE daily_briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  type brief_type NOT NULL,

  -- Brief content as JSONB for flexibility
  -- Structure varies by type:
  -- Morning: { tasks_due_today, pending_suggestions, waiting_on_threads, pending_follow_ups, summary }
  -- Evening: { tasks_completed_today, tasks_pending, follow_ups_sent, activity_summary }
  content JSONB NOT NULL,

  -- AI generation metadata
  ai_model_used TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure only one brief per date per type
  UNIQUE(date, type)
);

-- ============================================
-- NOTIFICATIONS TABLE
-- Tracks all notifications (push, in-app, etc.)
-- ============================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type notification_type NOT NULL,

  -- Notification content
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT, -- URL to navigate to when clicked

  -- Related entities (optional, for context)
  related_entity_type TEXT, -- 'suggestion', 'thread', 'follow_up', 'brief'
  related_entity_id UUID,

  -- Read status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Push delivery status
  push_sent BOOLEAN DEFAULT FALSE,
  push_sent_at TIMESTAMPTZ,
  push_error TEXT, -- Error message if push failed

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PUSH SUBSCRIPTIONS TABLE
-- Stores Web Push API subscriptions for each device
-- ============================================

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Web Push subscription data
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL, -- { p256dh: string, auth: string }

  -- Device info for management
  user_agent TEXT,
  device_name TEXT, -- Optional friendly name like "iPhone", "Laptop Chrome"

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ, -- Updated when a push is successfully sent

  -- Validity - subscription can expire or be revoked
  is_active BOOLEAN DEFAULT TRUE
);

-- ============================================
-- TRIGGERS FOR READ STATUS
-- ============================================

-- Auto-set read_at when notification is marked as read
CREATE OR REPLACE FUNCTION set_notification_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.read = TRUE AND (OLD.read IS NULL OR OLD.read = FALSE) THEN
    NEW.read_at = NOW();
  ELSIF NEW.read = FALSE THEN
    NEW.read_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_notifications_read_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION set_notification_read_at();

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Daily briefs: lookup by date and type
CREATE INDEX idx_briefs_date ON daily_briefs(date DESC);
CREATE INDEX idx_briefs_date_type ON daily_briefs(date, type);

-- Notifications: unread notifications (for badge count)
CREATE INDEX idx_notifications_unread ON notifications(read, created_at DESC)
  WHERE read = FALSE;

-- Notifications: filter by type
CREATE INDEX idx_notifications_type ON notifications(type);

-- Notifications: recent notifications (for dropdown)
CREATE INDEX idx_notifications_recent ON notifications(created_at DESC);

-- Notifications: related entity lookup
CREATE INDEX idx_notifications_entity ON notifications(related_entity_type, related_entity_id)
  WHERE related_entity_id IS NOT NULL;

-- Push subscriptions: active endpoints
CREATE INDEX idx_push_active ON push_subscriptions(is_active)
  WHERE is_active = TRUE;

-- Push subscriptions: cleanup old subscriptions
CREATE INDEX idx_push_last_used ON push_subscriptions(last_used_at);

-- ============================================
-- HELPER VIEWS
-- ============================================

-- View: Unread notification count (for bell badge)
CREATE VIEW unread_notification_count AS
SELECT COUNT(*) as count
FROM notifications
WHERE read = FALSE;

-- View: Recent notifications (for dropdown, limit 20)
CREATE VIEW recent_notifications AS
SELECT *
FROM notifications
ORDER BY created_at DESC
LIMIT 20;

-- View: Today's brief (for quick access)
CREATE VIEW todays_briefs AS
SELECT *
FROM daily_briefs
WHERE date = CURRENT_DATE
ORDER BY type;

-- ============================================
-- SETUP COMPLETE
-- ============================================
