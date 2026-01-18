/**
 * Text Chunking Module
 *
 * Splits text into semantically meaningful chunks for embedding.
 * Respects paragraph and sentence boundaries.
 *
 * Part of Loop #5: Knowledge Base + RAG System
 */

/**
 * Chunking configuration
 */
export interface ChunkConfig {
  maxTokens: number;      // Maximum tokens per chunk
  minTokens: number;      // Minimum tokens (avoid tiny fragments)
  overlapTokens: number;  // Overlap between chunks for context
  preserveHeadings: boolean; // Keep section headings with content
}

/**
 * Default chunking configuration
 */
export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  maxTokens: 1500,
  minTokens: 100,
  overlapTokens: 100,
  preserveHeadings: true,
};

/**
 * A text chunk with metadata
 */
export interface TextChunk {
  content: string;
  index: number;
  sectionTitle: string | null;
  tokenCount: number;
}

/**
 * Estimate token count from text
 * Uses a simple heuristic: ~4 characters per token for English
 */
export function estimateTokens(text: string): number {
  // More accurate estimation: words + punctuation
  // Average English word is ~4.5 letters, plus space = 5.5 chars
  // ~1.3 tokens per word on average
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  return Math.ceil(words.length * 1.3);
}

/**
 * Split text into chunks respecting semantic boundaries
 */
export function chunkText(
  text: string,
  config: ChunkConfig = DEFAULT_CHUNK_CONFIG
): TextChunk[] {
  if (!text.trim()) {
    return [];
  }

  // Split into sections by headings
  const sections = splitIntoSections(text);

  const chunks: TextChunk[] = [];
  let currentChunk: string[] = [];
  let currentTokens = 0;
  let currentSection: string | null = null;
  let chunkIndex = 0;

  for (const section of sections) {
    const { title, paragraphs } = section;
    currentSection = title;

    for (const paragraph of paragraphs) {
      const paragraphTokens = estimateTokens(paragraph);

      // If paragraph alone exceeds max tokens, split it further
      if (paragraphTokens > config.maxTokens) {
        // Finish current chunk first
        if (currentChunk.length > 0) {
          chunks.push({
            content: currentChunk.join('\n\n'),
            index: chunkIndex++,
            sectionTitle: currentSection,
            tokenCount: currentTokens,
          });
          currentChunk = [];
          currentTokens = 0;
        }

        // Split large paragraph into sentences
        const sentenceChunks = splitLargeParagraph(
          paragraph,
          config.maxTokens,
          currentSection
        );

        for (const sentenceChunk of sentenceChunks) {
          chunks.push({
            ...sentenceChunk,
            index: chunkIndex++,
          });
        }
        continue;
      }

      // Check if adding this paragraph exceeds max tokens
      if (currentTokens + paragraphTokens > config.maxTokens) {
        // Save current chunk
        if (currentTokens >= config.minTokens) {
          chunks.push({
            content: currentChunk.join('\n\n'),
            index: chunkIndex++,
            sectionTitle: currentSection,
            tokenCount: currentTokens,
          });
        }

        // Start new chunk with overlap
        const overlap = getOverlapText(currentChunk, config.overlapTokens);
        currentChunk = overlap ? [overlap, paragraph] : [paragraph];
        currentTokens = estimateTokens(currentChunk.join('\n\n'));
      } else {
        // Add to current chunk
        currentChunk.push(paragraph);
        currentTokens += paragraphTokens;
      }
    }
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0 && currentTokens >= config.minTokens) {
    chunks.push({
      content: currentChunk.join('\n\n'),
      index: chunkIndex++,
      sectionTitle: currentSection,
      tokenCount: currentTokens,
    });
  } else if (currentChunk.length > 0 && chunks.length > 0) {
    // If last chunk is too small, append to previous chunk
    const lastChunk = chunks[chunks.length - 1];
    lastChunk.content += '\n\n' + currentChunk.join('\n\n');
    lastChunk.tokenCount += currentTokens;
  } else if (currentChunk.length > 0) {
    // Only chunk, include it even if small
    chunks.push({
      content: currentChunk.join('\n\n'),
      index: chunkIndex++,
      sectionTitle: currentSection,
      tokenCount: currentTokens,
    });
  }

  return chunks;
}

/**
 * Split text into sections based on headings
 */
