/**
 * Production lines store: full CRUD for production lines.
 * Each line has: capacityProfile (Capacity Name + Product + capacity), processes (CRUD), equipment per process (CRUD).
 * Used by Production page; Scheduling/Dashboard resolve capacity via Loaf Line (see capacityProfileStore).
 */
import { isSupabaseConfigured } from '../lib/supabase';
import { updateConfig } from '../api/config';

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
  { id: 'cap-8s', capacityName: '8s', productName: 'Everyday Bread 8s', capacity: 2340, yield: 1092, doughWeightKg: 275, totalDoughWeightKg: 505.31, gramsPerUnit: 1000 },
  { id: 'cap-12s', capacityName: '12s', productName: 'Everyday Bread 12s', capacity: 1575, yield: 728, doughWeightKg: 275, totalDoughWeightKg: 505.31, gramsPerUnit: 1000 },
];

function normalizeLine(l) {
  const profileTags = Array.isArray(l.profileTags)
    ? l.profileTags.map((t) => String(t ?? '').trim()).filter(Boolean)
    : [];
  const capacityProfile = Array.isArray(l.capacityProfile)
    ? l.capacityProfile.map((e) => ({
        id: e.id || `cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        capacityName: String(e.capacityName ?? e.productOrType ?? '').trim(),
        productName: String(e.productName ?? '').trim(),
        capacity: Number(e.capacity) || 0,
        yield: e.yield !== undefined ? Number(e.yield) : null,
        doughWeightKg: e.doughWeightKg !== undefined ? Number(e.doughWeightKg) : null,
        totalDoughWeightKg: e.totalDoughWeightKg !== undefined ? Number(e.totalDoughWeightKg) : null,
        gramsPerUnit: e.gramsPerUnit !== undefined ? Number(e.gramsPerUnit) : null,
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
  const equipmentMinutesByProcess = l.equipmentMinutesByProcess && typeof l.equipmentMinutesByProcess === 'object' ? { ...l.equipmentMinutesByProcess } : {};
  const processTimesByProcess = l.processTimesByProcess && typeof l.processTimesByProcess === 'object' ? { ...l.processTimesByProcess } : {};
  // Mixing profiles per process: each profile has equipment, equipmentMinutes, processTimes. Migrate legacy data into one profile if needed.
  let mixingProfilesByProcess = l.mixingProfilesByProcess && typeof l.mixingProfilesByProcess === 'object' ? { ...l.mixingProfilesByProcess } : {};
  Object.keys(mixingProfilesByProcess).forEach((procId) => {
    const list = mixingProfilesByProcess[procId];
    mixingProfilesByProcess[procId] = Array.isArray(list)
      ? list.map((mp) => ({
          id: mp.id || `mp-${procId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          tag: mp.tag !== undefined && mp.tag !== null ? String(mp.tag).trim() : '',
          equipment: Array.isArray(mp.equipment)
            ? mp.equipment.map((e, idx) => ({
                id: e.id,
                name: String(e.name ?? '').trim(),
                order: e.order !== undefined && e.order !== null && !Number.isNaN(Number(e.order)) ? Number(e.order) : (idx + 1),
                isPipelineStagger: Boolean(e.isPipelineStagger),
                isBreakpoint: Boolean(e.isBreakpoint),
              }))
            : [],
          equipmentMinutes: mp.equipmentMinutes && typeof mp.equipmentMinutes === 'object' ? { ...mp.equipmentMinutes } : {},
          processTimes: Array.isArray(mp.processTimes)
            ? mp.processTimes.map((pt) => ({
                id: pt.id || `pt-${Date.now()}`,
                name: String(pt.name ?? '').trim(),
                minutes: Number(pt.minutes) || 0,
                order: pt.order !== undefined && pt.order !== null && !Number.isNaN(Number(pt.order)) ? Number(pt.order) : null,
                isPipelineStagger: Boolean(pt.isPipelineStagger),
                isBreakpoint: Boolean(pt.isBreakpoint),
              }))
            : [],
        }))
      : [];
  });
  // If a profile has processTimes without explicit ordering, assign them after equipment (or after max order).
  Object.keys(mixingProfilesByProcess).forEach((procId) => {
    const list = mixingProfilesByProcess[procId];
    if (!Array.isArray(list)) return;
    mixingProfilesByProcess[procId] = list.map((mp) => {
      const equipment = Array.isArray(mp.equipment) ? mp.equipment.map((e) => ({ ...e })) : [];
      const pts = Array.isArray(mp.processTimes) ? mp.processTimes.map((p) => ({ ...p })) : [];
      const maxEqOrder = equipment.reduce((m, e) => Math.max(m, Number(e.order) || 0), 0);
      let next = Math.max(1, maxEqOrder + 1);
      const hasAnyPtOrder = pts.some((p) => p.order !== null && p.order !== undefined);
      if (!hasAnyPtOrder) {
        for (let i = 0; i < pts.length; i++) {
          pts[i].order = next++;
        }
      } else {
        // Fill missing with increasing orders after current max.
        const maxExisting = Math.max(
          maxEqOrder,
          pts.reduce((m, p) => Math.max(m, Number(p.order) || 0), 0),
        );
        next = maxExisting + 1;
        for (let i = 0; i < pts.length; i++) {
          if (pts[i].order === null || pts[i].order === undefined || Number.isNaN(Number(pts[i].order))) {
            pts[i].order = next++;
          }
        }
      }
      return { ...mp, equipment, processTimes: pts };
    });
  });
  // Migration rule: if no explicit pipeline-stagger is set, treat a legacy-named "Gap" as the pipeline stagger.
  Object.keys(mixingProfilesByProcess).forEach((procId) => {
    const list = mixingProfilesByProcess[procId];
    if (!Array.isArray(list)) return;
    mixingProfilesByProcess[procId] = list.map((mp) => {
      const eq = Array.isArray(mp.equipment) ? mp.equipment.map((x) => ({ ...x })) : [];
      const pts = Array.isArray(mp.processTimes) ? mp.processTimes.map((x) => ({ ...x })) : [];
      const hasExplicit = pts.some((pt) => pt.isPipelineStagger) || eq.some((e) => e.isPipelineStagger);
      if (hasExplicit) return mp;
      const idxGap = pts.findIndex((pt) => String(pt.name || '').trim().toLowerCase() === 'gap');
      if (idxGap === -1) return mp;
      pts[idxGap] = { ...pts[idxGap], isPipelineStagger: true };
      return { ...mp, equipment: eq, processTimes: pts };
    });
  });
  // Migration: if a process has equipment/processTimes but no mixing profiles, create one profile from current data
  const procList = processes;
  procList.forEach((p) => {
    const pid = p.id;
    const eqFromSection = equipmentByProcessFinal[pid]?.length > 0 ? equipmentByProcessFinal[pid] : [];
    const eqMinutes = equipmentMinutesByProcess[pid] || {};
    const ptList = processTimesByProcess[pid] || [];
    const hasLegacy = eqFromSection.length > 0 || Object.keys(eqMinutes).length > 0 || ptList.length > 0;
    const hasProfiles = Array.isArray(mixingProfilesByProcess[pid]) && mixingProfilesByProcess[pid].length > 0;
    if (hasLegacy && !hasProfiles) {
      const equipment = eqFromSection.length > 0
        ? eqFromSection.map((e) => ({ id: e.id, name: e.name ?? '' }))
        : Object.keys(eqMinutes).map((machineId) => ({ id: machineId, name: 'Unknown' }));
      mixingProfilesByProcess = { ...mixingProfilesByProcess, [pid]: [{
        id: `mp-${pid}-${Date.now()}-migrated`,
        equipment,
        equipmentMinutes: { ...eqMinutes },
        processTimes: ptList.map((x) => ({ id: x.id, name: x.name ?? '', minutes: Number(x.minutes) || 0 })),
      }] };
    }
    if (!Array.isArray(mixingProfilesByProcess[pid])) mixingProfilesByProcess = { ...mixingProfilesByProcess, [pid]: [] };
  });
  return {
    id: l.id,
    name: String(l.name || '').trim(),
    profileTags,
    capacityProfile,
    processes,
    equipmentByProcess: equipmentByProcessFinal,
    equipmentMinutesByProcess,
    processTimesByProcess,
    mixingProfilesByProcess,
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
  if (isSupabaseConfigured()) {
    // Fire-and-forget; latest lines are stored under config key "lines".
    updateConfig('lines', { lines });
  }
}

