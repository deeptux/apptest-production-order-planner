/**
 * Production lines store: full CRUD for production lines.
 * Each line has: capacityProfile (Capacity Name + Product + capacity), processes (CRUD), equipment per process (CRUD).
 * Used by Production page; Scheduling/Dashboard resolve capacity via Loaf Line (see capacityProfileStore).
 */
const LINES_STORAGE_KEY = 'loaf-production-lines';

const LOAF_SECTION_IDS = ['mixing', 'makeup-dividing', 'makeup-panning', 'baking', 'packaging'];
const DEFAULT_PROCESS_NAMES = ['Mixing', 'Makeup Dividing', 'Makeup Panning', 'Baking', 'Packaging'];

function defaultProcesses() {
  return LOAF_SECTION_IDS.map((id, order) => ({ id, name: DEFAULT_PROCESS_NAMES[order] ?? id, order }));
}

function defaultEquipmentBySection(sectionIds) {
  return sectionIds.reduce((acc, id) => {
    acc[id] = [];
    return acc;
  }, {});
}

const DEFAULT_LOAF_CAPACITY = [
  { id: 'cap-8s', capacityName: '8s', productName: 'Everyday Bread 8s', capacity: 2340 },
  { id: 'cap-12s', capacityName: '12s', productName: 'Everyday Bread 12s', capacity: 1575 },
];

