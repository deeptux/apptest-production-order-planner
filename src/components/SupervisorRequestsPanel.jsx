import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ClipboardList, Trash2 } from 'lucide-react';
import { deleteOverride } from '../api/overrides';
import { notifyAdminPendingOverridesRefresh } from '../context/OverrideRequestsContext';
import { useSupervisorMyRequests } from '../hooks/useSupervisorMyRequests';
import { removeLocalSupervisorRequest } from '../utils/supervisorLocalQueue';
import { formatSupervisorRequestSummary, formatSupervisorRequestWhen } from '../constants/supervisorRequests';

function statusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'pending' || s === 'pending_local') {
    return 'bg-amber-100 text-amber-900 border-amber-200';
  }
  if (s === 'approved') {
    return 'bg-green-100 text-green-900 border-green-200';
  }
  if (s === 'rejected') {
    return 'bg-red-50 text-red-900 border-red-200';
  }
  return 'bg-gray-100 text-gray-800 border-gray-200';
}

function statusLabel(status) {
  const s = (status || '').toLowerCase();
  if (s === 'pending_local') return 'Queued (offline)';
  if (s === 'pending') return 'Pending';
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';
}

function canWithdrawRequest(row) {
  const s = String(row.status ?? '').toLowerCase().trim();
  return s === 'pending' || s === 'pending_local';
}

/**
 * Collapsible right rail: this supervisor’s requests for the current line/process URL.
 */
export default function SupervisorRequestsPanel({ lineId, processId }) {
  const [expanded, setExpanded] = useState(true);
  const [withdrawingId, setWithdrawingId] = useState(null);
  const { items, refresh } = useSupervisorMyRequests({ lineId, processId });

  const toggle = useCallback(() => setExpanded((e) => !e), []);

  const withdrawRequest = useCallback(
    async (row) => {
      if (!row?.id || !canWithdrawRequest(row)) return;
      if (
        !window.confirm(
          'Remove this request? It will disappear from your list and from the Dashboard notification bar on this browser.',
        )
      ) {
        return;
      }
      setWithdrawingId(row.id);
      const isLocal = row._source === 'local' || String(row.id).startsWith('local-');
      try {
        if (isLocal) {
          removeLocalSupervisorRequest(row.id);
          notifyAdminPendingOverridesRefresh();
          await refresh();
        } else {
          const res = await deleteOverride(row.id);
          if (res.ok) {
            notifyAdminPendingOverridesRefresh();
            await refresh();
          } else {
            window.alert(
              'Could not delete this request from the database. Run migration 003_override_requests_delete_policy.sql in Supabase (see supabase/README.md), or ask an admin to remove it.',
            );
          }
        }
      } finally {
        setWithdrawingId(null);
      }
    },
    [refresh],
  );

  return (
    <>
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="pointer-events-auto fixed bottom-4 right-4 z-[91] flex items-center gap-2 rounded-full border-2 border-primary bg-surface px-4 py-2.5 text-sm font-semibold text-primary shadow-lg sm:hidden"
        >
          <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
          My requests
          {items.length > 0 && (
            <span className="min-w-[1.25rem] rounded-full bg-primary px-1.5 py-0.5 text-center text-xs text-white tabular-nums">
              {items.length}
            </span>
          )}
        </button>
      )}
    <div
      className={`fixed top-0 right-0 z-[90] flex h-full max-h-screen pointer-events-none ${
        expanded ? 'w-[min(100vw-1rem,19rem)] sm:w-[22rem]' : 'w-0 sm:w-9'
      }`}
      aria-hidden={false}
    >
      <div className="pointer-events-auto flex h-full ml-auto border-l border-gray-300/80 bg-surface shadow-[0_0_24px_rgba(0,0,0,0.06)]">
        <button
          type="button"
          onClick={toggle}
          className="hidden sm:flex h-full w-9 shrink-0 flex-col items-center justify-center gap-1 border-r border-gray-300/80 bg-surface-card-warm text-gray-700 hover:bg-gray-200/70"
          aria-expanded={expanded}
          aria-controls="supervisor-requests-panel"
          title={expanded ? 'Collapse requests' : 'My requests'}
        >
          {expanded ? (
            <ChevronRight className="h-5 w-5" aria-hidden />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5" aria-hidden />
              {items.length > 0 && (
                <span className="text-[10px] font-bold text-primary tabular-nums">{items.length}</span>
              )}
            </>
          )}
        </button>

        {expanded && (
          <aside
            id="supervisor-requests-panel"
            className="flex w-[min(calc(100vw-2.25rem),19rem)] sm:w-[20rem] flex-col h-full min-h-0 bg-surface"
          >
            <div className="shrink-0 border-b border-gray-300/80 bg-surface-card-warm px-3 py-2.5">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary shrink-0" aria-hidden />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-gray-900 leading-tight">My requests</h2>
                  <p className="text-[11px] text-muted leading-snug">
                    Sent from this device for this screen. Admins review from the planner notification bar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => refresh()}
                className="mt-2 text-xs font-medium text-primary hover:underline"
              >
                Refresh list
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto bg-surface px-2 py-2">
              {items.length === 0 ? (
                <p className="text-sm text-muted px-2 py-6 text-center">
                  No requests yet. Use <strong className="text-gray-700">General request</strong> or row{' '}
                  <strong className="text-gray-700">Request</strong>.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {items.map((row) => {
                    const p = row.payload || {};
                    return (
                      <li
                        key={row.id}
                        className="rounded-lg border border-gray-200 bg-surface-card p-2.5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${statusBadge(row.status)}`}
                          >
                            {statusLabel(row.status)}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] text-muted whitespace-nowrap">
                              {formatSupervisorRequestWhen(row)}
                            </span>
                            {canWithdrawRequest(row) && (
                              <button
                                type="button"
                                onClick={() => withdrawRequest(row)}
                                disabled={withdrawingId === row.id}
                                className="rounded-md p-1 text-gray-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                                title="Remove request"
                                aria-label="Remove request"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm font-medium text-gray-900 leading-snug">
                          {formatSupervisorRequestSummary(row)}
                        </p>
                        {p.note && (
                          <p className="text-xs text-gray-600 mt-1.5 line-clamp-3 whitespace-pre-wrap">
                            {p.note}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={toggle}
              className="sm:hidden shrink-0 border-t border-gray-300/80 bg-surface-card-warm py-2 text-sm font-medium text-primary"
            >
              Hide panel
            </button>
          </aside>
        )}
      </div>
    </div>
    </>
  );
}
