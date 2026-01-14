import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function clearOldEmails() {
  // Keep the "Follow up with Jason" email, delete the rest
  const { data: emails } = await supabase
    .from('emails')
    .select('id, subject')
    .neq('subject', 'Follow up with Jason');

  if (!emails || emails.length === 0) {
    console.log('No emails to delete');
    return;
  }

  console.log(`\n📧 Found ${emails.length} old emails to clear:\n`);
  emails.forEach((e, i) => {
    console.log(`${i + 1}. ${e.subject}`);
  });

  const { error } = await supabase
    .from('emails')
    .delete()
    .neq('subject', 'Follow up with Jason');

  if (error) {
    console.error('\n❌ Error deleting:', error);
  } else {
    console.log(`\n✅ Deleted ${emails.length} emails. Ready to reprocess!\n`);
  }
}

clearOldEmails();
