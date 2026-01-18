-- Migration 008: Knowledge Base Categories
-- Adds categorization system for documents

-- Categories table (user-defined categories)
CREATE TABLE kb_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6B7280', -- Tailwind gray-500 default
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document-Category junction table (many-to-many)
CREATE TABLE kb_document_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES kb_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, category_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_doc_categories_document ON kb_document_categories(document_id);
CREATE INDEX idx_doc_categories_category ON kb_document_categories(category_id);

-- Trigger to update updated_at on categories
CREATE OR REPLACE FUNCTION update_kb_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kb_categories_updated_at
  BEFORE UPDATE ON kb_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_kb_categories_updated_at();

-- View to get documents with their categories
CREATE OR REPLACE VIEW kb_documents_with_categories AS
SELECT
  d.*,
  COALESCE(
    json_agg(
      json_build_object(
        'id', c.id,
        'name', c.name,
        'color', c.color
      )
    ) FILTER (WHERE c.id IS NOT NULL),
    '[]'::json
  ) AS categories
FROM kb_documents d
LEFT JOIN kb_document_categories dc ON d.id = dc.document_id
LEFT JOIN kb_categories c ON dc.category_id = c.id
GROUP BY d.id;

-- Add some default categories as examples (optional, can be deleted by user)
INSERT INTO kb_categories (name, description, color) VALUES
  ('Contracts', 'Legal contracts and agreements', '#EF4444'),
  ('Financial', 'Financial documents, invoices, quotes', '#10B981'),
  ('Design', 'Design files, renderings, plans', '#8B5CF6'),
  ('Marketing', 'Marketing materials and assets', '#F59E0B'),
  ('Reference', 'Reference documents and guides', '#3B82F6');
