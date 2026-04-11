import {
  getStageDurationsForProduct as getFromRecipe,
  getStageDurationsForProductOnLine as getFromRecipeOnLine,
  getTotalProcessMinutes as getTotalFromRecipe,
  getTotalProcessMinutesForLine,
  getEndDoughProcessIdForProduct,
} from '../store/recipeStore.js';
import { getProcessesForLine } from '../store/productionLinesStore.js';
import { getStageDurationsForProduct as getFromSku, getTotalProcessMinutes as getTotalFromSku } from '../data/skuProcessDurations.js';

function recipeStagesForProduct(productName, productionLineId) {
  const onLine = productionLineId && getFromRecipeOnLine(productName, productionLineId);
  return onLine || getFromRecipe(productName) || null;
}

function getStageDurationsForProduct(productName, productionLineId) {
  return recipeStagesForProduct(productName, productionLineId) ?? getFromSku(productName);
}

// loaf line process chain — used when we sum minutes up to "end dough" for a given recipe step
const END_DOUGH_ORDER = ['mixing', 'makeup-dividing', 'makeup-panning', 'baking', 'packaging'];
const PROCESS_ID_TO_LEGACY_KEY = {
  'mixing': 'mixing',
  'makeup-dividing': 'makeupDividing',
  'makeup-panning': 'makeupPanning',
  'baking': 'baking',
  'packaging': 'packaging',
};

// Default Production tab names -> canonical id (when line stores proc-* ids but names match loaf stages).
const PROCESS_NAME_TO_LEGACY_ID = {
  mixing: 'mixing',
  'makeup dividing': 'makeup-dividing',
  'makeup panning': 'makeup-panning',
  baking: 'baking',
  packaging: 'packaging',
};

/**
 * Map a line's process tab id to a canonical loaf stage id (`mixing`, `makeup-dividing`, …).
 * Dashboard/PlanTable need this when `addProcess` created opaque ids (`proc-…`) — without it we fall back to
 * raw row.startSponge / row.endDough on every tab (same start; end dough = whole-row field, not stage end).
 */
export function resolveLegacySectionIdForRowContext(sectionId, sortedProcesses) {
  if (sectionId == null || sectionId === '') return null;
  const sid = String(sectionId);

  if (END_DOUGH_ORDER.includes(sid)) return sid;

  const sidLower = sid.toLowerCase();
  const byCase = END_DOUGH_ORDER.find((id) => id.toLowerCase() === sidLower);
  if (byCase) return byCase;

  const list = Array.isArray(sortedProcesses) ? sortedProcesses : [];
  const proc = list.find((p) => p.id === sid);
  if (proc) {
    const n = String(proc.name || '').trim().toLowerCase();
    if (PROCESS_NAME_TO_LEGACY_ID[n]) return PROCESS_NAME_TO_LEGACY_ID[n];
  }

  const idx = list.findIndex((p) => p.id === sid);
  const allIdsOpaque =
    list.length === END_DOUGH_ORDER.length &&
    list.length > 0 &&
    list.every((p) => p?.id && !END_DOUGH_ORDER.includes(String(p.id)));
  if (idx >= 0 && allIdsOpaque) {
    return END_DOUGH_ORDER[idx];
  }
  return null;
}

// running sum of stage minutes through the chosen process — drives "end dough" time on the schedule
function getCumulativeMinutesUpToProcess(stages, processId) {
  const idx = END_DOUGH_ORDER.indexOf(processId);
  if (idx === -1) return stages.mixing ?? 0;
  let sum = 0;
  for (let i = 0; i <= idx; i++) {
    const key = PROCESS_ID_TO_LEGACY_KEY[END_DOUGH_ORDER[i]];
    if (key) sum += (stages[key] ?? 0);
  }
  return sum;
}

function getTotalProcessMinutesForPlanRow(row) {
  if (row?.productionLineId) {
    const t = getTotalProcessMinutesForLine(row.product, row.productionLineId);
    if (t > 0) return t;
  }
  const total = getTotalFromRecipe(row.product);
  if (total > 0) return total;
  return getTotalFromSku(row.product) ?? 0;
}

const DAY_MINUTES = 24 * 60;

export const STAGE_RATIOS = {
  mixing: 0.18,
  makeupDividing: 0.16,
  makeupPanning: 0.18,
  baking: 0.30,
  packaging: 0.18,
};

