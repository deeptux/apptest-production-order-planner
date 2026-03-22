import { useState, useEffect, useCallback, useMemo } from 'react';
import { listOverridesForSupervisor, subscribeOverrides } from '../api/overrides';
import { isSupabaseConfigured } from '../lib/supabase';
import { getSupervisorClientId } from '../utils/supervisorClientId';
import {
  readLocalSupervisorRequests,
  subscribeSupervisorLocalQueue,
} from '../utils/supervisorLocalQueue';

function mergeServerAndLocal(serverRows, localRows, lineId, processId) {
  const byId = new Map();
  for (const r of serverRows) {
    if (r?.id) byId.set(r.id, { ...r, _source: 'server' });
  }
  for (const r of localRows) {
    const p = r.payload || {};
    if (lineId && p.productionLineId !== lineId) continue;
    if (processId && p.processId !== processId) continue;
    if (r.id && !byId.has(r.id)) {
      byId.set(r.id, {
        id: r.id,
        status: r.status || 'pending_local',
        requested_at: r.requested_at || r.created_at_local,
        requested_by: r.requested_by,
        payload: p,
        station_id: r.station_id || 'mixing',
        _source: 'local',
      });
    }
  }
  // Newest first (requested_at desc), then most recently decided for ties
  return [...byId.values()].sort((a, b) => {
    const ta = new Date(a.requested_at || a.created_at || 0).getTime();
    const tb = new Date(b.requested_at || b.created_at || 0).getTime();
    if (tb !== ta) return tb - ta;
    const da = new Date(a.decided_at || 0).getTime();
    const db = new Date(b.decided_at || 0).getTime();
    return db - da;
  });
}

export function useSupervisorMyRequests({ lineId, processId }) {
  const clientId = useMemo(() => getSupervisorClientId(), []);
  const [serverItems, setServerItems] = useState([]);
  const [tick, setTick] = useState(0);

  const refreshLocalTick = useCallback(() => setTick((t) => t + 1), []);

  const refresh = useCallback(async () => {
    if (!lineId || !processId) return;
    if (isSupabaseConfigured()) {
      const list = await listOverridesForSupervisor(clientId, { lineId, processId, limit: 80 });
      setServerItems(list);
    } else {
      setServerItems([]);
    }
  }, [clientId, lineId, processId]);

  useEffect(() => {
    refresh();
  }, [refresh, tick]);

  // Always listen for local queue writes (same tab). When Supabase is on we previously skipped this,
  // so removeLocalSupervisorRequest() did not bump `tick` → `localOnly` stayed stale until full reload.
  useEffect(() => {
    const unsubLocal = subscribeSupervisorLocalQueue(refreshLocalTick);
    if (!isSupabaseConfigured()) {
      return unsubLocal;
    }
    const unsubRt = subscribeOverrides(() => {
      refresh();
    });
    return () => {
      unsubLocal();
      unsubRt();
    };
  }, [refresh, refreshLocalTick]);

  useEffect(() => {
    const onRefresh = () => refresh();
    window.addEventListener('loaf-supervisor-requests-refresh', onRefresh);
    return () => window.removeEventListener('loaf-supervisor-requests-refresh', onRefresh);
  }, [refresh]);

  const localOnly = useMemo(() => {
    void tick;
    return readLocalSupervisorRequests();
  }, [tick, lineId, processId]);

  const items = useMemo(
    () => mergeServerAndLocal(serverItems, localOnly, lineId, processId),
    [serverItems, localOnly, lineId, processId]
  );

  return { items, refresh, clientId };
}