function normalizeLine(l) {
  const capacityProfile = Array.isArray(l.capacityProfile)
    ? l.capacityProfile.map((e) => ({
        id: e.id || `cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        capacityName: String(e.capacityName ?? e.productOrType ?? '').trim(),
        productName: String(e.productName ?? '').trim(),
        capacity: Number(e.capacity) || 0,
      })).filter((e) => e.capacityName || e.productName)
    : [];
  let processes = Array.isArray(l.processes) ? l.processes.map((p) => ({ ...p, id: p.id || `proc-${Date.now()}`, name: String(p.name || '').trim(), order: Number(p.order) ?? 0 })) : [];
  let equipmentByProcess = l.equipmentByProcess && typeof l.equipmentByProcess === 'object' ? { ...l.equipmentByProcess } : {};
  if (processes.length === 0 && Array.isArray(l.sectionIds) && l.sectionIds.length > 0) {
    processes = l.sectionIds.map((id, order) => ({ id, name: DEFAULT_PROCESS_NAMES[order] ?? id, order }));
    if (l.equipmentBySection && typeof l.equipmentBySection === 'object') {
      equipmentByProcess = Object.fromEntries(
        Object.entries(l.equipmentBySection).map(([k, arr]) => [k, Array.isArray(arr) ? arr.map((e) => ({ ...e })) : []])
      );
    }
  }
  if (processes.length > 0 && Object.keys(equipmentByProcess).length === 0 && l.equipmentBySection && typeof l.equipmentBySection === 'object') {
    equipmentByProcess = Object.fromEntries(
      Object.entries(l.equipmentBySection).map(([k, arr]) => [k, Array.isArray(arr) ? arr.map((e) => ({ ...e })) : []])
    );
  }
  const equipmentByProcessFinal = equipmentByProcess;
  return {
    id: l.id,
    name: String(l.name || '').trim(),
    capacityProfile,
    processes,
    equipmentByProcess: equipmentByProcessFinal,
  };
}

const DEFAULT_LINES = [
  {
    id: 'line-loaf',
    name: 'Loaf Line',
    capacityProfile: DEFAULT_LOAF_CAPACITY.map((e) => ({ ...e })),
    processes: defaultProcesses(),
    equipmentBySection: defaultEquipmentBySection(LOAF_SECTION_IDS),
  },
  {
    id: 'line-buns',
    name: 'Buns Line',
    capacityProfile: [],
    processes: [],
    equipmentBySection: {},
  },
];

function loadLines() {
  try {
    const raw = localStorage.getItem(LINES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(normalizeLine);
    }
  } catch (_) {}
  try {
    const defaultNormalized = DEFAULT_LINES.map(normalizeLine);
    localStorage.setItem(LINES_STORAGE_KEY, JSON.stringify(defaultNormalized));
    return defaultNormalized;
  } catch (_) {}
  return DEFAULT_LINES.map(normalizeLine);
}

let lines = loadLines();

function persist() {
  try {
    localStorage.setItem(LINES_STORAGE_KEY, JSON.stringify(lines));
  } catch (_) {}
}

export function getLines() {
  return lines.map((l) => normalizeLine(l));
}

export function getLineById(id) {
  const line = lines.find((l) => l.id === id);
  return line ? normalizeLine(line) : null;
}

export function getLoafLine() {
  const loaf = lines.find((l) => l.id === 'line-loaf' || l.name === 'Loaf Line');
  return loaf ? normalizeLine(loaf) : null;
}

export function addLine(name) {
  const id = `line-${String(name).replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
  const newLine = normalizeLine({
    id,
    name: String(name || 'New Line').trim(),
    capacityProfile: [],
    processes: [],
    equipmentByProcess: {},
  });
  lines = [...lines, newLine];
  persist();
  return newLine;
}

export function deleteLine(id) {
  if (lines.length <= 1) return;
  lines = lines.filter((l) => l.id !== id);
  persist();
}

export function setLines(next) {
  if (!Array.isArray(next)) return;
  lines = next.map((l) => normalizeLine(l));
  persist();
}

export function updateLine(id, updates) {
  const idx = lines.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  const current = lines[idx];
  const next = normalizeLine({
    ...current,
    ...updates,
    id: current.id,
    capacityProfile: updates.capacityProfile !== undefined ? updates.capacityProfile : current.capacityProfile,
    processes: updates.processes !== undefined ? updates.processes : current.processes,
    equipmentByProcess: updates.equipmentByProcess !== undefined ? updates.equipmentByProcess : current.equipmentByProcess,
  });
  lines = [...lines.slice(0, idx), next, ...lines.slice(idx + 1)];
  persist();
  return next;
}

export function getEquipmentForLine(lineId, sectionId) {
  const line = lines.find((l) => l.id === lineId);
  if (!line) return [];
  const byProcess = line.equipmentByProcess || {};
  const arr = byProcess[sectionId];
  return Array.isArray(arr) ? [...arr] : [];
}

export function setEquipmentForSection(lineId, sectionId, equipmentList) {
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return;
  const line = { ...lines[idx] };
  line.equipmentByProcess = { ...(line.equipmentByProcess || {}) };
  line.equipmentByProcess[sectionId] = Array.isArray(equipmentList) ? equipmentList.map((e) => ({ ...e })) : [];
  lines = [...lines.slice(0, idx), line, ...lines.slice(idx + 1)];
  persist();
}

export function addEquipmentItem(lineId, sectionId, item) {
  const line = lines.find((l) => l.id === lineId);
  if (!line) return;
  const eq = (line.equipmentByProcess && line.equipmentByProcess[sectionId]) || [];
  const newItem = {
    id: item?.id || `eq-${sectionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: item?.name ?? 'Unnamed',
    ...item,
  };
  setEquipmentForSection(lineId, sectionId, [...eq, newItem]);
}

export function updateEquipmentItem(lineId, sectionId, itemId, updates) {
  const line = lines.find((l) => l.id === lineId);
  if (!line || !line.equipmentByProcess) return null;
  const arr = line.equipmentByProcess[sectionId];
  if (!Array.isArray(arr)) return null;
  const idx = arr.findIndex((e) => e.id === itemId);
  if (idx === -1) return null;
  const nextArr = [...arr];
  nextArr[idx] = { ...nextArr[idx], ...updates };
  setEquipmentForSection(lineId, sectionId, nextArr);
  return nextArr[idx];
}

export function deleteEquipmentItem(lineId, sectionId, itemId) {
  const line = lines.find((l) => l.id === lineId);
  if (!line || !line.equipmentByProcess) return;
  const arr = (line.equipmentByProcess[sectionId] || []).filter((e) => e.id !== itemId);
  setEquipmentForSection(lineId, sectionId, arr);
}

// ----- Capacity profile per line -----
export function getCapacityProfileForLine(lineId) {
  const line = lines.find((l) => l.id === lineId);
  return line && Array.isArray(line.capacityProfile) ? line.capacityProfile.map((e) => ({ ...e })) : [];
}

export function setCapacityProfileForLine(lineId, entries) {
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return;
  const line = { ...lines[idx] };
  line.capacityProfile = Array.isArray(entries) ? entries.map((e) => ({
    id: e.id || `cap-${Date.now()}`,
    capacityName: String(e.capacityName ?? '').trim(),
    productName: String(e.productName ?? '').trim(),
    capacity: Number(e.capacity) || 0,
  })) : [];
  lines = [...lines.slice(0, idx), line, ...lines.slice(idx + 1)];
  persist();
}

export function addCapacityEntryForLine(lineId, entry) {
  const line = lines.find((l) => l.id === lineId);
  if (!line) return null;
  const newEntry = {
    id: entry?.id || `cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    capacityName: String(entry?.capacityName ?? '').trim(),
    productName: String(entry?.productName ?? '').trim(),
    capacity: Number(entry?.capacity) || 0,
  };
  const nextProfile = [...(line.capacityProfile || []), newEntry];
  setCapacityProfileForLine(lineId, nextProfile);
  return newEntry;
}

export function updateCapacityEntryForLine(lineId, entryId, updates) {
  const line = lines.find((l) => l.id === lineId);
  if (!line || !Array.isArray(line.capacityProfile)) return null;
  const profile = line.capacityProfile.map((e) => (e.id === entryId ? { ...e, ...updates } : e));
  setCapacityProfileForLine(lineId, profile);
  return profile.find((e) => e.id === entryId) ?? null;
}

export function deleteCapacityEntryForLine(lineId, entryId) {
  const line = lines.find((l) => l.id === lineId);
  if (!line || !Array.isArray(line.capacityProfile)) return;
  setCapacityProfileForLine(lineId, line.capacityProfile.filter((e) => e.id !== entryId));
}

/** Resolve capacity by product name for a given line (used by Scheduling via Loaf Line). */
export function getCapacityForProductFromLine(lineId, productName) {
  if (!productName || typeof productName !== 'string') return null;
  const profile = getCapacityProfileForLine(lineId);
  const exact = profile.find((e) => e.productName === productName.trim());
  if (exact != null) return exact.capacity;
  const trimmed = productName.trim();
  if (trimmed.endsWith('8s')) {
    const e = profile.find((x) => x.productName?.endsWith('8s') || x.capacityName === '8s');
    return e != null ? e.capacity : 2340;
  }
  if (trimmed.endsWith('12s')) {
    const e = profile.find((x) => x.productName?.endsWith('12s') || x.capacityName === '12s');
    return e != null ? e.capacity : 1575;
  }
  return null;
}

// ----- Processes per line -----
export function getProcessesForLine(lineId) {
  const line = lines.find((l) => l.id === lineId);
  return line && Array.isArray(line.processes) ? [...line.processes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];
}

export function addProcess(lineId, name) {
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return null;
  const line = lines[idx];
  const processes = [...(line.processes || [])];
  const order = processes.length;
  const id = `proc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  processes.push({ id, name: String(name || 'Process').trim(), order });
  const equipmentByProcess = { ...(line.equipmentByProcess || {}), [id]: [] };
  updateLine(lineId, { processes, equipmentByProcess });
  return { id, name: processes[processes.length - 1].name, order };
}

export function updateProcess(lineId, processId, updates) {
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return null;
  const line = lines[idx];
  const processes = (line.processes || []).map((p) => (p.id === processId ? { ...p, ...updates } : p));
  updateLine(lineId, { processes });
  return processes.find((p) => p.id === processId) ?? null;
}

export function deleteProcess(lineId, processId) {
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return;
  const line = lines[idx];
  const processes = (line.processes || []).filter((p) => p.id !== processId);
  const equipmentByProcess = { ...(line.equipmentByProcess || {}) };
  delete equipmentByProcess[processId];
  updateLine(lineId, { processes, equipmentByProcess });
}

export { LINES_STORAGE_KEY, LOAF_SECTION_IDS };
