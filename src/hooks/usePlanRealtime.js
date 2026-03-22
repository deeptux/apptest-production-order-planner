import { useEffect, useRef } from 'react';
import { subscribePlan } from '../api/plan';
import { subscribeOverrides } from '../api/overrides';
import { subscribeConfig } from '../api/config';
import { isSupabaseConfigured } from '../lib/supabase';

// wires supabase channels for plan + override_requests; refs so we don't resubscribe every render
export function usePlanRealtime(opts = {}) {
  const onPlanUpdateRef = useRef(opts.onPlanUpdate);
  const onOverrideEventRef = useRef(opts.onOverrideEvent);
  const onConfigKeyRef = useRef(opts.onConfigKeyChange);
  onPlanUpdateRef.current = opts.onPlanUpdate;
  onOverrideEventRef.current = opts.onOverrideEvent;
  onConfigKeyRef.current = opts.onConfigKeyChange;

  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;
    const unsubPlan = subscribePlan((data) => {
      onPlanUpdateRef.current?.(data);
    });
    const unsubOverrides = subscribeOverrides((payload) => {
      onOverrideEventRef.current?.(payload);
    });
    const unsubConfig =
      typeof onConfigKeyRef.current === 'function'
        ? subscribeConfig((key, row) => onConfigKeyRef.current?.(key, row))
        : () => {};
    return () => {
      unsubPlan();
      unsubOverrides();
      unsubConfig();
    };
  }, []);
}
