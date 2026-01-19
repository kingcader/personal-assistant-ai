-- Migration 011: Entity System
-- Tracks people, organizations, projects, and their relationships
-- Part of Loop 6: Entity System + Chat Intelligence

-- ============================================
-- ENUMS
-- ============================================

-- Entity types
CREATE TYPE entity_type AS ENUM ('person', 'organization', 'project', 'deal');

-- Relationship types between entities
CREATE TYPE relationship_type AS ENUM (
  'works_at',      -- person → organization
  'owns',          -- person → organization
  'client_of',     -- organization → user (or org → org)
  'vendor_of',     -- organization → user (or org → org)
  'involved_in',   -- person → project/deal
  'related_to'     -- generic relationship
);

-- ============================================
-- ENTITIES TABLE
-- ============================================

-- Main entities table - people, orgs, projects, deals
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type entity_type NOT NULL,
  name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',           -- Alternative names ["Jen", "Jennifer", "J. Smith"]
  email TEXT,                            -- Primary email (for people)
  description TEXT,                      -- AI-generated summary of who/what this is
  metadata JSONB DEFAULT '{}',           -- Flexible: role, industry, status, etc.
  first_seen_at TIMESTAMPTZ,             -- When we first encountered this entity
  last_seen_at TIMESTAMPTZ,              -- Most recent mention
  mention_count INT DEFAULT 0,           -- How often they appear
  is_important BOOLEAN DEFAULT false,    -- User-marked as key entity
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common lookups
CREATE INDEX idx_entities_type ON entities(type);
CREATE INDEX idx_entities_name ON entities USING gin(to_tsvector('english', name));
CREATE INDEX idx_entities_email ON entities(email) WHERE email IS NOT NULL;
CREATE INDEX idx_entities_aliases ON entities USING gin(aliases);
CREATE INDEX idx_entities_important ON entities(is_important) WHERE is_important = true;
CREATE INDEX idx_entities_last_seen ON entities(last_seen_at DESC NULLS LAST);

-- ============================================
-- ENTITY RELATIONSHIPS
-- ============================================

-- Relationships between entities
CREATE TABLE entity_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relationship_type relationship_type NOT NULL,
  confidence FLOAT DEFAULT 1.0,          -- AI extraction confidence (0-1)
  metadata JSONB DEFAULT '{}',           -- Additional context
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate relationships
  UNIQUE(source_entity_id, target_entity_id, relationship_type)
);

-- Indexes for relationship queries
CREATE INDEX idx_entity_rel_source ON entity_relationships(source_entity_id);
CREATE INDEX idx_entity_rel_target ON entity_relationships(target_entity_id);
CREATE INDEX idx_entity_rel_type ON entity_relationships(relationship_type);

-- ============================================
-- ENTITY MENTIONS
-- ============================================

-- Link entities to source records (emails, tasks, events, documents)
CREATE TABLE entity_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,             -- 'email', 'task', 'calendar_event', 'kb_document'
  source_id UUID NOT NULL,               -- ID of the source record
  context TEXT,                          -- Snippet where entity was mentioned
  confidence FLOAT DEFAULT 1.0,          -- AI extraction confidence
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate mentions
  UNIQUE(entity_id, source_type, source_id)
);

-- Indexes for mention queries
CREATE INDEX idx_entity_mentions_entity ON entity_mentions(entity_id);
CREATE INDEX idx_entity_mentions_source ON entity_mentions(source_type, source_id);
CREATE INDEX idx_entity_mentions_type ON entity_mentions(source_type);

-- ============================================
-- ENTITY PROCESSING TRACKING
-- ============================================

-- Track which records have been processed for entity extraction
CREATE TABLE entity_processing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,             -- 'email', 'task', 'calendar_event', 'kb_document'
  source_id UUID NOT NULL,               -- ID of the source record
  processed_at TIMESTAMPTZ DEFAULT now(),
  entities_found INT DEFAULT 0,          -- Number of entities extracted
  relationships_found INT DEFAULT 0,     -- Number of relationships extracted
  error TEXT,                            -- Error message if processing failed

  -- One processing record per source
  UNIQUE(source_type, source_id)
);

