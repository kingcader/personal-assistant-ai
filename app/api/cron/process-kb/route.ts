/**
 * Knowledge Base Processing Cron Job
 *
 * Processes pending documents: extracts text, chunks content, generates embeddings.
 * Runs every 10 minutes to process newly synced files.
 *
 * Part of Loop #5: Knowledge Base + RAG System
 *
 * Usage: GET /api/cron/process-kb
 *
 * Environment:
 * - Requires OPENAI_API_KEY for embeddings
 * - CRON_SECRET for authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromFile, countWords } from '@/lib/kb/extractors';
import { chunkText, DEFAULT_CHUNK_CONFIG, estimateTokens } from '@/lib/kb/chunker';
import { generateEmbeddings } from '@/lib/kb/embeddings';
import {
  getPendingDocuments,
  updateDocumentStatus,
  updateDocumentExtractedText,
  createChunks,
  getDocumentById,
} from '@/lib/supabase/kb-queries';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Process 1 document per cron run to stay within cron-job.org's 30s timeout
const BATCH_SIZE = 1;

/**
 * Main KB processing handler
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting KB processing...');

    const results = {
      documents_processed: 0,
      documents_indexed: 0,
      documents_failed: 0,
      chunks_created: 0,
      errors: [] as string[],
    };

    // 2. Get pending documents
    const pendingDocs = await getPendingDocuments(BATCH_SIZE);
    console.log(`📄 Found ${pendingDocs.length} documents to process`);

    if (pendingDocs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No documents pending processing',
        ...results,
      });
    }

    // 3. Process each document
    for (const doc of pendingDocs) {
      try {
        console.log(`📝 Processing: ${doc.file_name}`);
        results.documents_processed++;

        // Mark as processing
        await updateDocumentStatus(doc.id, 'processing');

        // Step 1: Extract text
        console.log(`  ⏳ Extracting text...`);
        const extraction = await extractTextFromFile(doc.drive_file_id, doc.mime_type);

        if (!extraction.success) {
          throw new Error(`Text extraction failed: ${extraction.error}`);
        }

        if (!extraction.text.trim()) {
          throw new Error('Extracted text is empty');
        }

        // Compute content hash
        const contentHash = crypto
          .createHash('sha256')
          .update(extraction.text)
          .digest('hex');

        // Check if content has changed (if re-processing)
        const existingDoc = await getDocumentById(doc.id);
        if (existingDoc?.content_hash === contentHash && existingDoc.status === 'indexed') {
          console.log(`  ⏭️ Content unchanged, skipping`);
          continue;
        }

        // Save extracted text
        await updateDocumentExtractedText(doc.id, extraction.text, contentHash);
        console.log(`  ✅ Extracted ${countWords(extraction.text)} words`);

        // Step 2: Chunk the text
        console.log(`  ⏳ Chunking text...`);
        const chunks = chunkText(extraction.text, DEFAULT_CHUNK_CONFIG);
        console.log(`  ✅ Created ${chunks.length} chunks`);

        if (chunks.length === 0) {
          throw new Error('No chunks created from text');
        }

        // Step 3: Generate embeddings
        console.log(`  ⏳ Generating embeddings...`);
        const chunkTexts = chunks.map((c) => c.content);
        const embeddings = await generateEmbeddings(chunkTexts);
        console.log(`  ✅ Generated ${embeddings.length} embeddings`);

        // Step 4: Save chunks with embeddings
        console.log(`  ⏳ Saving chunks to database...`);
        const chunkData = chunks.map((chunk, index) => ({
          content: chunk.content,
          chunk_index: chunk.index,
          section_title: chunk.sectionTitle,
          embedding: embeddings[index],
          truth_priority: doc.truth_priority,
          token_count: chunk.tokenCount,
        }));

        await createChunks(doc.id, chunkData);
        results.chunks_created += chunks.length;

        // Success!
        results.documents_indexed++;
        console.log(`  ✅ Document indexed successfully`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`  ❌ Failed to process "${doc.file_name}": ${errorMsg}`);
        results.documents_failed++;
        results.errors.push(`${doc.file_name}: ${errorMsg}`);

        // Mark as failed
        await updateDocumentStatus(doc.id, 'failed', errorMsg);
      }
    }

    console.log('✅ KB processing complete:', results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('❌ Fatal error in KB processing:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for manual processing trigger
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
