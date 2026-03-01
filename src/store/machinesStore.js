/**
 * Global machines and equipment store.
 * Assignment to a production line + process is optional (productionLineId, processId).
 * When set, the machine appears under that line's process in the Production tab.
 */
const MACHINES_STORAGE_KEY = 'loaf-machines-equipment-v2';

/**
 * Default machines/equipment (flat list; assign to production line + process via Machines table or Production tab).
 */
const DEFAULT_MACHINES = [
  { id: 'm-01', name: 'Sponge Mixer', productionLineId: null, processId: null },
  { id: 'm-02', name: 'Dough Mixer', productionLineId: null, processId: null },
  { id: 'm-03', name: 'Fermentation Cabinet', productionLineId: null, processId: null },
  { id: 'm-04', name: 'Dough Scale (Mixing)', productionLineId: null, processId: null },
  { id: 'm-05', name: 'Tub / Dough Tub', productionLineId: null, processId: null },
  { id: 'm-06', name: 'Divider', productionLineId: null, processId: null },
  { id: 'm-07', name: 'Dividing Table', productionLineId: null, processId: null },
  { id: 'm-08', name: 'Dough Scale (Dividing)', productionLineId: null, processId: null },
  { id: 'm-09', name: 'Bench (Floor Time)', productionLineId: null, processId: null },
  { id: 'm-10', name: 'Molder', productionLineId: null, processId: null },
  { id: 'm-11', name: 'Panning Table', productionLineId: null, processId: null },
  { id: 'm-12', name: 'Pan Loader', productionLineId: null, processId: null },
  { id: 'm-13', name: 'Proofer', productionLineId: null, processId: null },
  { id: 'm-14', name: 'Rounder (if applicable)', productionLineId: null, processId: null },
  { id: 'm-15', name: 'Oven 1', productionLineId: null, processId: null },
  { id: 'm-16', name: 'Oven 2', productionLineId: null, processId: null },
  { id: 'm-17', name: 'Oven Loader', productionLineId: null, processId: null },
  { id: 'm-18', name: 'Cooling Rack', productionLineId: null, processId: null },
  { id: 'm-19', name: 'Baking Rack', productionLineId: null, processId: null },
  { id: 'm-20', name: 'Cooler', productionLineId: null, processId: null },
  { id: 'm-21', name: 'Slicer', productionLineId: null, processId: null },
  { id: 'm-22', name: 'Check-Weigher', productionLineId: null, processId: null },
  { id: 'm-23', name: 'Metal Detector', productionLineId: null, processId: null },
  { id: 'm-24', name: 'Bagger', productionLineId: null, processId: null },
  { id: 'm-25', name: 'Sealer', productionLineId: null, processId: null },
  { id: 'm-26', name: 'Case Packer', productionLineId: null, processId: null },
];

function loadMachines() {
  try {
    const raw = localStorage.getItem(MACHINES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 0) {
        return parsed.map((m) => ({
          ...m,
          productionLineId: m.productionLineId || null,
          processId: m.processId || null,
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

function persist() {
  try {
    localStorage.setItem(MACHINES_STORAGE_KEY, JSON.stringify(machines));
  } catch (_) {}
}

export function getMachines() {
  return machines.map((m) => ({ ...m }));
}

export function getMachineById(id) {
  const m = machines.find((x) => x.id === id);
  return m ? { ...m } : null;
}

/** Machines assigned to a given production line and process (shown in Production tab process section). */
export function getMachinesForLineAndProcess(lineId, processId) {
  if (!lineId || !processId) return [];
  return machines.filter((m) => m.productionLineId === lineId && m.processId === processId).map((m) => ({ id: m.id, name: m.name }));
}

export function addMachine(attrs) {
  const name = typeof attrs === 'string' ? attrs : (attrs?.name ?? '');
  const productionLineId = typeof attrs === 'object' && attrs && 'productionLineId' in attrs ? attrs.productionLineId : null;
  const processId = typeof attrs === 'object' && attrs && 'processId' in attrs ? attrs.processId : null;
  const id = `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item = {
    id,
    name: String(name || '').trim(),
    productionLineId: productionLineId || null,
    processId: processId || null,
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
  next.productionLineId = next.productionLineId || null;
  next.processId = next.processId || null;
  machines = [...machines.slice(0, idx), next, ...machines.slice(idx + 1)];
  persist();
  return next;
}

export function deleteMachine(id) {
  machines = machines.filter((m) => m.id !== id);
  persist();
}

export { MACHINES_STORAGE_KEY };
