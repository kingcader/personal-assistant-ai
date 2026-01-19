-- Migration 012: Entity Notes
-- Adds a notes field to entities for user-provided context
-- Part of Manual Entity Creation via Chat feature

-- Add notes column to entities table
-- This stores user-provided context like "representing our project" or other notes
-- Unlike description (AI-generated), notes are explicitly provided by users
ALTER TABLE entities ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add index for full-text search on notes
CREATE INDEX IF NOT EXISTS idx_entities_notes ON entities USING gin(to_tsvector('english', notes)) WHERE notes IS NOT NULL;
