/**
 * HTML Text Extractor
 *
 * Extracts clean text content from HTML pages.
 * Strips scripts, styles, navigation, and preserves structure.
 *
 * Part of Loop #5.5: Website Crawler
 */

import * as cheerio from 'cheerio';

export interface HtmlExtractionResult {
  success: boolean;
  text: string;
  title: string | null;
  description: string | null;
  error?: string;
  metadata?: {
    wordCount: number;
    hasStructure: boolean;
  };
}

/**
 * Extract text from HTML content
 */
export function extractHtml(html: string, baseUrl?: string): HtmlExtractionResult {
  try {
    const $ = cheerio.load(html);

    // Extract metadata
    const title = $('title').text().trim() || $('h1').first().text().trim() || null;
    const description =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      null;

    // Remove unwanted elements
    $(
      'script, style, noscript, iframe, svg, canvas, ' +
        'nav, header, footer, aside, ' +
        'form, input, button, ' +
        '[role="navigation"], [role="banner"], [role="contentinfo"], ' +
        '.nav, .navigation, .header, .footer, .sidebar, ' +
        '.menu, .ad, .advertisement, .social-share, ' +
        '.cookie-banner, .popup, .modal'
    ).remove();

    // Remove hidden elements
    $('[style*="display: none"], [style*="display:none"], [hidden]').remove();

    // Extract main content - prefer article or main content areas
    let contentArea = $('main, article, [role="main"], .content, .main-content, #content, #main')
      .first();

    // Fall back to body if no content area found
    if (contentArea.length === 0) {
      contentArea = $('body');
    }

    // Extract text with structure preservation
    const textParts: string[] = [];
    let hasStructure = false;

    // Process headings first for structure
    contentArea.find('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const heading = $(el).text().trim();
      if (heading) {
        const level = parseInt(el.tagName.substring(1));
        const prefix = '#'.repeat(level);
        textParts.push(`${prefix} ${heading}`);
        hasStructure = true;
      }
    });

    // Process paragraphs and list items
    contentArea.find('p, li, td, th, blockquote, pre, code').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10) {
        // Avoid tiny fragments
        // Check if it's a list item
        if (el.tagName === 'li') {
          textParts.push(`• ${text}`);
        } else if (el.tagName === 'blockquote') {
          textParts.push(`> ${text}`);
        } else if (el.tagName === 'pre' || el.tagName === 'code') {
          textParts.push(`\`\`\`\n${text}\n\`\`\``);
        } else {
          textParts.push(text);
        }
      }
    });

    // If structured extraction didn't yield much, fall back to all text
    if (textParts.length < 3) {
      const allText = contentArea.text();
      // Clean up whitespace
      const cleanedText = allText
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();

      if (cleanedText.length > textParts.join('\n').length) {
        textParts.length = 0;
        textParts.push(cleanedText);
        hasStructure = false;
      }
    }

    // Deduplicate and join
    const uniqueParts = [...new Set(textParts)];
    const finalText = uniqueParts.join('\n\n');

    // Count words
    const wordCount = finalText.split(/\s+/).filter((w) => w.length > 0).length;

    return {
      success: true,
      text: finalText,
      title,
      description,
      metadata: {
        wordCount,
        hasStructure,
      },
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      title: null,
      description: null,
      error: error instanceof Error ? error.message : 'HTML extraction failed',
    };
  }
}

/**
 * Extract links from HTML for crawling
 */
export function extractLinks(html: string, baseUrl: string): string[] {
  try {
    const $ = cheerio.load(html);
    const links: string[] = [];
    const base = new URL(baseUrl);

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      try {
        // Skip non-http links
        if (
          href.startsWith('mailto:') ||
          href.startsWith('tel:') ||
          href.startsWith('javascript:') ||
          href.startsWith('#')
        ) {
          return;
        }

        // Resolve relative URLs
        const absoluteUrl = new URL(href, baseUrl);

        // Only include same-domain links
        if (absoluteUrl.hostname === base.hostname) {
          // Normalize: remove hash, trailing slash
          absoluteUrl.hash = '';
          let path = absoluteUrl.pathname;
          if (path.endsWith('/') && path !== '/') {
            path = path.slice(0, -1);
          }
          absoluteUrl.pathname = path;

          const normalizedUrl = absoluteUrl.toString();

          // Skip common non-content URLs
          if (
            normalizedUrl.match(/\.(jpg|jpeg|png|gif|svg|pdf|zip|css|js|ico)$/i) ||
            normalizedUrl.includes('/wp-admin') ||
            normalizedUrl.includes('/login') ||
            normalizedUrl.includes('/signin') ||
            normalizedUrl.includes('/signup')
          ) {
            return;
          }

          links.push(normalizedUrl);
        }
      } catch {
        // Skip invalid URLs
      }
    });

    // Return unique links
    return [...new Set(links)];
  } catch {
    return [];
  }
}
