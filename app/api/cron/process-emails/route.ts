/**
 * Email Processing Cron Job
 *
 * This API route replaces the N8N workflow.
 * Fetches emails from Gmail, extracts tasks with AI, and inserts suggestions into Supabase.
 *
 * Trigger:
 * - Local: Run manually or with a simple Node.js cron
 * - Production: Vercel Cron, GitHub Actions, or any cron service
 *
 * Usage: GET /api/cron/process-emails
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchEmailsWithLabel, parseEmailAddress } from '@/lib/gmail/client';
import { upsertEmail, insertSuggestions } from '@/lib/supabase/task-queries';
import { TASK_EXTRACTION_SYSTEM_PROMPT, validateTaskExtractionResult } from '@/lib/ai/task-extraction-prompt';

export const dynamic = 'force-dynamic';

/**
 * Main email processing handler
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate (optional: check for a secret token)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting email processing...');

    // 2. Fetch emails from Gmail
    const labelName = process.env.GMAIL_LABEL_NAME || 'AI/Work';
    const emails = await fetchEmailsWithLabel(labelName, 50); // Fetch more to catch older emails

    console.log(`📧 Found ${emails.length} emails with label "${labelName}"`);

    const results = {
      processed: 0,
      skipped: 0,
      suggestions_created: 0,
      errors: [] as string[],
    };

    // 3. Process each email
    for (const email of emails) {
      try {
        // 3a. Check if email already exists (idempotency)
        const { email: dbEmail, isNew } = await upsertEmail({
          gmail_message_id: email.id,
          thread_id: email.threadId,
          sender_email: parseEmailAddress(email.from).email,
          sender_name: parseEmailAddress(email.from).name,
          subject: email.subject,
          body: email.body,
          received_at: email.receivedAt.toISOString(),
          to_emails: email.to.map((e) => parseEmailAddress(e).email),
          cc_emails: email.cc.map((e) => parseEmailAddress(e).email),
          has_attachments: email.hasAttachments,
        });

        if (!isNew) {
          console.log(`⏭️  Skipping already processed email: ${email.subject}`);
          results.skipped++;
          continue;
        }

        console.log(`✅ Inserted new email: ${email.subject}`);

        // 3b. Call AI for task extraction
        const aiProvider = (process.env.AI_PROVIDER || 'openai') as 'openai' | 'anthropic';
        const suggestions = await extractTasksWithAI(email, aiProvider);

        console.log(`🤖 AI returned ${suggestions.length} suggestions:`, JSON.stringify(suggestions, null, 2));

        // 3c. Validate AI response
        const validSuggestions = validateTaskExtractionResult(suggestions);

        console.log(`✅ ${validSuggestions.length} suggestions passed validation`);

        // 3d. Insert suggestions into database
        if (validSuggestions.length > 0) {
          await insertSuggestions(
            dbEmail.id,
            validSuggestions,
            aiProvider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-sonnet'
          );
          results.suggestions_created += validSuggestions.length;
        }

        results.processed++;
      } catch (error) {
        console.error(`❌ Error processing email ${email.subject}:`, error);
        results.errors.push(`${email.subject}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('✅ Email processing complete:', results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('❌ Fatal error in email processing:', error);
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
 * Extract tasks from email using AI
 */
async function extractTasksWithAI(
  email: { subject: string; from: string; to: string[]; body: string; receivedAt: Date },
  provider: 'openai' | 'anthropic'
) {
  const userMessage = `Extract actionable tasks from this email:

Subject: ${email.subject}
From: ${email.from}
Received: ${email.receivedAt.toISOString()}
To: ${email.to.join(', ')}

Body:
${email.body}`;

  if (provider === 'openai') {
    return await extractWithOpenAI(userMessage);
  } else {
    return await extractWithAnthropic(userMessage);
  }
}

/**
 * OpenAI task extraction
 */
async function extractWithOpenAI(userMessage: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // Using gpt-4o-mini (faster, cheaper, widely available)
      messages: [
        { role: 'system', content: TASK_EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  console.log('🔍 OpenAI raw response:', content);

  if (!content) {
    return [];
  }

  // OpenAI returns the array wrapped in an object, so we need to parse it
  const parsed = JSON.parse(content);
  console.log('🔍 Parsed JSON:', JSON.stringify(parsed, null, 2));

  // Handle different response formats:
  // 1. Array: [{task}, {task}]
  // 2. Object with tasks property: {tasks: [{task}, {task}]}
  // 3. Single task object: {title, why, ...}
  let result: any[];
  if (Array.isArray(parsed)) {
    result = parsed;
  } else if (parsed.tasks && Array.isArray(parsed.tasks)) {
    result = parsed.tasks;
  } else if (parsed.title && parsed.why) {
    // Single task object - wrap in array
    result = [parsed];
  } else {
    result = [];
  }

  console.log('🔍 Final result:', JSON.stringify(result, null, 2));

  return result;
}

/**
 * Anthropic task extraction
 */
async function extractWithAnthropic(userMessage: string) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: TASK_EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text;

  if (!content) {
    return [];
  }

  return JSON.parse(content);
}
