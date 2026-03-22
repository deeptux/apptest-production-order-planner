import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// one supabase project can hold multiple apps — we isolate tables under this schema (default apptest_prodplanner)
export const SUPABASE_SCHEMA = import.meta.env.VITE_SUPABASE_SCHEMA || 'apptest_prodplanner';

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = () => !!supabase;
