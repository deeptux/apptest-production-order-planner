const STORAGE_KEY = 'loaf-supervisor-client-id';

/** Stable id per browser so supervisors only see their own submitted requests in the side panel. */
export function getSupervisorClientId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (id && typeof id === 'string' && id.length >= 8) return id;
    id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `sc-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return `sc-fallback-${Date.now()}`;
  }
}
