import { getSupabase, SUPABASE_SCHEMA } from '../lib/supabase';

function planTable() {
  const s = getSupabase();
  if (!s) return null;
  return s.schema(SUPABASE_SCHEMA).from('plan');
}

// newest row by updated_at wins (we only keep one "current" plan in the table right now)
export async function getPlan() {
  const t = planTable();
  if (!t) return null;
  const { data, error } = await t
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

// planId set => update; missing => insert (first save on fresh db)
export async function updatePlan(planId, { planDate, rows }) {
  const t = planTable();
  if (!t) return { ok: false };
  const payload = {
    plan_date: planDate instanceof Date ? planDate.toISOString() : planDate,
    rows: rows ?? [],
    updated_at: new Date().toISOString(),
  };
  if (planId) {
    const { error } = await t.update(payload).eq('id', planId);
    if (error) {
      console.error('updatePlan error', error);
      return { ok: false };
    }
    return { ok: true };
  }
  const { data, error } = await t.insert(payload).select('id').single();
  if (error) {
    console.error('updatePlan insert error', error);
    return { ok: false };
  }
  return { ok: true, id: data?.id };
}

export function subscribePlan(onUpdate) {
  const s = getSupabase();
  if (!s || !onUpdate) return () => {};
  const channel = s
    .channel('plan-changes')
    .on('postgres_changes', { event: '*', schema: SUPABASE_SCHEMA, table: 'plan' }, () => {
      getPlan().then((data) => data && onUpdate(data));
    })
    .subscribe();
  return () => {
    s.removeChannel(channel);
  };
}
