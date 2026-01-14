import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function showSuggestions() {
  const { data: suggestions, error } = await supabase
    .from('suggestions')
    .select(`
      *,
      email:emails(subject)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\n💡 Found ${suggestions?.length || 0} pending suggestions:\n`);
  console.log('='.repeat(80));

  suggestions?.forEach((s, i) => {
    console.log(`\n${i + 1}. ${s.title}`);
    console.log(`   Priority: ${s.priority.toUpperCase()}`);
    console.log(`   Due Date: ${s.suggested_due_date || 'No deadline'}`);
    console.log(`   Owner: ${s.suggested_owner_email}`);
    console.log(`   Why: ${s.why}`);
    console.log(`   From Email: "${s.email.subject}"`);
    console.log('   ' + '-'.repeat(76));
  });

  console.log('\n✅ Go to http://localhost:3004/approvals to approve these!\n');
}

showSuggestions();
