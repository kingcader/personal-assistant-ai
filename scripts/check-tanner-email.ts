import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkTannerEmail() {
  const { data, error } = await supabase
    .from('emails')
    .select('subject, body')
    .like('subject', '%Daily Report | Tanner%')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    console.log('No Tanner email found or error:', error);
    return;
  }

  const email = data[0];
  console.log('Subject:', email.subject);
  console.log('\nBody:\n---');
  console.log(email.body);
  console.log('---');
  console.log('\nContains "Kincaid"?', email.body.toLowerCase().includes('kincaid'));
}

checkTannerEmail();
