-- ============================================
-- LOOP #4: AI-POWERED PRODUCTIVITY CALENDAR
-- Calendar Events, Meeting Prep Packets, Scheduling Suggestions
-- ============================================

-- ============================================
-- EXTEND NOTIFICATION TYPE ENUM
-- ============================================

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'calendar_event';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'meeting_prep';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'scheduling_suggestion';

-- ============================================
-- CUSTOM TYPES FOR CALENDAR
-- ============================================

CREATE TYPE calendar_event_status AS ENUM ('confirmed', 'tentative', 'cancelled');
CREATE TYPE scheduling_suggestion_status AS ENUM ('pending', 'accepted', 'dismissed');

-- ============================================
-- CALENDAR EVENTS TABLE
-- Synced from Google Calendar
-- ============================================

CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Google Calendar identifiers
  google_event_id TEXT UNIQUE NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',

  -- Event details
  summary TEXT,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT FALSE,

  -- Participants
  attendees JSONB DEFAULT '[]'::jsonb,
  -- attendees: [{ email, name, responseStatus, organizer, self }]

  organizer JSONB,
  -- organizer: { email, name, self }

  -- Location and meeting
  location TEXT,
  meeting_link TEXT,

  -- Status tracking
  status calendar_event_status DEFAULT 'confirmed',
  recurring_event_id TEXT, -- If this is an instance of a recurring event

  -- Sync metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MEETING PREP PACKETS TABLE
-- AI-generated context and talking points for meetings
-- ============================================

CREATE TABLE meeting_prep_packets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,

  -- Prep packet content as JSONB
  -- Structure:
  -- {
  --   meeting: { summary, time, attendees, location },
  --   related_tasks: [{ id, title, status, priority, due_date }],
  --   related_emails: [{ id, subject, from, snippet, date, thread_id }],
  --   waiting_on: [{ thread_id, subject, days_waiting, waiting_on_email }],
  --   talking_points: string[],
  --   ai_summary: string,
  --   attendee_context: { [email]: { recent_interactions, open_items } }
  -- }
  content JSONB NOT NULL,

  -- AI generation metadata
  ai_model_used TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Allow regeneration tracking
  regenerated_count INTEGER DEFAULT 0,
  last_regenerated_at TIMESTAMPTZ,

  -- Ensure one prep packet per event (latest wins)
  UNIQUE(event_id)
);

-- ============================================
-- SCHEDULING SUGGESTIONS TABLE
-- AI suggestions for when to work on tasks
-- ============================================

CREATE TABLE scheduling_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,

  -- Suggested time block
  suggested_start TIMESTAMPTZ NOT NULL,
  suggested_end TIMESTAMPTZ NOT NULL,

  -- AI reasoning
  reason TEXT NOT NULL,
  -- e.g., "2-hour gap before your 4pm meeting, good for focused work"

  -- Suggestion details
  estimated_duration_minutes INTEGER,
  confidence_score NUMERIC(3, 2), -- 0.00 to 1.00

  -- Status tracking
  status scheduling_suggestion_status DEFAULT 'pending',

  -- When user interacts with suggestion
  accepted_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  -- AI metadata
  ai_model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Allow multiple suggestions per task over time
  -- but typically show only the most recent pending one
  CONSTRAINT valid_time_range CHECK (suggested_end > suggested_start)
);

-- ============================================
-- CALENDAR SYNC STATE TABLE
-- Track sync progress and errors
-- ============================================

CREATE TABLE calendar_sync_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  calendar_id TEXT NOT NULL DEFAULT 'primary',

  -- Sync status
  last_sync_at TIMESTAMPTZ,
  last_sync_success BOOLEAN DEFAULT TRUE,
  last_sync_error TEXT,

  -- Sync token for incremental updates (Google Calendar API feature)
  sync_token TEXT,

  -- Stats
  events_synced_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(calendar_id)
);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

-- Auto-update updated_at for calendar_events
CREATE TRIGGER set_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for calendar_sync_state
CREATE TRIGGER set_calendar_sync_state_updated_at
  BEFORE UPDATE ON calendar_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Calendar events: time-based queries
CREATE INDEX idx_calendar_events_start ON calendar_events(start_time);
CREATE INDEX idx_calendar_events_end ON calendar_events(end_time);
CREATE INDEX idx_calendar_events_range ON calendar_events(start_time, end_time);

-- Calendar events: lookup by Google ID
CREATE INDEX idx_calendar_events_google_id ON calendar_events(google_event_id);

