import { config } from 'dotenv';
import { fetchEmailsWithLabel } from '../lib/gmail/client';

config({ path: '.env.local' });

async function listGmailEmails() {
  try {
    console.log('📧 Fetching emails with "Work" label from Gmail...\n');
    const emails = await fetchEmailsWithLabel('Work', 20);

    console.log(`Found ${emails.length} emails:\n`);
    emails.forEach((email, i) => {
      console.log(`${i + 1}. ${email.subject}`);
      console.log(`   From: ${email.from}`);
      console.log(`   Date: ${email.receivedAt.toLocaleString()}`);
      console.log();
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

listGmailEmails();
