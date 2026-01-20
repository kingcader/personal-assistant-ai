-- Migration 014: Business Context + Agent Foundation
-- Provides deep business understanding for the AI agent
-- Part of Loop 9: Business Context + Agent Foundation

-- ============================================
-- ENUMS
-- ============================================

-- Project status
CREATE TYPE project_status AS ENUM (
  'active',       -- Currently being worked on
  'on_hold',      -- Paused but not cancelled
  'completed',    -- Successfully finished
  'cancelled'     -- Abandoned
);

-- SOP category
CREATE TYPE sop_category AS ENUM (
  'email',        -- Email drafting/sending
  'scheduling',   -- Calendar/meeting management
  'follow_up',    -- Follow-up procedures
  'research',     -- Information gathering
  'communication', -- General communication
  'task_management', -- Task handling
  'other'
);

-- Business rule type
CREATE TYPE rule_type AS ENUM (
  'constraint',   -- Must not do (e.g., "never schedule before 9am")
  'preference',   -- Should do if possible (e.g., "prefer morning meetings")
  'requirement'   -- Must do (e.g., "always CC Spencer on Ocho emails")
);

-- ============================================
-- PROJECTS TABLE
-- ============================================

-- Active projects/deals with status tracking
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status project_status DEFAULT 'active',

  -- Link to entity system (if project exists as entity)
  entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,

  -- Key people involved (references to entity IDs)
  key_contacts UUID[] DEFAULT '{}',

  -- Progress tracking
  milestones JSONB DEFAULT '[]',  -- [{name, target_date, completed_at, notes}]
  current_blockers TEXT[],         -- What's blocking progress
  next_steps TEXT[],               -- What needs to happen next

  -- Dates
  started_at TIMESTAMPTZ,
  target_completion TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Flexible metadata
  metadata JSONB DEFAULT '{}',     -- industry, value, priority, tags, etc.

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_entity ON projects(entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_projects_name ON projects USING gin(to_tsvector('english', name));
CREATE INDEX idx_projects_updated ON projects(updated_at DESC);

-- ============================================
-- SOPS TABLE (Standard Operating Procedures)
-- ============================================

-- Playbooks that teach the agent HOW to do things
CREATE TABLE sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category sop_category NOT NULL,

  -- When to use this SOP
  trigger_patterns TEXT[],         -- Keywords/phrases that trigger this SOP

  -- The procedure itself
  steps JSONB NOT NULL,            -- [{step_number, instruction, examples, notes}]

  -- Examples
  examples JSONB DEFAULT '[]',     -- [{input, expected_output, notes}]

  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INT DEFAULT 0,          -- Higher = used first when multiple match

  -- Usage tracking
  times_used INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sops_category ON sops(category);
CREATE INDEX idx_sops_active ON sops(is_active) WHERE is_active = true;
CREATE INDEX idx_sops_triggers ON sops USING gin(trigger_patterns);

-- ============================================
-- BUSINESS RULES TABLE
-- ============================================

-- Constraints and preferences the agent must follow
CREATE TABLE business_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  rule_type rule_type NOT NULL,

  -- Rule definition
  condition TEXT NOT NULL,         -- When this rule applies (natural language)
  action TEXT NOT NULL,            -- What to do / not do

  -- Scope (optional - can limit to specific contexts)
  applies_to_projects UUID[],      -- Specific projects, or empty for all
  applies_to_entities UUID[],      -- Specific people/orgs, or empty for all
  applies_to_categories sop_category[], -- Specific SOP types, or empty for all

  -- Priority (for conflict resolution)
  priority INT DEFAULT 0,          -- Higher = takes precedence

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Usage tracking
  times_applied INT DEFAULT 0,
  last_applied_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_rules_type ON business_rules(rule_type);
CREATE INDEX idx_rules_active ON business_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_rules_priority ON business_rules(priority DESC);

-- ============================================
-- DECISION LOG TABLE
-- ============================================

-- Record key decisions with rationale for context
CREATE TABLE decision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The decision
  decision TEXT NOT NULL,          -- What was decided
  rationale TEXT,                  -- Why this decision was made
  context TEXT,                    -- The situation/background

  -- When
  decided_at TIMESTAMPTZ DEFAULT now(),

  -- Related records
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  related_entity_ids UUID[],       -- People/orgs involved
  related_task_ids UUID[],         -- Related tasks

  -- Source
  source TEXT DEFAULT 'manual',    -- 'chat', 'manual', 'meeting', etc.
  source_reference TEXT,           -- Link to source (message ID, etc.)

  -- For superseded decisions
  supersedes_id UUID REFERENCES decision_log(id), -- If this updates a previous decision
  is_current BOOLEAN DEFAULT true, -- False if superseded by newer decision

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_decisions_project ON decision_log(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_decisions_current ON decision_log(is_current) WHERE is_current = true;
CREATE INDEX idx_decisions_decided ON decision_log(decided_at DESC);
CREATE INDEX idx_decisions_entities ON decision_log USING gin(related_entity_ids);

-- ============================================
-- PROJECT ACTIVITY LOG
-- ============================================

-- Track activity on projects for "what's happening with X" queries
CREATE TABLE project_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  activity_type TEXT NOT NULL,     -- 'email', 'task', 'meeting', 'decision', 'note', 'status_change'
  description TEXT NOT NULL,

  -- Link to source record
  source_type TEXT,                -- 'email', 'task', 'calendar_event', 'decision_log'
  source_id UUID,

  -- Who was involved
  entity_ids UUID[],

  occurred_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_project_activity_project ON project_activity(project_id);
CREATE INDEX idx_project_activity_occurred ON project_activity(occurred_at DESC);
CREATE INDEX idx_project_activity_type ON project_activity(activity_type);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update project timestamps
CREATE OR REPLACE FUNCTION update_project_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_projects_updated
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_project_timestamp();

CREATE TRIGGER trigger_sops_updated
BEFORE UPDATE ON sops
FOR EACH ROW
EXECUTE FUNCTION update_project_timestamp();

CREATE TRIGGER trigger_rules_updated
BEFORE UPDATE ON business_rules
FOR EACH ROW
EXECUTE FUNCTION update_project_timestamp();

-- Function to log project activity when decisions are made
CREATE OR REPLACE FUNCTION log_decision_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    INSERT INTO project_activity (
      project_id,
      activity_type,
      description,
      source_type,
      source_id,
      entity_ids,
      occurred_at
    ) VALUES (
      NEW.project_id,
      'decision',
      NEW.decision,
      'decision_log',
      NEW.id,
      NEW.related_entity_ids,
      NEW.decided_at
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_decision_activity
AFTER INSERT ON decision_log
FOR EACH ROW
EXECUTE FUNCTION log_decision_activity();

-- ============================================
-- VIEWS
-- ============================================

-- View: Active projects with summary
CREATE VIEW active_projects_summary AS
SELECT
  p.*,
  (SELECT COUNT(*) FROM project_activity WHERE project_id = p.id) as activity_count,
  (SELECT MAX(occurred_at) FROM project_activity WHERE project_id = p.id) as last_activity_at,
  (SELECT COUNT(*) FROM decision_log WHERE project_id = p.id AND is_current = true) as decision_count,
  e.name as entity_name
FROM projects p
LEFT JOIN entities e ON e.id = p.entity_id
WHERE p.status = 'active'
ORDER BY p.updated_at DESC;

-- View: Recent decisions
CREATE VIEW recent_decisions AS
SELECT
  d.*,
  p.name as project_name
FROM decision_log d
LEFT JOIN projects p ON p.id = d.project_id
WHERE d.is_current = true
ORDER BY d.decided_at DESC
LIMIT 50;

-- View: Active business rules
CREATE VIEW active_business_rules AS
SELECT *
FROM business_rules
WHERE is_active = true
ORDER BY priority DESC, created_at ASC;

-- View: Active SOPs by category
CREATE VIEW active_sops_by_category AS
SELECT *
FROM sops
WHERE is_active = true
ORDER BY category, priority DESC, name;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (single user)
CREATE POLICY "Allow all on projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sops" ON sops FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on business_rules" ON business_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on decision_log" ON decision_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on project_activity" ON project_activity FOR ALL USING (true) WITH CHECK (true);