-- Calendar events: filter by status (skip cancelled events in most queries)
CREATE INDEX idx_calendar_events_status ON calendar_events(status)
  WHERE status = 'confirmed';

-- Calendar events: find events with specific attendees
CREATE INDEX idx_calendar_events_attendees ON calendar_events USING gin(attendees);

-- Meeting prep packets: lookup by event
CREATE INDEX idx_prep_packets_event ON meeting_prep_packets(event_id);

-- Meeting prep packets: recent packets for dashboard
CREATE INDEX idx_prep_packets_generated ON meeting_prep_packets(generated_at DESC);

-- Scheduling suggestions: lookup by task
CREATE INDEX idx_scheduling_suggestions_task ON scheduling_suggestions(task_id);

-- Scheduling suggestions: pending suggestions (for display)
CREATE INDEX idx_scheduling_suggestions_pending ON scheduling_suggestions(status, suggested_start)
  WHERE status = 'pending';

-- Scheduling suggestions: time-based queries
CREATE INDEX idx_scheduling_suggestions_time ON scheduling_suggestions(suggested_start, suggested_end);

-- ============================================
-- HELPER VIEWS
-- ============================================

-- View: Upcoming events with prep status
CREATE VIEW upcoming_events_with_prep AS
SELECT
  ce.*,
  mpp.id AS prep_packet_id,
  mpp.generated_at AS prep_generated_at,
  CASE WHEN mpp.id IS NOT NULL THEN TRUE ELSE FALSE END AS has_prep_packet
FROM calendar_events ce
LEFT JOIN meeting_prep_packets mpp ON ce.id = mpp.event_id
WHERE ce.start_time > NOW()
  AND ce.status = 'confirmed'
ORDER BY ce.start_time ASC;

-- View: Today's calendar (events + tasks due today)
CREATE VIEW todays_calendar AS
SELECT
  'event' AS item_type,
  ce.id::text AS item_id,
  ce.summary AS title,
  ce.start_time AS start_time,
  ce.end_time AS end_time,
  ce.all_day,
  NULL AS priority,
  ce.status::text AS status,
  ce.meeting_link,
  ce.location,
  (SELECT COUNT(*) FROM meeting_prep_packets WHERE event_id = ce.id) > 0 AS has_prep
FROM calendar_events ce
WHERE DATE(ce.start_time) = CURRENT_DATE
  AND ce.status = 'confirmed'

UNION ALL

SELECT
  'task' AS item_type,
  t.id::text AS item_id,
  t.title,
  t.due_date AS start_time,
  t.due_date AS end_time,
  TRUE AS all_day, -- Tasks are treated as all-day items
  t.priority::text AS priority,
  t.status::text AS status,
  NULL AS meeting_link,
  NULL AS location,
  FALSE AS has_prep
FROM tasks t
WHERE DATE(t.due_date) = CURRENT_DATE
  AND t.status NOT IN ('completed', 'cancelled')

ORDER BY all_day DESC, start_time ASC;

-- View: Pending scheduling suggestions
CREATE VIEW pending_scheduling_suggestions AS
SELECT
  ss.*,
  t.title AS task_title,
  t.priority AS task_priority,
  t.due_date AS task_due_date
FROM scheduling_suggestions ss
JOIN tasks t ON ss.task_id = t.id
WHERE ss.status = 'pending'
  AND ss.suggested_start > NOW()
  AND t.status NOT IN ('completed', 'cancelled')
ORDER BY ss.suggested_start ASC;

-- View: Events needing prep packets (meetings with attendees in next 24 hours)
CREATE VIEW events_needing_prep AS
SELECT ce.*
FROM calendar_events ce
LEFT JOIN meeting_prep_packets mpp ON ce.id = mpp.event_id
WHERE ce.start_time > NOW()
  AND ce.start_time < NOW() + INTERVAL '24 hours'
  AND ce.status = 'confirmed'
  AND jsonb_array_length(ce.attendees) > 0
  AND mpp.id IS NULL
ORDER BY ce.start_time ASC;

-- ============================================
-- ROW LEVEL SECURITY (if needed later)
-- Currently single-user, but ready for expansion
-- ============================================

-- Enable RLS on all new tables
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_prep_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync_state ENABLE ROW LEVEL SECURITY;

-- Permissive policies for anon (single-user app)
CREATE POLICY "Allow all for anon" ON calendar_events FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON meeting_prep_packets FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON scheduling_suggestions FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON calendar_sync_state FOR ALL USING (true);

-- ============================================
-- SETUP COMPLETE
-- ============================================
