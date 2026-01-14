import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function deleteTestEmail() {
  const { error } = await supabase
    .from('emails')
    .delete()
    .eq('subject', 'Q4 Budget Review Needed');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Deleted test email - ready for a new one!');
  }
}

deleteTestEmail();
