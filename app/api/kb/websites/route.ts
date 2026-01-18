/**
 * Knowledge Base Websites API
 *
 * CRUD operations for websites to crawl.
 *
 * Part of Loop #5.5: Website Crawler
 *
 * Usage:
 * - GET /api/kb/websites - List all websites
 * - POST /api/kb/websites - Add a new website
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllWebsites,
  createWebsite,
  getWebsiteById,
} from '@/lib/supabase/kb-queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/kb/websites - List all websites
 */
export async function GET() {
  try {
    const websites = await getAllWebsites();

    return NextResponse.json({
      success: true,
      websites,
    });
  } catch (error) {
    console.error('Error fetching websites:', error);
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
 * POST /api/kb/websites - Add a new website
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, name, maxDepth, maxPages } = body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate and normalize URL
    let normalizedUrl: string;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return NextResponse.json(
          { success: false, error: 'URL must use HTTP or HTTPS protocol' },
          { status: 400 }
        );
      }
      normalizedUrl = parsed.origin + parsed.pathname;
      // Remove trailing slash for consistency
      if (normalizedUrl.endsWith('/') && normalizedUrl !== parsed.origin + '/') {
        normalizedUrl = normalizedUrl.slice(0, -1);
      }
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Use hostname as default name
    const websiteName = name || new URL(normalizedUrl).hostname;

    // Create website
    const website = await createWebsite({
      url: normalizedUrl,
      name: websiteName,
      max_depth: maxDepth,
      max_pages: maxPages,
    });

    return NextResponse.json({
      success: true,
      website,
      message: `Website "${websiteName}" added for crawling`,
    });
  } catch (error) {
    console.error('Error creating website:', error);

    // Handle unique constraint violation
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
      return NextResponse.json(
        { success: false, error: 'This URL is already being tracked' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
