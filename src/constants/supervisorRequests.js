export const STATION_LABELS = {
  mixing: 'Mixing',
  'makeup-dividing': 'Makeup Dividing',
  'makeup-panning': 'Makeup Panning',
  baking: 'Baking',
  packaging: 'Packaging',
};

export const SUPERVISOR_REQUEST_KIND_LABELS = {
  supervisor_reorder: 'Reorder batch',
  supervisor_insert_time_blocker: 'Insert time blocker',
  supervisor_remove_time_blocker: 'Remove time blocker',
  supervisor_edit_batch: 'Edit batch',
  supervisor_delete_batch: 'Delete batch',
  supervisor_add_batch: 'Add batch',
  supervisor_general: 'General / other',
};

/** Shared primary style: toolbar + table row Request actions */
export const SUPERVISOR_REQUEST_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-1.5 shrink-0 rounded-lg border-2 border-primary bg-white px-2.5 py-1.5 text-xs font-semibold text-primary shadow-sm hover:bg-primary/5 sm:text-sm';

export function formatSupervisorRequestSummary(row) {
  if (!row) return '';
  const p = row.payload || {};
  const kind = p.kind || 'supervisor_general';
  const kindLabel = SUPERVISOR_REQUEST_KIND_LABELS[kind] || kind;
  const station = STATION_LABELS[row.station_id] || row.station_id || '';
  const product = p.product && !p.isBreak ? p.product : p.isBreak ? 'Time blocker' : '';
  const parts = [kindLabel];
  if (station) parts.push(`· ${station}`);
  if (product) parts.push(`· ${product}`);
  if (p.skuBatchOrder && String(p.skuBatchOrder).trim()) {
    parts.push(`(${String(p.skuBatchOrder).trim()})`);
  }
  return parts.join(' ');
}

export function formatSupervisorRequestWhen(row) {
  const t = row.requested_at || row.created_at || row.created_at_local;
  if (!t) return '';
  try {
    return new Date(t).toLocaleString();
  } catch {
    return String(t);
  }
}
