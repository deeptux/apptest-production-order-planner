import { formatInstantMsWithDayContext } from '../utils/planDisplay';
import { formatRemainingMs } from '../utils/processLiveWindow';
import { isSupabaseConfigured } from '../lib/supabase';

/**
 * Shows which batch is occupying the process stepper timeline (In Progress),
 * or a compact “idle / next” state when none.
 */
function RealtimeFootnote() {
  const text = isSupabaseConfigured()
    ? 'Plan rows sync across browsers when your database is connected with live replication. This page also refreshes timers periodically so status and the stepper stay aligned with the clock. On reconnect, the app reloads the plan from the database as the source of truth; offline, it keeps using local cache.'
    : 'Connect your database (project setup) for live plan sync across browsers. Until then, this session uses local data. Timers still refresh periodically for status and the stepper.';
  return (
    <p className="mt-3 text-xs sm:text-sm text-muted leading-relaxed border-t border-gray-200/80 pt-3">{text}</p>
  );
}

export default function ProcessLiveCurrentBatchCard({
  processLabel,
  inProgress,
  spotlightRow,
  spotlightStatus,
  skuBatchOrderMap,
  orderBatchMap,
}) {
  if (inProgress) {
    const { row, win, skuBatch, remainingMs } = inProgress;
    const ob = orderBatchMap[row.id];
    return (
      <div className="rounded-card border border-gray-200 bg-gradient-to-br from-surface-card via-surface-card to-surface-card-warm shadow-card p-3 sm:p-4 md:p-5 mb-3 sm:mb-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-kpi-label sm:text-sm-kpi-label uppercase tracking-wide text-muted font-semibold">
            Current batch in {processLabel}
          </p>
          <span className="inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs sm:text-sm font-semibold text-amber-900">
            In progress
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-4">
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-muted font-medium">SKU batch</div>
            <div className="text-base sm:text-lg md:text-xl font-bold text-gray-900 tabular-nums truncate">
              {skuBatch ?? '—'}
            </div>
            {ob && <div className="text-sm sm:text-base text-gray-600 mt-0.5">{ob}</div>}
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-muted font-medium">Product</div>
            <div className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 line-clamp-2">
              {row.product ?? '—'}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-muted font-medium">Process start</div>
            <div className="text-sm sm:text-base font-medium text-gray-900 leading-snug">
              {formatInstantMsWithDayContext(win.startMs)}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-muted font-medium">Process end</div>
            <div className="text-sm sm:text-base font-medium text-gray-900 leading-snug">
              {formatInstantMsWithDayContext(win.endMs)}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 sm:px-4">
          <span className="text-sm sm:text-base font-semibold text-gray-800">Time remaining in this process</span>
          <span className="text-xl sm:text-2xl md:text-3xl font-bold tabular-nums text-primary">
            {formatRemainingMs(remainingMs)}
          </span>
        </div>
        <RealtimeFootnote />
      </div>
    );
  }

  return (
    <div className="rounded-card border border-dashed border-gray-300 bg-surface-card/80 shadow-card p-3 sm:p-4 md:p-5 mb-3 sm:mb-4">
      <p className="text-sm sm:text-base md:text-lg font-semibold text-gray-800">No batch in this process right now</p>
      {spotlightRow && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-surface-card-warm px-3 py-2.5 text-sm sm:text-base">
          <span className="font-semibold text-gray-800">
            {spotlightStatus === 'In Progress'
              ? 'Batch on this line (may be in another process stage): '
              : 'Next on this line (by schedule start): '}
          </span>
          <span className="text-gray-700">{spotlightRow.product ?? '—'}</span>
          {skuBatchOrderMap[spotlightRow.id] && (
            <span className="ml-2 tabular-nums text-muted">({skuBatchOrderMap[spotlightRow.id]})</span>
          )}
        </div>
      )}
      <RealtimeFootnote />
    </div>
  );
}
