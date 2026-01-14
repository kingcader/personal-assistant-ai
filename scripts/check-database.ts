import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkDatabase() {
  // Check emails
  const { data: emails, error: emailError } = await supabase
    .from('emails')
    .select('id, subject, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (emailError) {
    console.error('Error fetching emails:', emailError);
    return;
  }

  console.log(`\n📧 Found ${emails?.length || 0} emails in database:\n`);
  emails?.forEach((email, i) => {
    console.log(`${i + 1}. ${email.subject}`);
  });

  // Check suggestions
  const { count: suggestionCount, error: suggestionError } = await supabase
    .from('suggestions')
    .select('*', { count: 'exact', head: true });

  if (suggestionError) {
    console.error('Error counting suggestions:', suggestionError);
    return;
  }

  console.log(`\n💡 Total suggestions: ${suggestionCount || 0}\n`);

  if (suggestionCount && suggestionCount > 0) {
    const { data: suggestions } = await supabase
      .from('suggestions')
      .select('title, status, priority')
      .limit(5);

    console.log('Recent suggestions:');
    suggestions?.forEach((s, i) => {
      console.log(`${i + 1}. [${s.status}] ${s.title} (${s.priority})`);
    });
  }
}

checkDatabase();
