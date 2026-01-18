-- ============================================
-- LOOP #5: KNOWLEDGE BASE + RAG SYSTEM
-- Google Drive sync, semantic search, embeddings
-- ============================================

-- ============================================
-- ENABLE PGVECTOR EXTENSION
-- ============================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- EXTEND NOTIFICATION TYPE ENUM
-- ============================================

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'kb_folder_synced';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'kb_document_indexed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'kb_search_result';

-- ============================================
-- CUSTOM TYPES FOR KNOWLEDGE BASE
-- ============================================

CREATE TYPE kb_truth_priority AS ENUM ('standard', 'high', 'authoritative');
CREATE TYPE kb_document_status AS ENUM ('pending', 'processing', 'indexed', 'failed', 'deleted');

-- ============================================
-- SYNCED FOLDERS TABLE
-- Google Drive folders to sync
-- ============================================

CREATE TABLE kb_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Google Drive identifiers
  drive_folder_id TEXT NOT NULL UNIQUE,
  folder_name TEXT NOT NULL,
  folder_path TEXT,

  -- Configuration
  truth_priority kb_truth_priority DEFAULT 'standard',
  sync_enabled BOOLEAN DEFAULT TRUE,

  -- Sync status
  last_sync_at TIMESTAMPTZ,
  last_sync_error TEXT,
  file_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DOCUMENTS TABLE
-- File metadata from Google Drive
-- ============================================

CREATE TABLE kb_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Folder relationship
  folder_id UUID REFERENCES kb_folders(id) ON DELETE CASCADE,

  -- Google Drive identifiers
  drive_file_id TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  file_path TEXT,
  mime_type TEXT NOT NULL,

  -- Content tracking
  content_hash TEXT,
  drive_modified_at TIMESTAMPTZ,
  file_size_bytes BIGINT,

  -- Processing status
  status kb_document_status DEFAULT 'pending',
  processing_error TEXT,

  -- Extracted content
  extracted_text TEXT,

  -- Truth priority (inherits from folder, can override)
  truth_priority kb_truth_priority,

  -- Chunk tracking
  chunk_count INTEGER DEFAULT 0,

  -- Timestamps
  indexed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CHUNKS TABLE
-- Text chunks with embeddings for RAG
-- ============================================

CREATE TABLE kb_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Document relationship
  document_id UUID REFERENCES kb_documents(id) ON DELETE CASCADE,

  -- Chunk content
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,

  -- Section metadata
  section_title TEXT,

  -- Embedding vector (OpenAI text-embedding-3-small = 1536 dimensions)
  embedding vector(1536),

  -- Truth priority (inherited from document)
  truth_priority kb_truth_priority,

  -- Token count for chunking validation
  token_count INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One chunk per index per document
  UNIQUE(document_id, chunk_index)
);

-- ============================================
-- TASK-DOCUMENT LINKS TABLE
-- Associate tasks with relevant documents
-- ============================================

CREATE TABLE task_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relationships
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  document_id UUID REFERENCES kb_documents(id) ON DELETE CASCADE,

  -- Relevance
  relevance_score NUMERIC(4,3),
  auto_linked BOOLEAN DEFAULT TRUE, -- True if linked by AI, false if manual

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One link per task-document pair
  UNIQUE(task_id, document_id)
);

-- ============================================
-- RAG QUERY HISTORY TABLE
-- Track searches for analytics and debugging
-- ============================================

CREATE TABLE kb_search_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Query details
  query TEXT NOT NULL,
  query_embedding vector(1536),

  -- Results
  result_count INTEGER DEFAULT 0,
  top_chunk_ids UUID[], -- Array of chunk IDs returned

  -- Performance
  search_duration_ms INTEGER,

  -- Context (optional)
  context_type TEXT, -- 'task', 'conversation', 'manual'
  context_id UUID,   -- Related task_id or other entity

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

-- Auto-update updated_at for kb_folders
CREATE TRIGGER set_kb_folders_updated_at
  BEFORE UPDATE ON kb_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for kb_documents
CREATE TRIGGER set_kb_documents_updated_at
  BEFORE UPDATE ON kb_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Folders: find enabled folders for sync
CREATE INDEX idx_kb_folders_sync_enabled ON kb_folders(sync_enabled)
  WHERE sync_enabled = TRUE;

-- Documents: lookup by Drive ID
CREATE INDEX idx_kb_documents_drive_id ON kb_documents(drive_file_id);

-- Documents: find pending/processing documents
CREATE INDEX idx_kb_documents_status ON kb_documents(status)
  WHERE status IN ('pending', 'processing');

-- Documents: find by folder
CREATE INDEX idx_kb_documents_folder ON kb_documents(folder_id);

-- Documents: find indexed documents by folder
CREATE INDEX idx_kb_documents_folder_indexed ON kb_documents(folder_id, indexed_at)
  WHERE status = 'indexed';

-- Chunks: find by document
CREATE INDEX idx_kb_chunks_document ON kb_chunks(document_id);

-- Chunks: HNSW index for vector similarity search (faster than IVFFlat for smaller datasets)
-- Using HNSW instead of IVFFlat for better recall at small scale
CREATE INDEX idx_kb_chunks_embedding ON kb_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Task-documents: find documents for a task
CREATE INDEX idx_task_documents_task ON task_documents(task_id);

-- Task-documents: find tasks for a document
CREATE INDEX idx_task_documents_document ON task_documents(document_id);

-- Search history: recent queries
CREATE INDEX idx_kb_search_history_created ON kb_search_history(created_at DESC);

-- ============================================
-- VECTOR SIMILARITY SEARCH FUNCTION
-- ============================================

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
  drive_file_id TEXT
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
    d.drive_file_id
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
-- HELPER VIEWS
-- ============================================

-- View: Folder sync status overview
CREATE VIEW kb_folder_status AS
SELECT
  f.id,
  f.folder_name,
  f.drive_folder_id,
  f.truth_priority,
  f.sync_enabled,
  f.last_sync_at,
  f.last_sync_error,
  f.file_count,
  COUNT(CASE WHEN d.status = 'indexed' THEN 1 END) AS indexed_count,
  COUNT(CASE WHEN d.status = 'pending' THEN 1 END) AS pending_count,
  COUNT(CASE WHEN d.status = 'processing' THEN 1 END) AS processing_count,
  COUNT(CASE WHEN d.status = 'failed' THEN 1 END) AS failed_count
FROM kb_folders f
LEFT JOIN kb_documents d ON f.id = d.folder_id
GROUP BY f.id;

-- View: Documents needing processing
CREATE VIEW kb_documents_pending AS
SELECT
  d.*,
  f.folder_name,
  f.truth_priority AS folder_truth_priority
FROM kb_documents d
JOIN kb_folders f ON d.folder_id = f.id
WHERE d.status = 'pending'
ORDER BY d.created_at ASC;

-- View: Recently indexed documents
CREATE VIEW kb_recently_indexed AS
SELECT
  d.*,
  f.folder_name
FROM kb_documents d
JOIN kb_folders f ON d.folder_id = f.id
WHERE d.status = 'indexed'
ORDER BY d.indexed_at DESC
LIMIT 50;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all new tables
ALTER TABLE kb_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_search_history ENABLE ROW LEVEL SECURITY;

-- Permissive policies for anon (single-user app)
CREATE POLICY "Allow all for anon" ON kb_folders FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON kb_documents FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON kb_chunks FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON task_documents FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON kb_search_history FOR ALL USING (true);

-- ============================================
-- SETUP COMPLETE
-- ============================================
