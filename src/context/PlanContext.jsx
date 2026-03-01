import { useSyncExternalStore, useRef, useEffect } from 'react';
import { getPlan, subscribePlan } from '../api/plan';
import { isSupabaseConfigured } from '../lib/supabase';
import { useSnackbar } from './SnackbarContext';
import {
  initPlanStore,
  hydrateFromApi,
  setPlanFromRemote,
  shouldSkipNextRealtime,
  subscribe,
  getSnapshot,
  PLAN_ROWS_STORAGE_KEY,
} from '../store/planStore';

/**
 * Subscribes to Supabase Realtime and localStorage (when no Supabase), updates the plan store,
 * and shows snackbar when plan is updated from another client. No plan state lives here so
 * the layout (PlannerLayout, Topbar, Sidebar) does not re-render when rows change.
 */
function PlanSync() {
  const skipRef = useRef(false);
  const { show: showSnackbar } = useSnackbar() ?? {};

  useEffect(() => {
    initPlanStore({ getSkipRef: () => skipRef });
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      hydrateFromApi(null);
      return;
    }
    getPlan().then((data) => {
      hydrateFromApi(data);
    });
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;
    const unsub = subscribePlan((data) => {
      if (shouldSkipNextRealtime()) return;
      if (data?.rows && Array.isArray(data.rows)) {
        setPlanFromRemote(data);
        if (typeof showSnackbar === 'function') showSnackbar('Plan updated');
      }
    });
    return unsub;
  }, [showSnackbar]);

  useEffect(() => {
    if (isSupabaseConfigured()) return undefined;
    const handleStorage = (e) => {
      if (e.key !== PLAN_ROWS_STORAGE_KEY || e.newValue == null) return;
      try {
        const next = JSON.parse(e.newValue);
        if (Array.isArray(next)) setPlanFromRemote({ rows: next });
      } catch (_) {}
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return null;
}

export function PlanProvider({ children }) {
  return (
    <>
      <PlanSync />
      {children}
    </>
  );
}

function getServerSnapshot() {
  return getSnapshot();
}

export function usePlan() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!snapshot) throw new Error('usePlan: store not ready');
  return snapshot;
}
