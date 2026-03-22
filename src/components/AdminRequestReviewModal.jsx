import * as Dialog from '@radix-ui/react-dialog';
import { X, Check, Ban } from 'lucide-react';
import { useState, useCallback } from 'react';
import { approveOverride, rejectOverride } from '../api/overrides';
import { usePlan } from '../context/PlanContext';
import { updateLocalSupervisorRequestStatus } from '../utils/supervisorLocalQueue';
import {
  formatSupervisorRequestSummary,
  formatSupervisorRequestWhen,
  SUPERVISOR_REQUEST_KIND_LABELS,
} from '../constants/supervisorRequests';

export default function AdminRequestReviewModal({ open, onOpenChange, request, onDecided }) {
  const { planDate, rows } = usePlan();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const isLocalRequest = request?._source === 'local' || String(request?.id ?? '').startsWith('local-');

  const handleApprove = useCallback(async () => {
    if (!request?.id) return;
    setBusy(true);
    setErr('');
    if (isLocalRequest) {
      const ok = updateLocalSupervisorRequestStatus(request.id, 'approved', 'planner');
      setBusy(false);
      if (ok) {
        onDecided?.();
        onOpenChange(false);
      } else {
        setErr('Could not update local queue.');
      }
      return;
    }
    const res = await approveOverride(request.id, {
      decided_by: 'planner',
      plan_date: planDate instanceof Date ? planDate.toISOString() : planDate,
      rows,
    });
    setBusy(false);
    if (res.ok) {
      onDecided?.();
      onOpenChange(false);
    } else {
      setErr('Could not approve. Try again.');
    }
  }, [request?.id, isLocalRequest, planDate, rows, onDecided, onOpenChange]);

  const handleReject = useCallback(async () => {
    if (!request?.id) return;
    setBusy(true);
    setErr('');
    if (isLocalRequest) {
      const ok = updateLocalSupervisorRequestStatus(request.id, 'rejected', 'planner');
      setBusy(false);
      if (ok) {
        onDecided?.();
        onOpenChange(false);
      } else {
        setErr('Could not update local queue.');
      }
      return;
    }
    const res = await rejectOverride(request.id, 'planner');
    setBusy(false);
    if (res.ok) {
      onDecided?.();
      onOpenChange(false);
    } else {
      setErr('Could not reject. Try again.');
    }
  }, [request?.id, isLocalRequest, onDecided, onOpenChange]);

  if (!request) return null;

  const p = request.payload || {};
  const kindLabel = SUPERVISOR_REQUEST_KIND_LABELS[p.kind] || p.kind || '—';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[140]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[141] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-start justify-between gap-3 mb-3">
            <Dialog.Title className="text-lg font-semibold text-gray-900 pr-8">
              Review supervisor request
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-sm text-muted">
            {isLocalRequest ? (
              <>
                Stored on <strong className="text-gray-800">this browser</strong> only. Approve/reject updates the list
                here; apply schedule edits in <strong className="text-gray-800">Scheduling</strong>.
              </>
            ) : (
              <>Acknowledge the request and approve (records decision + optional plan sync) or reject.</>
            )}
          </Dialog.Description>

          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Summary</dt>
              <dd className="text-gray-900 font-medium">{formatSupervisorRequestSummary(request)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Type</dt>
              <dd className="text-gray-800">{kindLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">When</dt>
              <dd className="text-gray-800">{formatSupervisorRequestWhen(request)}</dd>
            </div>
            {request.requested_by && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">From</dt>
                <dd className="text-gray-800">{request.requested_by}</dd>
              </div>
            )}
            {(p.lineName || p.productionLineId) && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Line / process</dt>
                <dd className="text-gray-800">
                  {p.lineName || p.productionLineId}
                  {p.processName || p.processId ? ` · ${p.processName || p.processId}` : ''}
                </dd>
              </div>
            )}
            {p.viewSource && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Opened from</dt>
                <dd className="text-gray-800 capitalize">{p.viewSource}</dd>
              </div>
            )}
            {p.skuBatchOrder != null && String(p.skuBatchOrder).trim() !== '' && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">SKU batch order</dt>
                <dd className="text-gray-800">{p.skuBatchOrder}</dd>
              </div>
            )}
            {p.orderBatch != null && String(p.orderBatch).trim() !== '' && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Order batch</dt>
                <dd className="text-gray-800">{p.orderBatch}</dd>
              </div>
            )}
            {p.note && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Details</dt>
                <dd className="text-gray-800 whitespace-pre-wrap rounded-lg bg-gray-50 border border-gray-100 p-3 mt-1">
                  {p.note}
                </dd>
              </div>
            )}
            {p.rowId && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Row id</dt>
                <dd className="font-mono text-xs text-gray-700 break-all">{p.rowId}</dd>
              </div>
            )}
          </dl>

          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={busy}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              disabled={busy}
              onClick={handleReject}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-gray-800 text-sm font-medium hover:bg-gray-100 disabled:opacity-50"
            >
              <Ban className="h-4 w-4" />
              Reject
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleApprove}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {busy ? 'Working…' : 'Approve'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
