import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkEmailDetails() {
  const { data: emails, error } = await supabase
    .from('emails')
    .select('*')
    .eq('subject', 'Q4 Budget Review Needed')
    .single();

  if (error) {
    console.error('Error fetching email:', error);
    return;
  }

  console.log('\n📧 Email Details:\n');
  console.log('Subject:', emails.subject);
  console.log('Sender:', emails.sender_email);
  console.log('Received:', emails.received_at);
  console.log('\nBody:\n---');
  console.log(emails.body);
  console.log('---\n');
}

checkEmailDetails();
