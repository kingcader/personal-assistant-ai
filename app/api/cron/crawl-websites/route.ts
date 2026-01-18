/**
 * Website Crawl Cron Job
 *
 * Crawls websites configured in kb_websites and creates documents.
 * Runs every 6 hours to check for new/updated content.
 *
 * Part of Loop #5.5: Website Crawler
 *
 * Usage: GET /api/cron/crawl-websites
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getWebsitesToCrawl,
  updateWebsiteCrawlStatus,
  upsertVirtualDocument,
  KBWebsite,
} from '@/lib/supabase/kb-queries';
import { crawlWebsite, urlToFileName } from '@/lib/kb/crawler';

export const dynamic = 'force-dynamic';

// Process 1 website per cron run to stay within timeout
const BATCH_SIZE = 1;

/**
 * Main crawl handler
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🌐 Starting website crawl...');

    const results = {
      websites_processed: 0,
      pages_discovered: 0,
      documents_created: 0,
      errors: [] as string[],
    };

    // 2. Get websites to crawl
    const websites = await getWebsitesToCrawl();

    // Filter to those pending or due for recrawl (>24 hours since last crawl)
    const now = Date.now();
    const recrawlInterval = 24 * 60 * 60 * 1000; // 24 hours

    const websitesToProcess = websites.filter((w) => {
      if (w.status === 'pending') return true;
      if (w.status === 'indexed' && w.last_crawl_at) {
        const lastCrawl = new Date(w.last_crawl_at).getTime();
        return now - lastCrawl > recrawlInterval;
      }
      return false;
    });

    console.log(`📋 Found ${websitesToProcess.length} websites to process`);

    if (websitesToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No websites due for crawling',
        ...results,
      });
    }

    // Process batch
    const batch = websitesToProcess.slice(0, BATCH_SIZE);

    for (const website of batch) {
      try {
        console.log(`\n🔄 Processing: ${website.name} (${website.url})`);
        results.websites_processed++;

        // Mark as crawling
        await updateWebsiteCrawlStatus(website.id, {
          status: 'crawling',
          crawl_error: null,
        });

        // Crawl the website
        const crawlResults = await crawlWebsite(website.url, {
          maxDepth: website.max_depth,
          maxPages: website.max_pages,
          onProgress: (progress) => {
            console.log(
              `  📊 Progress: ${progress.pagesProcessed}/${progress.pagesFound} pages`
            );
          },
        });

        results.pages_discovered += crawlResults.length;

        // Create/update documents for successful pages
        let documentsCreated = 0;
        for (const page of crawlResults) {
          if (!page.success || !page.content) continue;

          try {
            const fileName = page.title || urlToFileName(page.url);

            // Compute content hash for change detection
            const contentHash = crypto
              .createHash('sha256')
              .update(page.content)
              .digest('hex');

            await upsertVirtualDocument({
              website_id: website.id,
              source_url: page.url,
              file_name: fileName,
              mime_type: 'text/html',
              extracted_text: page.content,
              content_hash: contentHash,
            });

            documentsCreated++;
          } catch (docError) {
            console.error(`  ⚠️ Failed to create document for ${page.url}:`, docError);
          }
        }

        results.documents_created += documentsCreated;

        // Update website status
        await updateWebsiteCrawlStatus(website.id, {
          status: 'indexed',
          last_crawl_at: new Date().toISOString(),
          page_count: crawlResults.filter((r) => r.success).length,
          crawl_error: null,
        });

        console.log(
          `✅ Completed: ${website.name} - ${documentsCreated} documents created`
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Failed to crawl "${website.name}": ${errorMsg}`);
        results.errors.push(`${website.name}: ${errorMsg}`);

        // Mark as failed
        await updateWebsiteCrawlStatus(website.id, {
          status: 'failed',
          crawl_error: errorMsg,
        });
      }
    }

    console.log('\n✅ Website crawl complete:', results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('❌ Fatal error in website crawl:', error);
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
 * POST endpoint for manual crawl trigger
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
