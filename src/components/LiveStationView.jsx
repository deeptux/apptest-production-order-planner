import { useState, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { usePlan } from '../context/PlanContext';
import PlanTable from './PlanTable';
import { createOverride, listOverrides, subscribeOverrides } from '../api/overrides';
import { SECTIONS } from './SectionTabs';
import { isSupabaseConfigured } from '../lib/supabase';

const VALID_STATION_IDS = SECTIONS.map((s) => s.id);

export default function LiveStationView() {
  const { stationId } = useParams();
  const { hydrated } = usePlan();
  const [overrideMessage, setOverrideMessage] = useState('');
  const [overrideSent, setOverrideSent] = useState(false);
  const [pendingAtStation, setPendingAtStation] = useState(null);

  const valid = VALID_STATION_IDS.includes(stationId);
  const stationLabel = SECTIONS.find((s) => s.id === stationId)?.label ?? stationId;

  const refreshPending = useCallback(() => {
    if (!isSupabaseConfigured()) return;
    listOverrides({ status: 'pending' }).then((list) => {
      const atThis = list.find((r) => r.station_id === stationId);
      setPendingAtStation(atThis ?? null);
    });
  }, [stationId]);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;
    return subscribeOverrides(() => refreshPending());
  }, [refreshPending]);

  const handleRequestOverride = useCallback(() => {
    if (!isSupabaseConfigured() || !stationId) return;
    createOverride({
      station_id: stationId,
      payload: overrideMessage ? { message: overrideMessage } : {},
      requested_by: stationLabel,
    }).then((res) => {
      if (res.ok) {
        setOverrideSent(true);
        setOverrideMessage('');
        refreshPending();
      }
    });
  }, [stationId, stationLabel, overrideMessage, refreshPending]);

  if (!valid) {
    return (
      <div className="min-h-screen bg-surface p-6 flex flex-col items-center justify-center">
        <p className="text-gray-700 mb-4">Invalid station.</p>
        <Link to="/live" className="text-primary font-medium hover:underline">
          Back to station list
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="shrink-0 bg-primary text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/live" className="text-white/90 hover:text-white text-sm">
            ← Stations
          </Link>
          <span className="font-semibold">{stationLabel} — Live view</span>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
        {!hydrated && (
          <p className="text-sm text-muted mb-4">Loading plan…</p>
        )}
        {pendingAtStation && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm">Override request pending. Waiting for planner approval.</span>
          </div>
        )}
        <div className="mb-4">
          <PlanTable sectionId={stationId} />
        </div>
        {isSupabaseConfigured() && (
          <div className="bg-surface-card rounded-card shadow-card border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Request override</h3>
            {overrideSent ? (
              <p className="text-sm text-muted">Request sent. The planner will be notified.</p>
            ) : (
              <>
                <textarea
                  placeholder="Reason or details (optional)"
                  value={overrideMessage}
                  onChange={(e) => setOverrideMessage(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 mb-2 min-h-[80px]"
                  rows={3}
                />
                <button
                  type="button"
                  onClick={handleRequestOverride}
                  className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark"
                >
                  Send override request
                </button>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
