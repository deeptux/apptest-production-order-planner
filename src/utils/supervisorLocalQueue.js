const KEY = 'loaf-supervisor-local-requests';

/** When Supabase is off, queue requests locally so the side panel still works on the device. */
export function readLocalSupervisorRequests() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export function appendLocalSupervisorRequest(entry) {
  const list = readLocalSupervisorRequests();
  list.unshift(entry);
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
  } catch (_) {}
  window.dispatchEvent(new CustomEvent('loaf-supervisor-local-queue'));
}

export function subscribeSupervisorLocalQueue(callback) {
  const onCustom = () => callback();
  const onStorage = (e) => {
    if (e.key === KEY) callback();
  };
  window.addEventListener('loaf-supervisor-local-queue', onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('loaf-supervisor-local-queue', onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

/** Pending items for admin UI (same browser as supervisor Live View). */
export function listPendingLocalSupervisorRequests() {
  return readLocalSupervisorRequests().filter((r) => {
    const s = String(r.status ?? 'pending_local').toLowerCase().trim();
    return s === 'pending' || s === 'pending_local';
  });
}

/** Remove one request entirely (supervisor withdraw). Updates admin + side panel via events. */
export function removeLocalSupervisorRequest(id) {
  if (!id) return false;
  const list = readLocalSupervisorRequests().filter((r) => r.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (_) {
    return false;
  }
  window.dispatchEvent(new CustomEvent('loaf-supervisor-local-queue'));
  return true;
}

export function updateLocalSupervisorRequestStatus(id, nextStatus, decidedBy = 'planner') {
  if (!id) return false;
  const list = readLocalSupervisorRequests();
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) return false;
  const row = { ...list[idx] };
  row.status = nextStatus;
  row.decided_at = new Date().toISOString();
  row.decided_by = decidedBy;
  list[idx] = row;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (_) {
    return false;
  }
  window.dispatchEvent(new CustomEvent('loaf-supervisor-local-queue'));
  return true;
}
