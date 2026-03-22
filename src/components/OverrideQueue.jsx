import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import { listOverrides, approveOverride, rejectOverride, subscribeOverrides } from '../api/overrides';
import { usePlan } from '../context/PlanContext';
import { isSupabaseConfigured } from '../lib/supabase';

const STATION_LABELS = {
  mixing: 'Mixing',
  'makeup-dividing': 'Makeup Dividing',
  'makeup-panning': 'Makeup Panning',
  baking: 'Baking',
  packaging: 'Packaging',
};

export default function OverrideQueue() {
  const { planDate, rows } = usePlan();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    listOverrides({ status: 'pending' }).then((list) => {
      setPending(list);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;
    const unsub = subscribeOverrides(() => refresh());
    return unsub;
  }, [refresh]);

  const handleApprove = useCallback(
    (id) => {
      approveOverride(id, {
        decided_by: 'planner',
        plan_date: planDate instanceof Date ? planDate.toISOString() : planDate,
        rows,
      }).then((res) => res.ok && refresh());
    },
    [planDate, rows, refresh]
  );

  const handleReject = useCallback(
    (id) => {
      rejectOverride(id, 'planner').then((res) => res.ok && refresh());
    },
    [refresh]
  );

  if (!isSupabaseConfigured()) return null;
  if (pending.length === 0) return null;

  return (
    <div className="bg-surface-card-warm rounded-card shadow-card border border-gray-100 p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-5 h-5 text-primary shrink-0" aria-hidden />
        <h3 className="text-sm font-semibold text-gray-800">Override requests</h3>
        {loading && <span className="text-xs text-muted">Updating…</span>}
      </div>
      <ul className="space-y-2">
        {pending.map((req) => (
          <li
            key={req.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 bg-surface-card rounded-lg border border-gray-100"
          >
            <div className="min-w-0">
              <span className="font-medium text-gray-800">
                {STATION_LABELS[req.station_id] ?? req.station_id}
              </span>
              <span className="text-xs text-muted ml-2">
                {req.requested_at ? new Date(req.requested_at).toLocaleString() : ''}
              </span>
              {req.requested_by && (
                <div className="text-xs text-gray-600 mt-0.5 w-full">From: {req.requested_by}</div>
              )}
              {req.payload && Object.keys(req.payload).length > 0 && (
                <pre className="text-xs text-muted mt-1 whitespace-pre-wrap">
                  {JSON.stringify(req.payload)}
                </pre>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleApprove(req.id)}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-dark"
              >
                <Check className="w-4 h-4" />
                Approve
              </button>
              <button
                type="button"
                onClick={() => handleReject(req.id)}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
