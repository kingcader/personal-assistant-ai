/**
 * Knowledge Base Website Detail API
 *
 * Operations on a specific website.
 *
 * Part of Loop #5.5: Website Crawler
 *
 * Usage:
 * - GET /api/kb/websites/[id] - Get website details
 * - PATCH /api/kb/websites/[id] - Update website settings
 * - DELETE /api/kb/websites/[id] - Delete website and its documents
 * - POST /api/kb/websites/[id] - Trigger actions (e.g., recrawl)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getWebsiteById,
  updateWebsite,
  updateWebsiteCrawlStatus,
  deleteWebsite,
  getDocumentsForWebsite,
} from '@/lib/supabase/kb-queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/kb/websites/[id] - Get website details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const website = await getWebsiteById(id);

    if (!website) {
      return NextResponse.json(
        { success: false, error: 'Website not found' },
        { status: 404 }
      );
    }

    // Get documents for this website
    const documents = await getDocumentsForWebsite(id);

    return NextResponse.json({
      success: true,
      website,
      documents,
    });
  } catch (error) {
    console.error('Error fetching website:', error);
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
 * PATCH /api/kb/websites/[id] - Update website settings
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check website exists
    const existing = await getWebsiteById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Website not found' },
        { status: 404 }
      );
    }

    // Build updates
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      updates.name = body.name;
    }

    if (body.max_depth !== undefined) {
      const maxDepth = parseInt(body.max_depth);
      if (isNaN(maxDepth) || maxDepth < 0 || maxDepth > 5) {
        return NextResponse.json(
          { success: false, error: 'max_depth must be between 0 and 5' },
          { status: 400 }
        );
      }
      updates.max_depth = maxDepth;
    }

    if (body.max_pages !== undefined) {
      const maxPages = parseInt(body.max_pages);
      if (isNaN(maxPages) || maxPages < 1 || maxPages > 200) {
        return NextResponse.json(
          { success: false, error: 'max_pages must be between 1 and 200' },
          { status: 400 }
        );
      }
      updates.max_pages = maxPages;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    const website = await updateWebsite(id, updates as any);

    return NextResponse.json({
      success: true,
      website,
    });
  } catch (error) {
    console.error('Error updating website:', error);
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
 * DELETE /api/kb/websites/[id] - Delete website and documents
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check website exists
    const existing = await getWebsiteById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Website not found' },
        { status: 404 }
      );
    }

    // Delete website (cascades to documents)
    await deleteWebsite(id);

    return NextResponse.json({
      success: true,
      message: `Website "${existing.name}" and all its pages deleted`,
    });
  } catch (error) {
    console.error('Error deleting website:', error);
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
 * POST /api/kb/websites/[id] - Trigger actions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    // Check website exists
    const existing = await getWebsiteById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Website not found' },
        { status: 404 }
      );
    }

    if (action === 'recrawl') {
      // Mark as pending to trigger recrawl on next cron run
      await updateWebsiteCrawlStatus(id, {
        status: 'pending',
        crawl_error: null,
      });

      return NextResponse.json({
        success: true,
        message: `Website "${existing.name}" queued for recrawl`,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing website action:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
