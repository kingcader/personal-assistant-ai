/**
 * Website Crawler
 *
 * Crawls websites and extracts content for the knowledge base.
 * Respects robots.txt and implements rate limiting.
 *
 * Part of Loop #5.5: Website Crawler
 */

import { extractHtml, extractLinks, HtmlExtractionResult } from './extractors/html';

export interface CrawlResult {
  url: string;
  success: boolean;
  title: string | null;
  description: string | null;
  content: string;
  wordCount: number;
  error?: string;
}

export interface CrawlProgress {
  pagesProcessed: number;
  pagesFound: number;
  currentUrl: string | null;
}

interface RobotsRules {
  allowed: boolean;
  crawlDelay: number;
}

/**
 * Parse robots.txt for basic rules
 */
async function parseRobotsTxt(baseUrl: string): Promise<RobotsRules> {
  const defaults: RobotsRules = { allowed: true, crawlDelay: 1000 };

  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).toString();
    const response = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return defaults;
    }

    const text = await response.text();
    const lines = text.split('\n');

    let inUserAgentAll = false;
    let crawlDelay = 1000; // Default 1 second

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();

      if (trimmed.startsWith('user-agent:')) {
        const agent = trimmed.substring('user-agent:'.length).trim();
        inUserAgentAll = agent === '*';
      }

      if (inUserAgentAll) {
        if (trimmed.startsWith('disallow:')) {
          const path = trimmed.substring('disallow:'.length).trim();
          if (path === '/') {
            return { allowed: false, crawlDelay };
          }
        }

        if (trimmed.startsWith('crawl-delay:')) {
          const delay = parseInt(trimmed.substring('crawl-delay:'.length).trim());
          if (!isNaN(delay)) {
            crawlDelay = delay * 1000; // Convert to milliseconds
          }
        }
      }
    }

    return { allowed: true, crawlDelay: Math.max(crawlDelay, 1000) };
  } catch {
    return defaults;
  }
}

/**
 * Fetch a single page
 */
async function fetchPage(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PersonalAssistantAI-Crawler/1.0 (+https://example.com/bot)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });

    if (!response.ok) {
      console.log(`  ⚠️ HTTP ${response.status} for ${url}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      console.log(`  ⚠️ Non-HTML content type for ${url}`);
      return null;
    }

    const html = await response.text();
    return { html, finalUrl: response.url };
  } catch (error) {
    console.log(`  ❌ Fetch error for ${url}: ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
}

/**
 * Crawl a website starting from the base URL
 */
export async function crawlWebsite(
  startUrl: string,
  options: {
    maxDepth?: number;
    maxPages?: number;
    onProgress?: (progress: CrawlProgress) => void;
  } = {}
): Promise<CrawlResult[]> {
  const { maxDepth = 2, maxPages = 50, onProgress } = options;

  const results: CrawlResult[] = [];
  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [];

  // Normalize start URL
  const baseUrl = new URL(startUrl);
  baseUrl.hash = '';
  const normalizedStart = baseUrl.toString();

  queue.push({ url: normalizedStart, depth: 0 });

  // Check robots.txt
  console.log(`🤖 Checking robots.txt for ${baseUrl.origin}...`);
  const robots = await parseRobotsTxt(baseUrl.origin);

  if (!robots.allowed) {
    console.log(`🚫 Crawling disallowed by robots.txt`);
    return [];
  }

  const crawlDelay = robots.crawlDelay;
  console.log(`⏱️ Using crawl delay: ${crawlDelay}ms`);

  while (queue.length > 0 && results.length < maxPages) {
    const { url, depth } = queue.shift()!;

    // Skip if already visited
    if (visited.has(url)) continue;
    visited.add(url);

    // Report progress
    onProgress?.({
      pagesProcessed: results.length,
      pagesFound: visited.size,
      currentUrl: url,
    });

    console.log(`📄 Crawling (depth ${depth}): ${url}`);

    // Fetch page
    const fetchResult = await fetchPage(url);
    if (!fetchResult) {
      results.push({
        url,
        success: false,
        title: null,
        description: null,
        content: '',
        wordCount: 0,
        error: 'Failed to fetch page',
      });
      continue;
    }

    const { html, finalUrl } = fetchResult;

    // Mark final URL as visited too (in case of redirects)
    visited.add(finalUrl);

    // Extract content
    const extraction = extractHtml(html, finalUrl);

    if (!extraction.success) {
      results.push({
        url: finalUrl,
        success: false,
        title: null,
        description: null,
        content: '',
        wordCount: 0,
        error: extraction.error,
      });
      continue;
    }

    // Skip pages with very little content
    if (extraction.metadata && extraction.metadata.wordCount < 50) {
      console.log(`  ⏭️ Skipping low-content page (${extraction.metadata.wordCount} words)`);
      continue;
    }

    results.push({
      url: finalUrl,
      success: true,
      title: extraction.title,
      description: extraction.description,
      content: extraction.text,
      wordCount: extraction.metadata?.wordCount || 0,
    });

    console.log(`  ✅ Extracted ${extraction.metadata?.wordCount || 0} words`);

    // Extract and queue links if not at max depth
    if (depth < maxDepth) {
      const links = extractLinks(html, finalUrl);
      console.log(`  🔗 Found ${links.length} links`);

      for (const link of links) {
        if (!visited.has(link) && queue.length + results.length < maxPages * 2) {
          queue.push({ url: link, depth: depth + 1 });
        }
      }
    }

    // Respect crawl delay
    await new Promise((resolve) => setTimeout(resolve, crawlDelay));
  }

  console.log(`\n✅ Crawl complete: ${results.length} pages processed`);

  return results;
}

/**
 * Generate a filename from URL
 */
export function urlToFileName(url: string): string {
  try {
    const parsed = new URL(url);
    let path = parsed.pathname;

    // Remove leading/trailing slashes
    path = path.replace(/^\/|\/$/g, '');

    // Replace slashes with dashes
    path = path.replace(/\//g, '-');

    // If empty (homepage), use 'index'
    if (!path) {
      path = 'index';
    }

    // Add domain prefix for clarity
    return `${parsed.hostname}/${path}`;
  } catch {
    return 'unknown-page';
  }
}