export function parseTimeToMinutes(str) {
  if (!str || typeof str !== 'string') return 0;
  const [h, m] = str.split(':').map(Number);
  return (h % 24) * 60 + (m || 0);
}

// wall clock add; wraps modulo 24h (we only return HH:MM so "next day" is handled elsewhere via date)
export function addMinutesToTime(timeStr, minutes) {
  const total = parseTimeToMinutes(timeStr) + Number(minutes);
  const normalized = ((total % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const h = Math.floor(normalized / 60) % 24;
  const m = Math.round(normalized % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function computeTotalMinutesForRow(row) {
  const total = getTotalProcessMinutesForPlanRow(row);
  if (total > 0) return total;
  const base = Number(row.procTime);
  if (!Number.isNaN(base) && base > 0) return base;
  const startHM = parseTimeToMinutes(row.startSponge);
  const endHM = parseTimeToMinutes(row.endBatch);
  let endAbs = endHM;
  if (endAbs <= startHM) endAbs += DAY_MINUTES;
  return Math.max(30, endAbs - startHM);
}

export function computeStageDurations(totalMinutes) {
  const total = Math.max(30, Number(totalMinutes) || 0);
  if (!total) {
    return {
      mixing: 0,
      makeupDividing: 0,
      makeupPanning: 0,
      baking: 0,
      packaging: 0,
    };
  }
  const mixing = Math.max(5, Math.round(total * STAGE_RATIOS.mixing));
  const makeupDividing = Math.max(5, Math.round(total * STAGE_RATIOS.makeupDividing));
  const makeupPanning = Math.max(5, Math.round(total * STAGE_RATIOS.makeupPanning));
  const baking = Math.max(5, Math.round(total * STAGE_RATIOS.baking));
  const used = mixing + makeupDividing + makeupPanning + baking;
  const packaging = Math.max(5, total - used);
  return {
    mixing,
    makeupDividing,
    makeupPanning,
    baking,
    packaging,
  };
}

// prefer recipe/SKU table minutes; if product missing, fake it from total time * STAGE_RATIOS
export function computeStageDurationsForRow(row) {
  const sku = getStageDurationsForProduct(row.product, row.productionLineId);
  if (sku) return { ...sku };
  const total = computeTotalMinutesForRow(row);
  return computeStageDurations(total);
}

// endDough depends which process is flagged as "end dough" in the recipe (mixing only vs through panning etc).
// endBatch is start + full pipeline. returns HH:MM; bails to existing row values if totals are garbage
export function recomputeEndTimesForRow(row) {
  const stages = computeStageDurationsForRow(row);
  const total = stages.mixing + stages.makeupDividing + stages.makeupPanning + stages.baking + stages.packaging;
  if (!total || !row.startSponge || typeof row.startSponge !== 'string') {
    return { endDough: row.endDough ?? '00:00', endBatch: row.endBatch ?? '00:00' };
  }
  const rawEndDoughId = getEndDoughProcessIdForProduct(row.product, row.productionLineId);
  // Recipe stores the line’s real tab id (often `proc-*`). Cumulative math only knows canonical loaf ids.
  const sortedProcesses = row.productionLineId
    ? getProcessesForLine(row.productionLineId).map((p, i) => ({
        id: p.id,
        name: p.name,
        order: p.order ?? i,
      }))
    : [];
  let canonEnd = resolveLegacySectionIdForRowContext(rawEndDoughId, sortedProcesses);
  if (canonEnd == null && typeof rawEndDoughId === 'string' && END_DOUGH_ORDER.includes(rawEndDoughId)) {
    canonEnd = rawEndDoughId;
  }
  if (canonEnd == null) {
    canonEnd = 'mixing';
  }
  const endDoughMinutes = getCumulativeMinutesUpToProcess(stages, canonEnd);
  const endDough = addMinutesToTime(row.startSponge, endDoughMinutes);
  const endBatch = addMinutesToTime(row.startSponge, total);
  return { endDough, endBatch };
}

const STAGE_KEYS_ORDERED = ['mixing', 'makeupDividing', 'makeupPanning', 'baking', 'packaging'];

// proc column for a tab: legacy ids (mixing, baking...) map straight to stage minutes.
// custom line process lists that still match the 5 loaf ids in order -> same mapping.
// anything else -> split total time evenly across N processes (best we can do)
export function getProcMinutesForPlanSection(row, sectionId, sortedProcesses) {
  const stages = computeStageDurationsForRow(row);
  const canon = resolveLegacySectionIdForRowContext(sectionId, sortedProcesses);
  const idForLegacy = canon || sectionId;
  const legacyKey = PROCESS_ID_TO_LEGACY_KEY[idForLegacy];
  if (legacyKey) {
    const v = stages[legacyKey];
    return v != null && !Number.isNaN(Number(v)) ? Number(v) : null;
  }

  const list = Array.isArray(sortedProcesses) ? sortedProcesses : [];
  const n = list.length;
  if (n === 0) return null;
  const idx = list.findIndex((p) => p.id === sectionId);
  if (idx < 0) return null;

  const matchesLoafOrder =
    n === END_DOUGH_ORDER.length && list.every((p, i) => p.id === END_DOUGH_ORDER[i]);
  if (matchesLoafOrder) {
    const k = STAGE_KEYS_ORDERED[idx];
    const v = stages[k];
    return v != null && !Number.isNaN(Number(v)) ? Number(v) : null;
  }

  const total =
    STAGE_KEYS_ORDERED.reduce((s, k) => s + (Number(stages[k]) || 0), 0) || computeTotalMinutesForRow(row);
  if (!total) return null;
  return Math.max(1, Math.round(total / n));
}

export function isLegacyProcessSectionId(sectionId, sortedProcesses = null) {
  return resolveLegacySectionIdForRowContext(sectionId, sortedProcesses) != null;
}

export function getProcessWindowStartOffsetMinutes(row, sectionId, sortedProcesses = null) {
  const canon = resolveLegacySectionIdForRowContext(sectionId, sortedProcesses);
  if (!canon) return null;
  const idx = END_DOUGH_ORDER.indexOf(canon);
  if (idx < 0) return null;
  const stages = computeStageDurationsForRow(row);
  let sum = 0;
  for (let i = 0; i < idx; i++) {
    const key = PROCESS_ID_TO_LEGACY_KEY[END_DOUGH_ORDER[i]];
    sum += Number(stages[key]) || 0;
  }
  return sum;
}

export function getProcessWindowEndOffsetMinutes(row, sectionId, sortedProcesses = null) {
  const canon = resolveLegacySectionIdForRowContext(sectionId, sortedProcesses);
  if (!canon) return null;
  const idx = END_DOUGH_ORDER.indexOf(canon);
  if (idx < 0) return null;
  const stages = computeStageDurationsForRow(row);
  let sum = 0;
  for (let i = 0; i <= idx; i++) {
    const key = PROCESS_ID_TO_LEGACY_KEY[END_DOUGH_ORDER[i]];
    sum += Number(stages[key]) || 0;
  }
  return sum;
}

export function getAlignedLegacyProcessProcMinutes(row, sectionId, sortedProcesses = null) {
  const start = getProcessWindowStartOffsetMinutes(row, sectionId, sortedProcesses);
  const end = getProcessWindowEndOffsetMinutes(row, sectionId, sortedProcesses);
  if (start === null || end === null) return null;
  return Math.max(0, Math.round(end - start));
}

// Dashboard / PlanTable: minutes from batch anchor (sponge) to this tab's window [start, end).
// If we can map the tab to the loaf chain, we use recipe stage sums; otherwise we chain in **line process order**
// (whatever the user set on Production) using per-tab minutes from getProcMinutesForPlanSection — no fixed id list required.
export function getProcessTimelineOffsetsMinutes(row, sectionId, sortedProcesses) {
  const list = Array.isArray(sortedProcesses) ? sortedProcesses : [];
  const idx = list.findIndex((p) => p.id === sectionId);
  if (idx < 0) return null;

  const canon = resolveLegacySectionIdForRowContext(sectionId, sortedProcesses);
  if (canon != null) {
    const startOff = getProcessWindowStartOffsetMinutes(row, sectionId, sortedProcesses);
    const endOff = getProcessWindowEndOffsetMinutes(row, sectionId, sortedProcesses);
    if (startOff == null || endOff == null) return null;
    return { startOff, endOff };
  }

  let startOff = 0;
  for (let i = 0; i < idx; i++) {
    const m = getProcMinutesForPlanSection(row, list[i].id, list);
    startOff += Number(m) || 0;
  }
  const selfM = getProcMinutesForPlanSection(row, sectionId, list);
  const self = Number(selfM) || 0;
  return { startOff, endOff: startOff + self };
}

export { DAY_MINUTES };