/** Hydrate production lines from Supabase config payload (array of raw line objects). */
export function hydrateLinesFromApi(list) {
  if (!Array.isArray(list) || list.length === 0) return;
  lines = list.map((l) => normalizeLine(l));
  persist();
}

/** Serialize current lines for pushing to Supabase config. */
export function getLinesPayloadForApi() {
  return lines.map((l) => normalizeLine(l));
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
    equipmentMinutesByProcess: updates.equipmentMinutesByProcess !== undefined ? updates.equipmentMinutesByProcess : current.equipmentMinutesByProcess,
    processTimesByProcess: updates.processTimesByProcess !== undefined ? updates.processTimesByProcess : current.processTimesByProcess,
    mixingProfilesByProcess: updates.mixingProfilesByProcess !== undefined ? updates.mixingProfilesByProcess : current.mixingProfilesByProcess,
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
    yield: e.yield !== undefined ? Number(e.yield) : null,
    doughWeightKg: e.doughWeightKg !== undefined ? Number(e.doughWeightKg) : null,
    totalDoughWeightKg: e.totalDoughWeightKg !== undefined ? Number(e.totalDoughWeightKg) : null,
    gramsPerUnit: e.gramsPerUnit !== undefined ? Number(e.gramsPerUnit) : null,
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
    yield: entry?.yield !== undefined ? Number(entry.yield) : null,
    doughWeightKg: entry?.doughWeightKg !== undefined ? Number(entry.doughWeightKg) : null,
    totalDoughWeightKg: entry?.totalDoughWeightKg !== undefined ? Number(entry.totalDoughWeightKg) : null,
    gramsPerUnit: entry?.gramsPerUnit !== undefined ? Number(entry.gramsPerUnit) : null,
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

/** Update all capacity profile entries that reference a product by its previous name (e.g. after renaming a recipe). */
export function updateProductNameInCapacityProfiles(oldName, newName) {
  const oldTrimmed = (oldName || '').trim();
  const newTrimmed = (newName || '').trim();
  if (!oldTrimmed || oldTrimmed === newTrimmed) return;
  getLines().forEach((line) => {
    const profile = getCapacityProfileForLine(line.id);
    const updated = profile.map((e) =>
      (e.productName || '').trim() === oldTrimmed ? { ...e, productName: newTrimmed } : e
    );
    if (updated.some((e, i) => (e.productName || '').trim() !== (profile[i].productName || '').trim())) {
      setCapacityProfileForLine(line.id, updated);
    }
  });
}

/** Resolve capacity (pieces) by product name for a given line (used by Scheduling via Loaf Line). */
export function getCapacityForProductFromLine(lineId, productName) {
  const entry = getCapacityEntryForProduct(lineId, productName);
  if (entry != null) return entry.capacity;
  const trimmed = (productName || '').trim();
  if (trimmed.endsWith('8s')) return 2340;
  if (trimmed.endsWith('12s')) return 1575;
  return null;
}

/** Resolve capacity entry (capacity + doughWeightKg) by product name for a given line. */
export function getCapacityEntryForProduct(lineId, productName) {
  if (!productName || typeof productName !== 'string') return null;
  const profile = getCapacityProfileForLine(lineId);
  const exact = profile.find((e) => e.productName === productName.trim());
  if (exact != null) return exact;
  const trimmed = productName.trim();
  if (trimmed.endsWith('8s')) {
    const e = profile.find((x) => x.productName?.endsWith('8s') || x.capacityName === '8s');
    return e != null ? e : null;
  }
  if (trimmed.endsWith('12s')) {
    const e = profile.find((x) => x.productName?.endsWith('12s') || x.capacityName === '12s');
    return e != null ? e : null;
  }
  return null;
}

/** Resolve dough weight (kg) by product name for a given line. */
export function getDoughWeightKgForProductFromLine(lineId, productName) {
  const entry = getCapacityEntryForProduct(lineId, productName);
  return entry?.doughWeightKg != null ? entry.doughWeightKg : null;
}

/** Resolve yield (pieces per one dough batch, e.g. 1092 for 8s) by product name for a given line. */
export function getYieldForProductFromLine(lineId, productName) {
  const entry = getCapacityEntryForProduct(lineId, productName);
  return entry?.yield != null ? entry.yield : null;
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
  const equipmentMinutesByProcess = { ...(line.equipmentMinutesByProcess || {}) };
  delete equipmentMinutesByProcess[processId];
  const processTimesByProcess = { ...(line.processTimesByProcess || {}) };
  delete processTimesByProcess[processId];
  const mixingProfilesByProcess = { ...(line.mixingProfilesByProcess || {}) };
  delete mixingProfilesByProcess[processId];
  updateLine(lineId, { processes, equipmentByProcess, equipmentMinutesByProcess, processTimesByProcess, mixingProfilesByProcess });
}

/** Get duration in minutes for a machine assigned to a line+process. */
export function getEquipmentMinutes(lineId, processId, machineId) {
  const line = lines.find((l) => l.id === lineId);
  if (!line || !line.equipmentMinutesByProcess) return null;
  const byProcess = line.equipmentMinutesByProcess[processId];
  if (!byProcess || typeof byProcess !== 'object') return null;
  const v = byProcess[machineId];
  return v !== undefined && v !== null && !Number.isNaN(Number(v)) ? Number(v) : null;
}

/** Set duration in minutes for a machine assigned to a line+process. Pass null to clear. */
export function setEquipmentMinutes(lineId, processId, machineId, minutes) {
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return;
  const line = { ...lines[idx] };
  line.equipmentMinutesByProcess = { ...(line.equipmentMinutesByProcess || {}) };
  line.equipmentMinutesByProcess[processId] = { ...(line.equipmentMinutesByProcess[processId] || {}) };
  if (minutes === null || minutes === undefined || minutes === '') {
    delete line.equipmentMinutesByProcess[processId][machineId];
  } else {
    line.equipmentMinutesByProcess[processId][machineId] = Number(minutes);
  }
  lines = [...lines.slice(0, idx), line, ...lines.slice(idx + 1)];
  persist();
}

/** Get process times (name + minutes) for a line+process. */
export function getProcessTimesForProcess(lineId, processId) {
  const line = lines.find((l) => l.id === lineId);
  if (!line || !line.processTimesByProcess) return [];
  const arr = line.processTimesByProcess[processId];
  return Array.isArray(arr) ? arr.map((e) => ({ ...e })) : [];
}

/** Add a process time (name + minutes) for a line+process. */
export function addProcessTime(lineId, processId, entry) {
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return null;
  const line = { ...lines[idx] };
  line.processTimesByProcess = { ...(line.processTimesByProcess || {}) };
  const list = [...(line.processTimesByProcess[processId] || [])];
  const newEntry = {
    id: entry?.id || `pt-${processId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(entry?.name ?? '').trim(),
    minutes: entry?.minutes !== undefined && entry?.minutes !== '' && !Number.isNaN(Number(entry.minutes)) ? Number(entry.minutes) : 0,
  };
  list.push(newEntry);
  line.processTimesByProcess[processId] = list;
  lines = [...lines.slice(0, idx), line, ...lines.slice(idx + 1)];
  persist();
  return newEntry;
}

/** Update a process time entry. */
export function updateProcessTime(lineId, processId, processTimeId, updates) {
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return null;
  const line = { ...lines[idx] };
  const list = line.processTimesByProcess?.[processId];
  if (!Array.isArray(list)) return null;
  const i = list.findIndex((e) => e.id === processTimeId);
  if (i === -1) return null;
  line.processTimesByProcess = { ...(line.processTimesByProcess || {}) };
  const nextList = [...list];
  nextList[i] = {
    ...nextList[i],
    ...updates,
    name: updates.name !== undefined ? String(updates.name).trim() : nextList[i].name,
    minutes: updates.minutes !== undefined && !Number.isNaN(Number(updates.minutes)) ? Number(updates.minutes) : nextList[i].minutes,
  };
  line.processTimesByProcess[processId] = nextList;
  lines = [...lines.slice(0, idx), line, ...lines.slice(idx + 1)];
  persist();
  return nextList[i];
}

/** Delete a process time entry. */
export function deleteProcessTime(lineId, processId, processTimeId) {
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return;
  const line = { ...lines[idx] };
  const list = (line.processTimesByProcess?.[processId] || []).filter((e) => e.id !== processTimeId);
  line.processTimesByProcess = { ...(line.processTimesByProcess || {}) };
  line.processTimesByProcess[processId] = list;
  lines = [...lines.slice(0, idx), line, ...lines.slice(idx + 1)];
  persist();
}

// ----- Mixing profiles (per line, per process) -----
/** Get mixing profiles for a line+process. Each profile has id, equipment, equipmentMinutes, processTimes. */
export function getMixingProfiles(lineId, processId) {
  const line = lines.find((l) => l.id === lineId);
  if (!line || !line.mixingProfilesByProcess) return [];
  const list = line.mixingProfilesByProcess[processId];
  return Array.isArray(list) ? list.map((mp) => ({ ...mp, equipment: [...(mp.equipment || [])], equipmentMinutes: { ...(mp.equipmentMinutes || {}) }, processTimes: (mp.processTimes || []).map((e) => ({ ...e })) })) : [];
}

/** Total minutes for a profile (sum of equipment minutes + process time minutes). Used as profile display name. */
export function getProfileTotalMinutes(lineId, processId, profileId) {
  const line = lines.find((l) => l.id === lineId);
  if (!line || !line.mixingProfilesByProcess) return 0;
  const list = line.mixingProfilesByProcess[processId];
  const profile = Array.isArray(list) ? list.find((mp) => mp.id === profileId) : null;
  if (!profile) return 0;
  let total = 0;
  Object.values(profile.equipmentMinutes || {}).forEach((v) => { if (v != null && !Number.isNaN(Number(v))) total += Number(v); });
  (profile.processTimes || []).forEach((pt) => { total += Number(pt.minutes) || 0; });
  return total;
}

export function addMixingProfile(lineId, processId) {
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return null;
  const line = lines[idx];
  const byProcess = { ...(line.mixingProfilesByProcess || {}) };
  const list = [...(byProcess[processId] || [])];
  const id = `mp-${processId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  list.push({ id, tag: '', equipment: [], equipmentMinutes: {}, processTimes: [] });
  byProcess[processId] = list;
  lines = [...lines.slice(0, idx), { ...line, mixingProfilesByProcess: byProcess }, ...lines.slice(idx + 1)];
  persist();
  return { id };
}

// ----- Profile tags (per production line; assignable to mixing profiles) -----
export function getProfileTagsForLine(lineId) {
  const line = getLineById(lineId);
  return Array.isArray(line?.profileTags) ? [...line.profileTags] : [];
}

export function addProfileTagForLine(lineId, tag) {
  const trimmed = String(tag ?? '').trim();
  if (!trimmed) return null;
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return null;
  const line = lines[idx];
  const current = Array.isArray(line.profileTags) ? line.profileTags.map((t) => String(t ?? '').trim()).filter(Boolean) : [];
  const exists = current.some((t) => t.toLowerCase() === trimmed.toLowerCase());
  if (exists) return trimmed;
  const next = [...current, trimmed];
  updateLine(lineId, { profileTags: next });
  return trimmed;
}

export function setTagForMixingProfile(lineId, processId, profileId, tag) {
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return null;
  const line = lines[idx];
  const byProcess = { ...(line.mixingProfilesByProcess || {}) };
  const list = (byProcess[processId] || []).map((mp) => mp.id === profileId ? { ...mp, tag: String(tag ?? '').trim() } : mp);
  byProcess[processId] = list;
  lines = [...lines.slice(0, idx), { ...line, mixingProfilesByProcess: byProcess }, ...lines.slice(idx + 1)];
  persist();
  const profiles = getMixingProfiles(lineId, processId);
  const p = profiles.find((mp) => mp.id === profileId);
  return p?.tag ?? '';
}

export function getTagForMixingProfile(lineId, processId, profileId) {
  const profiles = getMixingProfiles(lineId, processId);
  return profiles.find((mp) => mp.id === profileId)?.tag ?? '';
}

export function deleteMixingProfile(lineId, processId, profileId) {
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return;
  const line = lines[idx];
  const byProcess = { ...(line.mixingProfilesByProcess || {}) };
  byProcess[processId] = (byProcess[processId] || []).filter((mp) => mp.id !== profileId);
  lines = [...lines.slice(0, idx), { ...line, mixingProfilesByProcess: byProcess }, ...lines.slice(idx + 1)];
  persist();
}

/** Get equipment list for a mixing profile. */
export function getEquipmentForProfile(lineId, processId, profileId) {
  const profiles = getMixingProfiles(lineId, processId);
  const p = profiles.find((mp) => mp.id === profileId);
  return p && Array.isArray(p.equipment) ? p.equipment.map((e) => ({ ...e })) : [];
}

/** Set full equipment list for a profile. */
export function setEquipmentForProfile(lineId, processId, profileId, equipmentList) {
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return;
  const line = lines[idx];
  const byProcess = { ...(line.mixingProfilesByProcess || {}) };
  const list = (byProcess[processId] || []).map((mp) => mp.id === profileId ? {
    ...mp,
    equipment: Array.isArray(equipmentList) ? equipmentList.map((e, idx) => ({
      id: e.id,
      name: e.name ?? '',
      order: e.order !== undefined && e.order !== null && !Number.isNaN(Number(e.order)) ? Number(e.order) : (idx + 1),
      isPipelineStagger: Boolean(e.isPipelineStagger),
      isBreakpoint: Boolean(e.isBreakpoint),
    })) : [],
  } : mp);
  byProcess[processId] = list;
  lines = [...lines.slice(0, idx), { ...line, mixingProfilesByProcess: byProcess }, ...lines.slice(idx + 1)];
  persist();
}

export function addEquipmentItemToProfile(lineId, processId, profileId, item) {
  const profiles = getMixingProfiles(lineId, processId);
  const p = profiles.find((mp) => mp.id === profileId);
  if (!p) return;
  const existingEq = Array.isArray(p.equipment) ? p.equipment : [];
  const existingPts = Array.isArray(p.processTimes) ? p.processTimes : [];
  const maxOrder = Math.max(
    existingEq.reduce((m, e) => Math.max(m, Number(e.order) || 0), 0),
    existingPts.reduce((m, pt) => Math.max(m, Number(pt.order) || 0), 0),
  );
  const eq = [
    ...existingEq,
    {
      id: item?.id ?? item?.name,
      name: String(item?.name ?? 'Unnamed').trim(),
      order: maxOrder + 1,
      isPipelineStagger: false,
      isBreakpoint: false,
    },
  ];
  const idx = lines.findIndex((l) => l.id === lineId);
  const line = lines[idx];
  const byProcess = { ...(line.mixingProfilesByProcess || {}) };
  const list = (byProcess[processId] || []).map((mp) => mp.id === profileId ? { ...mp, equipment: eq } : mp);
  byProcess[processId] = list;
  lines = [...lines.slice(0, idx), { ...line, mixingProfilesByProcess: byProcess }, ...lines.slice(idx + 1)];
  persist();
}

export function updateEquipmentItemInProfile(lineId, processId, profileId, machineId, updates) {
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return null;
  const line = lines[idx];
  const byProcess = { ...(line.mixingProfilesByProcess || {}) };
  const list = (byProcess[processId] || []).map((mp) => {
    if (mp.id !== profileId) return mp;
    const equipment = (mp.equipment || []).map((e) => {
      if (e.id !== machineId) {
        return e;
      }
      return {
        ...e,
        ...updates,
        order: updates?.order !== undefined && updates?.order !== null && !Number.isNaN(Number(updates.order)) ? Number(updates.order) : e.order,
        isPipelineStagger: updates?.isPipelineStagger !== undefined ? Boolean(updates.isPipelineStagger) : Boolean(e.isPipelineStagger),
        isBreakpoint: Boolean(updates?.isBreakpoint ?? e.isBreakpoint),
      };
    });
    return { ...mp, equipment };
  });
  byProcess[processId] = list;
  lines = [...lines.slice(0, idx), { ...line, mixingProfilesByProcess: byProcess }, ...lines.slice(idx + 1)];
  persist();
  const profiles = getMixingProfiles(lineId, processId);
  const p = profiles.find((mp) => mp.id === profileId);
  return p?.equipment?.find((e) => e.id === machineId) ?? null;
}

export function deleteEquipmentItemFromProfile(lineId, processId, profileId, machineId) {
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return;
  const line = lines[idx];
  const byProcess = { ...(line.mixingProfilesByProcess || {}) };
  const list = (byProcess[processId] || []).map((mp) => {
    if (mp.id !== profileId) return mp;
    const equipment = (mp.equipment || []).filter((e) => e.id !== machineId);
    const equipmentMinutes = { ...(mp.equipmentMinutes || {}) };
    delete equipmentMinutes[machineId];
    return { ...mp, equipment, equipmentMinutes };
  });
  byProcess[processId] = list;
  lines = [...lines.slice(0, idx), { ...line, mixingProfilesByProcess: byProcess }, ...lines.slice(idx + 1)];
  persist();
}

export function getEquipmentMinutesForProfile(lineId, processId, profileId, machineId) {
  const profiles = getMixingProfiles(lineId, processId);
  const p = profiles.find((mp) => mp.id === profileId);
  if (!p || !p.equipmentMinutes) return null;
  const v = p.equipmentMinutes[machineId];
  return v !== undefined && v !== null && !Number.isNaN(Number(v)) ? Number(v) : null;
}

export function setEquipmentMinutesForProfile(lineId, processId, profileId, machineId, minutes) {
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return;
  const line = lines[idx];
  const byProcess = { ...(line.mixingProfilesByProcess || {}) };
  const list = (byProcess[processId] || []).map((mp) => {
    if (mp.id !== profileId) return mp;
    const equipmentMinutes = { ...(mp.equipmentMinutes || {}) };
    if (minutes === null || minutes === undefined || minutes === '') delete equipmentMinutes[machineId];
    else equipmentMinutes[machineId] = Number(minutes);
    return { ...mp, equipmentMinutes };
  });
  byProcess[processId] = list;
  lines = [...lines.slice(0, idx), { ...line, mixingProfilesByProcess: byProcess }, ...lines.slice(idx + 1)];
  persist();
}

/** Get process times for a mixing profile. */
export function getProcessTimesForProfile(lineId, processId, profileId) {
  const profiles = getMixingProfiles(lineId, processId);
  const p = profiles.find((mp) => mp.id === profileId);
  return p && Array.isArray(p.processTimes) ? p.processTimes.map((e) => ({ ...e })) : [];
}

/** Check if a process time name is already used in this profile (excluding optional processTimeId when editing). */
export function isProcessTimeNameUsedInProfile(lineId, processId, profileId, name, excludeProcessTimeId = null) {
  const list = getProcessTimesForProfile(lineId, processId, profileId);
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return false;
  return list.some((pt) => pt.id !== excludeProcessTimeId && pt.name.trim() === trimmed);
}

export function addProcessTimeToProfile(lineId, processId, profileId, entry) {
  if (isProcessTimeNameUsedInProfile(lineId, processId, profileId, entry?.name)) return { duplicateName: true };
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return null;
  const line = lines[idx];
  const byProcess = { ...(line.mixingProfilesByProcess || {}) };
  const list = (byProcess[processId] || []).map((mp) => {
    if (mp.id !== profileId) return mp;
    const processTimes = [...(mp.processTimes || [])];
    const equipment = [...(mp.equipment || [])];
    const maxOrder = Math.max(
      equipment.reduce((m, e) => Math.max(m, Number(e.order) || 0), 0),
      processTimes.reduce((m, pt) => Math.max(m, Number(pt.order) || 0), 0),
    );
    const newEntry = {
      id: entry?.id || `pt-${profileId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: String(entry?.name ?? '').trim(),
      minutes: entry?.minutes !== undefined && entry?.minutes !== '' && !Number.isNaN(Number(entry.minutes)) ? Number(entry.minutes) : 0,
      order: entry?.order !== undefined && entry?.order !== null && !Number.isNaN(Number(entry.order)) ? Number(entry.order) : (maxOrder + 1),
      isPipelineStagger: Boolean(entry?.isPipelineStagger),
      isBreakpoint: Boolean(entry?.isBreakpoint),
    };
    return { ...mp, equipment, processTimes: processTimes.concat([newEntry]) };
  });
  byProcess[processId] = list;
  lines = [...lines.slice(0, idx), { ...line, mixingProfilesByProcess: byProcess }, ...lines.slice(idx + 1)];
  persist();
  const profiles = getMixingProfiles(lineId, processId);
  const p = profiles.find((mp) => mp.id === profileId);
  const added = p?.processTimes?.find((e) => e.id === (entry?.id || p.processTimes?.[p.processTimes.length - 1]?.id));
  return added ?? null;
}

export function updateProcessTimeInProfile(lineId, processId, profileId, processTimeId, updates) {
  if (updates.name !== undefined && isProcessTimeNameUsedInProfile(lineId, processId, profileId, updates.name, processTimeId)) return { duplicateName: true };
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return null;
  const line = lines[idx];
  const byProcess = { ...(line.mixingProfilesByProcess || {}) };
  const list = (byProcess[processId] || []).map((mp) => {
    if (mp.id !== profileId) return mp;
    const processTimes = (mp.processTimes || []).map((pt) => {
      if (pt.id !== processTimeId) {
        return pt;
      }
      const next = {
        ...pt,
        ...updates,
        name: updates.name !== undefined ? String(updates.name).trim() : pt.name,
        minutes: updates.minutes !== undefined && !Number.isNaN(Number(updates.minutes)) ? Number(updates.minutes) : pt.minutes,
        order: updates.order !== undefined && updates.order !== null && !Number.isNaN(Number(updates.order)) ? Number(updates.order) : pt.order,
        isBreakpoint: updates.isBreakpoint !== undefined ? Boolean(updates.isBreakpoint) : Boolean(pt.isBreakpoint),
        isPipelineStagger: updates.isPipelineStagger !== undefined ? Boolean(updates.isPipelineStagger) : Boolean(pt.isPipelineStagger),
      };
      return next;
    });
    return { ...mp, processTimes };
  });
  byProcess[processId] = list;
  lines = [...lines.slice(0, idx), { ...line, mixingProfilesByProcess: byProcess }, ...lines.slice(idx + 1)];
  persist();
  const profiles = getMixingProfiles(lineId, processId);
  const p = profiles.find((mp) => mp.id === profileId);
  return p?.processTimes?.find((e) => e.id === processTimeId) ?? null;
}

export function deleteProcessTimeFromProfile(lineId, processId, profileId, processTimeId) {
  const idx = lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return;
  const line = lines[idx];
  const byProcess = { ...(line.mixingProfilesByProcess || {}) };
  const list = (byProcess[processId] || []).map((mp) => mp.id === profileId ? { ...mp, processTimes: (mp.processTimes || []).filter((e) => e.id !== processTimeId) } : mp);
  byProcess[processId] = list;
  lines = [...lines.slice(0, idx), { ...line, mixingProfilesByProcess: byProcess }, ...lines.slice(idx + 1)];
  persist();
}

/** Pipelining stagger minutes: next batch Actual Process Start = previous + this (from explicit per-profile selection). */
export function getStaggerMinutesFromMixingProfiles(profiles) {
  const first = profiles && profiles[0];
  if (!first) return 0;
  const equipment = Array.isArray(first.equipment) ? first.equipment : [];
  const processTimes = Array.isArray(first.processTimes) ? first.processTimes : [];

  const selectedKeys = [];
  for (const e of equipment) if (e?.isPipelineStagger) selectedKeys.push({ kind: 'equipment', id: e.id });
  for (const pt of processTimes) if (pt?.isPipelineStagger) selectedKeys.push({ kind: 'processTime', id: pt.id });
  if (selectedKeys.length === 0) return 0;

  // Build ordered steps across both lists
  const steps = [];
  for (const e of equipment) {
    const mins = first.equipmentMinutes && e?.id != null ? first.equipmentMinutes[e.id] : null;
    steps.push({
      kind: 'equipment',
      id: e.id,
      order: Number(e.order) || null,
      minutes: mins !== undefined && mins !== null && !Number.isNaN(Number(mins)) ? Number(mins) : 0,
    });
  }
  for (const pt of processTimes) {
    steps.push({
      kind: 'processTime',
      id: pt.id,
      order: Number(pt.order) || null,
      minutes: pt.minutes !== undefined && pt.minutes !== null && !Number.isNaN(Number(pt.minutes)) ? Number(pt.minutes) : 0,
    });
  }
  steps.sort((a, b) => {
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    // Stable secondary ordering
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return String(a.id).localeCompare(String(b.id));
  });

  // Rule: stagger = earliest selected breakpoint in sequence.
  // That means: compute cumulative time to each selected step; take the minimum.
  let cumulative = 0;
  const selectedSet = new Set(selectedKeys.map((k) => `${k.kind}:${k.id}`));
  let best = null;
  for (const s of steps) {
    cumulative += Number(s.minutes) || 0;
    if (selectedSet.has(`${s.kind}:${s.id}`)) {
      best = best === null ? cumulative : Math.min(best, cumulative);
    }
  }
  return Math.max(0, best ?? 0);
}
export function getStaggerMinutesForLine(lineId) {
  return getStaggerMinutesFromMixingProfiles(getMixingProfiles(lineId, 'mixing'));
}

export { LINES_STORAGE_KEY, LOAF_SECTION_IDS };
