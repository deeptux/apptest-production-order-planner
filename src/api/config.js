import { supabase, SUPABASE_SCHEMA } from '../lib/supabase';

function configTable() {
  return supabase.schema(SUPABASE_SCHEMA).from('config');
}

// generic key/value bag in supabase (recipes, lines, ...)
export async function getConfig(key) {
  if (!supabase || !key) return null;
  const { data, error } = await configTable()
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
  if (!supabase || !key) return { ok: false };
  const { error } = await configTable()
    .upsert({
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
  if (!supabase || typeof onKeyChange !== 'function') return () => {};
  const channel = supabase
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
    supabase.removeChannel(channel);
  };
}
