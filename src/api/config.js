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

