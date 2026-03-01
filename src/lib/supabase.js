import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Schema for this app (allows one Supabase project to host multiple apps). Default: apptest_prodplanner */
export const SUPABASE_SCHEMA = import.meta.env.VITE_SUPABASE_SCHEMA || 'apptest_prodplanner';

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = () => !!supabase;
