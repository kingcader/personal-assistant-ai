/**
 * Direct Email Processing Script
 *
 * Bypasses the HTTP API to avoid timeout issues during testing.
 * Usage: npx tsx scripts/process-emails-direct.ts
 */

// Load env BEFORE any other imports
import { config } from 'dotenv';
config({ path: '.env.local' });

(async () => {
  // Dynamic imports after env is loaded
  const { fetchEmailsWithLabel, parseEmailAddress } = await import('../lib/gmail/client');
  const { upsertEmail, insertSuggestions } = await import('../lib/supabase/task-queries');
  const { TASK_EXTRACTION_SYSTEM_PROMPT, validateTaskExtractionResult } = await import('../lib/ai/task-extraction-prompt');

  async function extractWithOpenAI(userMessage: string) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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

    if (!content) return [];

    const parsed = JSON.parse(content);

    if (Array.isArray(parsed)) return parsed;
    if (parsed.tasks && Array.isArray(parsed.tasks)) return parsed.tasks;
    if (parsed.title && parsed.why) return [parsed];
    return [];
  }

  console.log('🔄 Starting direct email processing...\n');

  const labelName = process.env.GMAIL_LABEL_NAME || 'AI/Work';
  const emails = await fetchEmailsWithLabel(labelName, 50);

  console.log(`📧 Found ${emails.length} emails with label "${labelName}"\n`);

  const results = {
    processed: 0,
    skipped: 0,
    suggestions_created: 0,
    errors: [] as string[],
  };

  for (const email of emails) {
    try {
      // Check if email already exists
      const { email: dbEmail, isNew } = await upsertEmail({
        gmail_message_id: email.id,
        thread_id: email.threadId,
        sender_email: parseEmailAddress(email.from).email,
        sender_name: parseEmailAddress(email.from).name,
        subject: email.subject,
        body: email.body,
        received_at: email.receivedAt.toISOString(),
        to_emails: email.to.map((e: string) => parseEmailAddress(e).email),
        cc_emails: email.cc.map((e: string) => parseEmailAddress(e).email),
        has_attachments: email.hasAttachments,
      });

      if (!isNew) {
        console.log(`⏭️  Skip: ${email.subject}`);
        results.skipped++;
        continue;
      }

      console.log(`📨 Processing: ${email.subject}`);

      // Call AI for task extraction
      const userMessage = `Extract actionable tasks from this email:

Subject: ${email.subject}
From: ${email.from}
Received: ${email.receivedAt.toISOString()}
To: ${email.to.join(', ')}

Body:
${email.body}`;

      const suggestions = await extractWithOpenAI(userMessage);
      const validSuggestions = validateTaskExtractionResult(suggestions);

      // Insert suggestions
      if (validSuggestions.length > 0) {
        const inserted = await insertSuggestions(dbEmail.id, validSuggestions, 'gpt-4o-mini');
        console.log(`   ✅ ${inserted.length} tasks extracted`);
        results.suggestions_created += inserted.length;
      } else {
        console.log(`   📭 No tasks for Kincaid`);
      }

      results.processed++;
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      results.errors.push(`${email.subject}: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Results:');
  console.log(`   Processed: ${results.processed}`);
  console.log(`   Skipped: ${results.skipped}`);
  console.log(`   Suggestions created: ${results.suggestions_created}`);
  if (results.errors.length > 0) {
    console.log(`   Errors: ${results.errors.length}`);
  }
})().catch(console.error);
