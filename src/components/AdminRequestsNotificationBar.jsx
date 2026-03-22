import { useState, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { usePendingOverrideRequests } from '../hooks/usePendingOverrideRequests';
import { isSupabaseConfigured } from '../lib/supabase';
import { formatSupervisorRequestSummary, formatSupervisorRequestWhen } from '../constants/supervisorRequests';
import AdminRequestReviewModal from './AdminRequestReviewModal';

/**
 * Planner-facing strip: pending supervisor requests. Scrolls when many items; click opens review modal.
 */
export default function AdminRequestsNotificationBar() {
  const { pending, refresh } = usePendingOverrideRequests();
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const openReview = useCallback((req) => {
    setSelected(req);
    setModalOpen(true);
  }, []);

  if (!isSupabaseConfigured()) return null;
  if (pending.length === 0) return null;

  return (
    <>
      <div
        role="region"
        aria-label="Supervisor requests"
        className="shrink-0 border-b border-amber-200/90 bg-amber-50/95 text-amber-950"
      >
        <div className="flex items-stretch min-h-[3rem] max-h-[7.5rem]">
          <div className="flex items-center gap-2 px-3 py-2 border-r border-amber-200/80 bg-amber-100/80 shrink-0">
            <Bell className="h-5 w-5 text-amber-800 shrink-0" aria-hidden />
            <div className="hidden sm:block leading-tight">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Supervisor requests</p>
              <p className="text-[11px] text-amber-800/90">{pending.length} pending</p>
            </div>
            <span className="sm:hidden text-sm font-bold tabular-nums">{pending.length}</span>
          </div>
          <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden py-1.5 px-2">
            <ul className="flex flex-col gap-1">
              {pending.map((req) => (
                <li key={req.id}>
                  <button
                    type="button"
                    onClick={() => openReview(req)}
                    className="w-full text-left rounded-lg px-2 py-1.5 text-sm hover:bg-amber-100/90 border border-transparent hover:border-amber-300/60 transition-colors"
                  >
                    <span className="font-medium text-amber-950 line-clamp-2">
                      {formatSupervisorRequestSummary(req)}
                    </span>
                    <span className="block text-xs text-amber-800/85 mt-0.5">
                      {formatSupervisorRequestWhen(req)}
                      {req.requested_by ? ` · ${req.requested_by}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <AdminRequestReviewModal
        open={modalOpen}
        onOpenChange={(o) => {
          setModalOpen(o);
          if (!o) setSelected(null);
        }}
        request={selected}
        onDecided={refresh}
      />
    </>
  );
}
