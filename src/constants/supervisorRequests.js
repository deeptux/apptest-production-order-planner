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

/** `detail: { request }` — opens AdminRequestReviewModal from Topbar bell menu. */
export const OPEN_ADMIN_SUPERVISOR_REVIEW_EVENT = 'loaf-open-admin-review';

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

/** Shorter timestamp for compact UI (e.g. bell menu). */
export function formatSupervisorRequestWhenCompact(row) {
  const t = row.requested_at || row.created_at || row.created_at_local;
  if (!t) return '';
  try {
    const d = new Date(t);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return String(t);
  }
}

/**
 * Structured meta for notification bell cards (avoids one long " · " string).
 * Uses payload when present; falls back to parsing requested_by.
 */
export function getSupervisorBellCardMeta(req) {
  if (!req) return { when: '', source: null, where: null };
  const p = req.payload || {};
  let source = null;
  if (p.viewSource === 'dashboard') source = 'Dashboard';
  else if (p.viewSource === 'live') source = 'Live';
  else {
    const by = String(req.requested_by || '');
    if (by.includes(' · Dashboard ·')) source = 'Dashboard';
    else if (by.includes(' · Live ·')) source = 'Live';
  }
  let where = null;
  const line = p.lineName || p.productionLineId;
  const proc = p.processName || p.processId;
  if (line && proc) where = `${line} · ${proc}`;
  else if (line) where = String(line);
  else if (proc) where = String(proc);
  if (!where) {
    const by = String(req.requested_by || '');
    const parts = by.split(' · ').map((s) => s.trim());
    if (parts.length >= 4 && parts[0] === 'Supervisor') {
      where = parts.slice(2).join(' · ');
    }
  }
  return {
    when: formatSupervisorRequestWhenCompact(req),
    source,
    where,
  };
}
