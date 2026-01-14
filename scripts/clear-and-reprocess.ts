import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
  console.log('🗑️ Clearing database...');

  // Delete tasks first (depends on emails)
  const { error: e0 } = await supabase
    .from('tasks')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('  Tasks:', e0 ? `ERROR: ${e0.message}` : 'deleted');

  // Delete suggestions (depends on emails)
  const { error: e1 } = await supabase
    .from('suggestions')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('  Suggestions:', e1 ? `ERROR: ${e1.message}` : 'deleted');

  // Delete emails
  const { error: e2 } = await supabase
    .from('emails')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('  Emails:', e2 ? `ERROR: ${e2.message}` : 'deleted');

  // Verify counts
  const { count: sugCount } = await supabase
    .from('suggestions')
    .select('*', { count: 'exact', head: true });
  const { count: emailCount } = await supabase
    .from('emails')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 Remaining: ${emailCount} emails, ${sugCount} suggestions`);

  if (emailCount === 0) {
    console.log('✅ Database cleared successfully!');
  } else {
    console.log('⚠️ Some data remains - may need manual cleanup');
  }
}

main().catch(console.error);
