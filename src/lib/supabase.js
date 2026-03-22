import { createClient } from '@supabase/supabase-js';

/** Trim; treat empty, comment lines (#...), and invalid URLs as unset (local-only mode). */
function readEnvString(name) {
  const raw = import.meta.env[name];
  if (raw == null || typeof raw !== 'string') return '';
  const t = raw.trim();
  if (t === '' || t.startsWith('#')) return '';
  return t;
}

function isTruthyLocalFlag(v) {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

// Force local-only mode even if URL/key exist (e.g. local dev without touching shared DB).
const useLocalOnly = isTruthyLocalFlag(import.meta.env.VITE_USE_LOCAL_ONLY);

const urlRaw = readEnvString('VITE_SUPABASE_URL');
const anonKeyRaw = readEnvString('VITE_SUPABASE_ANON_KEY');
const url = /^https?:\/\//i.test(urlRaw) ? urlRaw : '';
const anonKey = anonKeyRaw.length >= 20 ? anonKeyRaw : '';

// one supabase project can hold multiple apps — we isolate tables under this schema (default apptest_prodplanner)
export const SUPABASE_SCHEMA = import.meta.env.VITE_SUPABASE_SCHEMA || 'apptest_prodplanner';

export const supabase =
  !useLocalOnly && url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = () => !!supabase;