function splitIntoSections(text: string): Array<{
  title: string | null;
  paragraphs: string[];
}> {
  const sections: Array<{ title: string | null; paragraphs: string[] }> = [];

  // Patterns for detecting headings
  const headingPatterns = [
    /^#+\s+(.+)$/m,          // Markdown headings
    /^([A-Z][A-Z\s]{5,})$/m, // ALL CAPS lines
    /^(\d+\.?\s+[A-Z].+)$/m, // Numbered sections
  ];

  // Split by potential heading indicators
  const lines = text.split('\n');
  let currentSection: { title: string | null; paragraphs: string[] } = {
    title: null,
    paragraphs: [],
  };
  let currentParagraph: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check if this line is a heading
    let isHeading = false;
    let headingText: string | null = null;

    for (const pattern of headingPatterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        isHeading = true;
        headingText = match[1]?.trim() || trimmedLine;
        break;
      }
    }

    if (isHeading) {
      // Save current paragraph
      if (currentParagraph.length > 0) {
        currentSection.paragraphs.push(currentParagraph.join(' '));
        currentParagraph = [];
      }

      // Save current section and start new one
      if (currentSection.paragraphs.length > 0 || currentSection.title) {
        sections.push(currentSection);
      }

      currentSection = {
        title: headingText,
        paragraphs: [],
      };
    } else if (trimmedLine === '') {
      // End of paragraph
      if (currentParagraph.length > 0) {
        currentSection.paragraphs.push(currentParagraph.join(' '));
        currentParagraph = [];
      }
    } else {
      // Continue current paragraph
      currentParagraph.push(trimmedLine);
    }
  }

  // Don't forget final paragraph and section
  if (currentParagraph.length > 0) {
    currentSection.paragraphs.push(currentParagraph.join(' '));
  }
  if (currentSection.paragraphs.length > 0 || currentSection.title) {
    sections.push(currentSection);
  }

  // If no sections found, return all text as one section
  if (sections.length === 0) {
    return [{
      title: null,
      paragraphs: [text.trim()],
    }];
  }

  return sections;
}

/**
 * Split a large paragraph into sentence-based chunks
 */
function splitLargeParagraph(
  paragraph: string,
  maxTokens: number,
  sectionTitle: string | null
): Array<Omit<TextChunk, 'index'>> {
  const sentences = splitIntoSentences(paragraph);
  const chunks: Array<Omit<TextChunk, 'index'>> = [];

  let currentSentences: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    if (currentTokens + sentenceTokens > maxTokens) {
      if (currentSentences.length > 0) {
        chunks.push({
          content: currentSentences.join(' '),
          sectionTitle,
          tokenCount: currentTokens,
        });
      }
      currentSentences = [sentence];
      currentTokens = sentenceTokens;
    } else {
      currentSentences.push(sentence);
      currentTokens += sentenceTokens;
    }
  }

  if (currentSentences.length > 0) {
    chunks.push({
      content: currentSentences.join(' '),
      sectionTitle,
      tokenCount: currentTokens,
    });
  }

  return chunks;
}

/**
 * Split text into sentences
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence boundaries (. ! ?) followed by space or end
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.filter(s => s.trim().length > 0);
}

/**
 * Get overlap text from previous chunk
 */
function getOverlapText(
  previousParagraphs: string[],
  overlapTokens: number
): string | null {
  if (previousParagraphs.length === 0 || overlapTokens === 0) {
    return null;
  }

  // Get the last paragraph or part of it
  const lastParagraph = previousParagraphs[previousParagraphs.length - 1];
  const sentences = splitIntoSentences(lastParagraph);

  let overlap: string[] = [];
  let tokens = 0;

  // Take sentences from the end until we hit the token limit
  for (let i = sentences.length - 1; i >= 0; i--) {
    const sentenceTokens = estimateTokens(sentences[i]);
    if (tokens + sentenceTokens > overlapTokens) {
      break;
    }
    overlap.unshift(sentences[i]);
    tokens += sentenceTokens;
  }

  return overlap.length > 0 ? overlap.join(' ') : null;
}

/**
 * Chunk text with section title prefix
 * Useful for providing context in each chunk
 */
export function chunkTextWithContext(
  text: string,
  documentTitle: string,
  config: ChunkConfig = DEFAULT_CHUNK_CONFIG
): TextChunk[] {
  const chunks = chunkText(text, config);

  return chunks.map(chunk => {
    let contextPrefix = '';

    if (documentTitle) {
      contextPrefix += `Document: ${documentTitle}\n`;
    }

    if (chunk.sectionTitle) {
      contextPrefix += `Section: ${chunk.sectionTitle}\n`;
    }

    if (contextPrefix) {
      return {
        ...chunk,
        content: contextPrefix + '\n' + chunk.content,
        tokenCount: chunk.tokenCount + estimateTokens(contextPrefix),
      };
    }

    return chunk;
  });
}
