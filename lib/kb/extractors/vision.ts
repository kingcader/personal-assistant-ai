/**
 * AI Vision Extractor
 *
 * Uses OpenAI GPT-4 Vision to analyze images and generate
 * searchable text descriptions.
 *
 * Part of Loop #5.5: AI Vision Enhancement
 */

import OpenAI from 'openai';
import { downloadFile } from '@/lib/google/drive';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Vision analysis prompt for documents/images
 */
const VISION_ANALYSIS_PROMPT = `Analyze this image and provide a detailed description that would be useful for search and retrieval. Include:

1. **Document Type**: What kind of document or image is this? (e.g., architectural rendering, floor plan, contract, photo, diagram)

2. **Key Content**: Describe the main content, subjects, or information shown. Be specific about:
   - For architectural drawings: building style, rooms, layout, dimensions if visible
   - For photos: subjects, location, context
   - For documents: main topics, key information, names mentioned
   - For diagrams/charts: what data or concepts are being illustrated

3. **Text Content**: Transcribe any visible text, labels, titles, or annotations.

4. **Notable Details**: Any important details, branding, dates, or identifiers visible.

Format your response as plain text paragraphs that would be useful for semantic search. Be comprehensive but concise.`;

/**
 * Analyze an image using GPT-4 Vision
 *
 * @param imageBuffer - The image file as a Buffer
 * @param mimeType - The MIME type of the image
 * @param fileName - The file name for context
 * @returns Text description of the image
 */
export async function analyzeImageWithVision(
  imageBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  // Convert buffer to base64
  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  console.log(`🔍 Analyzing image with AI vision: ${fileName}`);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o', // GPT-4o has vision capabilities
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `File name: ${fileName}\n\n${VISION_ANALYSIS_PROMPT}`,
          },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl,
              detail: 'high', // Use high detail for better analysis
            },
          },
        ],
      },
    ],
    max_tokens: 2000,
  });

  const description = response.choices[0]?.message?.content || '';

  if (!description.trim()) {
    throw new Error('AI vision returned empty description');
  }

  console.log(`✅ AI vision analysis complete: ${description.length} characters`);

  return `[AI Vision Analysis of ${fileName}]\n\n${description}`;
}

/**
 * Extract image from Google Drive and analyze with AI vision
 *
 * @param fileId - Google Drive file ID
 * @param mimeType - The MIME type
 * @param fileName - The file name
 * @returns AI-generated description
 */
export async function extractImageWithVision(
  fileId: string,
  mimeType: string,
  fileName: string
): Promise<{ success: boolean; text: string; error?: string }> {
  try {
    // Download the image from Drive
    const imageBuffer = await downloadFile(fileId);

    // Check file size (GPT-4V has limits)
    const maxSizeBytes = 20 * 1024 * 1024; // 20MB limit
    if (imageBuffer.length > maxSizeBytes) {
      return {
        success: false,
        text: '',
        error: `Image too large (${Math.round(imageBuffer.length / 1024 / 1024)}MB). Max 20MB.`,
      };
    }

    // Analyze with AI vision
    const description = await analyzeImageWithVision(imageBuffer, mimeType, fileName);

    return {
      success: true,
      text: description,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Vision extraction failed for ${fileName}:`, errorMessage);
    return {
      success: false,
      text: '',
      error: errorMessage,
    };
  }
}

/**
 * Analyze a PDF page image with AI vision
 * Used for image-based PDFs that have no extractable text
 *
 * @param pdfBuffer - The PDF file as a Buffer
 * @param fileName - The file name
 * @returns AI-generated description of PDF content
 */
export async function analyzePdfWithVision(
  pdfBuffer: Buffer,
  fileName: string
): Promise<string> {
  // For PDFs, we'll send the first page as an image
  // Note: This is a simplified approach. For multi-page PDFs,
  // you might want to use pdf-to-image conversion libraries.

  // GPT-4o can actually handle PDFs directly in some cases,
  // but for reliability we'll describe what we're sending
  const base64Pdf = pdfBuffer.toString('base64');

  console.log(`🔍 Analyzing PDF with AI vision: ${fileName}`);

  // Try sending as PDF first (GPT-4o can sometimes handle this)
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `This is a PDF file named "${fileName}". Please analyze its visual content and provide a detailed description.\n\n${VISION_ANALYSIS_PROMPT}`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:application/pdf;base64,${base64Pdf}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
    max_tokens: 2000,
  });

  const description = response.choices[0]?.message?.content || '';

  if (!description.trim()) {
    throw new Error('AI vision returned empty description for PDF');
  }

  console.log(`✅ AI PDF vision analysis complete: ${description.length} characters`);

  return `[AI Vision Analysis of PDF: ${fileName}]\n\n${description}`;
}
