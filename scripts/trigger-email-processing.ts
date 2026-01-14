/**
 * Manual Email Processing Trigger
 *
 * Use this to manually trigger email processing for testing.
 * In production, this will be triggered by a cron job.
 *
 * Usage: npx tsx scripts/trigger-email-processing.ts
 */

import { config } from 'dotenv';

// Load .env.local file
config({ path: '.env.local' });

async function triggerEmailProcessing() {
  console.log('🚀 Triggering email processing...\n');

  const cronSecret = process.env.CRON_SECRET;
  const headers: HeadersInit = {};

  if (cronSecret) {
    headers['Authorization'] = `Bearer ${cronSecret}`;
  }

  try {
    const response = await fetch('http://localhost:3004/api/cron/process-emails', {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    console.log('📊 Result:', JSON.stringify(data, null, 2));
    console.log('\n');

    if (data.success) {
      console.log('✅ Email processing complete!');
      console.log(`   Processed: ${data.processed}`);
      console.log(`   Skipped: ${data.skipped}`);
      console.log(`   Suggestions created: ${data.suggestions_created}`);

      if (data.errors && data.errors.length > 0) {
        console.log(`   Errors: ${data.errors.length}`);
        data.errors.forEach((err: string) => console.log(`     - ${err}`));
      }
    } else {
      console.error('❌ Email processing failed:', data.error);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

triggerEmailProcessing();
