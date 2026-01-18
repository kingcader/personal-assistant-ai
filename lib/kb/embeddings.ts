/**
 * Embedding Generation Module
 *
 * Generates embeddings using OpenAI's text-embedding-3-small model.
 * Handles batching for efficiency.
 *
 * Part of Loop #5: Knowledge Base + RAG System
 */

import OpenAI from 'openai';

/**
 * OpenAI client (singleton)
 */
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * Embedding model configuration
 */
export const EMBEDDING_CONFIG = {
  model: 'text-embedding-3-small',
  dimensions: 1536,
  maxBatchSize: 2048,       // Max texts per API call
  maxTokensPerText: 8191,   // Max tokens per text for this model
};

/**
 * Result of embedding generation
 */
export interface EmbeddingResult {
  text: string;
  embedding: number[];
  index: number;
}

/**
 * Generate embedding for a single text
 *
 * @param text - Text to embed
 * @returns Embedding vector (1536 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAIClient();

  const response = await openai.embeddings.create({
    model: EMBEDDING_CONFIG.model,
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts (batch)
 *
 * @param texts - Array of texts to embed
 * @returns Array of embeddings in same order as input
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const openai = getOpenAIClient();
  const allEmbeddings: number[][] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += EMBEDDING_CONFIG.maxBatchSize) {
    const batch = texts.slice(i, i + EMBEDDING_CONFIG.maxBatchSize);

    const response = await openai.embeddings.create({
      model: EMBEDDING_CONFIG.model,
      input: batch,
    });

    // Sort by index to maintain order
    const sortedData = response.data.sort((a, b) => a.index - b.index);
    allEmbeddings.push(...sortedData.map((d) => d.embedding));
  }

  return allEmbeddings;
}

/**
 * Generate embeddings with rate limiting and error handling
 *
 * @param texts - Array of texts to embed
 * @param onProgress - Optional callback for progress updates
 * @returns Array of embedding results
 */
export async function generateEmbeddingsWithProgress(
  texts: string[],
  onProgress?: (processed: number, total: number) => void
): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];
  const batchSize = Math.min(EMBEDDING_CONFIG.maxBatchSize, 100); // Smaller batches for progress

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchIndices = batch.map((_, idx) => i + idx);

    try {
      const embeddings = await generateEmbeddings(batch);

      for (let j = 0; j < batch.length; j++) {
        results.push({
          text: batch[j],
          embedding: embeddings[j],
          index: batchIndices[j],
        });
      }

      if (onProgress) {
        onProgress(Math.min(i + batchSize, texts.length), texts.length);
      }

      // Small delay between batches to avoid rate limits
      if (i + batchSize < texts.length) {
        await sleep(100);
      }
    } catch (error) {
      console.error(`Error generating embeddings for batch ${i}:`, error);
      throw error;
    }
  }

  return results;
}

/**
 * Generate embedding for a search query
 * Same as generateEmbedding but semantically named
 *
 * @param query - Search query text
 * @returns Embedding vector
 */
export async function embedSearchQuery(query: string): Promise<number[]> {
  return generateEmbedding(query);
}

/**
 * Calculate cosine similarity between two embedding vectors
 *
 * @param a - First embedding
 * @param b - Second embedding
 * @returns Similarity score (0-1, higher is more similar)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find the most similar texts to a query using local embedding comparison
 *
 * @param queryEmbedding - Query embedding vector
 * @param documents - Array of documents with embeddings
 * @param limit - Maximum number of results
 * @param threshold - Minimum similarity threshold (0-1)
 * @returns Sorted array of documents with similarity scores
 */
export function findSimilar<T extends { embedding: number[] }>(
  queryEmbedding: number[],
  documents: T[],
  limit: number = 10,
  threshold: number = 0.7
): Array<T & { similarity: number }> {
  const results = documents
    .map((doc) => ({
      ...doc,
      similarity: cosineSimilarity(queryEmbedding, doc.embedding),
    }))
    .filter((doc) => doc.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}

/**
 * Helper: Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Estimate cost for embedding texts
 * text-embedding-3-small costs $0.02 per 1M tokens
 *
 * @param tokenCount - Total tokens to embed
 * @returns Estimated cost in USD
 */
export function estimateEmbeddingCost(tokenCount: number): number {
  const costPer1MTokens = 0.02;
  return (tokenCount / 1_000_000) * costPer1MTokens;
}
