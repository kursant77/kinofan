import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if ((url && !anonKey) || (!url && anonKey)) {
  console.warn('Kinofan: set both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for Supabase mode.');
}

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
