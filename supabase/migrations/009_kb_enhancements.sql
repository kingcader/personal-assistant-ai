-- ============================================
-- Migration 009: Knowledge Base Enhancements
-- Document Prioritization, Summaries, and Website Analysis
-- Part of Loop #5.5
-- ============================================

-- ============================================
-- PHASE 1: DOCUMENT PRIORITIZATION
-- ============================================

-- Add processing priority (higher = process first)
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS processing_priority INTEGER DEFAULT 0;

-- Index for efficient priority queries
CREATE INDEX IF NOT EXISTS idx_kb_documents_priority ON kb_documents(processing_priority DESC, created_at ASC)
  WHERE status = 'pending';

-- Recreate pending view with priority ordering
DROP VIEW IF EXISTS kb_documents_pending;
CREATE VIEW kb_documents_pending AS
SELECT
  d.*,
  f.folder_name,
  f.truth_priority AS folder_truth_priority
FROM kb_documents d
LEFT JOIN kb_folders f ON d.folder_id = f.id
WHERE d.status = 'pending'
ORDER BY d.processing_priority DESC, d.created_at ASC;

-- ============================================
-- PHASE 2: DOCUMENT SUMMARIES
-- ============================================

-- Add summary fields
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMPTZ;

-- Drop existing function first (return type is changing)
DROP FUNCTION IF EXISTS match_kb_chunks(vector(1536), FLOAT, INT, kb_truth_priority);

-- Update match_kb_chunks function to return summary
CREATE OR REPLACE FUNCTION match_kb_chunks(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_truth_priority kb_truth_priority DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  section_title TEXT,
  similarity FLOAT,
  truth_priority kb_truth_priority,
  file_name TEXT,
  file_path TEXT,
  drive_file_id TEXT,
  summary TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.content,
    c.section_title,
    1 - (c.embedding <=> query_embedding) AS similarity,
    c.truth_priority,
    d.file_name,
    d.file_path,
    d.drive_file_id,
    d.summary
  FROM kb_chunks c
  JOIN kb_documents d ON c.document_id = d.id
  WHERE
    d.status = 'indexed'
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
    AND (filter_truth_priority IS NULL OR c.truth_priority = filter_truth_priority)
  ORDER BY
    -- Boost authoritative and high priority documents
    CASE c.truth_priority
      WHEN 'authoritative' THEN (1 - (c.embedding <=> query_embedding)) * 1.5
      WHEN 'high' THEN (1 - (c.embedding <=> query_embedding)) * 1.25
      ELSE 1 - (c.embedding <=> query_embedding)
    END DESC
  LIMIT match_count;
END;
$$;

-- ============================================
-- PHASE 3: WEBSITE ANALYSIS
-- ============================================

-- Websites to monitor
CREATE TABLE IF NOT EXISTS kb_websites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  max_depth INTEGER DEFAULT 2,
  max_pages INTEGER DEFAULT 50,
  status TEXT DEFAULT 'pending',
  last_crawl_at TIMESTAMPTZ,
  page_count INTEGER DEFAULT 0,
  crawl_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for website status queries
CREATE INDEX IF NOT EXISTS idx_kb_websites_status ON kb_websites(status);

-- Trigger to update updated_at for kb_websites
CREATE OR REPLACE FUNCTION update_kb_websites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_kb_websites_updated_at ON kb_websites;
CREATE TRIGGER set_kb_websites_updated_at
  BEFORE UPDATE ON kb_websites
  FOR EACH ROW
  EXECUTE FUNCTION update_kb_websites_updated_at();

-- Allow virtual documents (not from Drive)
-- Make folder_id nullable for website-sourced documents
ALTER TABLE kb_documents
  ALTER COLUMN folder_id DROP NOT NULL;

-- Add website relationship and source URL
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS website_id UUID REFERENCES kb_websites(id) ON DELETE CASCADE;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN DEFAULT FALSE;

-- Index for website documents
CREATE INDEX IF NOT EXISTS idx_kb_documents_website ON kb_documents(website_id)
  WHERE website_id IS NOT NULL;

-- Make drive_file_id nullable for virtual documents
ALTER TABLE kb_documents ALTER COLUMN drive_file_id DROP NOT NULL;

-- Update unique constraint to allow nulls (for virtual docs)
-- First, drop the existing unique constraint
ALTER TABLE kb_documents DROP CONSTRAINT IF EXISTS kb_documents_drive_file_id_key;

-- Create a partial unique index instead (only for non-null drive_file_id)
CREATE UNIQUE INDEX IF NOT EXISTS kb_documents_drive_file_id_unique
  ON kb_documents(drive_file_id)
  WHERE drive_file_id IS NOT NULL;

-- Enable RLS on kb_websites
ALTER TABLE kb_websites ENABLE ROW LEVEL SECURITY;

-- Permissive policy for anon (single-user app)
CREATE POLICY "Allow all for anon" ON kb_websites FOR ALL USING (true);

-- ============================================
-- VIEW: Website status overview
-- ============================================

CREATE OR REPLACE VIEW kb_website_status AS
SELECT
  w.id,
  w.name,
  w.url,
  w.max_depth,
  w.max_pages,
  w.status,
  w.last_crawl_at,
  w.page_count,
  w.crawl_error,
  w.created_at,
  COUNT(CASE WHEN d.status = 'indexed' THEN 1 END) AS indexed_count,
  COUNT(CASE WHEN d.status = 'pending' THEN 1 END) AS pending_count,
  COUNT(CASE WHEN d.status = 'processing' THEN 1 END) AS processing_count,
  COUNT(CASE WHEN d.status = 'failed' THEN 1 END) AS failed_count
FROM kb_websites w
LEFT JOIN kb_documents d ON w.id = d.website_id
GROUP BY w.id;

-- ============================================
-- SETUP COMPLETE
-- ============================================
