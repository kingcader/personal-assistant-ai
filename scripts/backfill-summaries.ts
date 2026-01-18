/**
 * Backfill Summaries Script
 *
 * Generates summaries for existing indexed documents that don't have one.
 *
 * Usage:
 *   npx tsx scripts/backfill-summaries.ts
 *
 * Part of Loop #5.5: RAG System Improvements
 */

import { createClient } from '@supabase/supabase-js';
import { generateDocumentSummary } from '../lib/ai/summary-generation-prompt';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Document {
  id: string;
  file_name: string;
  mime_type: string;
  extracted_text: string | null;
}

async function backfillSummaries() {
  console.log('🚀 Starting summary backfill...\n');

  // Get indexed documents without summaries
  const { data: documents, error } = await supabase
    .from('kb_documents')
    .select('id, file_name, mime_type, extracted_text')
    .eq('status', 'indexed')
    .is('summary', null)
    .not('extracted_text', 'is', null)
    .order('indexed_at', { ascending: false });

  if (error) {
    console.error('Error fetching documents:', error);
    process.exit(1);
  }

  const docs = documents as Document[];
  console.log(`📄 Found ${docs.length} documents needing summaries\n`);

  if (docs.length === 0) {
    console.log('✅ All documents already have summaries!');
    return;
  }

  let success = 0;
  let failed = 0;

  for (const doc of docs) {
    try {
      process.stdout.write(`Processing: ${doc.file_name}... `);

      if (!doc.extracted_text) {
        console.log('⏭️ No extracted text');
        continue;
      }

      // Generate summary
      const summary = await generateDocumentSummary(
        doc.extracted_text,
        doc.file_name,
        doc.mime_type
      );

      if (!summary) {
        console.log('⚠️ Empty summary generated');
        continue;
      }

      // Update document
      const { error: updateError } = await supabase
        .from('kb_documents')
        .update({
          summary,
          summary_generated_at: new Date().toISOString(),
        })
        .eq('id', doc.id);

      if (updateError) {
        throw updateError;
      }

      console.log('✅');
      success++;

      // Rate limiting - avoid hitting API limits
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.log(`❌ ${err instanceof Error ? err.message : 'Unknown error'}`);
      failed++;
    }
  }

  console.log(`\n📊 Summary Backfill Complete`);
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📄 Total: ${docs.length}`);
}

// Run the script
backfillSummaries().catch(console.error);
