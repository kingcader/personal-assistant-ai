/**
 * Apply Migration 010: Chat Conversations
 *
 * Run with: node scripts/apply-migration-010.js
 *
 * Requires: npm install pg
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  // Connection string for Supabase
  // Try direct connection first (port 5432), then pooler (port 6543)
  const connectionString = process.env.DATABASE_URL ||
    'postgresql://postgres:leFF36Wu8J8TxgNw@aws-0-us-west-1.pooler.supabase.com:5432/postgres?options=project%3Dqprhkeaeaaizkagyqrtc';

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected!');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/010_chat_conversations.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying migration 010_chat_conversations.sql...');
    await client.query(migrationSql);
    console.log('Migration applied successfully!');

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
