import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const clientOptions = {
  auth: { persistSession: false },
  realtime: { transport: ws as any },
};

let supabase: ReturnType<typeof createClient>;

if (!supabaseUrl || !supabaseKey) {
  console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Using placeholder client — database operations will fail.');
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key', clientOptions);
} else {
  supabase = createClient(supabaseUrl, supabaseKey, clientOptions);
}

export { supabase };
