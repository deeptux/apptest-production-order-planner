/**
 * Global machines and equipment store.
 */
const MACHINES_STORAGE_KEY = 'loaf-machines-equipment-v2';

/**
 * Default machines/equipment (flat list; assign to production line + process via Machines table or Production tab).
 */
const DEFAULT_MACHINES = [
  { id: 'm-01', name: 'Sponge Mixer' },
  { id: 'm-02', name: 'Dough Mixer' },
  { id: 'm-03', name: 'Fermentation Cabinet' },
  { id: 'm-04', name: 'Dough Scale (Mixing)' },
  { id: 'm-05', name: 'Tub / Dough Tub' },
  { id: 'm-06', name: 'Divider' },
  { id: 'm-07', name: 'Dividing Table' },
  { id: 'm-08', name: 'Dough Scale (Dividing)' },
  { id: 'm-09', name: 'Bench Time' },
  { id: 'm-10', name: 'Molder' },
  { id: 'm-11', name: 'Panning Table' },
  { id: 'm-12', name: 'Pan Loader' },
  { id: 'm-13', name: 'Proofer' },
  { id: 'm-14', name: 'Rounder (if applicable)' },
  { id: 'm-15', name: 'Oven 1' },
  { id: 'm-16', name: 'Oven 2' },
  { id: 'm-17', name: 'Oven Loader' },
  { id: 'm-18', name: 'Cooling Rack' },
  { id: 'm-19', name: 'Baking Rack' },
  { id: 'm-20', name: 'Cooler' },
  { id: 'm-21', name: 'Slicer' },
  { id: 'm-22', name: 'Check-Weigher' },
  { id: 'm-23', name: 'Metal Detector' },
  { id: 'm-24', name: 'Bagger' },
  { id: 'm-25', name: 'Sealer' },
  { id: 'm-26', name: 'Case Packer' },
  { id: 'm-27', name: 'Floor Time' },
];

function loadMachines() {
  try {
    const raw = localStorage.getItem(MACHINES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 0) {
        return parsed.map((m) => ({
          ...m,
          name: String(m.name ?? '').trim(),
        }));
      }
    }
  } catch (_) {}
  try {
    localStorage.setItem(MACHINES_STORAGE_KEY, JSON.stringify(DEFAULT_MACHINES));
  } catch (_) {}
  return DEFAULT_MACHINES.map((m) => ({ ...m }));
}

let machines = loadMachines();

/**
 * Reset the machines list to the current DEFAULT_MACHINES (from code).
 * Use this after updating DEFAULT_MACHINES so the app uses the new list instead of old localStorage data.
 * Warning: removes any machines added only in the UI that are not in DEFAULT_MACHINES.
 */
export function resetMachinesToDefaults() {
  machines = DEFAULT_MACHINES.map((m) => ({ ...m }));
  persist();
  return machines.map((m) => ({ ...m }));
}

function persist() {
  try {
    localStorage.setItem(MACHINES_STORAGE_KEY, JSON.stringify(machines));
  } catch (_) {}
}

export function getMachines() {
  resetMachinesToDefaults()
  return machines.map((m) => ({ ...m }));
}

export function getMachineById(id) {
  const m = machines.find((x) => x.id === id);
  return m ? { ...m } : null;
}

export function addMachine(attrs) {
  const name = typeof attrs === 'string' ? attrs : (attrs?.name ?? '');
  const id = `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item = {
    id,
    name: String(name || '').trim(),
  };
  if (!item.name) return null;
  machines = [...machines, item];
  persist();
  return item;
}

export function updateMachine(id, updates) {
  const idx = machines.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  const next = { ...machines[idx], ...updates };
  next.name = String(next.name ?? '').trim();
  machines = [...machines.slice(0, idx), next, ...machines.slice(idx + 1)];
  persist();
  return next;
}

export function deleteMachine(id) {
  machines = machines.filter((m) => m.id !== id);
  persist();
}

export { MACHINES_STORAGE_KEY };
