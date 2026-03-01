import { supabase, SUPABASE_SCHEMA } from '../lib/supabase';

function planTable() {
  return supabase.schema(SUPABASE_SCHEMA).from('plan');
}

/**
 * Fetch the current plan (single row with latest updated_at).
 * Returns { id, plan_date, rows } or null if no backend or no row.
 */
export async function getPlan() {
  if (!supabase) return null;
  const { data, error } = await planTable()
    .select('id, plan_date, rows')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('getPlan error', error);
    return null;
  }
  return data;
}

/**
 * Update the plan. If planId is provided, update that row; otherwise insert a new row.
 * planDate: Date or ISO string; rows: array of row objects.
 */
export async function updatePlan(planId, { planDate, rows }) {
  if (!supabase) return { ok: false };
  const payload = {
    plan_date: planDate instanceof Date ? planDate.toISOString() : planDate,
    rows: rows ?? [],
    updated_at: new Date().toISOString(),
  };
  if (planId) {
    const { error } = await planTable().update(payload).eq('id', planId);
    if (error) {
      console.error('updatePlan error', error);
      return { ok: false };
    }
    return { ok: true };
  }
  const { data, error } = await planTable().insert(payload).select('id').single();
  if (error) {
    console.error('updatePlan insert error', error);
    return { ok: false };
  }
  return { ok: true, id: data?.id };
}

/**
 * Subscribe to plan table changes (Realtime). Calls onUpdate when plan row changes.
 * Returns unsubscribe function.
 */
export function subscribePlan(onUpdate) {
  if (!supabase || !onUpdate) return () => {};
  const channel = supabase
    .channel('plan-changes')
    .on('postgres_changes', { event: '*', schema: SUPABASE_SCHEMA, table: 'plan' }, () => {
      getPlan().then((data) => data && onUpdate(data));
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
