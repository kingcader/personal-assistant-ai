-- ============================================
-- Migration 010: Chat Conversations & Message Persistence
-- ============================================

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  summary TEXT,
  message_count INTEGER DEFAULT 0,
  first_message_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_last_message
  ON conversations(last_message_at DESC)
  WHERE is_archived = FALSE;

CREATE INDEX IF NOT EXISTS idx_conversations_archived
  ON conversations(archived_at DESC)
  WHERE is_archived = TRUE;

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  type TEXT,
  intent TEXT,
  confidence TEXT CHECK (confidence IS NULL OR confidence IN ('high', 'medium', 'low')),
  citations JSONB,
  action JSONB,
  search_results JSONB,
  sequence_number INTEGER NOT NULL,
  processing_ms INTEGER,
  ai_model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
  ON chat_messages(conversation_id, sequence_number ASC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_content
  ON chat_messages USING gin(to_tsvector('english', content));

-- Trigger: update conversation stats on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    first_message_at = COALESCE(first_message_at, NEW.created_at),
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_conversation_on_new_message ON chat_messages;
CREATE TRIGGER update_conversation_on_new_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();

-- Trigger: update updated_at on conversation changes
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_conversation_updated_at ON conversations;
CREATE TRIGGER set_conversation_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_updated_at();

-- Trigger: auto-generate title from first user message
CREATE OR REPLACE FUNCTION auto_generate_conversation_title()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'user' AND NEW.sequence_number = 1 THEN
    UPDATE conversations SET
      title = LEFT(NEW.content, 100)
    WHERE id = NEW.conversation_id AND title IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_title_conversation ON chat_messages;
CREATE TRIGGER auto_title_conversation
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_conversation_title();

-- Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon on conversations" ON conversations;
CREATE POLICY "Allow all for anon on conversations"
  ON conversations FOR ALL USING (true);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon on chat_messages" ON chat_messages;
CREATE POLICY "Allow all for anon on chat_messages"
  ON chat_messages FOR ALL USING (true);

-- View: Recent conversations with preview
CREATE OR REPLACE VIEW recent_conversations AS
SELECT
  c.id,
  c.title,
  c.summary,
  c.message_count,
  c.first_message_at,
  c.last_message_at,
  c.is_archived,
  c.created_at,
  (
    SELECT content
    FROM chat_messages m
    WHERE m.conversation_id = c.id AND m.role = 'user'
    ORDER BY m.sequence_number DESC
    LIMIT 1
  ) AS last_user_message
FROM conversations c
WHERE c.is_archived = FALSE
ORDER BY c.last_message_at DESC NULLS LAST;
