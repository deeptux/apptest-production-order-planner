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
