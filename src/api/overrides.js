import { getSupabase, SUPABASE_SCHEMA } from '../lib/supabase';

const VALID_STATIONS = ['mixing', 'makeup-dividing', 'makeup-panning', 'baking', 'packaging'];

/** Legacy station ids accepted by DB `override_requests.station_id`. Exported for supervisor Live View routing. */
export const OVERRIDE_STATION_IDS = [...VALID_STATIONS];

/** Map any process id to a valid DB station (custom line processes use `mixing` as the shared bucket + payload disambiguation). */
export function resolveOverrideStationId(processId) {
  if (processId && VALID_STATIONS.includes(processId)) return processId;
  return 'mixing';
}

function overridesTable() {
  const s = getSupabase();
  if (!s) return null;
  return s.schema(SUPABASE_SCHEMA).from('override_requests');
}

function planTable() {
  const s = getSupabase();
  if (!s) return null;
  return s.schema(SUPABASE_SCHEMA).from('plan');
}

// opts.status filters pending | approved | rejected if you pass it
export async function listOverrides(opts = {}) {
  const t = overridesTable();
  if (!t) return [];
  let q = t.select('*').order('created_at', { ascending: false });
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

/** Pending rows only — filters in JS so we never miss rows if status default / casing differs. */
export async function listPendingOverrideRequests() {
  const t = overridesTable();
  if (!t) return [];
  const { data, error } = await t
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) {
    console.error('listPendingOverrideRequests error', error);
    return [];
  }
  return (data ?? []).filter((r) => {
    const s = String(r.status ?? 'pending').toLowerCase().trim();
    return s === 'pending';
  });
}

/**
 * Requests submitted from this browser (payload.supervisorClientId), optionally scoped to one live URL.
 * Client-side filter after a capped fetch — fine for typical queue sizes.
 */
export async function listOverridesForSupervisor(clientId, opts = {}) {
  const t = overridesTable();
  if (!t || !clientId) return [];
  const { lineId, processId, limit = 50 } = opts;
  const { data, error } = await t
    .select('*')
    .order('created_at', { ascending: false })
    .limit(400);
  if (error) {
    console.error('listOverridesForSupervisor error', error);
    return [];
  }
  let rows = (data ?? []).filter((r) => r.payload?.supervisorClientId === clientId);
  if (lineId) rows = rows.filter((r) => r.payload?.productionLineId === lineId);
  if (processId) rows = rows.filter((r) => r.payload?.processId === processId);
  return rows.slice(0, limit);
}

// station_id must be one of VALID_STATIONS or insert gets skipped
export async function createOverride({ station_id, payload = {}, requested_by }) {
  const t = overridesTable();
  if (!t) return { ok: false, id: null };
  if (!VALID_STATIONS.includes(station_id)) return { ok: false, id: null };
  const { data, error } = await t
    .insert({
      station_id,
      payload: typeof payload === 'object' ? payload : {},
      requested_by: requested_by ?? null,
      status: 'pending',
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
  const ot = overridesTable();
  const pt = planTable();
  if (!ot) return { ok: false };
  const { error: updateError } = await ot
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
  if (pt && opts.plan_date != null && opts.rows != null) {
    const { data: planRows } = await pt.select('id').order('updated_at', { ascending: false }).limit(1);
    const planId = planRows?.[0]?.id;
    if (planId) {
      await pt.update({
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
  const t = overridesTable();
  if (!t) return { ok: false };
  const { error } = await t
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

/** Supervisor withdraws their own pending row, or admin removes it. Requires DELETE RLS (see migration 003). */
export async function deleteOverride(overrideId) {
  const t = overridesTable();
  if (!t || !overrideId) return { ok: false };
  const { error } = await t.delete().eq('id', overrideId);
  if (error) {
    console.error('deleteOverride error', error);
    return { ok: false };
  }
  return { ok: true };
}

// supabase realtime — remember to call the returned unsub on unmount
export function subscribeOverrides(onEvent) {
  const s = getSupabase();
  if (!s || !onEvent) return () => {};
  const channelName = `loaf-override-requests:${SUPABASE_SCHEMA}`;
  const channel = s
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: SUPABASE_SCHEMA, table: 'override_requests' },
      (payload) => {
        onEvent(payload);
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('subscribeOverrides: Realtime channel issue — pending list may lag until refresh.');
      }
    });
  return () => {
    s.removeChannel(channel);
  };
}
