import { getSupabase, SUPABASE_SCHEMA } from '../lib/supabase';

function configTable() {
  const s = getSupabase();
  if (!s) return null;
  return s.schema(SUPABASE_SCHEMA).from('config');
}

// generic key/value bag in supabase (recipes, lines, ...)
export async function getConfig(key) {
  const t = configTable();
  if (!t || !key) return null;
  const { data, error } = await t
    .select('key, payload')
    .eq('key', key)
    .maybeSingle();
  if (error) {
    console.error('getConfig error', error);
    return null;
  }
  return data;
}

export async function updateConfig(key, payload) {
  const t = configTable();
  if (!t || !key) return { ok: false };
  const { error } = await t.upsert({
    key,
    payload: payload ?? {},
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error('updateConfig error', error);
    return { ok: false };
  }
  return { ok: true };
}

/** Supabase Realtime (WebSocket) — fires when any row in apptest_prodplanner.config changes. Add table to replication publication (see supabase/README.md). */
export function subscribeConfig(onKeyChange) {
  const s = getSupabase();
  if (!s || typeof onKeyChange !== 'function') return () => {};
  const channel = s
    .channel('config-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: SUPABASE_SCHEMA, table: 'config' },
      (payload) => {
        const key = payload.new?.key ?? payload.old?.key;
        if (key) onKeyChange(key, payload.new ?? null);
      },
    )
    .subscribe();
  return () => {
    s.removeChannel(channel);
  };
}
