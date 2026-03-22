import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { listPendingOverrideRequests, subscribeOverrides } from '../api/overrides';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  listPendingLocalSupervisorRequests,
  subscribeSupervisorLocalQueue,
} from '../utils/supervisorLocalQueue';

const OverrideRequestsContext = createContext(null);

const REFRESH_EVENT = 'loaf-admin-pending-overrides-refresh';

function normalizeLocalPending() {
  return listPendingLocalSupervisorRequests().map((r) => ({
    ...r,
    _source: 'local',
  }));
}

/**
 * Pending supervisor requests: **localStorage** when offline / no Supabase; **database** when configured (authoritative).
 * Same-browser Dashboard + Supervisor Live share the local queue.
 */
export function OverrideRequestsProvider({ children }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!isSupabaseConfigured()) {
      setPending(normalizeLocalPending());
      setLoading(false);
      return;
    }
    setLoading(true);
    listPendingOverrideRequests().then((list) => {
      setPending((list ?? []).map((r) => ({ ...r, _source: 'remote' })));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return subscribeSupervisorLocalQueue(() => {
        refresh();
      });
    }
    const unsub = subscribeOverrides(() => {
      refresh();
    });
    return unsub;
  }, [refresh]);

  useEffect(() => {
    const onCustom = () => refresh();
    window.addEventListener(REFRESH_EVENT, onCustom);
    return () => window.removeEventListener(REFRESH_EVENT, onCustom);
  }, [refresh]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh]);

  const value = useMemo(
    () => ({
      pending,
      loading,
      refresh,
      /** True when pending list comes from this browser only (no Supabase). */
      isLocalOnlyQueue: !isSupabaseConfigured(),
    }),
    [pending, loading, refresh]
  );

  return (
    <OverrideRequestsContext.Provider value={value}>{children}</OverrideRequestsContext.Provider>
  );
}

export function useOverrideRequests() {
  const ctx = useContext(OverrideRequestsContext);
  if (!ctx) {
    throw new Error('useOverrideRequests must be used within OverrideRequestsProvider');
  }
  return ctx;
}

/** Call after a supervisor request is successfully stored (DB or local). */
export function notifyAdminPendingOverridesRefresh() {
  window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
}