CREATE INDEX idx_entity_processing_source ON entity_processing_log(source_type, source_id);

-- ============================================
-- LINK EXISTING TABLES
-- ============================================

-- Link people table to entities (for email senders/recipients)
ALTER TABLE people ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES entities(id);
CREATE INDEX IF NOT EXISTS idx_people_entity ON people(entity_id) WHERE entity_id IS NOT NULL;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update entity timestamps and mention count
CREATE OR REPLACE FUNCTION update_entity_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_seen_at and increment mention_count
  UPDATE entities
  SET
    last_seen_at = now(),
    mention_count = mention_count + 1,
    updated_at = now()
  WHERE id = NEW.entity_id;

  -- If first_seen_at is null, set it
  UPDATE entities
  SET first_seen_at = now()
  WHERE id = NEW.entity_id AND first_seen_at IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update entity stats when mentions are added
CREATE TRIGGER trigger_entity_mention_stats
AFTER INSERT ON entity_mentions
FOR EACH ROW
EXECUTE FUNCTION update_entity_stats();

-- Function to find entity by name or alias (case-insensitive)
CREATE OR REPLACE FUNCTION find_entity_by_name(search_name TEXT)
RETURNS TABLE(
  id UUID,
  type entity_type,
  name TEXT,
  aliases TEXT[],
  email TEXT,
  match_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.type,
    e.name,
    e.aliases,
    e.email,
    CASE
      WHEN lower(e.name) = lower(search_name) THEN 'exact_name'
      WHEN lower(search_name) = ANY(SELECT lower(unnest(e.aliases))) THEN 'alias'
      WHEN lower(e.email) = lower(search_name) THEN 'email'
      WHEN lower(e.name) ILIKE '%' || lower(search_name) || '%' THEN 'partial_name'
      ELSE 'fuzzy'
    END as match_type
  FROM entities e
  WHERE
    lower(e.name) = lower(search_name)
    OR lower(search_name) = ANY(SELECT lower(unnest(e.aliases)))
    OR lower(e.email) = lower(search_name)
    OR lower(e.name) ILIKE '%' || lower(search_name) || '%'
  ORDER BY
    CASE
      WHEN lower(e.name) = lower(search_name) THEN 1
      WHEN lower(search_name) = ANY(SELECT lower(unnest(e.aliases))) THEN 2
      WHEN lower(e.email) = lower(search_name) THEN 3
      ELSE 4
    END,
    e.mention_count DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS
-- ============================================

-- View: Entities with relationship counts
CREATE VIEW entity_summary AS
SELECT
  e.*,
  (SELECT COUNT(*) FROM entity_relationships WHERE source_entity_id = e.id OR target_entity_id = e.id) as relationship_count,
  (SELECT COUNT(*) FROM entity_mentions WHERE entity_id = e.id) as actual_mention_count
FROM entities e;

-- View: Recent entity activity
CREATE VIEW recent_entity_activity AS
SELECT
  e.id as entity_id,
  e.name as entity_name,
  e.type as entity_type,
  em.source_type,
  em.source_id,
  em.context,
  em.created_at
FROM entity_mentions em
JOIN entities e ON e.id = em.entity_id
ORDER BY em.created_at DESC
LIMIT 100;

-- ============================================
-- RLS POLICIES (for future multi-user support)
-- ============================================

-- Enable RLS
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_processing_log ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (single user)
CREATE POLICY "Allow all on entities" ON entities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on entity_relationships" ON entity_relationships FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on entity_mentions" ON entity_mentions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on entity_processing_log" ON entity_processing_log FOR ALL USING (true) WITH CHECK (true);
