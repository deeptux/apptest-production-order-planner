import { useEffect, useRef } from 'react';
import { subscribePlan } from '../api/plan';
import { subscribeOverrides } from '../api/overrides';
import { isSupabaseConfigured } from '../lib/supabase';

/**
 * Subscribe to plan and override_requests realtime. Callbacks are called when
 * backend emits changes (so all clients stay in sync).
 * @param {{ onPlanUpdate?: (data: { id, plan_date, rows }) => void, onOverrideEvent?: (payload) => void }} opts
 */
export function usePlanRealtime(opts = {}) {
  const onPlanUpdateRef = useRef(opts.onPlanUpdate);
  const onOverrideEventRef = useRef(opts.onOverrideEvent);
  onPlanUpdateRef.current = opts.onPlanUpdate;
  onOverrideEventRef.current = opts.onOverrideEvent;

  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;
    const unsubPlan = subscribePlan((data) => {
      onPlanUpdateRef.current?.(data);
    });
    const unsubOverrides = subscribeOverrides((payload) => {
      onOverrideEventRef.current?.(payload);
    });
    return () => {
      unsubPlan();
      unsubOverrides();
    };
  }, []);
}
