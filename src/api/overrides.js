import { supabase, SUPABASE_SCHEMA } from '../lib/supabase';

const VALID_STATIONS = ['mixing', 'makeup-dividing', 'makeup-panning', 'baking', 'packaging'];

function overridesTable() {
  return supabase.schema(SUPABASE_SCHEMA).from('override_requests');
}

function planTable() {
  return supabase.schema(SUPABASE_SCHEMA).from('plan');
}

// opts.status filters pending | approved | rejected if you pass it
export async function listOverrides(opts = {}) {
  if (!supabase) return [];
  let q = overridesTable()
    .select('*')
    .order('created_at', { ascending: false });
  if (opts.status) {
    q = q.eq('status', opts.status);
  }
  const { data, error } = await q;
  if (error) {
    console.error('listOverrides error', error);
    return [];
  }
  return data ?? [];
}

// station_id must be one of VALID_STATIONS or insert gets skipped
export async function createOverride({ station_id, payload = {}, requested_by }) {
  if (!supabase) return { ok: false, id: null };
  if (!VALID_STATIONS.includes(station_id)) return { ok: false, id: null };
  const { data, error } = await overridesTable()
    .insert({
      station_id,
      payload: typeof payload === 'object' ? payload : {},
      requested_by: requested_by ?? null,
    })
    .select('id')
    .single();
  if (error) {
    console.error('createOverride error', error);
    return { ok: false, id: null };
  }
  return { ok: true, id: data?.id };
}

// if opts includes plan_date + rows we also PATCH the latest plan row (supervisor flow)
export async function approveOverride(overrideId, opts = {}) {
  if (!supabase) return { ok: false };
  const { error: updateError } = await overridesTable()
    .update({
      status: 'approved',
      decided_at: new Date().toISOString(),
      decided_by: opts.decided_by ?? null,
    })
    .eq('id', overrideId);
  if (updateError) {
    console.error('approveOverride error', updateError);
    return { ok: false };
  }
  if (opts.plan_date != null && opts.rows != null) {
    const { data: planRows } = await planTable().select('id').order('updated_at', { ascending: false }).limit(1);
    const planId = planRows?.[0]?.id;
    if (planId) {
      await planTable().update({
        plan_date: opts.plan_date,
        rows: opts.rows,
        updated_at: new Date().toISOString(),
        updated_by: opts.decided_by ?? null,
      }).eq('id', planId);
    }
  }
  return { ok: true };
}

export async function rejectOverride(overrideId, decided_by) {
  if (!supabase) return { ok: false };
  const { error } = await overridesTable()
    .update({
      status: 'rejected',
      decided_at: new Date().toISOString(),
      decided_by: decided_by ?? null,
    })
    .eq('id', overrideId);
  if (error) {
    console.error('rejectOverride error', error);
    return { ok: false };
  }
  return { ok: true };
}

// supabase realtime — remember to call the returned unsub on unmount
export function subscribeOverrides(onEvent) {
  if (!supabase || !onEvent) return () => {};
  const channel = supabase
    .channel('override-changes')
    .on('postgres_changes', { event: '*', schema: SUPABASE_SCHEMA, table: 'override_requests' }, (payload) => {
      onEvent(payload);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
