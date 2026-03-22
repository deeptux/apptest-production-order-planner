import { useState, useMemo, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { createOverride, resolveOverrideStationId } from '../api/overrides';
import { isSupabaseConfigured } from '../lib/supabase';

const ACTION_DEFS = [
  {
    value: 'supervisor_reorder',
    label: 'Request reorder (vs other batches on this line)',
    needsRow: true,
    notBreak: true,
  },
  {
    value: 'supervisor_insert_time_blocker',
    label: 'Request insert time blocker',
    needsRow: false,
  },
  {
    value: 'supervisor_remove_time_blocker',
    label: 'Request remove this time blocker',
    needsRow: true,
    breakOnly: true,
  },
  {
    value: 'supervisor_edit_batch',
    label: 'Request edit to this batch',
    needsRow: true,
    notBreak: true,
  },
  {
    value: 'supervisor_delete_batch',
    label: 'Request delete this batch',
    needsRow: true,
    notBreak: true,
  },
  {
    value: 'supervisor_general',
    label: 'Other (describe for admin)',
    needsRow: false,
  },
];

export default function ProcessLiveSupervisorDialog({
  open,
  onOpenChange,
  lineId,
  lineName,
  processId,
  processName,
  row,
}) {
  const [action, setAction] = useState('supervisor_general');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const options = useMemo(() => {
    return ACTION_DEFS.filter((def) => {
      if (!def.needsRow) return true;
      if (!row) return false;
      if (def.breakOnly && !row.isBreak) return false;
      if (def.notBreak && row.isBreak) return false;
      return true;
    });
  }, [row]);

  useEffect(() => {
    if (!open) return;
    setDone(false);
    setErr('');
    setNote('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const first = options[0]?.value ?? 'supervisor_general';
    setAction(first);
  }, [open, options]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      setErr('Database is not configured — admins cannot receive requests from this device yet.');
      return;
    }
    setSending(true);
    setErr('');
    const payload = {
      kind: action,
      productionLineId: lineId,
      processId,
      processName,
      note: note.trim(),
      rowId: row?.id ?? null,
      product: row?.product ?? null,
      isBreak: Boolean(row?.isBreak),
    };
    const res = await createOverride({
      station_id: resolveOverrideStationId(processId),
      requested_by: `Supervisor · ${lineName || lineId} · ${processName || processId}`,
      payload,
    });
    setSending(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => onOpenChange(false), 1600);
    } else {
      setErr('Could not send request. Check database connection or try again.');
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[120]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[121] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-4 shadow-lg max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-semibold text-gray-900">Request change from admin</Dialog.Title>
          <Dialog.Description className="text-sm text-muted mt-1">
            Supervisors send requests here. Planners review them in the dashboard override queue and apply changes in
            Scheduling / Production / Recipes.
          </Dialog.Description>
          {!isSupabaseConfigured() && (
            <p className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              Connect the database in project settings to deliver requests to admins.
            </p>
          )}
          {done ? (
            <p className="mt-4 text-sm font-medium text-green-800">Request sent.</p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="pl-supervisor-action" className="block text-xs font-medium text-gray-600 mb-1">
                  Request type
                </label>
                <select
                  id="pl-supervisor-action"
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
                >
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="pl-supervisor-note" className="block text-xs font-medium text-gray-600 mb-1">
                  Details for admin
                </label>
                <textarea
                  id="pl-supervisor-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder="Describe the change needed (times, position, quantities, reason…)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                  required
                />
              </div>
              {err && <p className="text-sm text-red-600">{err}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={sending || !note.trim()}
                  className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
                >
                  {sending ? 'Sending…' : 'Send request'}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
