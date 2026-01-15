import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Lazy initialization to avoid build-time errors when env vars aren't available
let _supabase: ReturnType<typeof createClient<Database>> | null = null;

function getSupabaseClient() {
  if (_supabase) {
    return _supabase;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During build time, return a mock client to avoid errors
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window === 'undefined') {
      // Server-side during build - return a mock
      console.warn('Supabase env vars not available during build');
      return {} as ReturnType<typeof createClient<Database>>;
    }
    throw new Error(
      'Missing Supabase environment variables. Please check your .env.local file.'
    );
  }

  _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  return _supabase;
}

// Export as a getter property
export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(target, prop) {
    const client = getSupabaseClient();
    return (client as any)[prop];
  }
});
