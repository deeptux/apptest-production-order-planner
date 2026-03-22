import { createClient } from '@supabase/supabase-js';

/** Runtime kill-switch: same-tab + after reload, all DB calls no-op (see .env.example). */
export const PLANNER_FORCE_LOCAL_STORAGE_KEY = 'loaf-force-local-only';

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

/**
 * Underlying client from env (frozen until Vite rebuild / dev server restart).
 * Vite inlines import.meta.env — if you comment .env but do NOT restart `npm run dev`,
 * this can still be non-null. Use getSupabase() + PLANNER_FORCE_LOCAL_STORAGE_KEY to override at runtime.
 */
const underlyingSupabase =
  !useLocalOnly && url && anonKey ? createClient(url, anonKey) : null;

export function readPlannerForceLocalOnly() {
  try {
    return localStorage.getItem(PLANNER_FORCE_LOCAL_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Use this instead of importing a bare `supabase` singleton.
 * Respects localStorage `loaf-force-local-only=1` so you can disconnect without waiting for a dev-server restart.
 */
export function getSupabase() {
  if (readPlannerForceLocalOnly()) return null;
  return underlyingSupabase;
}

export const isSupabaseConfigured = () => !!getSupabase();

/** Dev / emergency: force local-only until cleared + full page reload (drops stale Realtime). */
export function setPlannerForceLocalOnly(enabled) {
  try {
    if (enabled) {
      localStorage.setItem(PLANNER_FORCE_LOCAL_STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(PLANNER_FORCE_LOCAL_STORAGE_KEY);
    }
  } catch (_) {}
  window.dispatchEvent(new CustomEvent('planner-force-local-changed'));
}
