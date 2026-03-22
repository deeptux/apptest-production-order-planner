import { useEffect, useRef } from 'react';
import { subscribePlan } from '../api/plan';
import { subscribeOverrides } from '../api/overrides';
import { isSupabaseConfigured } from '../lib/supabase';

// wires supabase channels for plan + override_requests; refs so we don't resubscribe every render
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
